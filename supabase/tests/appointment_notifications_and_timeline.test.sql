\set ON_ERROR_STOP on

-- P360-008 — schema falso dedicado (uuid em appointment_requests.id, como em produção; o fixture
-- de P360-004/appointment_domain.test.sql usa bigint ali e quebraria a FK nova de
-- appointment_notification_log). Reaproveita o padrão de private.my_tenant_ids()/is_tenant_staff()
-- de appointment_availability.test.sql.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

create schema private;

create function private.my_tenant_ids()
returns setof uuid language sql stable as $$
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

create function private.is_tenant_staff(p_tenant_id uuid)
returns boolean language sql stable as $$
  select p_tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

create table public.client_portal_accounts (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  portal_token uuid not null unique,
  is_active boolean not null default true,
  main_drive_folder_url text,
  scheduling_suspended boolean not null default false,
  payment_type text,
  payment_status text,
  payment_link text,
  payment_links jsonb not null default '[]'::jsonb,
  payment_due_date date,
  payment_updated_at timestamptz
);

create table public.client_portal_settings (
  tenant_id uuid primary key,
  tutorial_pdf_url text,
  support_whatsapp text,
  quick_access_enabled boolean not null default true,
  multi_purpose_schedule boolean not null default false,
  action_plan_enabled boolean not null default false,
  service_requests_enabled boolean not null default false
);

create table public.client_portal_account_clients (
  account_id uuid not null,
  client_id uuid not null
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  email text,
  city text,
  state text,
  has_personalized_sanitary_folder boolean not null default false,
  personalized_sanitary_folder_url text,
  deleted_at timestamptz
);

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid,
  public_token uuid not null default gen_random_uuid(),
  unit_name text,
  email text,
  appointment_type text not null default 'inspection',
  duration_minutes integer,
  status text not null default 'requested',
  requested_date date,
  requested_time text,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  report_due_at date,
  report_due_source text,
  report_pdf_path text,
  report_hidden boolean not null default false,
  nc_items jsonb not null default '[]'::jsonb,
  inspection_id uuid,
  compliance_score integer,
  sanitary_score integer,
  nutrition_score integer,
  critical_nc_count integer,
  important_nc_count integer,
  total_nc_count integer,
  recurring_nc_count integer,
  immediate_nc_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointment_attachments (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null references public.appointment_requests(id),
  kind text not null
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  appointment_type text not null default 'inspection',
  duration_minutes integer,
  inspection_id uuid
);

insert into public.client_portal_accounts (id, tenant_id, name, portal_token)
values (
  '10000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Conta A',
  '10000000-0000-4000-8000-000000000002'
);

insert into public.client_portal_settings (tenant_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.clients (id, tenant_id, name)
values ('10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Unidade A');

insert into public.client_portal_account_clients (account_id, client_id)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003');

insert into public.appointment_requests (
  id, tenant_id, client_id, unit_name, appointment_type, status, requested_date, requested_time
) values (
  '20000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '10000000-0000-4000-8000-000000000003',
  'Unidade A',
  'follow_up_meeting',
  'confirmed',
  '2026-08-15',
  '10:00'
);

-- Traz a checagem de "reunião não leva campo sanitário" (P360-004), que a migration nova nem
-- toca, mas o teste #2 abaixo depende dela — mesma constraint da produção.
\ir ../migrations/20260801161550_appointment_domain.sql

\ir ../migrations/20260806235257_appointment_notifications_and_timeline.sql

-- Linhas legadas provam o backfill: falha antiga volta a pending; envio confirmado vira sent.
insert into public.appointment_notification_log (
  tenant_id, appointment_request_id, event_type, dedupe_key, email_sent
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'confirmed', 'legacy-failed', false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'rescheduled', 'legacy-sent', true);

\ir ../migrations/20260812184947_canonical_appointment_email_delivery.sql

do $$
begin
  if (select delivery_status from public.appointment_notification_log where dedupe_key = 'legacy-failed') <> 'pending' then
    raise exception 'falha legada nao voltou a pending para permitir retry';
  end if;
  if (select delivery_status from public.appointment_notification_log where dedupe_key = 'legacy-sent') <> 'sent' then
    raise exception 'envio legado confirmado nao foi preservado como sent';
  end if;
end;
$$;

delete from public.appointment_notification_log where dedupe_key like 'legacy-%';

-- 1. Novos tipos aceitos, mesmo bucket de duracao das reunioes (30/60/90).
do $$
declare
  rejected boolean := false;
begin
  insert into public.appointment_requests (tenant_id, appointment_type, duration_minutes)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'audit', 60);

  insert into public.appointment_requests (tenant_id, appointment_type, duration_minutes)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'online_followup', 30);

  begin
    insert into public.appointment_requests (tenant_id, appointment_type, duration_minutes)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'audit', 45);
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'auditoria aceitou duracao fora de 30/60/90';
  end if;

  if private.resolve_appointment_duration_minutes('online_followup', 90) <> 90 then
    raise exception 'resolvedor de duracao nao aceitou 90 minutos para acompanhamento online';
  end if;
end;
$$;

-- 2. Continua bloqueando campo sanitario fora de inspection, agora tambem para os tipos novos.
do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.appointment_requests (
      tenant_id, appointment_type, inspection_id, status, report_due_at
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'audit',
      '22222222-2222-4222-8222-222222222222',
      'report_available',
      '2026-08-10'
    );
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'auditoria aceitou campos sanitarios';
  end if;
end;
$$;

-- 3. Idempotencia do log de notificacao: mesma chave nao duplica; chave nova (remarcacao) sim.
do $$
declare
  v_count integer;
begin
  insert into public.appointment_notification_log (tenant_id, appointment_request_id, event_type, dedupe_key)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'confirmed', '2026-08-15T10:00');

  begin
    insert into public.appointment_notification_log (tenant_id, appointment_request_id, event_type, dedupe_key)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'confirmed', '2026-08-15T10:00');
    raise exception 'log de notificacao aceitou retry com a mesma chave de dedupe';
  exception when unique_violation then
    null;
  end;

  insert into public.appointment_notification_log (tenant_id, appointment_request_id, event_type, dedupe_key)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'rescheduled', '2026-08-20T14:00');

  select count(*) into v_count
  from public.appointment_notification_log
  where appointment_request_id = '20000000-0000-4000-8000-000000000001';

  if v_count <> 2 then
    raise exception 'esperava 2 linhas no log (confirmed + rescheduled), achou %', v_count;
  end if;

  update public.appointment_notification_log
  set delivery_status = 'sending', attempt_count = attempt_count + 1, last_attempt_at = now()
  where appointment_request_id = '20000000-0000-4000-8000-000000000001'
    and event_type = 'confirmed'
    and dedupe_key = '2026-08-15T10:00'
    and delivery_status = 'pending';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'primeira aquisicao deveria obter o envio'; end if;

  update public.appointment_notification_log
  set delivery_status = 'sending'
  where appointment_request_id = '20000000-0000-4000-8000-000000000001'
    and event_type = 'confirmed'
    and dedupe_key = '2026-08-15T10:00'
    and delivery_status = 'pending';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'segunda aquisicao concorrente nao deveria obter o envio'; end if;
end;
$$;

-- 4. RLS/grants: anon sem acesso, authenticated com leitura (staff), mesmo padrao de
-- client_portal_audit_events (20260805010139_client_portal_audit_and_payment_ack.sql).
do $$
begin
  if has_table_privilege('anon', 'public.appointment_notification_log', 'SELECT') then
    raise exception 'anon nao deveria ler appointment_notification_log';
  end if;
  if not has_table_privilege('authenticated', 'public.appointment_notification_log', 'SELECT') then
    raise exception 'authenticated deveria ler appointment_notification_log';
  end if;
  if has_table_privilege('authenticated', 'public.appointment_notification_log', 'INSERT') then
    raise exception 'authenticated nao deveria escrever em appointment_notification_log (so a edge function via service role)';
  end if;
end;
$$;

-- 5. client_portal_overview devolve os novos flags por unidade.
update public.clients
set has_audit_service = true, has_online_followup = false
where id = '10000000-0000-4000-8000-000000000003';

do $$
declare
  overview jsonb;
begin
  overview := public.client_portal_overview('10000000-0000-4000-8000-000000000002');
  if (overview#>>'{units,0,has_audit_service}')::boolean is not true
     or (overview#>>'{units,0,has_online_followup}')::boolean is not false then
    raise exception 'overview nao devolveu has_audit_service/has_online_followup corretamente';
  end if;
end;
$$;

-- 6. Regressao do criterio de aceite: suspensao financeira nao apaga/altera compromisso
-- ja confirmado — so bloqueia agendamento novo (client_portal_create_appointment), que este
-- fixture nao precisa recriar para provar o ponto: a linha existente tem que permanecer intacta.
do $$
declare
  v_status text;
  v_date date;
begin
  update public.client_portal_accounts
  set scheduling_suspended = true
  where id = '10000000-0000-4000-8000-000000000001';

  select status, requested_date into v_status, v_date
  from public.appointment_requests
  where id = '20000000-0000-4000-8000-000000000001';

  if v_status <> 'confirmed' or v_date <> '2026-08-15' then
    raise exception 'suspensao financeira alterou compromisso ja confirmado (status=%, data=%)', v_status, v_date;
  end if;
end;
$$;

select 'P360-008 appointment notifications and timeline tests passed' as result;
