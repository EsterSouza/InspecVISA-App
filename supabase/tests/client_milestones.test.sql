\set ON_ERROR_STOP on

-- ============================================================================
-- AGD-02 — "outros pontos" da agenda (client_milestones).
-- Migration: supabase/migrations/20260829150000_agd02_client_milestones.sql
--
-- Fixture próprio (Postgres puro, sem o schema do Supabase), no padrão das demais suítes
-- independentes (COND-04, CDT-08): cria os papéis, o schema `private` com os dois helpers
-- de tenant e a tabela `clients` mínima que a migration referencia.
--
-- Tenants: A = aaaa… (o `private.my_tenant_ids()` do fixture só enxerga este)
--          B = bbbb… (consultoria vizinha)
-- ============================================================================

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

-- O Supabase concede ALL em tabela nova de `public` para anon e authenticated por default
-- privilege. Postgres puro não faz isso, e sem reproduzir aqui o teste de grants passaria de
-- graça — foi assim que o risco apareceu no PROD-01.
alter default privileges in schema public grant all on tables to anon, authenticated;

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

grant usage on schema private to authenticated;
grant execute on function private.my_tenant_ids() to authenticated;
grant execute on function private.is_tenant_staff(uuid) to authenticated;

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  name       text not null,
  deleted_at timestamptz
);

insert into public.clients (id, tenant_id, name) values
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Unidade A'),
  ('20000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Unidade B');

\ir ../migrations/20260829093956_agd02_client_milestones.sql

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.client_milestones'::regclass) then
    raise exception 'RLS desligada em client_milestones';
  end if;

  -- O navegador anônimo nunca toca na tabela nem nas RPCs.
  if has_table_privilege('anon', 'public.client_milestones', 'select')
     or has_table_privilege('anon', 'public.client_milestones', 'insert')
     or has_table_privilege('anon', 'public.client_milestones', 'update')
     or has_table_privilege('anon', 'public.client_milestones', 'delete') then
    raise exception 'anon alcanca a tabela de marcos direto';
  end if;

  if has_function_privilege('anon', 'public.admin_create_client_milestone(uuid,text,date,text,text)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.admin_update_client_milestone(uuid,text,date,text)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.admin_set_client_milestone_done(uuid,boolean)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.admin_delete_client_milestone(uuid)'::regprocedure, 'execute') then
    raise exception 'anon executa RPC de marco';
  end if;

  -- Staff lê direto (sob RLS), mas escreve só pela RPC.
  if not has_table_privilege('authenticated', 'public.client_milestones', 'select') then
    raise exception 'staff perdeu a leitura dos marcos';
  end if;
  if has_table_privilege('authenticated', 'public.client_milestones', 'insert')
     or has_table_privilege('authenticated', 'public.client_milestones', 'update')
     or has_table_privilege('authenticated', 'public.client_milestones', 'delete') then
    raise exception 'staff escreve direto na tabela de marcos';
  end if;

  if not has_function_privilege('authenticated', 'public.admin_create_client_milestone(uuid,text,date,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.admin_update_client_milestone(uuid,text,date,text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.admin_set_client_milestone_done(uuid,boolean)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.admin_delete_client_milestone(uuid)'::regprocedure, 'execute') then
    raise exception 'staff perdeu execute nas RPCs de marco';
  end if;
end;
$$;

-- ─── Criar exige título e data ─────────────────────────────────────────────────
do $$
declare
  v_erro boolean := false;
begin
  begin
    perform public.admin_create_client_milestone(
      '10000000-0000-4000-8000-000000000001', '   ', '2026-09-10'
    );
  exception when others then
    v_erro := true;
    if sqlerrm <> 'titulo e obrigatorio' then
      raise exception 'erro errado para titulo vazio: %', sqlerrm;
    end if;
  end;
  if not v_erro then
    raise exception 'aceitou marco sem titulo';
  end if;

  v_erro := false;
  begin
    perform public.admin_create_client_milestone(
      '10000000-0000-4000-8000-000000000001', 'Renovar alvara', null
    );
  exception when others then
    v_erro := true;
    if sqlerrm <> 'data e obrigatoria' then
      raise exception 'erro errado para data nula: %', sqlerrm;
    end if;
  end;
  if not v_erro then
    raise exception 'aceitou marco sem data';
  end if;
end;
$$;

-- ─── Fluxo completo: criar, editar, concluir, reabrir, excluir ────────────────
do $$
declare
  v_result jsonb;
  v_id uuid;
  v_row public.client_milestones%rowtype;
begin
  v_result := public.admin_create_client_milestone(
    '10000000-0000-4000-8000-000000000001',
    'Renovar alvara sanitario',
    '2026-09-10',
    'Levar o protocolo assinado.',
    'Ester Caiafa'
  );
  v_id := (v_result ->> 'id')::uuid;
  if v_id is null then
    raise exception 'criacao nao devolveu id: %', v_result;
  end if;

  select * into v_row from public.client_milestones where id = v_id;
  if v_row.tenant_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid then
    raise exception 'tenant_id nao veio do cliente, veio de outro lugar: %', v_row.tenant_id;
  end if;
  if v_row.title <> 'Renovar alvara sanitario' or v_row.note <> 'Levar o protocolo assinado.' then
    raise exception 'marco nao guardou titulo/nota: %', v_row;
  end if;
  if v_row.done_at is not null then
    raise exception 'marco nasceu concluido';
  end if;

  perform public.admin_update_client_milestone(
    v_id, 'Renovar alvara sanitario (2a via)', '2026-09-15', null
  );
  select * into v_row from public.client_milestones where id = v_id;
  if v_row.title <> 'Renovar alvara sanitario (2a via)'
     or v_row.milestone_date <> '2026-09-15'
     or v_row.note is not null then
    raise exception 'edicao nao aplicou: %', v_row;
  end if;

  perform public.admin_set_client_milestone_done(v_id, true);
  select * into v_row from public.client_milestones where id = v_id;
  if v_row.done_at is null then
    raise exception 'concluir nao marcou done_at';
  end if;

  -- Reabrir limpa done_at (não é histórico a preservar, é lembrete pontual).
  perform public.admin_set_client_milestone_done(v_id, false);
  select * into v_row from public.client_milestones where id = v_id;
  if v_row.done_at is not null then
    raise exception 'reabrir nao limpou done_at';
  end if;

  perform public.admin_delete_client_milestone(v_id);
  if exists (select 1 from public.client_milestones where id = v_id) then
    raise exception 'exclusao nao removeu a linha (deveria ser fisica)';
  end if;
end;
$$;

-- ─── Trava entre tenants: nem por cliente, nem por marco alheio ───────────────
do $$
declare
  v_erro boolean := false;
  v_id_b uuid;
begin
  -- Criar para cliente de outro tenant: sem permissao (tenant resolvido pelo cliente).
  begin
    perform public.admin_create_client_milestone(
      '20000000-0000-4000-8000-000000000001', 'Marco intruso', '2026-09-20'
    );
  exception when others then
    v_erro := true;
    if sqlerrm <> 'sem permissao' then
      raise exception 'erro errado ao criar em cliente alheio: %', sqlerrm;
    end if;
  end;
  if not v_erro then
    raise exception 'criou marco para cliente de outro tenant';
  end if;

  -- Um marco que já existe no tenant B (criado "manualmente" na tabela, simulando staff de B)
  -- não pode ser editado, concluído nem excluído por quem só enxerga o tenant A.
  insert into public.client_milestones (tenant_id, client_id, title, milestone_date)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000001',
          'Marco do tenant B', '2026-09-22')
  returning id into v_id_b;

  v_erro := false;
  begin
    perform public.admin_update_client_milestone(v_id_b, 'Sequestrado', '2026-09-23', null);
  exception when others then
    v_erro := true;
    if sqlerrm <> 'sem permissao' then
      raise exception 'erro errado ao editar marco alheio: %', sqlerrm;
    end if;
  end;
  if not v_erro then
    raise exception 'editou marco de outro tenant';
  end if;

  v_erro := false;
  begin
    perform public.admin_set_client_milestone_done(v_id_b, true);
  exception when others then
    v_erro := true;
    if sqlerrm <> 'sem permissao' then
      raise exception 'erro errado ao concluir marco alheio: %', sqlerrm;
    end if;
  end;
  if not v_erro then
    raise exception 'concluiu marco de outro tenant';
  end if;

  v_erro := false;
  begin
    perform public.admin_delete_client_milestone(v_id_b);
  exception when others then
    v_erro := true;
    if sqlerrm <> 'sem permissao' then
      raise exception 'erro errado ao excluir marco alheio: %', sqlerrm;
    end if;
  end;
  if not v_erro then
    raise exception 'excluiu marco de outro tenant';
  end if;

  if not exists (select 1 from public.client_milestones where id = v_id_b) then
    raise exception 'marco do tenant B foi apagado por engano';
  end if;
end;
$$;

select 'Client milestones (AGD-02) tests passed' as result;
