-- Desfaz o seed de homologação do P360-015.
--
-- Apaga por `tenant_id` — não por prefixo de id — porque os testes E2E criam
-- linhas com id gerado pelo banco (agendamento, evidência, auditoria, solicitação).
-- Filtrar por `aaaa0015%` deixaria essas para trás.
--
-- No fim confere em zero, tabela por tabela, e aborta se sobrar alguma coisa: um
-- teardown que "parece" ter rodado é pior que nenhum.
--
--   psql "$DATABASE_URL" -f supabase/homolog/teardown.sql
--
-- O Storage não é tocado aqui. Se os testes de evidência tiverem subido arquivo,
-- apague os objetos cujo primeiro nível de pasta é um dos dois tenants de
-- homologação (ver docs/rollout.md).

\set ON_ERROR_STOP on

begin;

create temporary table homolog_tenants (id uuid) on commit drop;
insert into homolog_tenants values
  ('aaaa0015-0000-4000-8000-00000000000a'),
  ('aaaa0015-0000-4000-8000-00000000000b');

-- Filhas primeiro; dentro de cada nível, o que referencia vem antes do referenciado.
delete from public.client_action_evidence            where tenant_id in (select id from homolog_tenants);
delete from public.client_action_items               where tenant_id in (select id from homolog_tenants);
delete from public.client_service_request_events     where tenant_id in (select id from homolog_tenants);
delete from public.client_service_requests           where tenant_id in (select id from homolog_tenants);
delete from public.client_portal_audit_events        where tenant_id in (select id from homolog_tenants);
delete from public.appointment_attachments           where tenant_id in (select id from homolog_tenants);
delete from public.appointment_notification_log      where tenant_id in (select id from homolog_tenants);
delete from public.appointment_requests              where tenant_id in (select id from homolog_tenants);
delete from public.appointment_slots                 where tenant_id in (select id from homolog_tenants);
delete from public.appointment_blocks                where tenant_id in (select id from homolog_tenants);
delete from public.appointment_blocked_dates         where tenant_id in (select id from homolog_tenants);
delete from public.schedules                         where tenant_id in (select id from homolog_tenants);
delete from public.photos                            where tenant_id in (select id from homolog_tenants);
delete from public.responses                         where tenant_id in (select id from homolog_tenants);
delete from public.inspection_report_versions        where tenant_id in (select id from homolog_tenants);
delete from public.inspections                       where tenant_id in (select id from homolog_tenants);
delete from public.client_portal_account_features    where tenant_id in (select id from homolog_tenants);
delete from public.client_portal_invoices            where tenant_id in (select id from homolog_tenants);
delete from public.client_portal_account_clients
  where account_id in (select id from public.client_portal_accounts where tenant_id in (select id from homolog_tenants));
delete from public.client_portal_accounts            where tenant_id in (select id from homolog_tenants);
delete from public.client_portal_settings            where tenant_id in (select id from homolog_tenants);
delete from public.clients                           where tenant_id in (select id from homolog_tenants);
delete from public.tenant_checklist_access           where tenant_id in (select id from homolog_tenants);
delete from public.sync_jobs                         where tenant_id in (select id from homolog_tenants);
delete from public.sync_batches                      where tenant_id in (select id from homolog_tenants);
delete from public.tenant_users                      where tenant_id in (select id from homolog_tenants);

delete from auth.identities where user_id::text like 'aaaa0015-0001%';
delete from auth.users      where id::text      like 'aaaa0015-0001%';
delete from public.profiles where id::text      like 'aaaa0015-0001%';

delete from public.tenants  where id in (select id from homolog_tenants);

-- Confere em zero antes de confirmar.
do $$
declare
  v_sobra text := '';
  v_tabela text;
  v_n bigint;
  v_tenants uuid[] := array['aaaa0015-0000-4000-8000-00000000000a','aaaa0015-0000-4000-8000-00000000000b'];
begin
  for v_tabela in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'tenant_id'
  loop
    execute format('select count(*) from public.%I where tenant_id = any($1)', v_tabela)
      into v_n using v_tenants;
    if v_n > 0 then v_sobra := v_sobra || v_tabela || '=' || v_n || ' '; end if;
  end loop;

  select count(*) into v_n from public.tenants where id = any(v_tenants);
  if v_n > 0 then v_sobra := v_sobra || 'tenants=' || v_n || ' '; end if;

  select count(*) into v_n from auth.users where id::text like 'aaaa0015-0001%';
  if v_n > 0 then v_sobra := v_sobra || 'auth.users=' || v_n || ' '; end if;

  if v_sobra <> '' then
    raise exception 'teardown incompleto, sobrou: %', v_sobra;
  end if;

  raise notice 'teardown conferido em zero';
end $$;

commit;
