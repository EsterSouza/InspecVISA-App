\set ON_ERROR_STOP on
\if :{?legacy}
\else
  \set legacy 0
\endif

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
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  city text,
  state text,
  has_personalized_sanitary_folder boolean not null default false,
  personalized_sanitary_folder_url text,
  deleted_at timestamptz
);

create table public.appointment_requests (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  client_id uuid,
  public_token uuid default gen_random_uuid(),
  unit_name text,
  inspection_id uuid,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  requested_date date,
  requested_time text,
  status text not null default 'requested',
  report_due_at date,
  report_due_source text,
  report_pdf_path text,
  compliance_score integer,
  sanitary_score integer,
  nutrition_score integer,
  critical_nc_count integer,
  important_nc_count integer,
  total_nc_count integer,
  recurring_nc_count integer,
  immediate_nc_count integer,
  nc_items jsonb not null default '[]'::jsonb,
  report_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.appointment_attachments (
  id bigint generated always as identity primary key,
  appointment_request_id bigint not null,
  kind text not null
);

create table public.schedules (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  inspection_id uuid
);

\if :legacy
  insert into public.appointment_requests (
    tenant_id, inspection_id, requested_starts_at, requested_ends_at,
    status, report_due_at, report_due_source, report_pdf_path, compliance_score
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '2026-07-31T12:30:00Z', '2026-07-31T14:00:00Z',
    'report_available', '2026-08-07', 'manual', 'legacy/report.pdf', 91
  );

  insert into public.schedules (tenant_id, inspection_id)
  values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111'
  );
\endif

\ir ../migrations/20260801161550_appointment_domain.sql

do $$
declare
  v_type text;
begin
  foreach v_type in array array[
    'inspection',
    'follow_up_meeting',
    'results_meeting',
    'document_guidance',
    'training',
    'other'
  ] loop
    insert into public.appointment_requests (tenant_id, appointment_type)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_type);

    insert into public.schedules (tenant_id, appointment_type)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_type);
  end loop;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.appointment_requests (tenant_id, appointment_type)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'unknown');
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'appointment_requests aceitou tipo desconhecido';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.appointment_requests (
      tenant_id, appointment_type, inspection_id, status, report_due_at
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'follow_up_meeting',
      '22222222-2222-4222-8222-222222222222',
      'report_available',
      '2026-08-10'
    );
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'reuniao aceitou campos sanitarios';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.schedules (tenant_id, appointment_type, inspection_id)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'training',
      '33333333-3333-4333-8333-333333333333'
    );
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'treinamento aceitou inspection_id';
  end if;
end;
$$;

-- O fluxo sanitário existente continua válido.
insert into public.appointment_requests (
  tenant_id, appointment_type, inspection_id, status, report_due_at, report_due_source
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'inspection',
  '44444444-4444-4444-8444-444444444444',
  'in_progress',
  '2026-08-10',
  'manual'
);

insert into public.client_portal_accounts (
  id, tenant_id, name, portal_token, payment_status
) values (
  '10000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Conta A',
  '10000000-0000-4000-8000-000000000002',
  'pending'
);

insert into public.client_portal_settings (tenant_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.clients (id, tenant_id, name)
values (
  '10000000-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Unidade A'
);

insert into public.client_portal_account_clients (account_id, client_id)
values (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003'
);

insert into public.appointment_requests (
  tenant_id, client_id, public_token, unit_name, appointment_type,
  subject, duration_minutes, status, requested_date, requested_time
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  'Unidade A',
  'follow_up_meeting',
  'Acompanhamento mensal',
  60,
  'confirmed',
  '2026-08-15',
  '10:00'
);

do $$
declare
  overview jsonb;
begin
  overview := public.client_portal_overview('10000000-0000-4000-8000-000000000002');
  if overview#>>'{units,0,visits,0,appointment_type}' <> 'follow_up_meeting'
     or overview#>>'{units,0,visits,0,subject}' <> 'Acompanhamento mensal'
     or (overview#>>'{units,0,visits,0,duration_minutes}')::integer <> 60
     or (overview#>>'{units,0,visits,0,report_count}')::integer <> 0
     or (overview#>>'{units,0,visits,0,photo_count}')::integer <> 0 then
    raise exception 'overview nao distinguiu compromisso nao sanitario';
  end if;
end;
$$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.appointment_attachments (appointment_request_id, kind)
    select id, 'report_pdf'
    from public.appointment_requests
    where public_token = '10000000-0000-4000-8000-000000000004';
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'reuniao aceitou publicacao de relatorio';
  end if;

  insert into public.appointment_attachments (appointment_request_id, kind)
  select id, 'attachment'
  from public.appointment_requests
  where public_token = '10000000-0000-4000-8000-000000000004';
end;
$$;

\if :legacy
  do $$
  begin
    if exists (
      select 1
      from public.appointment_requests
      where inspection_id = '11111111-1111-4111-8111-111111111111'
        and (
          appointment_type <> 'inspection'
          or duration_minutes <> 90
          or requested_starts_at <> '2026-07-31T12:30:00Z'
          or requested_ends_at <> '2026-07-31T14:00:00Z'
        )
    ) then
      raise exception 'backfill alterou ou classificou incorretamente registro legado';
    end if;
    if (select appointment_type from public.schedules limit 1) <> 'inspection' then
      raise exception 'schedule legado nao permaneceu inspection';
    end if;
  end;
  $$;
\endif

select case when :legacy::integer = 1
  then 'P360-004 legacy schema tests defined'
  else 'P360-004 clean schema tests defined'
end as result;
