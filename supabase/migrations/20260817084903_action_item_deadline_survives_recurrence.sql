-- Prazo de pendência reincidente não reinicia a contagem.
--
-- Até aqui, `due_date = excluded.due_date` fazia a data ser recalculada a cada
-- visita: um item que ganhou 60 dias em junho e reapareceu em agosto voltava a
-- vencer 60 dias depois de agosto. A pendência nunca vencia de verdade, porque a
-- cada visita o relógio começava do zero.
--
-- A data pactuada passa a valer, com três exceções:
--   * não havia data (item sem prazo) — a nova entra;
--   * a data já venceu, ou vence dentro de 7 dias da visita — é hora de
--     repactuar, e a escolha desta visita vale (inclusive "sem prazo");
--   * a nova data é mais curta — encurtar sempre vale, foi decisão da consultora.
--
-- A mesma regra está em `resolveRecurringDueDate` (src/utils/clientActionPlan.ts),
-- que é o que a tela usa para mostrar a data antes de publicar. O front manda a
-- data já resolvida; isto aqui é a garantia de que nenhum outro caminho de
-- publicação reinicia o prazo em silêncio.

create or replace function public.admin_publish_client_action_items(
  p_appointment_request_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.appointment_requests%rowtype;
  v_status text;
  v_detected date;
  v_created integer := 0;
  v_updated integer := 0;
begin
  select * into v_request
  from public.appointment_requests
  where id = p_appointment_request_id;

  if not found then
    return jsonb_build_object('error', 'solicitacao invalida');
  end if;

  if not private.is_tenant_staff(v_request.tenant_id) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  if v_request.client_id is null then
    return jsonb_build_object('error', 'solicitacao sem unidade vinculada');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('error', 'itens invalidos');
  end if;

  -- Relatório oculto no portal: a projeção é criada, mas nasce oculta. A regra de
  -- visibilidade vigente é a do relatório (appointment_requests.report_hidden), e a RPC de
  -- leitura a reaplica em tempo real — ocultar o relatório depois some com os itens junto.
  v_status := case when coalesce(v_request.report_hidden, false) then 'hidden' else 'published' end;
  v_detected := coalesce(
    v_request.requested_date,
    (coalesce(v_request.created_at, now()) at time zone 'America/Sao_Paulo')::date
  );

  with input as (
    select distinct on (source_item_id) *
    from (
      select
        nullif(trim(item ->> 'source_item_id'), '') as source_item_id,
        coalesce(nullif(trim(item ->> 'title'), ''), 'Requisito avaliado') as title,
        coalesce(nullif(trim(item ->> 'situation'), ''), 'Achado registrado durante a visita técnica.') as situation,
        coalesce(
          nullif(trim(item ->> 'recommended_action'), ''),
          'Definir medida corretiva e registrar evidência de conclusão.'
        ) as recommended_action,
        case
          when item ->> 'priority' in ('urgent', 'important', 'recommended') then item ->> 'priority'
          else 'important'
        end as priority,
        nullif(trim(item ->> 'responsible'), '') as responsible,
        case
          when (item ->> 'due_date') ~ '^\d{4}-\d{2}-\d{2}$' then (item ->> 'due_date')::date
        end as due_date
      from jsonb_array_elements(p_items) as item
    ) parsed
    where source_item_id is not null
  ),
  upserted as (
    insert into public.client_action_items as cai (
      tenant_id, client_id, appointment_request_id, inspection_id, source_item_id,
      title, situation, recommended_action, priority, responsible, due_date,
      status, first_detected_on, last_detected_on, published_at
    )
    select
      v_request.tenant_id,
      v_request.client_id,
      v_request.id,
      v_request.inspection_id,
      input.source_item_id,
      input.title,
      input.situation,
      input.recommended_action,
      input.priority,
      input.responsible,
      input.due_date,
      v_status,
      v_detected,
      v_detected,
      case when v_status = 'published' then now() end
    from input
    on conflict (tenant_id, client_id, source_item_id) where status <> 'resolved'
    do update set
      appointment_request_id = excluded.appointment_request_id,
      inspection_id = excluded.inspection_id,
      title = excluded.title,
      situation = excluded.situation,
      recommended_action = excluded.recommended_action,
      priority = excluded.priority,
      responsible = excluded.responsible,
      -- Reincidência não reinicia o prazo: ver o cabeçalho desta migration.
      due_date = case
        when cai.due_date is null then excluded.due_date
        when cai.due_date <= v_detected + 7 then excluded.due_date
        when excluded.due_date is not null and excluded.due_date < cai.due_date then excluded.due_date
        else cai.due_date
      end,
      first_detected_on = least(coalesce(cai.first_detected_on, excluded.first_detected_on), excluded.first_detected_on),
      last_detected_on = greatest(coalesce(cai.last_detected_on, excluded.last_detected_on), excluded.last_detected_on),
      -- Republicar o MESMO relatório não conta ocorrência nova; inspeção diferente conta.
      occurrence_count = cai.occurrence_count
        + case when cai.inspection_id is distinct from excluded.inspection_id then 1 else 0 end,
      -- Status não é sobrescrito: item que a consultora ocultou continua oculto.
      published_at = coalesce(cai.published_at, case when cai.status = 'published' then now() end),
      updated_at = now()
    returning (xmax = 0) as created
  )
  select
    count(*) filter (where created),
    count(*) filter (where not created)
  into v_created, v_updated
  from upserted;

  return jsonb_build_object(
    'ok', true,
    'created', coalesce(v_created, 0),
    'updated', coalesce(v_updated, 0),
    'status', v_status
  );
end;
$function$;

revoke all on function public.admin_publish_client_action_items(uuid, jsonb) from public;
revoke all on function public.admin_publish_client_action_items(uuid, jsonb) from anon;
grant execute on function public.admin_publish_client_action_items(uuid, jsonb) to authenticated;
