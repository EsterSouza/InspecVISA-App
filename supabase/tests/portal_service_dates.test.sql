\set ON_ERROR_STOP on

-- Datas de servico na agenda do portal (report_delivered_at + previsao da pasta sanitaria).
-- Fixture minima e propria (nao encadeia o historico de P360-*): a funcao atual de
-- client_portal_overview depende de private.portal_account_gates, que aqui e um stub
-- permissivo — as travas do PORT-01 ja sao cobertas em portal_feature_gates.test.sql.

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

create or replace function private.portal_account_gates(p_account_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'features', jsonb_build_object('reports', true, 'photos', true, 'compliance', true),
    'scheduling_suspended', false
  );
$$;

create table public.client_portal_accounts (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  portal_token uuid not null unique,
  is_active boolean not null default true,
  main_drive_folder_url text,
  tutorial_pdf_url text,
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
  has_audit_service boolean not null default false,
  has_online_followup boolean not null default false,
  deleted_at timestamptz
);

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid,
  public_token uuid not null default gen_random_uuid(),
  unit_name text,
  inspection_id uuid,
  appointment_type text not null default 'inspection',
  subject text,
  duration_minutes integer,
  consultant_names text[],
  status text not null default 'requested',
  requested_date date,
  requested_time text,
  report_due_at date,
  report_due_source text,
  report_pdf_path text,
  report_hidden boolean not null default false,
  compliance_score integer,
  sanitary_score integer,
  nutrition_score integer,
  critical_nc_count integer,
  important_nc_count integer,
  total_nc_count integer,
  recurring_nc_count integer,
  immediate_nc_count integer,
  nc_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.appointment_attachments (
  id uuid primary key default gen_random_uuid(),
  appointment_request_id uuid not null references public.appointment_requests(id),
  kind text not null
);

\ir ../migrations/20260810200532_portal_service_dates.sql

-- ─── Constraint: report_delivered_at so em appointment_type = inspection ───────
do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.appointment_requests (tenant_id, appointment_type, status, report_delivered_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'follow_up_meeting', 'confirmed', now());
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'reuniao aceitou report_delivered_at';
  end if;
end;
$$;

-- ─── client_portal_overview expõe os dois campos novos ─────────────────────────
insert into public.client_portal_accounts (id, tenant_id, name, portal_token)
values (
  '10000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Conta A',
  '10000000-0000-4000-8000-000000000002'
);

insert into public.client_portal_settings (tenant_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.clients (id, tenant_id, name, personalized_sanitary_folder_expected_delivery_date)
values (
  '10000000-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Unidade A',
  '2026-08-20'
);

insert into public.client_portal_account_clients (account_id, client_id)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003');

insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, appointment_type, status,
  requested_date, requested_time, report_due_at, report_delivered_at
) values (
  'a1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '10000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000002',
  'Unidade A', 'inspection', 'report_available',
  '2026-08-01', '09:00', '2026-08-05', '2026-08-04T18:00:00Z'
);

do $$
declare
  overview jsonb;
begin
  overview := public.client_portal_overview('10000000-0000-4000-8000-000000000002');

  if overview#>>'{units,0,personalized_sanitary_folder_expected_delivery_date}' <> '2026-08-20' then
    raise exception 'overview nao expos a previsao de entrega da pasta sanitaria: %', overview;
  end if;

  if overview#>>'{units,0,visits,0,report_delivered_at}' is null then
    raise exception 'overview nao expos a data real de entrega do relatorio: %', overview;
  end if;
end;
$$;

select 'Portal service dates tests passed' as result;
