-- SEC-01 — prova de que o revoke fecha o papel `anon` sem tirar nada de `authenticated`.
--
-- Roda em Postgres puro: cria os papéis, cria as tabelas como o default privilege do Supabase as
-- entrega (ALL para anon e authenticated), aplica a migration e confere os dois lados.
--
-- O caso que dá nome ao arquivo é o último: uma policy de `anon` cuja expressão consulta OUTRA
-- tabela passa a dar `permission denied` quando o grant dessa outra tabela é revogado. Foi por
-- isso que a policy de `storage.objects` teve de cair na mesma migration, e não depois.

\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;

-- ─── As 23 tabelas, como o Supabase as entrega ────────────────────────────────
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'appointment_attachments', 'appointment_blocked_dates', 'appointment_requests',
    'appointment_slots', 'checklist_items', 'checklist_sections', 'checklist_templates',
    'client_portal_account_clients', 'client_portal_accounts', 'client_portal_invoices',
    'clients', 'inspection_report_versions', 'inspections', 'legislations', 'photos',
    'profiles', 'responses', 'schedules', 'sync_batches', 'sync_jobs',
    'tenant_checklist_access', 'tenant_users', 'tenants'
  ]
  loop
    execute format('create table public.%I (id uuid primary key default gen_random_uuid())', v_tabela);
    execute format('grant all on table public.%I to anon', v_tabela);
    execute format('grant all on table public.%I to authenticated', v_tabela);
  end loop;
end;
$$;

alter table public.appointment_slots add column is_public boolean default false;
alter table public.appointment_slots add column status text default 'available';
alter table public.appointment_slots enable row level security;
create policy "anon select public slots" on public.appointment_slots
  for select to anon using (is_public = true and status = 'available');

alter table public.appointment_attachments add column storage_bucket text;
alter table public.appointment_attachments add column storage_path text;

create schema storage;
grant usage on schema storage to anon;
grant usage on schema storage to authenticated;
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text
);
alter table storage.objects enable row level security;
grant select on table storage.objects to anon;
create policy "client_portal_published_assets_select_anon" on storage.objects
  for select to anon using (
    bucket_id = any (array['client-portal-files', 'inspection-photos'])
    and exists (
      select 1 from public.appointment_attachments a
      where a.storage_bucket = objects.bucket_id and a.storage_path = objects.name
    )
  );

create function public.sync_inspection_bundle(p_payload jsonb)
returns jsonb language sql as $function$ select p_payload $function$;
grant execute on function public.sync_inspection_bundle(jsonb) to anon;
grant execute on function public.sync_inspection_bundle(jsonb) to authenticated;

-- Antes: `anon` lê a tabela e a policy de storage funciona (devolve 0 linhas, não erro).
do $$
declare
  v_linhas integer;
begin
  set local role anon;
  execute 'select count(*) from public.clients' into v_linhas;
  execute 'select count(*) from storage.objects' into v_linhas;
  reset role;
exception when others then
  reset role;
  raise exception 'o fixture nao reproduziu o estado de hoje: % (%)', sqlerrm, sqlstate;
end;
$$;

\ir ../migrations/20260808185210_sec01_revoke_anon_table_grants.sql

-- ─── `anon` não tem mais nada nas 23 tabelas ──────────────────────────────────
do $$
declare
  v_tabela text;
  v_priv text;
begin
  foreach v_tabela in array array[
    'appointment_attachments', 'appointment_blocked_dates', 'appointment_requests',
    'appointment_slots', 'checklist_items', 'checklist_sections', 'checklist_templates',
    'client_portal_account_clients', 'client_portal_accounts', 'client_portal_invoices',
    'clients', 'inspection_report_versions', 'inspections', 'legislations', 'photos',
    'profiles', 'responses', 'schedules', 'sync_batches', 'sync_jobs',
    'tenant_checklist_access', 'tenant_users', 'tenants'
  ]
  loop
    foreach v_priv in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']
    loop
      if has_table_privilege('anon', 'public.' || quote_ident(v_tabela), v_priv) then
        raise exception 'anon ainda tem % em %', v_priv, v_tabela;
      end if;
    end loop;

    -- E a consultora logada continua enxergando o que enxergava.
    foreach v_priv in array array['select', 'insert', 'update', 'delete']
    loop
      if not has_table_privilege('authenticated', 'public.' || quote_ident(v_tabela), v_priv) then
        raise exception 'authenticated perdeu % em %', v_priv, v_tabela;
      end if;
    end loop;
  end loop;
end;
$$;

-- ─── O comportamento observável muda de "0 linhas" para "permissão negada" ────
do $$
declare
  v_linhas integer;
  v_leu boolean := false;
begin
  begin
    set local role anon;
    execute 'select count(*) from public.clients' into v_linhas;
    v_leu := true;
  exception
    when insufficient_privilege then null;
    when others then
      raise exception 'esperava 42501 em clients, veio % (%)', sqlerrm, sqlstate;
  end;
  reset role;

  if v_leu then
    raise exception 'anon ainda leu clients (% linhas)', v_linhas;
  end if;
end;
$$;

-- ─── As duas policies de `anon` caíram ────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointment_slots'
      and policyname = 'anon select public slots'
  ) then
    raise exception 'a policy de anon em appointment_slots sobreviveu ao revoke';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'client_portal_published_assets_select_anon'
  ) then
    raise exception 'a policy de anon em storage.objects sobreviveu ao revoke';
  end if;
end;
$$;

-- ─── E storage.objects volta a devolver vazio, em vez de erro ─────────────────
--
-- Sem a policy, `anon` não casa com nenhuma policy permissiva: 0 linhas. Com a policy de pé e
-- sem o grant em `appointment_attachments`, esta mesma consulta levantaria
-- `permission denied for table appointment_attachments` — o motivo de as duas coisas andarem
-- juntas nesta migration.
do $$
declare
  v_linhas integer;
begin
  begin
    set local role anon;
    execute 'select count(*) from storage.objects' into v_linhas;
  exception when others then
    raise exception 'storage.objects passou a dar erro para anon: % (%)', sqlerrm, sqlstate;
  end;
  reset role;

  if v_linhas <> 0 then
    raise exception 'anon enxergou objeto no storage: %', v_linhas;
  end if;
end;
$$;

-- ─── A função security invoker deixou de ser oferecida ao papel anônimo ───────
do $$
begin
  if has_function_privilege('anon', 'public.sync_inspection_bundle(jsonb)', 'execute') then
    raise exception 'anon ainda executa sync_inspection_bundle';
  end if;
  if not has_function_privilege('authenticated', 'public.sync_inspection_bundle(jsonb)', 'execute') then
    raise exception 'authenticated perdeu o execute de sync_inspection_bundle';
  end if;
end;
$$;

\echo 'sec01_anon_grants.test.sql OK'
