-- P360-010 (adendo) — projetar o plano de ação das inspeções que JÁ foram entregues.
--
-- A projeção do P360-010 só nasce quando o app publica um relatório novo. Quem foi
-- inspecionado antes de 07/08/2026 abre o portal e vê a seção vazia — o que é pior do que não
-- ter a seção: dá a entender que não há pendência. Esta função vai buscar as NCs das inspeções
-- já concluídas e as projeta com a MESMA regra do app.
--
-- Três cuidados, porque isto mexe em dado real de cliente:
--
-- 1. **Não é uma migration de dados.** Ela só CRIA a função; nada é escrito ao aplicá-la. Quem
--    escreve é a chamada explícita, e o default é `p_dry_run => true`: sem argumento, a função
--    só conta o que faria.
-- 2. **Reusa `admin_publish_client_action_items`.** Não há um segundo caminho de escrita: a
--    idempotência, a recorrência entre inspeções, o respeito ao item já resolvido e a regra do
--    relatório oculto continuam valendo, e continuam num lugar só.
-- 3. **O roteiro vem congelado.** Peso, criticidade e texto do requisito saem do snapshot que o
--    relatório usou (REF-06), não do roteiro de hoje. Um item reescrito ou arquivado depois da
--    visita não muda a pendência que o cliente recebeu no PDF.

-- ─── Prazo em texto livre → dias corridos ─────────────────────────────────────
--
-- Mesma tabela de conversão de `deadlineToDays` em `src/utils/clientActionPlan.ts`, inclusive
-- no que ela RECUSA: o que não dá para datar ("assim que possível", "30" sem unidade) vira
-- item sem prazo, em vez de ganhar prazo inventado.

create or replace function private.deadline_to_days(p_deadline text)
returns integer
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_text text := lower(btrim(coalesce(p_deadline, '')));
  v_match text[];
  v_amount integer;
begin
  if v_text = '' then
    return null;
  end if;
  if v_text in ('imediato', 'imediata') then
    return 0;
  end if;

  v_match := regexp_match(v_text, '^([0-9]+)\s*(hora|horas|dia|dias|semana|semanas|m[êe]s|meses)$');
  if v_match is null then
    return null;
  end if;

  v_amount := v_match[1]::integer;
  if v_match[2] like 'hora%' then
    return ceil(v_amount / 24.0)::integer;
  elsif v_match[2] like 'semana%' then
    return v_amount * 7;
  elsif v_match[2] like 'm%' then
    return v_amount * 30;
  end if;
  return v_amount;
end;
$function$;

revoke all on function private.deadline_to_days(text) from public;
revoke all on function private.deadline_to_days(text) from anon;
revoke all on function private.deadline_to_days(text) from authenticated;

-- ─── As NCs de uma inspeção, no formato que a publicação espera ───────────────
--
-- Ordem de resolução do TÍTULO, e o porquê de cada degrau:
--   1. snapshot do relatório  — é o que o cliente leu no PDF;
--   2. `checklist_items` vivo — texto legível para item que não está no snapshot;
--   3. `custom_description`   — item avulso, que nunca esteve em roteiro nenhum;
--   4. rótulo genérico        — resposta órfã de item apagado, sem descrição própria.
--
-- A CLASSIFICAÇÃO (urgente/importante/recomendada) segue regra diferente, e essa diferença é
-- deliberada: quando existe snapshot do relatório entregue, só ele vale. Item que não está
-- nele não estava no roteiro daquele relatório, e o cliente foi informado sem severidade — o
-- roteiro de hoje não pode promovê-lo a urgente depois. Só quando a inspeção não tem snapshot
-- nenhum (anterior ao REF-06) o roteiro vivo classifica, porque aí é a única fonte que existe.
--
-- Na SAENS PENA isso valia para 4 itens: o roteiro de hoje os traz como críticos, o relatório
-- entregue não os continha, e sem esta separação o portal mostraria urgência que o PDF não tem.
--
-- Resposta apagada (`deleted_at`) fica de fora: ela não entrou no relatório.

create or replace function private.client_action_items_from_inspection(p_inspection_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  with template as (
    select distinct on (v.inspection_id)
      v.inspection_id,
      v.snapshot_json -> 'reportSnapshot' -> 'template' as tpl
    from public.inspection_report_versions v
    where v.inspection_id = p_inspection_id
      and v.snapshot_json -> 'reportSnapshot' ? 'template'
    order by
      v.inspection_id,
      -- `inspection_report_versions` guarda uma versão por SINCRONIZAÇÃO, não por relatório.
      -- A que vale é a que gerou o PDF entregue (`finalizeReport`): a SAENS PENA tem uma
      -- versão de 06/08 sem finalização, com 89 itens críticos contra 76 na de 19/06 que
      -- virou PDF. Pegar a mais recente classificaria como urgente o que o cliente leu como
      -- importante — o portal contradizendo o relatório na mão dele.
      ((v.snapshot_json ->> 'finalizeReport')::boolean is true) desc,
      v.version desc
  ),
  frozen as (
    select
      it ->> 'id' as item_id,
      nullif(btrim(it ->> 'description'), '') as description,
      case when jsonb_typeof(it -> 'weight') = 'number' then (it ->> 'weight')::numeric else 0 end as weight,
      coalesce((it ->> 'isCritical')::boolean, false) as is_critical
    from template t,
         jsonb_array_elements(t.tpl -> 'sections') as s,
         jsonb_array_elements(s -> 'items') as it
  ),
  base as (
    select
      (i.inspection_date at time zone 'America/Sao_Paulo')::date as visit_date,
      exists (select 1 from frozen) as has_frozen
    from public.inspections i
    where i.id = p_inspection_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_item_id', r.item_id,
        'title', coalesce(
          f.description,
          nullif(btrim(ci.description), ''),
          nullif(btrim(r.custom_description), ''),
          'Requisito avaliado'
        ),
        'situation', coalesce(
          nullif(btrim(r.situation_description), ''),
          'Achado registrado durante a visita técnica.'
        ),
        'recommended_action', coalesce(
          nullif(btrim(r.corrective_action), ''),
          'Definir medida corretiva e registrar evidência de conclusão.'
        ),
        -- Com snapshot entregue, só ele classifica; sem snapshot, o roteiro vivo é a única fonte.
        'priority', case
          when case when b.has_frozen then coalesce(f.is_critical, false) else coalesce(ci.is_critical, false) end
            then 'urgent'
          when case when b.has_frozen then coalesce(f.weight, 0) else coalesce(ci.weight, 0) end >= 5
            then 'important'
          else 'recommended'
        end,
        'responsible', nullif(btrim(r.responsible), ''),
        'due_date', case
          when private.deadline_to_days(r.deadline) is not null
            then to_char(
              coalesce(b.visit_date, (now() at time zone 'America/Sao_Paulo')::date)
                + private.deadline_to_days(r.deadline),
              'YYYY-MM-DD'
            )
        end
      )
    ),
    '[]'::jsonb
  )
  from public.responses r
  left join frozen f on f.item_id = r.item_id
  left join public.checklist_items ci on ci.id::text = r.item_id
  cross join base b
  where r.inspection_id = p_inspection_id
    and r.result = 'not_complies'
    and r.deleted_at is null
    and nullif(btrim(coalesce(r.item_id, '')), '') is not null;
$function$;

revoke all on function private.client_action_items_from_inspection(uuid) from public;
revoke all on function private.client_action_items_from_inspection(uuid) from anon;
revoke all on function private.client_action_items_from_inspection(uuid) from authenticated;

-- ─── O backfill ───────────────────────────────────────────────────────────────
--
-- Sem argumento: relatório do que ACONTECERIA, por visita, sem escrever nada.
--   select public.admin_backfill_client_action_items();
-- Para valer, numa visita só:
--   select public.admin_backfill_client_action_items('<id da visita>', false);
-- Para valer, em todas as visitas com relatório entregue:
--   select public.admin_backfill_client_action_items(null, false);
--
-- Rodar duas vezes não duplica nada: quem escreve é o upsert do P360-010, e a identidade do
-- item aberto é (tenant, unidade, requisito).

create or replace function public.admin_backfill_client_action_items(
  p_appointment_request_id uuid default null,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request record;
  v_items jsonb;
  v_result jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_visits integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  for v_request in
    select ar.id, ar.tenant_id, ar.client_id, ar.inspection_id, ar.unit_name,
           ar.requested_date, ar.report_hidden, c.name as unit
    from public.appointment_requests ar
    join public.clients c on c.id = ar.client_id and c.deleted_at is null
    join public.inspections i on i.id = ar.inspection_id
    where ar.inspection_id is not null
      and ar.client_id is not null
      and ar.appointment_type = 'inspection'
      -- Só o que já foi entregue ao cliente. Inspeção em andamento vira plano de ação quando
      -- o relatório for publicado — antecipar mostraria pendência que ainda pode mudar.
      and i.status = 'completed'
      and i.deleted_at is null
      and (p_appointment_request_id is null or ar.id = p_appointment_request_id)
      and private.is_tenant_staff(ar.tenant_id)
    order by ar.requested_date nulls last
  loop
    v_items := private.client_action_items_from_inspection(v_request.inspection_id);
    v_visits := v_visits + 1;

    if jsonb_array_length(v_items) = 0 then
      v_skipped := v_skipped + 1;
      v_rows := v_rows || jsonb_build_object(
        'appointment_request_id', v_request.id,
        'unit', v_request.unit,
        'requested_date', v_request.requested_date,
        'items', 0,
        'skipped', 'sem nao conformidade'
      );
      continue;
    end if;

    if p_dry_run then
      v_rows := v_rows || jsonb_build_object(
        'appointment_request_id', v_request.id,
        'unit', v_request.unit,
        'requested_date', v_request.requested_date,
        'items', jsonb_array_length(v_items),
        'report_hidden', coalesce(v_request.report_hidden, false)
      );
      continue;
    end if;

    v_result := public.admin_publish_client_action_items(v_request.id, v_items);
    if v_result ? 'error' then
      v_rows := v_rows || jsonb_build_object(
        'appointment_request_id', v_request.id,
        'unit', v_request.unit,
        'error', v_result ->> 'error'
      );
      continue;
    end if;

    v_created := v_created + coalesce((v_result ->> 'created')::integer, 0);
    v_updated := v_updated + coalesce((v_result ->> 'updated')::integer, 0);
    v_rows := v_rows || jsonb_build_object(
      'appointment_request_id', v_request.id,
      'unit', v_request.unit,
      'requested_date', v_request.requested_date,
      'created', (v_result ->> 'created')::integer,
      'updated', (v_result ->> 'updated')::integer,
      'status', v_result ->> 'status'
    );
  end loop;

  return jsonb_build_object(
    'dry_run', coalesce(p_dry_run, true),
    'visits', v_visits,
    'skipped', v_skipped,
    'created', v_created,
    'updated', v_updated,
    'detail', v_rows
  );
end;
$function$;

revoke all on function public.admin_backfill_client_action_items(uuid, boolean) from public;
revoke all on function public.admin_backfill_client_action_items(uuid, boolean) from anon;
grant execute on function public.admin_backfill_client_action_items(uuid, boolean) to authenticated;
