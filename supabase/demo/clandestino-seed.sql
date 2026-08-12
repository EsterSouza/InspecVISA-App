-- Cliente "Clandestino Beauty" — dados de demonstração para o vídeo tutorial
-- do portal do cliente.
--
-- Vive no TENANT DE PRODUÇÃO REAL (60191f17-6733-4439-9fd4-cceace47bf30). A
-- unidade 1 REAPROVEITA um cliente real já existente, `CLANDESTINO BEAUTY`
-- (id f87d239e-6a0b-457c-a1a5-a1b71611b5af), que já tinha uma inspeção
-- concluída de verdade (18/05/2026, 57% de conformidade, 23 não conformidades)
-- mas nunca teve acesso ao portal. Só a unidade 2 e o restante da estrutura de
-- portal/agenda/plano de ação são novos, com prefixo de id `de000026-`
-- (distinto do `aaaa0015-` do seed de homologação), fácil de apagar depois
-- com clandestino-teardown.sql — que NÃO apaga o cliente real, só o que este
-- script adicionou.
--
-- O que este script NÃO faz de propósito (fica para os passos manuais no
-- navegador, descritos no plano):
--   - Não gera nem publica o PDF do relatório (geração é só client-side,
--     jsPDF em src/utils/pdfGenerator.ts). O agendamento passado fica como
--     'completed', não 'report_available' — essa transição acontece sozinha
--     quando alguém gera o PDF pela tela da inspeção (InspectionSummary),
--     SE a inspeção já estiver ligada a um appointment_request (como este
--     script já deixa pronto): o app publica o PDF, marca report_available e
--     RECONCILIA o plano de ação sozinho a partir de TODOS os itens não
--     conformes da inspeção — não só os 4 inseridos abaixo. Essa reconciliação
--     sobrescreve título/situação (usa o texto cru do item do checklist) e
--     ZERA o due_date de qualquer item que não esteja 'resolved'. Por isso,
--     depois de gerar o PDF pela UI, é preciso reaplicar manualmente os
--     due_date dos itens que devem aparecer com prazo (ver nota no plano).
--   - Não insere client_portal_invoices nem appointment_attachments — usar o
--     upload real (InvoicesModal.tsx / PublishedFilesPanel.tsx).
--   - Não mexe em client_portal_settings — já existe uma linha para este tenant.
--   - Não toca nas respostas (`responses`) da inspeção real — são dado de
--     verdade, só o plano de ação é adicionado por cima.
--
-- Idempotente (on conflict do update). Aplicar via MCP Supabase (execute_sql,
-- projeto pfjacmawaigndqclgvpn) ou psql "$DATABASE_URL" -f supabase/demo/clandestino-seed.sql

\set ON_ERROR_STOP on

begin;

-- ------------------------------------------------ unidade 1 (cliente real)
-- Só completa cadastro (cidade/UF/CNPJ/responsável/pasta) — não mexe em nada
-- que já existisse.
update public.clients set
  name = 'CLANDESTINO BEAUTY — Barra da Tijuca',
  city = 'Rio de Janeiro',
  state = 'RJ',
  cnpj = '11.111.111/1111-11',
  responsible_name = 'Camila Duarte',
  has_personalized_sanitary_folder = true,
  personalized_sanitary_folder_url = 'https://drive.google.com/drive/folders/1a2B3cCLANDESTINOfake001',
  has_online_followup = true
where id = 'f87d239e-6a0b-457c-a1a5-a1b71611b5af';

-- ------------------------------------------------------- unidade 2 (nova)
insert into public.clients (
  id, tenant_id, name, cnpj, category, city, state, responsible_name,
  has_personalized_sanitary_folder, has_audit_service, has_online_followup
) values
  ('de000026-0002-4000-8000-000000000002', '60191f17-6733-4439-9fd4-cceace47bf30',
   'CLANDESTINO BEAUTY — Recreio dos Bandeirantes', '11.111.111/2222-22', 'estetica',
   'Rio de Janeiro', 'RJ', 'Camila Duarte',
   false, false, true)
on conflict (id) do update set name = excluded.name, category = excluded.category;

-- ------------------------------------------------------ conta do portal
insert into public.client_portal_accounts (
  id, tenant_id, name, email, access_code_hash, access_code_plain,
  is_active, payment_type, payment_status, payment_due_date,
  scheduling_suspension_mode, main_drive_folder_url
) values
  ('de000026-0003-4000-8000-000000000001', '60191f17-6733-4439-9fd4-cceace47bf30',
   'CLANDESTINO BEAUTY', 'clandestino.demo@consultorasanitaria.com.br',
   extensions.crypt('CLAND2026', extensions.gen_salt('bf')), 'CLAND2026',
   true, 'monthly', 'pending', (current_date + 18),
   'always_open', 'https://drive.google.com/drive/folders/1a2B3cCLANDESTINOfake000')
on conflict (id) do update set
  access_code_hash = excluded.access_code_hash,
  access_code_plain = excluded.access_code_plain,
  payment_type = excluded.payment_type,
  payment_status = excluded.payment_status,
  payment_due_date = excluded.payment_due_date,
  scheduling_suspension_mode = excluded.scheduling_suspension_mode,
  main_drive_folder_url = excluded.main_drive_folder_url,
  is_active = true;

insert into public.client_portal_account_clients (account_id, client_id) values
  ('de000026-0003-4000-8000-000000000001', 'f87d239e-6a0b-457c-a1a5-a1b71611b5af'),
  ('de000026-0003-4000-8000-000000000001', 'de000026-0002-4000-8000-000000000002')
on conflict do nothing;

-- ------------------------------------------------------------ agendamentos
-- Passado: liga a inspeção REAL já existente (64160eb0-d7f3-4aaf-a615-402a2cdc0459,
-- 18/05/2026, 71% de conformidade ao vivo na InspectionSummary, 16 urgentes +
-- 3 importantes = 23 NC). Futuros: horários já
-- conferidos como livres na agenda real da Ester em 12/08/2026 (nada agendado
-- entre 01/09 e 11/09/2026) — reconferir antes de rodar se muito tempo tiver
-- passado. Todos appointment_type='inspection' (constraint
-- appointment_requests_non_inspection_sanitary_check exige isso sempre que há
-- inspection_id/scores).
insert into public.appointment_requests (
  id, tenant_id, client_id, inspection_id, unit_name, district, responsible_name,
  requested_date, requested_starts_at, requested_ends_at, status, appointment_type,
  duration_minutes, consultant_names, attendance_mode,
  compliance_score, critical_nc_count, important_nc_count, total_nc_count, report_hidden
) values
  ('de000026-0005-4000-8000-000000000001', '60191f17-6733-4439-9fd4-cceace47bf30',
   'f87d239e-6a0b-457c-a1a5-a1b71611b5af', '64160eb0-d7f3-4aaf-a615-402a2cdc0459',
   'CLANDESTINO BEAUTY — Barra da Tijuca', 'Barra da Tijuca', 'Camila Duarte',
   date '2026-05-18',
   timestamptz '2026-05-18 09:00:00-03', timestamptz '2026-05-18 13:00:00-03',
   'completed', 'inspection', 240, array['Ester Caiafa'], 'presencial',
   71, 16, 3, 23, false),
  ('de000026-0005-4000-8000-000000000002', '60191f17-6733-4439-9fd4-cceace47bf30',
   'f87d239e-6a0b-457c-a1a5-a1b71611b5af', null,
   'CLANDESTINO BEAUTY — Barra da Tijuca', 'Barra da Tijuca', 'Camila Duarte',
   date '2026-09-02',
   timestamptz '2026-09-02 09:00:00-03', timestamptz '2026-09-02 13:00:00-03',
   'confirmed', 'inspection', 240, array['Ester Caiafa'], 'presencial',
   null, null, null, null, false),
  ('de000026-0005-4000-8000-000000000003', '60191f17-6733-4439-9fd4-cceace47bf30',
   'de000026-0002-4000-8000-000000000002', null,
   'CLANDESTINO BEAUTY — Recreio dos Bandeirantes', 'Recreio dos Bandeirantes', 'Camila Duarte',
   date '2026-09-04',
   timestamptz '2026-09-04 09:00:00-03', timestamptz '2026-09-04 13:00:00-03',
   'confirmed', 'inspection', 240, array['Ester Caiafa'], 'presencial',
   null, null, null, null, false)
on conflict (id) do update set
  status = excluded.status, report_hidden = excluded.report_hidden,
  requested_starts_at = excluded.requested_starts_at, requested_ends_at = excluded.requested_ends_at;

-- --------------------------------------------------------- plano de ação
-- 4 dos 23 itens não conformes reais da inspeção, com source_item_id = uuid
-- real de checklist_items (não item_id de roteiro estático). Mix pedido:
-- 1 resolvido, 1 important dentro do prazo, 1 urgent dentro do prazo,
-- 1 urgent atrasado.
insert into public.client_action_items (
  id, tenant_id, client_id, appointment_request_id, inspection_id, source_item_id,
  title, situation, recommended_action, priority, status, responsible, due_date,
  first_detected_on, last_detected_on, published_at, resolved_at
) values
  ('de000026-0006-4000-8000-000000000001', '60191f17-6733-4439-9fd4-cceace47bf30',
   'f87d239e-6a0b-457c-a1a5-a1b71611b5af', 'de000026-0005-4000-8000-000000000001',
   '64160eb0-d7f3-4aaf-a615-402a2cdc0459', '1f0a291b-9d61-49da-a9f9-648a6dc929c0',
   'Manual de instruções dos equipamentos',
   'Os manuais de instrução dos equipamentos não estavam disponíveis em português para consulta dos operadores.',
   'Reunir e arquivar os manuais em português de todos os equipamentos, com acesso fácil para a equipe.',
   'recommended', 'resolved', 'Responsável Técnico', (current_date - 4),
   (current_date - 86), (current_date - 86), now() - interval '84 days', now() - interval '4 days'),
  ('de000026-0006-4000-8000-000000000002', '60191f17-6733-4439-9fd4-cceace47bf30',
   'f87d239e-6a0b-457c-a1a5-a1b71611b5af', 'de000026-0005-4000-8000-000000000001',
   '64160eb0-d7f3-4aaf-a615-402a2cdc0459', 'a8f449d8-183f-45a9-8902-3611747d9c92',
   'Extintores de incêndio',
   'Os extintores de incêndio estavam com a carga vencida e sem sinalização adequada do local.',
   'Recarregar os extintores vencidos e sinalizar corretamente os pontos de fixação.',
   'important', 'published', 'Responsável Técnico', (current_date + 8),
   (current_date - 86), (current_date - 86), now() - interval '84 days', null),
  ('de000026-0006-4000-8000-000000000003', '60191f17-6733-4439-9fd4-cceace47bf30',
   'f87d239e-6a0b-457c-a1a5-a1b71611b5af', 'de000026-0005-4000-8000-000000000001',
   '64160eb0-d7f3-4aaf-a615-402a2cdc0459', '1fb44ced-50df-4b78-95ff-87519bfd5c4d',
   'Recipientes de descarte de resíduos',
   'As lixeiras não possuem tampa de acionamento por pedal nem a simbologia correta para o tipo de resíduo.',
   'Substituir os recipientes por modelos com tampa de acionamento por pedal e simbologia adequada.',
   'urgent', 'published', 'Responsável Técnico', (current_date + 13),
   (current_date - 86), (current_date - 86), now() - interval '84 days', null),
  ('de000026-0006-4000-8000-000000000004', '60191f17-6733-4439-9fd4-cceace47bf30',
   'f87d239e-6a0b-457c-a1a5-a1b71611b5af', 'de000026-0005-4000-8000-000000000001',
   '64160eb0-d7f3-4aaf-a615-402a2cdc0459', 'e615ca86-d4ce-476c-844f-a82a91ca19b6',
   'Central de Material e Esterilização',
   'Não há Central de Material e Esterilização (CME) ou área de processamento com barreira física e fluxo unidirecional sujo/limpo.',
   'Estruturar a área de processamento com barreira física entre as etapas suja e limpa.',
   'urgent', 'published', 'Responsável Técnico', (current_date - 11),
   (current_date - 86), (current_date - 86), now() - interval '84 days', null)
on conflict (id) do update set
  status = excluded.status, due_date = excluded.due_date, priority = excluded.priority,
  resolved_at = excluded.resolved_at;

commit;

-- --------------------------------------------------------- verificação
select 'clients (unidade 2 + prefixo)' as tabela, count(*) as n
  from public.clients where id::text like 'de000026%'
union all select 'portal_accounts', count(*) from public.client_portal_accounts where id::text like 'de000026%'
union all select 'portal_account_clients', count(*) from public.client_portal_account_clients where account_id::text like 'de000026%'
union all select 'appointment_requests', count(*) from public.appointment_requests where id::text like 'de000026%'
union all select 'client_action_items', count(*) from public.client_action_items where id::text like 'de000026%';
