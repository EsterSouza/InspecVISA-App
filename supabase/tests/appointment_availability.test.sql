\set ON_ERROR_STOP on

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

create schema auth;
create schema private;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select '10000000-0000-4000-8000-000000000001'::uuid;
$$;

create function private.my_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

create function private.is_tenant_staff(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select p_tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

create table public.tenants (
  id uuid primary key
);

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  email text,
  state text,
  deleted_at timestamptz
);

create table public.client_portal_accounts (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  portal_token uuid not null unique,
  is_active boolean not null default true,
  scheduling_suspended boolean not null default false
);

create table public.client_portal_account_clients (
  account_id uuid not null,
  client_id uuid not null
);

create table public.appointment_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  day date not null,
  reason text,
  unique (tenant_id, day)
);

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  schedule_id uuid,
  client_id uuid,
  public_token uuid not null unique default gen_random_uuid(),
  unit_name text not null,
  district text not null,
  municipality text,
  attendance_mode text,
  responsible_name text,
  phone text,
  email text,
  requested_date date,
  requested_time text,
  requested_period text,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  status text not null default 'requested',
  appointment_type text not null default 'inspection',
  subject text,
  duration_minutes integer,
  consultant_names text[],
  participant_names text[],
  notes text,
  created_at timestamptz not null default now()
);

create table public.appointment_notification_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  event_type text not null check (event_type in ('confirmed', 'rescheduled', 'cancelled')),
  dedupe_key text not null,
  email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (appointment_request_id, event_type, dedupe_key)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  client_id uuid,
  scheduled_at timestamptz not null,
  status text default 'pending',
  deleted_at timestamptz,
  appointment_type text not null default 'inspection',
  duration_minutes integer,
  consultant_names text[]
);

insert into public.tenants (id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.clients (id, tenant_id, name, state, email)
values (
  '20000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Unidade teste',
  'RJ',
  'cadastro@cliente.example'
);

insert into public.client_portal_accounts (
  id, tenant_id, name, portal_token
) values (
  '20000000-0000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Conta teste',
  '20000000-0000-4000-8000-000000000003'
);

insert into public.client_portal_account_clients (account_id, client_id)
values (
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001'
);

-- Legado sem duracao continua como uma hora, sem mudar scheduled_at.
insert into public.schedules (
  id, tenant_id, client_id, scheduled_at, status, appointment_type
) values (
  '30000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '2026-01-05T12:00:00Z',
  'completed',
  'inspection'
);

\ir ../migrations/20260802105852_appointment_availability_intervals.sql

do $$
begin
  if (select duration_minutes from public.schedules where id = '30000000-0000-4000-8000-000000000001') <> 60 then
    raise exception 'backfill de schedules nao preservou a duracao legada de uma hora';
  end if;

  if private.resolve_appointment_duration_minutes('follow_up_meeting', 30) <> 30
     or private.resolve_appointment_duration_minutes('results_meeting', 60) <> 60
     or private.resolve_appointment_duration_minutes('document_guidance', 90) <> 90
     or private.resolve_appointment_duration_minutes('training', 240) <> 240
     or private.resolve_appointment_duration_minutes('inspection', 90) <> 90 then
    raise exception 'duracoes validas foram rejeitadas';
  end if;

  begin
    perform private.resolve_appointment_duration_minutes('follow_up_meeting', 120);
    raise exception 'reuniao aceitou duracao de 120 minutos';
  exception when check_violation then
    null;
  end;

  begin
    perform private.resolve_appointment_duration_minutes('training', -30);
    raise exception 'treinamento aceitou duracao negativa';
  exception when check_violation then
    null;
  end;
end;
$$;

-- Intervalos adjacentes sao permitidos; sobreposicao da mesma consultora nao.
insert into public.appointment_requests (
  id, tenant_id, unit_name, district, requested_starts_at, requested_ends_at,
  status, appointment_type, duration_minutes, consultant_names
) values (
  '40000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Unidade teste',
  'Centro',
  '2027-02-01T13:00:00Z',
  '2027-02-01T13:30:00Z',
  'confirmed',
  'follow_up_meeting',
  30,
  array['Consultora A']
);

insert into public.schedules (
  id, tenant_id, client_id, scheduled_at, status, appointment_type,
  duration_minutes, consultant_names
) values (
  '40000000-0000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '2027-02-01T13:30:00Z',
  'pending',
  'follow_up_meeting',
  30,
  array['Consultora A']
);

-- Outra consultora pode atender durante o mesmo intervalo real.
insert into public.schedules (
  id, tenant_id, client_id, scheduled_at, status, appointment_type,
  duration_minutes, consultant_names
) values (
  '40000000-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '2027-02-01T13:15:00Z',
  'pending',
  'follow_up_meeting',
  30,
  array['Consultora B']
);

do $$
begin
  begin
    insert into public.schedules (
      tenant_id, client_id, scheduled_at, status, appointment_type,
      duration_minutes, consultant_names
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '20000000-0000-4000-8000-000000000001',
      '2027-02-01T13:15:00Z',
      'pending',
      'follow_up_meeting',
      30,
      array['Consultora A']
    );
    raise exception 'sobreposicao parcial da mesma consultora foi aceita';
  exception when exclusion_violation then
    null;
  end;

  begin
    insert into public.schedules (
      tenant_id, client_id, scheduled_at, status, appointment_type,
      duration_minutes, consultant_names
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '20000000-0000-4000-8000-000000000001',
      '2027-02-01T13:00:00Z',
      'pending',
      'follow_up_meeting',
      30,
      array['Consultora A']
    );
    raise exception 'mesmo inicio da mesma consultora foi aceito';
  exception when exclusion_violation then
    null;
  end;
end;
$$;

-- Bloqueios recorrentes sao linhas independentes e o mes e truncado corretamente.
select * from public.admin_create_appointment_blocks(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '2027-01-31T13:00:00Z',
  60,
  'Planejamento interno',
  'monthly',
  3
);

do $$
declare
  v_group uuid;
  v_cancelled uuid;
begin
  if (select count(*) from public.appointment_blocks where recurrence = 'monthly') <> 3 then
    raise exception 'recorrencia mensal nao criou tres ocorrencias';
  end if;
  if not exists (
    select 1 from public.appointment_blocks
    where recurrence = 'monthly'
      and (starts_at at time zone 'America/Sao_Paulo')::date = '2027-02-28'
  ) then
    raise exception 'recorrencia mensal nao ajustou 31 para o ultimo dia de fevereiro';
  end if;

  select recurrence_group_id into v_group
  from public.appointment_blocks
  where recurrence = 'monthly'
  limit 1;
  if v_group is null or exists (
    select 1 from public.appointment_blocks
    where recurrence = 'monthly' and recurrence_group_id <> v_group
  ) then
    raise exception 'grupo de recorrencia inconsistente';
  end if;

  select id into v_cancelled
  from public.appointment_blocks
  where recurrence = 'monthly' and occurrence_index = 2;
  update public.appointment_blocks set cancelled_at = now() where id = v_cancelled;
  if (select count(*) from public.appointment_blocks where recurrence_group_id = v_group and cancelled_at is null) <> 2 then
    raise exception 'cancelamento isolado afetou outras ocorrencias';
  end if;
  if (select cancelled_at from public.appointment_blocks where id = v_cancelled) is null then
    raise exception 'ocorrencia cancelada nao foi identificada';
  end if;
end;
$$;

-- America/Sao_Paulo preserva o horario local mesmo na mudanca historica de DST.
do $$
declare
  v_next timestamptz;
begin
  v_next := private.appointment_recurrence_start(
    '2018-10-29 13:00:00+00',
    'weekly',
    1
  );
  if (v_next at time zone 'America/Sao_Paulo')::time <> time '10:00' then
    raise exception 'recorrencia alterou o horario local na transicao historica de DST';
  end if;
end;
$$;

-- A margem de quatro horas existe somente na disponibilidade do cliente.
do $$
declare
  v_day date := '2027-03-01';
begin
  insert into public.schedules (
    tenant_id, client_id, scheduled_at, status, appointment_type,
    duration_minutes, consultant_names
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '20000000-0000-4000-8000-000000000001',
    (v_day + time '10:00') at time zone 'America/Sao_Paulo',
    'pending',
    'inspection',
    30,
    array['Consultora A']
  );

  if exists (
    select 1 from public.public_list_available_times(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_day
    ) where label = '14:00'
  ) then
    raise exception 'portal liberou horario dentro da margem de quatro horas';
  end if;
  if not exists (
    select 1 from public.public_list_available_times(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_day
    ) where label = '14:30'
  ) then
    raise exception 'portal nao liberou horario exatamente quatro horas apos o fim';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.public_create_calendar_appointment_request(jsonb_build_object(
      'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'unit_name', 'Unidade teste',
      'district', 'Centro',
      'municipality', 'Rio de Janeiro',
      'attendance_mode', 'presencial',
      'requested_starts_at', now() + interval '23 hours',
      'requested_ends_at', now() + interval '24 hours'
    ));
    raise exception 'portal aceitou menos de 24 horas de antecedencia';
  exception when others then
    if sqlerrm not like '%antecedencia minima de 24 horas%' then
      raise;
    end if;
  end;
end;
$$;

\ir ../migrations/20260802115342_portal_public_request_purpose.sql
\ir ../migrations/20260812221501_canonical_appointment_email_delivery.sql

do $$
declare
  v_result jsonb;
begin
  select public.public_create_calendar_appointment_request(jsonb_build_object(
    'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'unit_name', 'Unidade teste',
    'district', 'Centro',
    'municipality', 'Rio de Janeiro',
    'attendance_mode', 'presencial',
    'appointment_type', 'document_guidance',
    'duration_minutes', 60,
    'subject', 'Orientação de POP',
    'participant_names', jsonb_build_array('Ana', 'Beatriz'),
    'requested_starts_at', '2027-04-05T12:30:00Z',
    'requested_ends_at', '2027-04-05T13:30:00Z'
  )) into v_result;

  if not exists (
    select 1
    from public.appointment_requests
    where public_token = (v_result->>'public_token')::uuid
      and appointment_type = 'document_guidance'
      and subject = 'Orientação de POP'
      and participant_names = array['Ana', 'Beatriz']
  ) then
    raise exception 'P360-006 nao persistiu finalidade, assunto e participantes';
  end if;
end;
$$;

do $$
declare
  v_result jsonb;
  v_saved_email text;
begin
  select public.client_portal_create_appointment(jsonb_build_object(
    'portal_token', '20000000-0000-4000-8000-000000000003',
    'client_id', '20000000-0000-4000-8000-000000000001',
    'district', 'Centro',
    'municipality', 'Rio de Janeiro',
    'attendance_mode', 'presencial',
    'appointment_type', 'inspection',
    'email', 'payload-nao-canonico@example.com',
    'duration_minutes', 60,
    'requested_starts_at', '2027-04-12T12:30:00Z',
    'requested_ends_at', '2027-04-12T13:30:00Z'
  )) into v_result;

  select email into v_saved_email
  from public.appointment_requests
  where public_token = (v_result->>'public_token')::uuid;
  if v_saved_email <> 'cadastro@cliente.example' then
    raise exception 'portal nao usou clients.email como fonte canonica; gravou %', v_saved_email;
  end if;

  begin
    perform public.client_portal_create_appointment(jsonb_build_object(
      'portal_token', '20000000-0000-4000-8000-000000000003',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'district', 'Centro',
      'municipality', 'Rio de Janeiro',
      'attendance_mode', 'presencial',
      'appointment_type', 'inspection',
      'duration_minutes', 60,
      'requested_starts_at', '2027-04-19T12:30:00Z',
      'requested_ends_at', '2027-04-19T13:30:00Z'
    ));
    raise exception 'P360-006 aceitou segunda inspecao da mesma unidade no mes';
  exception when others then
    if sqlerrm not like '%ja possui uma inspecao%' then raise; end if;
  end;
end;
$$;

\ir ../migrations/20260804140000_appointment_buffer_por_registro.sql

-- DEBT-01: a margem de quatro horas e da inspecao. Compromisso curto bloqueia so 30 minutos.
do $$
declare
  v_day date := '2027-03-08';
begin
  insert into public.schedules (
    tenant_id, client_id, scheduled_at, status, appointment_type,
    duration_minutes, consultant_names
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '20000000-0000-4000-8000-000000000001',
    (v_day + time '10:00') at time zone 'America/Sao_Paulo',
    'pending',
    'follow_up_meeting',
    30,
    array['Consultora A']
  );

  if exists (
    select 1 from public.public_list_available_times(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_day
    ) where label = '10:00'
  ) then
    raise exception 'portal liberou horario sobreposto a reuniao curta';
  end if;
  if not exists (
    select 1 from public.public_list_available_times(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_day
    ) where label = '11:00'
  ) then
    raise exception 'reuniao de 30 minutos bloqueou mais de 30 minutos de margem';
  end if;
end;
$$;

-- Excluir o agendamento libera o horario mesmo com a solicitacao vinculada ainda ativa.
do $$
declare
  v_starts timestamptz := ('2027-03-15'::date + time '13:00') at time zone 'America/Sao_Paulo';
begin
  insert into public.schedules (
    id, tenant_id, client_id, scheduled_at, status, appointment_type,
    duration_minutes, consultant_names
  ) values (
    '50000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '20000000-0000-4000-8000-000000000001',
    v_starts,
    'pending',
    'inspection',
    60,
    array['Consultora A']
  );

  insert into public.appointment_requests (
    tenant_id, schedule_id, unit_name, district, requested_starts_at, requested_ends_at,
    status, appointment_type, duration_minutes
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '50000000-0000-4000-8000-000000000001',
    'Unidade teste',
    'Centro',
    v_starts,
    v_starts + interval '60 minutes',
    'confirmed',
    'inspection',
    60
  );

  update public.schedules set deleted_at = now()
  where id = '50000000-0000-4000-8000-000000000001';

  if private.appointment_has_conflict(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    v_starts,
    v_starts + interval '60 minutes',
    array['Consultora A']
  ) then
    raise exception 'solicitacao orfa continuou bloqueando o horario apos a exclusao do agendamento';
  end if;
end;
$$;

select 'P360-005 and P360-006 availability tests passed' as result;
