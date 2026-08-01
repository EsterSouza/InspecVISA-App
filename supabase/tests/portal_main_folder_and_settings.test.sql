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

create or replace function private.my_tenant_ids()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select value::uuid
  from unnest(string_to_array(nullif(current_setting('test.tenant_ids', true), ''), ',')) value;
$$;

create or replace function private.is_tenant_staff(p_tenant_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('test.is_staff', true), 'false') = 'true'
    and p_tenant_id in (select private.my_tenant_ids());
$$;

grant usage on schema private to authenticated;
grant execute on function private.my_tenant_ids() to authenticated;
grant execute on function private.is_tenant_staff(uuid) to authenticated;

create table public.client_portal_accounts (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  email text not null,
  username text,
  access_code_hash text not null,
  access_code_plain text,
  portal_token uuid not null unique,
  is_active boolean not null default true,
  payment_type text,
  payment_status text default 'pending',
  payment_link text,
  payment_links jsonb not null default '[]'::jsonb,
  payment_due_date date,
  payment_updated_at timestamptz,
  scheduling_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_portal_account_clients (
  account_id uuid not null references public.client_portal_accounts(id) on delete cascade,
  client_id uuid not null,
  primary key (account_id, client_id)
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
  id uuid primary key,
  tenant_id uuid not null,
  client_id uuid,
  public_token uuid not null,
  unit_name text,
  status text,
  requested_date date,
  requested_time text,
  report_due_at timestamptz,
  compliance_score integer,
  sanitary_score integer,
  nutrition_score integer,
  critical_nc_count integer,
  important_nc_count integer,
  total_nc_count integer,
  recurring_nc_count integer,
  immediate_nc_count integer,
  nc_items jsonb,
  report_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.appointment_attachments (
  id uuid primary key,
  appointment_request_id uuid not null references public.appointment_requests(id),
  kind text not null
);

create table public.client_portal_invoices (
  id uuid primary key,
  tenant_id uuid not null,
  account_id uuid not null references public.client_portal_accounts(id),
  competence_month date not null,
  storage_path text not null
);

\if :legacy
  insert into public.client_portal_accounts (
    id, tenant_id, name, email, username, access_code_hash, portal_token,
    is_active, payment_type, payment_status, payment_link, payment_links,
    payment_due_date, payment_updated_at, scheduling_suspended
  ) values
    ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Conta A', 'a@example.com', 'conta-a', 'hash-a', 'a0000000-0000-4000-8000-000000000001', true, 'monthly', 'pending', 'https://pay.example/a', '[{"label":"Principal","url":"https://pay.example/a"}]', '2026-08-10', '2026-08-01T12:00:00Z', false),
    ('20000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Conta B', 'b@example.com', 'conta-b', 'hash-b', 'b0000000-0000-4000-8000-000000000002', true, 'one_time', 'paid', null, '[]', null, '2026-08-01T12:00:00Z', false),
    ('30000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Conta Inativa', 'inativa@example.com', null, 'hash-c', 'c0000000-0000-4000-8000-000000000003', false, null, 'pending', null, '[]', null, null, false);

  insert into public.clients (
    id, tenant_id, name, city, state,
    has_personalized_sanitary_folder, personalized_sanitary_folder_url
  ) values
    ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Unidade A', 'Rio de Janeiro', 'RJ', true, 'https://drive.google.com/personalizada-a'),
    ('b2000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Unidade B', 'Sao Paulo', 'SP', true, 'https://drive.google.com/personalizada-b');

  insert into public.client_portal_account_clients (account_id, client_id) values
    ('10000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
    ('10000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002'),
    ('20000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002');

  insert into public.appointment_requests (
    id, tenant_id, client_id, public_token, unit_name, status,
    requested_date, requested_time, report_due_at,
    compliance_score, sanitary_score, nutrition_score,
    critical_nc_count, important_nc_count, total_nc_count,
    recurring_nc_count, immediate_nc_count, nc_items, report_hidden, created_at
  ) values (
    'a3000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000004',
    'Unidade A', 'completed', '2026-07-01', '09:00', null,
    90, 88, 92, 1, 2, 3, 1, 1,
    '[{"id":"nc-1","d":"Item sintetico","c":true}]', false, '2026-07-01T12:00:00Z'
  );

  insert into public.appointment_attachments (id, appointment_request_id, kind) values
    ('a5000000-0000-4000-8000-000000000005', 'a3000000-0000-4000-8000-000000000003', 'report_pdf'),
    ('a6000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000003', 'photo'),
    ('a7000000-0000-4000-8000-000000000007', 'a3000000-0000-4000-8000-000000000003', 'attachment');

  insert into public.client_portal_invoices (
    id, tenant_id, account_id, competence_month, storage_path
  ) values (
    'a8000000-0000-4000-8000-000000000008',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    '2026-07-01',
    'synthetic/invoice.pdf'
  );
\endif

\ir ../migrations/20260801134443_portal_main_folder_and_settings.sql

do $$
begin
  if to_regclass('public.client_portal_settings') is null then
    raise exception 'client_portal_settings nao foi criada';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_portal_accounts'
      and column_name = 'main_drive_folder_url'
  ) then
    raise exception 'main_drive_folder_url nao foi criada';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.client_portal_settings'::regclass
      and relrowsecurity
  ) then
    raise exception 'RLS nao foi habilitada';
  end if;
end;
$$;

\if :legacy
  set role authenticated;
  select set_config('test.tenant_ids', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
  select set_config('test.is_staff', 'true', false);

  select public.admin_save_client_portal_settings(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://example.com/tutorial-a.pdf',
    '+55 21 99999-9999',
    true, false, false, false
  );

  update public.client_portal_settings
  set support_whatsapp = '+55 21 98888-8888'
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  do $$
  declare
    denied boolean := false;
  begin
    begin
      insert into public.client_portal_settings (tenant_id)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then
      raise exception 'RLS permitiu escrita em outro tenant';
    end if;
  end;
  $$;

  do $$
  declare
    rejected boolean := false;
  begin
    begin
      perform public.admin_update_client_portal_account_configuration(
        '10000000-0000-4000-8000-000000000001',
        'a@example.com', 'conta-a', 'http://drive.google.com/insegura'
      );
    exception when others then
      rejected := sqlerrm like '%URL HTTPS valida%';
    end;
    if not rejected then
      raise exception 'RPC aceitou URL HTTP';
    end if;
  end;
  $$;

  do $$
  declare
    rejected boolean := false;
  begin
    begin
      perform public.admin_update_client_portal_account_configuration(
        '10000000-0000-4000-8000-000000000001',
        'a@example.com', 'conta-a', 'texto malformado'
      );
    exception when others then
      rejected := sqlerrm like '%URL HTTPS valida%';
    end;
    if not rejected then
      raise exception 'RPC aceitou URL malformada';
    end if;
  end;
  $$;

  select public.admin_update_client_portal_account_configuration(
    '10000000-0000-4000-8000-000000000001',
    'a@example.com', 'conta-a', ''
  );

  select public.admin_update_client_portal_account_configuration(
    '10000000-0000-4000-8000-000000000001',
    'a@example.com', 'conta-a', 'https://drive.google.com/principal-a'
  );

  do $$
  declare
    denied boolean := false;
  begin
    begin
      perform public.admin_update_client_portal_account_configuration(
        '20000000-0000-4000-8000-000000000002',
        'b@example.com', 'conta-b', 'https://drive.google.com/principal-b'
      );
    exception when others then
      denied := sqlerrm like '%sem permissao%';
    end;
    if not denied then
      raise exception 'RPC administrativa permitiu conta de outro tenant';
    end if;
  end;
  $$;

  reset role;

  insert into public.client_portal_settings (
    tenant_id, tutorial_pdf_url, support_whatsapp,
    quick_access_enabled, multi_purpose_schedule, action_plan_enabled, service_requests_enabled
  ) values (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'https://example.com/tutorial-b.pdf', '+55 11 99999-9999',
    true, true, true, true
  );

  do $$
  begin
    if (select main_drive_folder_url from public.client_portal_accounts where id = '10000000-0000-4000-8000-000000000001')
       <> 'https://drive.google.com/principal-a' then
      raise exception 'URL HTTPS valida nao foi persistida';
    end if;
    if (select count(*) from public.client_portal_invoices where id = 'a8000000-0000-4000-8000-000000000008') <> 1 then
      raise exception 'regressao em notas fiscais';
    end if;
  end;
  $$;

  set role anon;

  do $$
  declare
    denied boolean := false;
  begin
    begin
      perform * from public.client_portal_settings;
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then
      raise exception 'anon recebeu acesso direto as configuracoes';
    end if;
  end;
  $$;

  do $$
  declare
    overview jsonb;
  begin
    overview := public.client_portal_overview('a0000000-0000-4000-8000-000000000001');

    if overview->>'account_name' <> 'Conta A'
       or overview->>'main_drive_folder_url' <> 'https://drive.google.com/principal-a'
       or overview->>'tutorial_pdf_url' <> 'https://example.com/tutorial-a.pdf'
       or overview->>'support_whatsapp' <> '+55 21 98888-8888' then
      raise exception 'overview valida perdeu configuracoes seguras';
    end if;
    if jsonb_array_length(overview->'units') <> 1
       or overview#>>'{units,0,client_name}' <> 'Unidade A' then
      raise exception 'overview vazou unidade cruzada de outro tenant';
    end if;
    if overview#>>'{units,0,personalized_sanitary_folder_url}' <> 'https://drive.google.com/personalizada-a'
       or (overview#>>'{units,0,visits,0,sanitary_score}')::integer <> 88
       or (overview#>>'{units,0,visits,0,nutrition_score}')::integer <> 92
       or (overview#>>'{units,0,visits,0,total_nc_count}')::integer <> 3
       or (overview#>>'{units,0,visits,0,report_count}')::integer <> 1
       or (overview#>>'{units,0,visits,0,photo_count}')::integer <> 1
       or (overview#>>'{units,0,visits,0,attachment_count}')::integer <> 1
       or overview#>>'{payment,status}' <> 'pending' then
      raise exception 'regressao no contrato JSON da overview';
    end if;
    if overview ?| array['portal_token', 'access_code_hash', 'storage_path', 'signed_url', 'service_role']
       or overview::text ~* 'portal_token|access_code_hash|storage_path|signed_url|service_role' then
      raise exception 'overview expos campo interno';
    end if;
  end;
  $$;

  do $$
  begin
    if public.client_portal_overview('ffffffff-ffff-4fff-8fff-ffffffffffff')->>'error' <> 'acesso invalido' then
      raise exception 'token invalido foi aceito';
    end if;
    if public.client_portal_overview('c0000000-0000-4000-8000-000000000003')->>'error' <> 'acesso invalido' then
      raise exception 'token inativo foi aceito';
    end if;
    if public.client_portal_overview('b0000000-0000-4000-8000-000000000002')->>'tutorial_pdf_url'
       <> 'https://example.com/tutorial-b.pdf' then
      raise exception 'token de outro tenant recebeu configuracao incorreta';
    end if;
  end;
  $$;

  reset role;
\endif

select case when :legacy::integer = 1
  then 'P360-002 legacy schema and security tests passed'
  else 'P360-002 clean schema test passed'
end as result;
