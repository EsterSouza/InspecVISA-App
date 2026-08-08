-- Homologação do P360-015 — dados de teste dentro do projeto de produção.
--
-- Por que aqui e não num branch: o que mais interessa provar é o isolamento entre
-- tenants e as permissões de RLS/RPC, e isso só vale contra o banco de verdade. A
-- contenção é outra: dois tenants próprios, tudo com prefixo `[HOMOLOG]` e ids
-- fixos começando em `aaaa0015`, e um `teardown.sql` que apaga por tenant e
-- confere em zero.
--
-- Idempotente: pode rodar de novo sem duplicar.
--
-- Aplicar (as senhas NÃO ficam versionadas — ver docs/rollout.md):
--   psql "$DATABASE_URL" \
--     -v senha_staff="'...'" -v codigo_ok="'...'" \
--     -v codigo_atraso="'...'" -v codigo_outro="'...'" \
--     -f supabase/homolog/seed.sql

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------- tenants
insert into public.tenants (id, name, slug) values
  ('aaaa0015-0000-4000-8000-00000000000a', '[HOMOLOG] Tenant A', 'homolog-a'),
  ('aaaa0015-0000-4000-8000-00000000000b', '[HOMOLOG] Tenant B', 'homolog-b')
on conflict (id) do update set name = excluded.name;

-- ------------------------------------------------------- usuários de staff
-- Inserção direta em `auth`: as RPCs `admin_*` exigem `is_tenant_staff(auth.uid())`
-- e o service role não tem `auth.uid()`, então não dá para usá-las no seed.
-- Os campos de token vão como '' e não NULL de propósito. O GoTrue lê essas
-- colunas em `string` do Go: com NULL, o login devolve
-- `500 Database error querying schema` — erro que não menciona coluna nenhuma e
-- parece problema de senha. Usuário criado pelo painel do Supabase já nasce com ''.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaa0015-0001-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'homolog.staff.a@inspecvisa.test',
   extensions.crypt(:senha_staff, extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"homolog":true}'::jsonb,
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaa0015-0001-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'homolog.staff.b@inspecvisa.test',
   extensions.crypt(:senha_staff, extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"homolog":true}'::jsonb,
   '', '', '', '', '', '', '', '')
on conflict (id) do update set
  encrypted_password         = excluded.encrypted_password,
  confirmation_token         = coalesce(auth.users.confirmation_token, ''),
  recovery_token             = coalesce(auth.users.recovery_token, ''),
  email_change               = coalesce(auth.users.email_change, ''),
  email_change_token_new     = coalesce(auth.users.email_change_token_new, ''),
  email_change_token_current = coalesce(auth.users.email_change_token_current, ''),
  phone_change               = coalesce(auth.users.phone_change, ''),
  phone_change_token         = coalesce(auth.users.phone_change_token, ''),
  reauthentication_token     = coalesce(auth.users.reauthentication_token, '');

-- O GoTrue só aceita login por senha se houver identity do provider `email`.
-- `auth.identities.email` é coluna gerada a partir de `identity_data`: não entra no insert.
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values
  ('aaaa0015-0001-4000-8000-00000000000a', 'aaaa0015-0001-4000-8000-00000000000a',
   '{"sub":"aaaa0015-0001-4000-8000-00000000000a","email":"homolog.staff.a@inspecvisa.test","email_verified":true}'::jsonb,
   'email', now(), now()),
  ('aaaa0015-0001-4000-8000-00000000000b', 'aaaa0015-0001-4000-8000-00000000000b',
   '{"sub":"aaaa0015-0001-4000-8000-00000000000b","email":"homolog.staff.b@inspecvisa.test","email_verified":true}'::jsonb,
   'email', now(), now())
on conflict (provider, provider_id) do nothing;

insert into public.profiles (id, name, full_name) values
  ('aaaa0015-0001-4000-8000-00000000000a', '[HOMOLOG] Consultora A', '[HOMOLOG] Consultora A'),
  ('aaaa0015-0001-4000-8000-00000000000b', '[HOMOLOG] Consultora B', '[HOMOLOG] Consultora B')
on conflict (id) do update set name = excluded.name;

insert into public.tenant_users (id, tenant_id, user_id, role) values
  ('aaaa0015-0008-4000-8000-00000000000a', 'aaaa0015-0000-4000-8000-00000000000a',
   'aaaa0015-0001-4000-8000-00000000000a', 'admin'),
  ('aaaa0015-0008-4000-8000-00000000000b', 'aaaa0015-0000-4000-8000-00000000000b',
   'aaaa0015-0001-4000-8000-00000000000b', 'admin')
on conflict (id) do update set role = excluded.role;

-- --------------------------------------------------------------- unidades
-- A unidade 1 tem pasta personalizada, a 2 não: é o par que o teste de
-- "pasta principal versus personalizada" precisa para distinguir os dois botões.
insert into public.clients (
  id, tenant_id, name, category, city, state,
  has_personalized_sanitary_folder, personalized_sanitary_folder_url
) values
  ('aaaa0015-0002-4000-8000-000000000001', 'aaaa0015-0000-4000-8000-00000000000a',
   '[HOMOLOG] Unidade Com Pasta', 'ilpi', 'Rio de Janeiro', 'RJ',
   true, 'https://drive.google.com/drive/folders/homolog-personalizada'),
  ('aaaa0015-0002-4000-8000-000000000002', 'aaaa0015-0000-4000-8000-00000000000a',
   '[HOMOLOG] Unidade Sem Pasta', 'clinica', 'Niterói', 'RJ', false, null),
  ('aaaa0015-0002-4000-8000-00000000000b', 'aaaa0015-0000-4000-8000-00000000000b',
   '[HOMOLOG] Unidade Do Outro Tenant', 'clinica', 'Rio de Janeiro', 'RJ', false, null)
on conflict (id) do update set name = excluded.name, tenant_id = excluded.tenant_id;

-- ------------------------------------------------- configuração do portal
insert into public.client_portal_settings (
  tenant_id, tutorial_pdf_url, support_whatsapp, quick_access_enabled,
  multi_purpose_schedule, action_plan_enabled, service_requests_enabled, overdue_grace_days
) values
  ('aaaa0015-0000-4000-8000-00000000000a', 'https://exemplo.test/homolog-tutorial.pdf',
   '21993397315', true, true, true, true, 5),
  ('aaaa0015-0000-4000-8000-00000000000b', null, null, true, false, true, false, 5)
on conflict (tenant_id) do update set
  tutorial_pdf_url = excluded.tutorial_pdf_url,
  multi_purpose_schedule = excluded.multi_purpose_schedule,
  service_requests_enabled = excluded.service_requests_enabled;

-- ---------------------------------------------------- contas do portal
-- Três estados que os testes precisam distinguir: em dia, em atraso (o gate
-- suspende agendar mas não pode esconder a entrega — PORT-01) e de outro tenant.
-- `payment_status` só aceita 'pending' ou 'paid'; quem define o atraso é a data
-- de vencimento com a tolerância do tenant.
insert into public.client_portal_accounts (
  id, tenant_id, name, email, access_code_hash, access_code_plain,
  is_active, payment_type, payment_status, payment_due_date, main_drive_folder_url
) values
  ('aaaa0015-0003-4000-8000-000000000001', 'aaaa0015-0000-4000-8000-00000000000a',
   '[HOMOLOG] Conta Em Dia', 'homolog.portal@inspecvisa.test',
   extensions.crypt(:codigo_ok, extensions.gen_salt('bf')), :codigo_ok,
   true, 'monthly', 'paid', (current_date + 30),
   'https://drive.google.com/drive/folders/homolog-principal'),
  ('aaaa0015-0003-4000-8000-000000000002', 'aaaa0015-0000-4000-8000-00000000000a',
   '[HOMOLOG] Conta Em Atraso', 'homolog.atraso@inspecvisa.test',
   extensions.crypt(:codigo_atraso, extensions.gen_salt('bf')), :codigo_atraso,
   true, 'monthly', 'pending', (current_date - 30), null),
  ('aaaa0015-0003-4000-8000-00000000000b', 'aaaa0015-0000-4000-8000-00000000000b',
   '[HOMOLOG] Conta Do Outro Tenant', 'homolog.outrotenant@inspecvisa.test',
   extensions.crypt(:codigo_outro, extensions.gen_salt('bf')), :codigo_outro,
   true, 'monthly', 'paid', (current_date + 30), null)
on conflict (id) do update set
  access_code_hash = excluded.access_code_hash,
  access_code_plain = excluded.access_code_plain,
  payment_type = excluded.payment_type,
  payment_status = excluded.payment_status,
  payment_due_date = excluded.payment_due_date,
  main_drive_folder_url = excluded.main_drive_folder_url,
  is_active = true;

insert into public.client_portal_account_clients (account_id, client_id) values
  ('aaaa0015-0003-4000-8000-000000000001', 'aaaa0015-0002-4000-8000-000000000001'),
  ('aaaa0015-0003-4000-8000-000000000001', 'aaaa0015-0002-4000-8000-000000000002'),
  ('aaaa0015-0003-4000-8000-000000000002', 'aaaa0015-0002-4000-8000-000000000001'),
  ('aaaa0015-0003-4000-8000-00000000000b', 'aaaa0015-0002-4000-8000-00000000000b')
on conflict do nothing;

-- ------------------------------------------- visita concluída e entregue
insert into public.inspections (
  id, tenant_id, client_id, template_id, consultant_name, consultant_names,
  inspection_date, status, completed_at
) values
  ('aaaa0015-0004-4000-8000-000000000001', 'aaaa0015-0000-4000-8000-00000000000a',
   'aaaa0015-0002-4000-8000-000000000001', 'tpl-homolog', '[HOMOLOG] Consultora A',
   array['[HOMOLOG] Consultora A'], now() - interval '20 days', 'completed', now() - interval '18 days')
on conflict (id) do update set status = excluded.status;

-- Os dois compromissos que o teste "inspeção e reunião sem contaminação" compara.
-- O tipo tem de sair da lista que `private.resolve_appointment_duration_minutes`
-- aceita (inspection, follow_up_meeting, results_meeting, document_guidance, audit,
-- online_followup, training, other, briefing) — 'meeting' não existe — e o
-- intervalo precisa bater exatamente com `duration_minutes`, senão o gatilho recusa.
insert into public.appointment_requests (
  id, tenant_id, client_id, inspection_id, unit_name, district, responsible_name,
  requested_date, requested_starts_at, requested_ends_at, status, appointment_type,
  duration_minutes, consultant_names, compliance_score, total_nc_count, report_hidden
) values
  ('aaaa0015-0005-4000-8000-000000000001', 'aaaa0015-0000-4000-8000-00000000000a',
   'aaaa0015-0002-4000-8000-000000000001', 'aaaa0015-0004-4000-8000-000000000001',
   '[HOMOLOG] Unidade Com Pasta', 'Centro', '[HOMOLOG] Responsavel',
   (current_date - 20), date_trunc('hour', now() - interval '20 days'),
   date_trunc('hour', now() - interval '20 days') + interval '4 hours',
   'completed', 'inspection', 240, array['[HOMOLOG] Consultora A'], 72, 3, false),
  ('aaaa0015-0005-4000-8000-000000000002', 'aaaa0015-0000-4000-8000-00000000000a',
   'aaaa0015-0002-4000-8000-000000000002', null,
   '[HOMOLOG] Unidade Sem Pasta', 'Centro', '[HOMOLOG] Responsavel',
   (current_date + 7), date_trunc('hour', now() + interval '7 days'),
   date_trunc('hour', now() + interval '7 days') + interval '30 minutes',
   'confirmed', 'follow_up_meeting', 30, array['[HOMOLOG] Consultora A'], null, null, false)
on conflict (id) do update set status = excluded.status, report_hidden = excluded.report_hidden;

-- ------------------------------------------------------ plano de ação
insert into public.client_action_items (
  id, tenant_id, client_id, appointment_request_id, inspection_id, source_item_id,
  title, situation, recommended_action, priority, status, due_date,
  first_detected_on, last_detected_on, published_at
) values
  ('aaaa0015-0006-4000-8000-000000000001', 'aaaa0015-0000-4000-8000-00000000000a',
   'aaaa0015-0002-4000-8000-000000000001', 'aaaa0015-0005-4000-8000-000000000001',
   'aaaa0015-0004-4000-8000-000000000001', 'homolog-item-001',
   '[HOMOLOG] Pendencia aberta para teste de evidencia',
   'Item registrado apenas para homologacao.',
   'Enviar comprovante pelo portal.', 'important', 'published', (current_date + 15),
   (current_date - 20), (current_date - 20), now() - interval '18 days'),
  ('aaaa0015-0006-4000-8000-000000000002', 'aaaa0015-0000-4000-8000-00000000000a',
   'aaaa0015-0002-4000-8000-000000000001', 'aaaa0015-0005-4000-8000-000000000001',
   'aaaa0015-0004-4000-8000-000000000001', 'homolog-item-002',
   '[HOMOLOG] Pendencia vencida para teste de prazo',
   'Item registrado apenas para homologacao.',
   'Regularizar e informar pelo portal.', 'urgent', 'published', (current_date - 3),
   (current_date - 20), (current_date - 20), now() - interval '18 days')
on conflict (id) do update set
  status = 'published', due_date = excluded.due_date, priority = excluded.priority;

commit;

-- --------------------------------------------------------- verificação
select 'tenants' as tabela, count(*) as n from public.tenants where id::text like 'aaaa0015%'
union all select 'auth.users', count(*) from auth.users where id::text like 'aaaa0015%'
union all select 'auth.identities', count(*) from auth.identities where user_id::text like 'aaaa0015%'
union all select 'profiles', count(*) from public.profiles where id::text like 'aaaa0015%'
union all select 'tenant_users', count(*) from public.tenant_users where id::text like 'aaaa0015%'
union all select 'clients', count(*) from public.clients where id::text like 'aaaa0015%'
union all select 'portal_settings', count(*) from public.client_portal_settings where tenant_id::text like 'aaaa0015%'
union all select 'portal_accounts', count(*) from public.client_portal_accounts where id::text like 'aaaa0015%'
union all select 'portal_account_clients', count(*) from public.client_portal_account_clients where account_id::text like 'aaaa0015%'
union all select 'inspections', count(*) from public.inspections where id::text like 'aaaa0015%'
union all select 'appointment_requests', count(*) from public.appointment_requests where id::text like 'aaaa0015%'
union all select 'client_action_items', count(*) from public.client_action_items where id::text like 'aaaa0015%';
