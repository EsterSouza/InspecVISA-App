\set ON_ERROR_STOP on

-- ============================================================================
-- COND-08 — o contexto congelado e as respostas de roteamento atravessando o
-- bundle de sincronização.
-- Migration: supabase/migrations/20260827100000_cond08_routing_answers_sync.sql
--
-- O que esta suíte prova, e que só o banco pode provar:
--
--   1. as três colunas existem e nascem nulas — inspeção antiga não muda;
--   2. `sync_inspection_bundle` **leva** as quatro chaves (as três novas mais a
--      `applicability_revision_id`, que ele ignorava desde o COND-04);
--   3. um cliente **antigo**, que ainda não envia estas chaves, não apaga o que
--      um cliente novo já gravou — que é o modo de falha "as duas consultoras
--      calculam árvores diferentes", só que pela versão do app;
--   4. jsonb que não é objeto não entra: resposta ilegível nunca vira resposta.
--
-- Fixture próprio, no padrão da suíte do bundle (Postgres puro, sem o schema do
-- Supabase). Tenant A = aaaa… é o único que `is_tenant_staff` reconhece.
-- ============================================================================

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
-- Cópia dos tipos reais de produção, inclusive `applicability_revision_id`, que
-- veio no COND-04 e é a coluna que o bundle ignorava.
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
  last_edited_by text, finalized_by jsonb, reference_sources jsonb,
  applicability_revision_id uuid
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
\ir ../migrations/20260827100000_cond08_routing_answers_sync.sql

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

insert into public.clients (id, tenant_id)
values ('20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

-- ── 1 · Aditiva de verdade: inspeção que já existia não muda ────────────────
insert into public.inspections (
  id, client_id, template_id, consultant_name, inspection_date, status,
  created_at, updated_at, tenant_id, consultant_names, finalized_by
) values (
  '30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001',
  'tpl-legado', 'Consultora', now(), 'in_progress', now(), now(),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', array['Consultora'], '[]'
);

do $$
begin
  if (select count(*) from public.inspections
      where id = '30000000-0000-4000-8000-000000000009'
        and applicability_context is null
        and routing_answers is null
        and routing_answers_meta is null) <> 1 then
    raise exception 'coluna nova nasceu com valor: inspecao antiga mudou de comportamento';
  end if;
end;
$$;

-- ── 2 · O bundle leva as quatro chaves ──────────────────────────────────────
do $$
declare resultado jsonb;
begin
  resultado := public.sync_inspection_bundle(jsonb_build_object(
    'inspection', jsonb_build_object(
      'id', '30000000-0000-4000-8000-000000000001',
      'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'template_id', 'tpl-estetica',
      'consultant_name', 'Ester',
      'inspection_date', now(),
      'status', 'in_progress',
      'created_at', now(),
      'updated_at', now(),
      'applicability_revision_id', '70000000-0000-4000-8000-000000000001',
      'applicability_context', jsonb_build_object('uf', 'RJ', 'categoria', 'estetica'),
      'routing_answers', jsonb_build_object('q-processa', true),
      'routing_answers_meta', jsonb_build_object(
        'q-processa', jsonb_build_object('at', '2026-08-27T10:00:00.000Z', 'by', 'Ester')
      )
    ),
    'responses', '[]'::jsonb,
    'photos', '[]'::jsonb
  ));

  if resultado ->> 'ok' <> 'true' then
    raise exception 'bundle recusou o payload: %', resultado;
  end if;

  if (select applicability_revision_id from public.inspections where id = '30000000-0000-4000-8000-000000000001')
     is distinct from '70000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'bundle descartou o vinculo com a revisao';
  end if;

  if (select applicability_context ->> 'uf' from public.inspections where id = '30000000-0000-4000-8000-000000000001')
     is distinct from 'RJ' then
    raise exception 'bundle descartou o contexto congelado';
  end if;

  if (select routing_answers ->> 'q-processa' from public.inspections where id = '30000000-0000-4000-8000-000000000001')
     is distinct from 'true' then
    raise exception 'bundle descartou a resposta de roteamento';
  end if;

  if (select routing_answers_meta -> 'q-processa' ->> 'by' from public.inspections where id = '30000000-0000-4000-8000-000000000001')
     is distinct from 'Ester' then
    raise exception 'bundle descartou a autoria da resposta de roteamento';
  end if;
end;
$$;

-- ── 3 · Cliente antigo não apaga o que o cliente novo gravou ────────────────
do $$
begin
  perform public.sync_inspection_bundle(jsonb_build_object(
    'inspection', jsonb_build_object(
      'id', '30000000-0000-4000-8000-000000000001',
      'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'template_id', 'tpl-estetica',
      'consultant_name', 'Ana',
      'inspection_date', now(),
      'status', 'in_progress',
      'created_at', now(),
      'updated_at', now()
    ),
    'responses', '[]'::jsonb,
    'photos', '[]'::jsonb
  ));

  if (select routing_answers ->> 'q-processa' from public.inspections where id = '30000000-0000-4000-8000-000000000001')
     is distinct from 'true' then
    raise exception 'app antigo apagou a resposta de roteamento gravada pelo app novo';
  end if;
  if (select applicability_revision_id from public.inspections where id = '30000000-0000-4000-8000-000000000001')
     is distinct from '70000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'app antigo apagou o vinculo com a revisao';
  end if;
  if (select consultant_name from public.inspections where id = '30000000-0000-4000-8000-000000000001')
     is distinct from 'Ana' then
    raise exception 'o resto do registro deixou de ser atualizado';
  end if;
end;
$$;

-- ── 4 · Resposta ilegível não vira resposta ─────────────────────────────────
do $$
begin
  perform public.sync_inspection_bundle(jsonb_build_object(
    'inspection', jsonb_build_object(
      'id', '30000000-0000-4000-8000-000000000002',
      'tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'template_id', 'tpl-estetica',
      'consultant_name', 'Ester',
      'inspection_date', now(),
      'status', 'in_progress',
      'created_at', now(),
      'updated_at', now(),
      'routing_answers', '["nao sou objeto"]'::jsonb,
      'applicability_context', '"tambem nao"'::jsonb
    ),
    'responses', '[]'::jsonb,
    'photos', '[]'::jsonb
  ));

  if (select routing_answers from public.inspections where id = '30000000-0000-4000-8000-000000000002') is not null then
    raise exception 'lista foi aceita como mapa de respostas';
  end if;
  if (select applicability_context from public.inspections where id = '30000000-0000-4000-8000-000000000002') is not null then
    raise exception 'texto foi aceito como contexto congelado';
  end if;
end;
$$;

-- ── 5 · A função continua fechada para `anon` ───────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.sync_inspection_bundle(jsonb)', 'execute') then
    raise exception 'anon executa o bundle de sincronizacao';
  end if;
end;
$$;

select 'COND-08 routing answers sync tests passed' as result;
