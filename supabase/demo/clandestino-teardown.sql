-- Desfaz o seed de demonstração do cliente "Clandestino Beauty"
-- (supabase/demo/clandestino-seed.sql).
--
-- Escopado por PREFIXO DE ID (`de000026%`), nunca por tenant_id — este seed
-- vive dentro do tenant de produção real (60191f17-6733-4439-9fd4-cceace47bf30),
-- que tem clientes de verdade que não podem ser tocados.
--
-- A unidade 1 (CLANDESTINO BEAUTY, id f87d239e-6a0b-457c-a1a5-a1b71611b5af) é
-- um cliente REAL pré-existente que o seed só atualizou (nome/cidade/UF/CNPJ/
-- pasta) — este teardown NÃO apaga esse cliente nem sua inspeção/respostas
-- reais, só os agendamentos e itens de plano de ação que o seed criou por
-- cima (identificáveis pelo prefixo de id, não pelo client_id). Só a unidade 2
-- é inteiramente nova e é apagada de fato.
--
-- O Storage não é tocado aqui. Se o PDF do relatório e as notas fiscais fictícias
-- tiverem sido publicados pela UI (passos manuais do plano), apagar os objetos
-- correspondentes no bucket `client-portal-files` separadamente.
--
--   psql "$DATABASE_URL" -f supabase/demo/clandestino-teardown.sql

\set ON_ERROR_STOP on

begin;

create temporary table clandestino_clients (id uuid) on commit drop;
insert into clandestino_clients values
  ('de000026-0002-4000-8000-000000000002');

create temporary table clandestino_accounts (id uuid) on commit drop;
insert into clandestino_accounts values
  ('de000026-0003-4000-8000-000000000001');

delete from public.client_action_items
  where id::text like 'de000026%' or client_id in (select id from clandestino_clients);
delete from public.appointment_attachments
  where appointment_request_id::text like 'de000026%';
delete from public.appointment_requests
  where id::text like 'de000026%' or client_id in (select id from clandestino_clients);
delete from public.responses
  where inspection_id::text like 'de000026%';
delete from public.inspections
  where id::text like 'de000026%' or client_id in (select id from clandestino_clients);
delete from public.client_portal_invoices
  where account_id in (select id from clandestino_accounts);
delete from public.client_portal_account_clients
  where account_id in (select id from clandestino_accounts);
delete from public.client_portal_accounts
  where id in (select id from clandestino_accounts);
delete from public.clients
  where id in (select id from clandestino_clients);

-- Confere em zero antes de confirmar.
do $$
declare
  v_sobra text := '';
  v_n bigint;
begin
  select count(*) into v_n from public.clients where id::text like 'de000026%';
  if v_n > 0 then v_sobra := v_sobra || 'clients=' || v_n || ' '; end if;

  select count(*) into v_n from public.client_portal_accounts where id::text like 'de000026%';
  if v_n > 0 then v_sobra := v_sobra || 'client_portal_accounts=' || v_n || ' '; end if;

  select count(*) into v_n from public.client_portal_account_clients where account_id::text like 'de000026%';
  if v_n > 0 then v_sobra := v_sobra || 'client_portal_account_clients=' || v_n || ' '; end if;

  select count(*) into v_n from public.inspections where id::text like 'de000026%';
  if v_n > 0 then v_sobra := v_sobra || 'inspections=' || v_n || ' '; end if;

  select count(*) into v_n from public.responses where inspection_id::text like 'de000026%';
  if v_n > 0 then v_sobra := v_sobra || 'responses=' || v_n || ' '; end if;

  select count(*) into v_n from public.client_action_items where id::text like 'de000026%';
  if v_n > 0 then v_sobra := v_sobra || 'client_action_items=' || v_n || ' '; end if;

  select count(*) into v_n from public.appointment_requests where id::text like 'de000026%';
  if v_n > 0 then v_sobra := v_sobra || 'appointment_requests=' || v_n || ' '; end if;

  if v_sobra <> '' then
    raise exception 'teardown incompleto, sobrou: %', v_sobra;
  end if;

  raise notice 'teardown do Clandestino conferido em zero';
end $$;

commit;
