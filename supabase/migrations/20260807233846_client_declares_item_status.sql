-- PORT-03 — O cliente diz em que pé está cada pendência, inclusive quando NÃO fez.
--
-- Lacuna que a Ester apontou: *"não tem onde dizer que a pasta não foi feita"*. Até aqui a única
-- coisa que o cliente podia fazer no plano de ação era anexar arquivo. Quem ainda não corrigiu
-- ficava mudo — e mudo é indistinguível de "não abriu o portal". Para a consultoria isso é a
-- diferença entre um cliente que está providenciando e um que abandonou a pendência.
--
-- Três estados, na linguagem de quem responde:
--   * `done`        — "Já corrigi"        (normalmente vem com evidência anexada)
--   * `in_progress` — "Estou providenciando"
--   * `not_done`    — "Ainda não fiz"     → **exige justificativa**
--
-- A justificativa é obrigatória só no `not_done` de propósito. "Não fiz" sozinho não ajuda
-- ninguém: o que serve para a próxima visita é o motivo (obra parada, fornecedor, custo, espera
-- de terceiro). Nos outros dois o texto é bem-vindo mas não trava o registro, senão o cliente
-- desiste de declarar e volta ao silêncio, que é o problema que este card resolve.
--
-- Assinatura obrigatória, igual ao PORT-02: sem login no link, e mesmo pela conta do portal a
-- conta é da empresa e não da pessoa.
--
-- **Declarar não resolve pendência.** Continua valendo o modelo do P360-010: quem fecha é a
-- consultora, e desde o REL-03 é a vistoria em campo que confirma. Estes campos são a versão do
-- cliente dos fatos, guardada ao lado — nunca por cima — do que a consultoria apurou.

alter table public.client_action_items
  add column if not exists client_status text,
  add column if not exists client_status_note text,
  add column if not exists client_status_at timestamptz,
  add column if not exists client_status_by_name text,
  add column if not exists client_status_by_role text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_action_items_client_status_check') then
    alter table public.client_action_items
      add constraint client_action_items_client_status_check
      check (client_status is null or client_status in ('done', 'in_progress', 'not_done'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'client_action_items_not_done_needs_note') then
    alter table public.client_action_items
      add constraint client_action_items_not_done_needs_note
      check (
        client_status is distinct from 'not_done'
        or nullif(btrim(coalesce(client_status_note, '')), '') is not null
      );
  end if;
end;
$$;

comment on column public.client_action_items.client_status is
  'O que o CLIENTE declarou sobre esta pendência: done / in_progress / not_done. Nulo = ainda '
  'não disse nada. Não confundir com `status`, que é a situação técnica decidida pela '
  'consultoria (PORT-03).';
comment on column public.client_action_items.client_status_note is
  'Justificativa do cliente. Obrigatória quando ele declara `not_done`.';

-- ─── Regra única, dois caminhos ───────────────────────────────────────────────

create or replace function private.declare_action_item_status(
  p_item public.client_action_items,
  p_account_id uuid,
  p_source text,
  p_status text,
  p_note text,
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
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_name text := nullif(btrim(coalesce(p_by_name, '')), '');
  v_role text := nullif(btrim(coalesce(p_by_role, '')), '');
  v_at timestamptz := clock_timestamp();
begin
  if v_status not in ('done', 'in_progress', 'not_done') then
    return jsonb_build_object('error', 'situacao invalida');
  end if;

  if v_name is null or v_role is null then
    return jsonb_build_object('error', 'informe seu nome e sua funcao');
  end if;

  -- "Não fiz" sem motivo não serve para a próxima visita.
  if v_status = 'not_done' and v_note is null then
    return jsonb_build_object('error', 'explique por que ainda nao foi feito');
  end if;

  if p_item.status <> 'published' then
    return jsonb_build_object('error', 'item nao esta aberto');
  end if;

  update public.client_action_items
  set client_status = v_status,
      client_status_note = v_note,
      client_status_at = v_at,
      client_status_by_name = left(v_name, 120),
      client_status_by_role = left(v_role, 120),
      updated_at = now()
  where id = p_item.id;

  insert into public.client_portal_audit_events (
    tenant_id, account_id, client_id, appointment_request_id, event_type, payload, user_agent
  ) values (
    p_item.tenant_id,
    p_account_id,
    p_item.client_id,
    p_item.appointment_request_id,
    'item_status_declared',
    jsonb_build_object(
      'action_item_id', p_item.id,
      'client_status', v_status,
      'source', p_source,
      'by_name', left(v_name, 120),
      'by_role', left(v_role, 120)
    ),
    left(nullif(p_user_agent, ''), 500)
  );

  return jsonb_build_object('ok', true, 'client_status', v_status, 'client_status_at', v_at);
end;
$function$;

revoke all on function private.declare_action_item_status(public.client_action_items, uuid, text, text, text, text, text, text) from public;
revoke all on function private.declare_action_item_status(public.client_action_items, uuid, text, text, text, text, text, text) from anon;
revoke all on function private.declare_action_item_status(public.client_action_items, uuid, text, text, text, text, text, text) from authenticated;

-- ─── Pela conta do portal ─────────────────────────────────────────────────────
--
-- Diferente do envio de evidência, aqui não há arquivo: é texto. Por isso a RPC é chamável
-- direto pelo navegador, no mesmo molde de `client_portal_audit_event` e
-- `client_portal_payment_acknowledge` — o token da conta é a autorização, e não há caminho de
-- Storage para vazar.

create or replace function public.client_portal_set_item_status(
  p_token uuid,
  p_action_item_id uuid,
  p_status text,
  p_by_name text,
  p_by_role text,
  p_note text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
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

  select * into v_item
  from public.client_action_items
  where id = p_action_item_id
    and tenant_id = v_account.tenant_id;

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

  return private.declare_action_item_status(
    v_item, v_account.id, 'portal_account', p_status, p_note, p_by_name, p_by_role, p_user_agent
  );
end;
$function$;

revoke all on function public.client_portal_set_item_status(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.client_portal_set_item_status(uuid, uuid, text, text, text, text, text) to anon;
grant execute on function public.client_portal_set_item_status(uuid, uuid, text, text, text, text, text) to authenticated;

-- ─── Pelo link aberto do relatório ────────────────────────────────────────────

create or replace function public.public_report_set_item_status(
  p_visit_token uuid,
  p_action_item_id uuid,
  p_status text,
  p_by_name text,
  p_by_role text,
  p_note text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_item public.client_action_items%rowtype;
  v_item_hidden boolean;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null or coalesce(v_visit.report_hidden, false) then
    return jsonb_build_object('error', 'link invalido');
  end if;

  select * into v_item
  from public.client_action_items
  where id = p_action_item_id
    and tenant_id = v_visit.tenant_id
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

  return private.declare_action_item_status(
    v_item, null, 'report_link', p_status, p_note, p_by_name, p_by_role, p_user_agent
  );
end;
$function$;

revoke all on function public.public_report_set_item_status(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.public_report_set_item_status(uuid, uuid, text, text, text, text, text) to anon;
grant execute on function public.public_report_set_item_status(uuid, uuid, text, text, text, text, text) to authenticated;

-- ─── As duas leituras passam a devolver a declaração ──────────────────────────
--
-- `create or replace` com o mesmo corpo do PORT-02, acrescentando os cinco campos. Só a lista
-- de campos do `jsonb_build_object` muda; a autorização é a mesma.

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
