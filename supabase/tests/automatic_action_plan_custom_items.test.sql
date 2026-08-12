\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$$;

create schema auth;
create schema private;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function private.is_tenant_staff(p_tenant_id uuid) returns boolean language sql stable as $$
  select auth.uid() is not null and p_tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_tenant_staff(uuid) to authenticated, service_role;

create table public.clients (id uuid primary key, tenant_id uuid not null);
create table public.inspections (
  id uuid primary key, client_id uuid not null, template_id text, consultant_name text,
  inspection_date timestamptz, status text, observations text, created_at timestamptz,
  completed_at timestamptz, user_id uuid, tenant_id uuid, accompanist_name text,
  accompanist_role text, ilpi_capacity integer, residents_total integer, residents_male integer,
  residents_female integer, dependency_level_1 integer, dependency_level_2 integer,
  dependency_level_3 integer, signature_data_url text, dependency_level1 integer,
  dependency_level2 integer, dependency_level3 integer, updated_at timestamptz,
  deleted_at timestamptz, observed_staff integer, observed_nursing_techs integer,
  usable_area_m2 integer, observed_cleaning_staff integer, consultant_names text[],
  last_edited_by text, finalized_by jsonb, reference_sources jsonb
);
create table public.responses (
  id uuid primary key, inspection_id uuid not null, item_id text not null, result text,
  situation_description text, corrective_action text, created_at timestamptz,
  updated_at timestamptz, user_id uuid, tenant_id uuid, responsible text, deadline text,
  custom_description text, deleted_at timestamptz, last_edited_by text, links jsonb
);
create table public.photos (
  id uuid primary key, response_id uuid, storage_path text, caption text, taken_at timestamptz,
  user_id uuid, tenant_id uuid, data_url text, updated_at timestamptz, deleted_at timestamptz
);
create table public.sync_batches (
  id uuid primary key default gen_random_uuid(), tenant_id uuid, inspection_id uuid,
  client_sync_id text, status text, payload jsonb, error text, result jsonb, updated_at timestamptz
);
create table public.inspection_report_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid, inspection_id uuid,
  version integer, snapshot_json jsonb, created_by uuid
);
create table public.client_action_items (
  id uuid primary key, tenant_id uuid not null, client_id uuid not null,
  source_item_id text not null, status text not null, resolved_at timestamptz,
  updated_at timestamptz not null default now(), client_status text
);
create table public.client_action_evidence (
  id uuid primary key, tenant_id uuid not null, client_id uuid not null,
  action_item_id uuid not null, status text not null, review_note text,
  reviewed_at timestamptz, reviewed_by text, updated_at timestamptz not null default now()
);
grant select, insert, update on all tables in schema public to authenticated, service_role;

\ir ../migrations/20260812112448_automatic_action_plan_custom_items.sql
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
declare rejected boolean := false;
begin
  begin
    insert into public.responses (id, inspection_id, item_id, confirmed_client_evidence_ids, created_at, updated_at)
    values ('01000000-0000-4000-8000-000000000001', '02000000-0000-4000-8000-000000000001', 'bad', '{}'::jsonb, now(), now());
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'confirmed evidence aceitou objeto'; end if;
  rejected := false;
  begin
    insert into public.responses (id, inspection_id, item_id, custom_item_meta, created_at, updated_at)
    values (
      '01000000-0000-4000-8000-000000000002', '02000000-0000-4000-8000-000000000001', 'bad-meta',
      jsonb_build_object('sectionId', 's1', 'order', 1, 'weight', 5, 'isCritical', true, 'state', 'active'), now(), now()
    );
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'item critico aceitou peso diferente de 10'; end if;
  if has_function_privilege('anon', 'public.admin_reconcile_inspection_action_plan(uuid,uuid[])', 'execute') then
    raise exception 'anon executa reconcile';
  end if;
end;
$$;

insert into public.clients (id, tenant_id) values
  ('20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('20000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.inspections (
  id, client_id, template_id, consultant_name, inspection_date, status,
  created_at, updated_at, tenant_id, last_edited_by, consultant_names, finalized_by
) values
  (
    '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    'template', 'Consultora', now(), 'in_progress', now(), now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Consultora', array['Consultora'], '[]'
  ),
  (
    '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
    'template', 'Outra', now(), 'in_progress', now(), now(),
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Outra', array['Outra'], '[]'
  );

insert into public.client_action_items (id, tenant_id, client_id, source_item_id, status, client_status) values
  ('40000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'complies', 'published', 'done'),
  ('40000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'nc', 'published', 'done'),
  ('40000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'na', 'published', 'done'),
  ('40000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'extra|s1|gone', 'published', null);

insert into public.client_action_evidence (id, tenant_id, client_id, action_item_id, status) values
  ('50000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'pending'),
  ('50000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'changes_requested');

insert into public.responses (
  id, inspection_id, item_id, result, confirmed_client_evidence_ids,
  custom_item_meta, deleted_at, created_at, updated_at, tenant_id
) values
  (
    '60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    'complies', 'complies', to_jsonb(array['50000000-0000-4000-8000-000000000001']::text[]),
    null, null, now(), now(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
    'nc', 'not_complies', '[]', null, null, now(), now(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001',
    'na', 'not_applicable', '[]', null, null, now(), now(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001',
    'extra|s1|gone', 'not_observed', '[]',
    jsonb_build_object('sectionId', 's1', 'order', 2, 'weight', 1, 'isCritical', false, 'state', 'discontinued'),
    now(), now(), now(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );

do $$
declare result jsonb;
begin
  result := public.admin_reconcile_inspection_action_plan(
    '30000000-0000-4000-8000-000000000001',
    array['50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002']::uuid[]
  );
  if result ->> 'approvedEvidenceCount' <> '1' or result ->> 'resolvedItemCount' <> '2' then
    raise exception 'contagens inesperadas: %', result;
  end if;
  if (select status from public.client_action_evidence where id = '50000000-0000-4000-8000-000000000002') <> 'changes_requested' then
    raise exception 'changes_requested foi aprovado indevidamente';
  end if;
  if exists (select 1 from public.client_action_items where source_item_id in ('nc', 'na') and status = 'resolved') then
    raise exception 'NC, NA ou declaracao do cliente resolveu pendencia';
  end if;

  result := public.admin_reconcile_inspection_action_plan(
    '30000000-0000-4000-8000-000000000001',
    array['50000000-0000-4000-8000-000000000001']::uuid[]
  );
  if result ->> 'approvedEvidenceCount' <> '0' or result ->> 'resolvedItemCount' <> '0' then
    raise exception 'reconcile nao foi idempotente: %', result;
  end if;
end;
$$;

do $$
declare denied boolean := false;
begin
  begin
    perform public.admin_reconcile_inspection_action_plan('30000000-0000-4000-8000-000000000002', '{}'::uuid[]);
  exception when others then denied := true;
  end;
  if not denied then raise exception 'tenant estrangeiro foi reconciliado'; end if;
end;
$$;

select 'Automatic action plan and custom item tests passed' as result;
