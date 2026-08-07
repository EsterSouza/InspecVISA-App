-- P360-010 — Projeção segura do plano de ação.
--
-- O cliente precisa acompanhar as pendências apontadas na inspeção sem nunca tocar em
-- `responses`, em `checklist_items` nem no roteiro. Esta tabela é uma PROJEÇÃO: o staff
-- publica, a partir das NCs do relatório, uma cópia enxuta e revisável do plano de ação.
-- Escrever aqui não altera nada da inspeção; apagar tudo aqui não perde nenhum dado técnico.
--
-- Identidade de um item aberto = (tenant, unidade, requisito de origem). O índice único
-- parcial exclui os resolvidos, então:
--   * republicar o mesmo relatório é idempotente (dá update na mesma linha);
--   * um item que reaparece numa inspeção seguinte atualiza o item aberto e soma ocorrência;
--   * um item já resolvido nunca é sobrescrito — a recorrência nasce como linha nova e o
--     histórico do que foi corrigido continua de pé.

create table if not exists public.client_action_items (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null,
  client_id              uuid not null references public.clients(id) on delete cascade,
  appointment_request_id uuid references public.appointment_requests(id) on delete set null,
  inspection_id          uuid,
  -- Identificador do item do roteiro. Uso interno (dedupe/recorrência); NUNCA sai na RPC do cliente.
  source_item_id         text not null,
  title                  text not null,
  situation              text not null,
  recommended_action     text not null,
  priority               text not null default 'important',
  responsible            text,
  due_date               date,
  status                 text not null default 'published',
  occurrence_count       integer not null default 1,
  first_detected_on      date,
  last_detected_on       date,
  published_at           timestamptz,
  resolved_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint client_action_items_priority_check
    check (priority in ('urgent', 'important', 'recommended')),
  constraint client_action_items_status_check
    check (status in ('hidden', 'published', 'resolved'))
);

create unique index if not exists client_action_items_open_uniq
  on public.client_action_items (tenant_id, client_id, source_item_id)
  where status <> 'resolved';

create index if not exists client_action_items_client_idx
  on public.client_action_items (client_id, status, due_date);

create index if not exists client_action_items_request_idx
  on public.client_action_items (appointment_request_id);

alter table public.client_action_items enable row level security;

-- Tabela nova no `public` nasce com ALL para anon/authenticated por causa dos default
-- privileges do Supabase; o revoke tem de ser explícito. Ver PROD-01.
revoke all on table public.client_action_items from public;
revoke all on table public.client_action_items from anon;
revoke all on table public.client_action_items from authenticated;
grant select on table public.client_action_items to authenticated;

-- Staff só lê direto: publicar, ocultar, reabrir e resolver passam pelas RPCs abaixo, que
-- mantêm os carimbos de tempo e a contagem de ocorrências consistentes.
drop policy if exists "staff reads action items" on public.client_action_items;
create policy "staff reads action items"
  on public.client_action_items for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Sem policy para anon: o cliente enxerga a projeção apenas por
-- public.client_portal_action_items, que valida o token da conta e o vínculo com a unidade.

-- ─── Publicação da projeção (staff) ────────────────────────────────────────────

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
      due_date = excluded.due_date,
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

-- ─── Publicar / ocultar / resolver / reabrir (staff) ───────────────────────────

create or replace function public.admin_set_client_action_item_status(
  p_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.client_action_items%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if v_status not in ('published', 'hidden', 'resolved') then
    return jsonb_build_object('error', 'situacao invalida');
  end if;

  select * into v_item
  from public.client_action_items
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'item invalido');
  end if;

  if not private.is_tenant_staff(v_item.tenant_id) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  update public.client_action_items
  set
    status = v_status,
    published_at = case when v_status = 'published' then coalesce(published_at, now()) else published_at end,
    resolved_at = case when v_status = 'resolved' then coalesce(resolved_at, now()) end,
    updated_at = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'status', v_status);
exception
  when unique_violation then
    -- Reabrir um item resolvido enquanto já existe outro aberto para o mesmo requisito.
    return jsonb_build_object('error', 'ja existe um item aberto para este requisito');
end;
$function$;

revoke all on function public.admin_set_client_action_item_status(uuid, text) from public;
revoke all on function public.admin_set_client_action_item_status(uuid, text) from anon;
grant execute on function public.admin_set_client_action_item_status(uuid, text) to authenticated;

-- ─── Leitura pelo cliente (token da conta) ─────────────────────────────────────

create or replace function public.client_portal_action_items(
  p_token uuid,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_today date;
  v_items jsonb;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  if p_client_id is not null and not exists (
    select 1
    from public.client_portal_account_clients ac
    join public.clients c
      on c.id = ac.client_id
     and c.tenant_id = v_account.tenant_id
     and c.deleted_at is null
    where ac.account_id = v_account.id
      and ac.client_id = p_client_id
  ) then
    return jsonb_build_object('error', 'unidade fora do acesso');
  end if;

  -- Prazo vencido é sempre "hoje no Brasil": o servidor roda em UTC e, entre 21h e 24h BRT,
  -- comparar com a data UTC marcaria como vencido um item que ainda vence hoje.
  v_today := (now() at time zone 'America/Sao_Paulo')::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cai.id,
        'client_id', cai.client_id,
        'unit_name', c.name,
        'title', cai.title,
        'situation', cai.situation,
        'recommended_action', cai.recommended_action,
        'priority', cai.priority,
        'responsible', cai.responsible,
        'due_date', cai.due_date,
        'status', cai.status,
        'is_overdue', cai.status = 'published' and cai.due_date is not null and cai.due_date < v_today,
        'occurrence_count', cai.occurrence_count,
        'first_detected_on', cai.first_detected_on,
        'last_detected_on', cai.last_detected_on,
        'resolved_at', cai.resolved_at,
        'visit_token', ar.public_token
      )
      order by
        (cai.status = 'resolved'),
        (cai.due_date is null),
        cai.due_date,
        case cai.priority when 'urgent' then 1 when 'important' then 2 else 3 end,
        cai.title
    ),
    '[]'::jsonb
  )
  into v_items
  from public.client_action_items cai
  join public.client_portal_account_clients ac
    on ac.client_id = cai.client_id
   and ac.account_id = v_account.id
  join public.clients c
    on c.id = cai.client_id
   and c.tenant_id = v_account.tenant_id
   and c.deleted_at is null
  left join public.appointment_requests ar
    on ar.id = cai.appointment_request_id
   and ar.tenant_id = v_account.tenant_id
  where cai.tenant_id = v_account.tenant_id
    and (p_client_id is null or cai.client_id = p_client_id)
    -- Oculto nunca sai. Resolvido só sai se um dia chegou a ser publicado.
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    -- Relatório oculto no portal não vaza item nenhum daquela visita.
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object('items', v_items);
end;
$function$;

revoke all on function public.client_portal_action_items(uuid, uuid) from public;
-- O app usa um cliente Supabase só: se houver sessão de staff no navegador, a RPC pública é
-- chamada como `authenticated`. Os dois papéis precisam do grant.
grant execute on function public.client_portal_action_items(uuid, uuid) to anon;
grant execute on function public.client_portal_action_items(uuid, uuid) to authenticated;
