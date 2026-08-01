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

create or replace function public.admin_create_client_portal_account(uuid, text, text, text, uuid[])
returns void language sql security definer as $$ select $$;
create or replace function public.admin_create_client_portal_account(uuid, text, text, text, uuid[], text)
returns void language sql security definer as $$ select $$;
create or replace function public.admin_regenerate_client_portal_token(uuid)
returns void language sql security definer as $$ select $$;
create or replace function public.admin_set_portal_access_code(uuid, text)
returns void language sql security definer as $$ select $$;
create or replace function public.admin_set_portal_payment(uuid, text, text, text)
returns void language sql security definer as $$ select $$;
create or replace function public.admin_set_portal_payment(uuid, text, text, text, date)
returns void language sql security definer as $$ select $$;
create or replace function public.admin_set_portal_payment(uuid, text, text, text, date, jsonb)
returns void language sql security definer as $$ select $$;
create or replace function public.admin_set_portal_scheduling_suspended(uuid, boolean)
returns void language sql security definer as $$ select $$;
create or replace function public.admin_update_client_portal_account(uuid, text, text)
returns void language sql security definer as $$ select $$;
create or replace function public.is_tenant_admin(uuid)
returns boolean language sql security definer as $$ select false $$;
create or replace function public.is_tenant_staff(uuid)
returns boolean language sql security definer as $$ select false $$;
create or replace function public.my_tenant_ids()
returns setof uuid language sql security definer as $$ select null::uuid where false $$;
create or replace function public.notify_new_appointment()
returns trigger language plpgsql security definer as $$ begin return new; end $$;
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer as $$ begin end $$;

create or replace function public.client_portal_login(text, text)
returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
create or replace function public.client_portal_overview(uuid)
returns jsonb language sql security definer as $$ select '{}'::jsonb $$;
grant execute on function public.client_portal_login(text, text) to anon;
grant execute on function public.client_portal_overview(uuid) to anon;

\ir ../migrations/20260801144828_harden_portal_rpc_permissions.sql

do $$
declare
  signature regprocedure;
begin
  foreach signature in array array[
    'public.admin_create_client_portal_account(uuid,text,text,text,uuid[])'::regprocedure,
    'public.admin_create_client_portal_account(uuid,text,text,text,uuid[],text)'::regprocedure,
    'public.admin_regenerate_client_portal_token(uuid)'::regprocedure,
    'public.admin_set_portal_access_code(uuid,text)'::regprocedure,
    'public.admin_set_portal_payment(uuid,text,text,text)'::regprocedure,
    'public.admin_set_portal_payment(uuid,text,text,text,date)'::regprocedure,
    'public.admin_set_portal_payment(uuid,text,text,text,date,jsonb)'::regprocedure,
    'public.admin_set_portal_scheduling_suspended(uuid,boolean)'::regprocedure,
    'public.admin_update_client_portal_account(uuid,text,text)'::regprocedure,
    'public.is_tenant_admin(uuid)'::regprocedure,
    'public.is_tenant_staff(uuid)'::regprocedure,
    'public.my_tenant_ids()'::regprocedure
  ]
  loop
    if has_function_privilege('anon', signature, 'execute') then
      raise exception 'anon ainda executa %', signature;
    end if;
    if not has_function_privilege('authenticated', signature, 'execute') then
      raise exception 'authenticated perdeu acesso a %', signature;
    end if;
  end loop;

  foreach signature in array array[
    'public.notify_new_appointment()'::regprocedure,
    'public.rls_auto_enable()'::regprocedure
  ]
  loop
    if has_function_privilege('anon', signature, 'execute')
       or has_function_privilege('authenticated', signature, 'execute')
       or has_function_privilege('service_role', signature, 'execute') then
      raise exception 'funcao interna continua exposta: %', signature;
    end if;
  end loop;

  if not has_function_privilege('anon', 'public.client_portal_login(text,text)', 'execute')
     or not has_function_privilege('anon', 'public.client_portal_overview(uuid)', 'execute') then
    raise exception 'endpoint anonimo legitimo foi bloqueado';
  end if;
end;
$$;

select 'Portal RPC permission hardening tests passed' as result;
