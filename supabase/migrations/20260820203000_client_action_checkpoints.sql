-- PORT-05 — Os tópicos de uma pendência viram tarefas que o cliente marca uma a uma.
--
-- A consultora escreve a ação corretiva em tópicos ("- Providenciar X" por linha). Até aqui
-- os três viravam um texto só, e o cliente só podia responder "fiz" ou "não fiz" pelo
-- conjunto — mesmo tendo feito dois dos três. Esta tabela guarda cada tópico e o clique do
-- cliente sobre ele.
--
-- **A tarefa mora DENTRO do item, nunca vira linha nova em `client_action_items`.** O
-- requisito continua sendo um: um prazo pactuado, uma prioridade, uma contagem de
-- ocorrências, uma linha para casar reincidência. Espalhar os tópicos em linhas próprias
-- multiplicaria a contagem de pendências do portal e quebraria o `on conflict` que sustenta
-- prazo e recorrência.
--
-- Identidade do tópico = (item, chave do texto). A chave é o texto normalizado, gerada no
-- app pelo mesmo `normalizeRequirementText` que já reencontra a pendência quando o roteiro
-- troca de id. Consequência deliberada: republicar o mesmo apontamento preserva o "já fiz"
-- do cliente, e uma frase reescrita nasce como tarefa nova — texto diferente é outra coisa
-- a fazer.
--
-- Dois estados, não três: marcado (`done_at`) ou não marcado. É um clique, e o que não está
-- verde é o que falta. A declaração de três estados do PORT-03 continua existindo no nível
-- do item, para o cliente explicar o porquê.

create table if not exists public.client_action_checkpoints (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  action_item_id   uuid not null references public.client_action_items(id) on delete cascade,
  -- Texto normalizado do tópico. Chave de deduplicação; nunca sai na RPC do cliente.
  checkpoint_key   text not null,
  ordinal          integer not null default 0,
  text             text not null,
  done_at          timestamptz,
  done_by_name     text,
  done_by_role     text,
  -- Tópico que saiu de uma republicação mas que o cliente já tinha marcado: fica guardado
  -- em vez de ser apagado, e para de aparecer para ele.
  dropped_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists client_action_checkpoints_uniq
  on public.client_action_checkpoints (action_item_id, checkpoint_key);

create index if not exists client_action_checkpoints_item_idx
  on public.client_action_checkpoints (action_item_id, dropped_at, ordinal);

alter table public.client_action_checkpoints enable row level security;

-- Tabela nova no `public` nasce com ALL para anon/authenticated por causa dos default
-- privileges do Supabase; o revoke tem de ser explícito. Ver PROD-01.
revoke all on table public.client_action_checkpoints from public;
revoke all on table public.client_action_checkpoints from anon;
revoke all on table public.client_action_checkpoints from authenticated;
grant select on table public.client_action_checkpoints to authenticated;

drop policy if exists "staff reads action checkpoints" on public.client_action_checkpoints;
create policy "staff reads action checkpoints"
  on public.client_action_checkpoints for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Sem policy para anon: o cliente enxerga os tópicos apenas embutidos nas RPCs de leitura
-- do plano de ação, que validam o token da conta ou o link da visita.

comment on column public.client_action_checkpoints.checkpoint_key is
  'Texto do tópico normalizado (mesma regra de normalizeRequirementText). É a identidade '
  'estável do tópico: preserva o "já fiz" do cliente entre republicações e faz de uma frase '
  'reescrita uma tarefa nova.';
comment on column public.client_action_checkpoints.dropped_at is
  'Tópico que deixou de ser apontado mas que o cliente já havia marcado. Guardado para não '
  'apagar a resposta dele; some da visão do cliente.';

-- ─── Publicação: os tópicos viajam junto com o item ───────────────────────────
--
-- Mesma função do P360-010, agora sincronizando `checkpoints` de cada item. A parte dos
-- itens continua idêntica; o que muda é o laço que vem depois do upsert.

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
  v_ids jsonb := '{}'::jsonb;
  v_item jsonb;
  v_source text;
  v_action_id uuid;
  v_checkpoints jsonb;
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
    returning cai.id, cai.source_item_id, (xmax = 0) as created
  )
  select
    count(*) filter (where created),
    count(*) filter (where not created),
    coalesce(jsonb_object_agg(source_item_id, id), '{}'::jsonb)
  into v_created, v_updated, v_ids
  from upserted;

  -- ── Os tópicos de cada item ──
  for v_item in
    select distinct on (nullif(trim(item ->> 'source_item_id'), '')) item
    from jsonb_array_elements(p_items) as item
    where nullif(trim(item ->> 'source_item_id'), '') is not null
  loop
    v_source := trim(v_item ->> 'source_item_id');
    v_action_id := nullif(v_ids ->> v_source, '')::uuid;
    continue when v_action_id is null;

    v_checkpoints := case
      when jsonb_typeof(v_item -> 'checkpoints') = 'array' then v_item -> 'checkpoints'
      else '[]'::jsonb
    end;

    insert into public.client_action_checkpoints as c (
      tenant_id, action_item_id, checkpoint_key, ordinal, text
    )
    select
      v_request.tenant_id,
      v_action_id,
      nullif(trim(e.value ->> 'key'), ''),
      (e.ordinality)::int,
      nullif(trim(e.value ->> 'text'), '')
    from jsonb_array_elements(v_checkpoints) with ordinality as e(value, ordinality)
    where nullif(trim(e.value ->> 'key'), '') is not null
      and nullif(trim(e.value ->> 'text'), '') is not null
    on conflict (action_item_id, checkpoint_key) do update set
      ordinal = excluded.ordinal,
      text = excluded.text,
      -- Tópico que tinha sido retirado e voltou a ser apontado.
      dropped_at = null,
      updated_at = now();

    -- Tópico que saiu desta publicação e que ninguém marcou: some.
    delete from public.client_action_checkpoints c
    where c.action_item_id = v_action_id
      and c.done_at is null
      and not exists (
        select 1
        from jsonb_array_elements(v_checkpoints) as e
        where nullif(trim(e.value ->> 'key'), '') = c.checkpoint_key
      );

    -- Saiu, mas o cliente já tinha marcado: fica guardado, sem aparecer para ele.
    update public.client_action_checkpoints c
    set dropped_at = now(), updated_at = now()
    where c.action_item_id = v_action_id
      and c.done_at is not null
      and c.dropped_at is null
      and not exists (
        select 1
        from jsonb_array_elements(v_checkpoints) as e
        where nullif(trim(e.value ->> 'key'), '') = c.checkpoint_key
      );
  end loop;

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

-- ─── O clique do cliente, regra única para os dois caminhos ────────────────────

create or replace function private.toggle_action_checkpoint(
  p_checkpoint public.client_action_checkpoints,
  p_item public.client_action_items,
  p_account_id uuid,
  p_source text,
  p_done boolean,
  p_by_name text,
  p_by_role text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_by_name, '')), '');
  v_role text := nullif(btrim(coalesce(p_by_role, '')), '');
  v_at timestamptz := clock_timestamp();
  v_done boolean := coalesce(p_done, false);
begin
  -- Mesma exigência do PORT-03: a conta é da empresa, não da pessoa, e é a pessoa que
  -- responde. No portal isso é pedido uma vez por página, não a cada clique.
  if v_name is null or v_role is null then
    return jsonb_build_object('error', 'informe seu nome e sua funcao');
  end if;

  if p_item.status <> 'published' then
    return jsonb_build_object('error', 'item nao esta aberto');
  end if;

  if p_checkpoint.dropped_at is not null then
    return jsonb_build_object('error', 'tarefa nao esta mais no plano');
  end if;

  update public.client_action_checkpoints
  set done_at = case when v_done then coalesce(done_at, v_at) end,
      done_by_name = case when v_done then left(v_name, 120) end,
      done_by_role = case when v_done then left(v_role, 120) end,
      updated_at = now()
  where id = p_checkpoint.id;

  insert into public.client_portal_audit_events (
    tenant_id, account_id, client_id, appointment_request_id, event_type, payload, user_agent
  ) values (
    p_item.tenant_id,
    p_account_id,
    p_item.client_id,
    p_item.appointment_request_id,
    'action_checkpoint_toggled',
    jsonb_build_object(
      'action_item_id', p_item.id,
      'checkpoint_id', p_checkpoint.id,
      'done', v_done,
      'source', p_source,
      'by_name', left(v_name, 120),
      'by_role', left(v_role, 120)
    ),
    left(nullif(p_user_agent, ''), 500)
  );

  return jsonb_build_object('ok', true, 'done', v_done, 'done_at', case when v_done then v_at end);
end;
$function$;

revoke all on function private.toggle_action_checkpoint(public.client_action_checkpoints, public.client_action_items, uuid, text, boolean, text, text, text) from public;
revoke all on function private.toggle_action_checkpoint(public.client_action_checkpoints, public.client_action_items, uuid, text, boolean, text, text, text) from anon;
revoke all on function private.toggle_action_checkpoint(public.client_action_checkpoints, public.client_action_items, uuid, text, boolean, text, text, text) from authenticated;

-- ─── Pela conta do portal ─────────────────────────────────────────────────────

create or replace function public.client_portal_set_checkpoint_done(
  p_token uuid,
  p_checkpoint_id uuid,
  p_done boolean,
  p_by_name text,
  p_by_role text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_checkpoint public.client_action_checkpoints%rowtype;
  v_item public.client_action_items%rowtype;
  v_report_hidden boolean;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  if not coalesce(
    (private.portal_account_gates(v_account.id) -> 'features' ->> 'action_plan')::boolean,
    true
  ) then
    return jsonb_build_object('error', 'plano de acao indisponivel');
  end if;

  select * into v_checkpoint
  from public.client_action_checkpoints
  where id = p_checkpoint_id
    and tenant_id = v_account.tenant_id;

  if not found then
    return jsonb_build_object('error', 'tarefa invalida');
  end if;

  select * into v_item
  from public.client_action_items
  where id = v_checkpoint.action_item_id;

  if not found then
    return jsonb_build_object('error', 'item invalido');
  end if;

  if not exists (
    select 1
    from public.client_portal_account_clients ac
    join public.clients c
      on c.id = ac.client_id
     and c.tenant_id = v_account.tenant_id
     and c.deleted_at is null
    where ac.account_id = v_account.id
      and ac.client_id = v_item.client_id
  ) then
    return jsonb_build_object('error', 'item fora do acesso');
  end if;

  select coalesce(ar.report_hidden, false) into v_report_hidden
  from public.appointment_requests ar
  where ar.id = v_item.appointment_request_id;

  if coalesce(v_report_hidden, false) then
    return jsonb_build_object('error', 'item nao esta aberto');
  end if;

  return private.toggle_action_checkpoint(
    v_checkpoint, v_item, v_account.id, 'portal_account', p_done, p_by_name, p_by_role, p_user_agent
  );
end;
$function$;

revoke all on function public.client_portal_set_checkpoint_done(uuid, uuid, boolean, text, text, text) from public;
grant execute on function public.client_portal_set_checkpoint_done(uuid, uuid, boolean, text, text, text) to anon;
grant execute on function public.client_portal_set_checkpoint_done(uuid, uuid, boolean, text, text, text) to authenticated;

-- ─── Pelo link aberto do relatório ────────────────────────────────────────────

create or replace function public.public_report_set_checkpoint_done(
  p_visit_token uuid,
  p_checkpoint_id uuid,
  p_done boolean,
  p_by_name text,
  p_by_role text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_checkpoint public.client_action_checkpoints%rowtype;
  v_item public.client_action_items%rowtype;
  v_item_hidden boolean;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null or coalesce(v_visit.report_hidden, false) then
    return jsonb_build_object('error', 'link invalido');
  end if;

  select * into v_checkpoint
  from public.client_action_checkpoints
  where id = p_checkpoint_id
    and tenant_id = v_visit.tenant_id;

  if not found then
    return jsonb_build_object('error', 'tarefa invalida');
  end if;

  select * into v_item
  from public.client_action_items
  where id = v_checkpoint.action_item_id
    -- O link é da unidade daquela visita, e só dela.
    and client_id = v_visit.client_id;

  if not found then
    return jsonb_build_object('error', 'item invalido');
  end if;

  select coalesce(ar.report_hidden, false) into v_item_hidden
  from public.appointment_requests ar
  where ar.id = v_item.appointment_request_id;

  if coalesce(v_item_hidden, false) then
    return jsonb_build_object('error', 'item nao esta aberto');
  end if;

  return private.toggle_action_checkpoint(
    v_checkpoint, v_item, null, 'report_link', p_done, p_by_name, p_by_role, p_user_agent
  );
end;
$function$;

revoke all on function public.public_report_set_checkpoint_done(uuid, uuid, boolean, text, text, text) from public;
grant execute on function public.public_report_set_checkpoint_done(uuid, uuid, boolean, text, text, text) to anon;
grant execute on function public.public_report_set_checkpoint_done(uuid, uuid, boolean, text, text, text) to authenticated;

-- ─── As duas leituras passam a devolver os tópicos ────────────────────────────
--
-- `create or replace` com o mesmo corpo do PORT-03, acrescentando `checkpoints` a cada item.
-- A autorização é a mesma; só a lista de campos muda.

create or replace function public.public_report_action_items(p_visit_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_items jsonb;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null then
    return jsonb_build_object('error', 'link invalido');
  end if;

  if coalesce(v_visit.report_hidden, false) then
    return jsonb_build_object('error', 'relatorio indisponivel');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cai.id,
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
        'resolved_at', cai.resolved_at,
        'evidence_count', coalesce(ev.total, 0),
        'evidence_status', ev.status,
        'evidence_file_name', ev.file_name,
        'evidence_submitted_at', ev.submitted_at,
        'evidence_reviewed_at', ev.reviewed_at,
        'evidence_review_note', ev.review_note,
        'evidence_by_name', ev.submitted_by_name,
        'evidence_by_role', ev.submitted_by_role,
        'client_status', cai.client_status,
        'client_status_note', cai.client_status_note,
        'client_status_at', cai.client_status_at,
        'client_status_by_name', cai.client_status_by_name,
        'client_status_by_role', cai.client_status_by_role,
        'checkpoints', coalesce(cps.list, '[]'::jsonb),
        'accepts_evidence', cai.status = 'published'
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
  left join public.appointment_requests ar
    on ar.id = cai.appointment_request_id
   and ar.tenant_id = cai.tenant_id
  left join lateral (
    select
      (select count(*) from public.client_action_evidence x where x.action_item_id = cai.id) as total,
      e.status, e.file_name, e.submitted_at, e.reviewed_at, e.review_note,
      e.submitted_by_name, e.submitted_by_role
    from public.client_action_evidence e
    where e.action_item_id = cai.id
    order by e.submitted_at desc
    limit 1
  ) ev on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'text', cp.text,
        'ordinal', cp.ordinal,
        'done', cp.done_at is not null,
        'done_at', cp.done_at,
        'done_by_name', cp.done_by_name
      )
      order by cp.ordinal, cp.text
    ) as list
    from public.client_action_checkpoints cp
    where cp.action_item_id = cai.id
      and cp.dropped_at is null
  ) cps on true
  where cai.tenant_id = v_visit.tenant_id
    and cai.client_id = v_visit.client_id
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object(
    'unit_name', (select c.name from public.clients c where c.id = v_visit.client_id),
    'visit_date', v_visit.requested_date,
    'items', v_items
  );
end;
$function$;

revoke all on function public.public_report_action_items(uuid) from public;
grant execute on function public.public_report_action_items(uuid) to anon;
grant execute on function public.public_report_action_items(uuid) to authenticated;

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

  if not coalesce(
    (private.portal_account_gates(v_account.id) -> 'features' ->> 'action_plan')::boolean,
    true
  ) then
    return jsonb_build_object('items', '[]'::jsonb);
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
        'visit_token', ar.public_token,
        'evidence_count', coalesce(ev.total, 0),
        'evidence_status', ev.status,
        'evidence_file_name', ev.file_name,
        'evidence_submitted_at', ev.submitted_at,
        'evidence_reviewed_at', ev.reviewed_at,
        'evidence_review_note', ev.review_note,
        'evidence_by_name', ev.submitted_by_name,
        'evidence_by_role', ev.submitted_by_role,
        'client_status', cai.client_status,
        'client_status_note', cai.client_status_note,
        'client_status_at', cai.client_status_at,
        'client_status_by_name', cai.client_status_by_name,
        'client_status_by_role', cai.client_status_by_role,
        'checkpoints', coalesce(cps.list, '[]'::jsonb),
        'accepts_evidence', cai.status = 'published'
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
  left join lateral (
    select
      (select count(*) from public.client_action_evidence x where x.action_item_id = cai.id) as total,
      e.status, e.file_name, e.submitted_at, e.reviewed_at, e.review_note,
      e.submitted_by_name, e.submitted_by_role
    from public.client_action_evidence e
    where e.action_item_id = cai.id
    order by e.submitted_at desc
    limit 1
  ) ev on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'text', cp.text,
        'ordinal', cp.ordinal,
        'done', cp.done_at is not null,
        'done_at', cp.done_at,
        'done_by_name', cp.done_by_name
      )
      order by cp.ordinal, cp.text
    ) as list
    from public.client_action_checkpoints cp
    where cp.action_item_id = cai.id
      and cp.dropped_at is null
  ) cps on true
  where cai.tenant_id = v_account.tenant_id
    and (p_client_id is null or cai.client_id = p_client_id)
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object('items', v_items);
end;
$function$;

revoke all on function public.client_portal_action_items(uuid, uuid) from public;
grant execute on function public.client_portal_action_items(uuid, uuid) to anon;
grant execute on function public.client_portal_action_items(uuid, uuid) to authenticated;
