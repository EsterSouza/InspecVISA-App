\set ON_ERROR_STOP on

-- P360-013 — continua de onde o fixture do P360-012 para (contas, unidades, visitas, plano de
-- ação, evidência, travas por conta, solicitações e os helpers `private`).
\ir client_service_requests.test.sql

\ir ../migrations/20260808113928_admin_operational_overview.sql

-- Correção dos bugs #1 (consultora por inspeção, não por setor) e #2 (relatório oculto).
\ir ../migrations/20260815160715_painel_consultora_e_relatorio_oculto.sql

-- Tokens em jogo (herdados da cadeia de fixtures):
--   tenant A = aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa (o `private.my_tenant_ids()` do fixture só enxerga este)
--   client A1 = 20000000-…-000001 (Unidade teste, na conta 20000000-…-000002)
--   client A2 = 20000000-…-000011 (Unidade sem vínculo com a conta, mesmo tenant)
--   tenant B  = bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb (outra consultoria — controle negativo)
--   client B1 = 20000000-…-000021

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.admin_operational_counts(text,uuid,integer)'::regprocedure, 'execute') then
    raise exception 'anon executa a contagem operacional';
  end if;

  if has_function_privilege('anon', 'public.admin_operational_items(text,text,uuid,text,date,integer,integer,integer)'::regprocedure, 'execute') then
    raise exception 'anon executa a lista operacional';
  end if;

  if not has_function_privilege('authenticated', 'public.admin_operational_counts(text,uuid,integer)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.admin_operational_items(text,text,uuid,text,date,integer,integer,integer)'::regprocedure, 'execute') then
    raise exception 'staff perdeu acesso ao painel operacional';
  end if;
end;
$$;

-- ─── Limpeza do que a cadeia de fixtures anteriores deixou para trás ───────────
--
-- `client_service_requests.test.sql` e os fixtures anteriores já exercitam os próprios
-- cenários (cancelamento, atualização, evidência pendente etc.) e deixam linhas de tenant A
-- para trás. Este teste conta linhas — precisa de uma base zerada para os números baterem.

-- `subject` existe em produção desde o domínio multiuso (P360-004), mas o fixture de
-- disponibilidade que esta cadeia herda constrói `schedules` sem essa coluna.
alter table public.schedules add column if not exists subject text;

delete from public.client_service_requests where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from public.schedules where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from public.client_action_items where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- ─── Atribuição de consultora (bug #1) e visibilidade (bug #2) ──────────────────
--
-- Em produção a consultora do plano de ação vive em `inspections.consultant_names` (preenchida em
-- 100% dos itens), NUNCA em `client_action_items.responsible` (que guarda setor). O fixture de
-- agenda não cria a tabela `inspections` nem a coluna `consultant_names` em `appointment_requests`
-- — a migration nova referencia as duas, então aqui elas passam a existir.

create table if not exists public.inspections (
  id uuid primary key,
  tenant_id uuid,
  client_id uuid,
  consultant_names text[],
  consultant_name text,
  status text default 'completed',
  deleted_at timestamptz
);
alter table public.inspections add column if not exists consultant_names text[];
alter table public.appointment_requests add column if not exists consultant_names text[];

-- Inspeções das visitas já criadas pelo fixture do P360-010: Ester nas visíveis e na oculta, Ana
-- na unidade A2. É por `consultant_names` que o filtro de consultora tem de casar.
insert into public.inspections (id, tenant_id, client_id, consultant_names) values
  ('60000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', array['Ester Caiafa']),
  ('60000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', array['Ester Caiafa']),
  ('60000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000011', array['Ana Roberta Ribeiro'])
on conflict (id) do nothing;

-- ─── Massa de dados ─────────────────────────────────────────────────────────────

-- Compromissos: dois dentro da janela padrão (14 dias), um fora, um passado, um cancelado,
-- um de outra consultoria (isolamento).
insert into public.schedules (id, tenant_id, client_id, scheduled_at, status, appointment_type, consultant_names)
values
  ('30000000-0000-4000-8000-000000000101', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', now() + interval '2 days', 'pending', 'inspection', array['Ester Caiafa']),
  ('30000000-0000-4000-8000-000000000102', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000011', now() + interval '5 days', 'pending', 'follow_up_meeting', array['Ana Roberta Ribeiro']),
  ('30000000-0000-4000-8000-000000000103', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', now() + interval '30 days', 'pending', 'inspection', array['Ester Caiafa']),
  ('30000000-0000-4000-8000-000000000104', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', now() - interval '1 day', 'completed', 'inspection', array['Ester Caiafa']),
  ('30000000-0000-4000-8000-000000000105', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', now() + interval '3 days', 'cancelled', 'inspection', array['Ester Caiafa']),
  ('30000000-0000-4000-8000-000000000106', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000021', now() + interval '2 days', 'pending', 'inspection', array['Ester Caiafa']);

-- Solicitações: uma nova (sem dono), uma aguardando o cliente, uma em andamento (não entra em
-- nenhum dos dois blocos), uma resolvida (fora), uma de outro tenant (isolamento).
insert into public.client_service_requests (
  id, tenant_id, client_id, request_number, category, subject, description, status, priority,
  assigned_to, submission_key
) values
  ('40000000-0000-4000-8000-000000000201', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 101, 'documentacao', 'Renovar alvara', 'Preciso da documentacao para renovar o alvara sanitario.', 'open', 'normal', null, gen_random_uuid()),
  ('40000000-0000-4000-8000-000000000202', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 102, 'licenciamento', 'Duvida sobre licenca', 'A consultoria pediu um documento e estou aguardando orientacao.', 'awaiting_client', 'high', 'Ester Caiafa', gen_random_uuid()),
  ('40000000-0000-4000-8000-000000000203', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000011', 103, 'treinamento', 'Treinamento de equipe', 'Solicito treinamento de boas praticas para a equipe nova.', 'in_progress', 'normal', 'Ana Roberta Ribeiro', gen_random_uuid()),
  ('40000000-0000-4000-8000-000000000204', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 104, 'outro', 'Pedido resolvido', 'Isto ja foi atendido pela consultoria.', 'resolved', 'low', 'Ester Caiafa', gen_random_uuid()),
  ('40000000-0000-4000-8000-000000000205', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000021', 101, 'documentacao', 'Solicitacao de outra consultoria', 'Isto pertence a outro tenant e nao pode aparecer aqui.', 'open', 'normal', null, gen_random_uuid());

-- Planos de ação. `responsible` é SETOR de propósito (bug #1): a única forma de o filtro de
-- consultora casar é pela inspeção de origem, nunca por este campo. `appointment_request_id`
-- aponta a visibilidade (bug #2): a visita ...0005 tem report_hidden=true.
insert into public.client_action_items (
  id, tenant_id, client_id, source_item_id, title, situation, recommended_action, priority,
  responsible, due_date, status, appointment_request_id, inspection_id
) values
  ('50000000-0000-4000-8000-000000000301', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'op-item-1', 'Item vencido', 'Achado', 'Corrigir', 'urgent', 'Gerência / Administração', current_date - 5, 'published', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000302', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000011', 'op-item-2', 'Item em dia', 'Achado', 'Corrigir', 'important', 'Responsável Técnico (RT)', current_date + 5, 'published', '50000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000004'),
  ('50000000-0000-4000-8000-000000000303', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'op-item-3', 'Item sem prazo', 'Achado', 'Corrigir', 'recommended', null, null, 'published', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000304', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'op-item-4', 'Item oculto vencido', 'Achado', 'Corrigir', 'urgent', 'Gerência / Administração', current_date - 10, 'hidden', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000305', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'op-item-5', 'Item resolvido vencido', 'Achado', 'Corrigir', 'urgent', 'Gerência / Administração', current_date - 10, 'resolved', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000306', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000021', 'op-item-6', 'Item de outro tenant', 'Achado', 'Corrigir', 'urgent', 'Gerência / Administração', current_date - 5, 'published', '50000000-0000-4000-8000-000000000009', null),
  -- bug #2: vencido e publicado, MAS a visita ...0005 está com relatório oculto → não pode contar.
  ('50000000-0000-4000-8000-000000000307', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'op-item-7', 'Item vencido de relatorio oculto', 'Achado', 'Corrigir', 'urgent', 'Gerência / Administração', current_date - 10, 'published', '50000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000003');

-- Evidências: uma pendente ligada ao item em dia (unidade da Ana), uma pendente ligada ao item
-- vencido da visita da Ester (para o filtro de consultora, agora via inspeção), uma já aprovada
-- (não conta) e uma pendente de item com relatório oculto (bug #2: não pode contar).
insert into public.client_action_evidence (
  id, tenant_id, client_id, action_item_id, upload_key, storage_path, file_name, mime_type, file_size, status
) values
  ('60000000-0000-4000-8000-000000000401', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000302', gen_random_uuid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/unidade/item/a.pdf', 'a.pdf', 'application/pdf', 1000, 'pending'),
  ('60000000-0000-4000-8000-000000000402', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000301', gen_random_uuid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/unidade/item/b.pdf', 'b.pdf', 'application/pdf', 1000, 'pending'),
  ('60000000-0000-4000-8000-000000000403', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000303', gen_random_uuid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/unidade/item/c.pdf', 'c.pdf', 'application/pdf', 1000, 'approved'),
  ('60000000-0000-4000-8000-000000000404', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000307', gen_random_uuid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/unidade/item/d.pdf', 'd.pdf', 'application/pdf', 1000, 'pending');

-- Financeiro: a conta existente (20000000-…-000002, unidade A1) fica em atraso; uma conta nova
-- para a unidade A2 fica em dia (controle negativo); uma conta de outro tenant fica em atraso
-- (isolamento).
update public.client_portal_accounts
set payment_status = 'pending', payment_due_date = current_date - 20
where id = '20000000-0000-4000-8000-000000000002';

insert into public.client_portal_accounts (id, tenant_id, name, portal_token, payment_status, payment_due_date)
values ('20000000-0000-4000-8000-000000000032', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Conta em dia', gen_random_uuid(), 'paid', current_date - 20);
insert into public.client_portal_account_clients (account_id, client_id)
values ('20000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000011');

insert into public.client_portal_accounts (id, tenant_id, name, portal_token, payment_status, payment_due_date)
values ('20000000-0000-4000-8000-000000000033', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Conta de outra consultoria', gen_random_uuid(), 'pending', current_date - 20);
insert into public.client_portal_account_clients (account_id, client_id)
values ('20000000-0000-4000-8000-000000000033', '20000000-0000-4000-8000-000000000021');

-- ─── Contagens sem filtro ───────────────────────────────────────────────────────
do $$
declare
  v_counts jsonb;
begin
  v_counts := public.admin_operational_counts();

  if (v_counts -> 'appointments' ->> 'count')::int <> 2 then
    raise exception 'compromissos proximos errado: %', v_counts -> 'appointments';
  end if;

  if (v_counts -> 'requests_new' ->> 'count')::int <> 1 then
    raise exception 'solicitacoes novas errado: %', v_counts -> 'requests_new';
  end if;

  if (v_counts -> 'awaiting_client' ->> 'count')::int <> 1 then
    raise exception 'clientes aguardando resposta errado: %', v_counts -> 'awaiting_client';
  end if;

  if (v_counts -> 'evidence_pending' ->> 'count')::int <> 2 then
    raise exception 'evidencias pendentes errado: %', v_counts -> 'evidence_pending';
  end if;

  if (v_counts -> 'action_items_overdue' ->> 'count')::int <> 1 then
    raise exception 'planos vencidos errado: %', v_counts -> 'action_items_overdue';
  end if;

  if (v_counts -> 'financial_pending' ->> 'count')::int <> 1 then
    raise exception 'pendencias financeiras errado: %', v_counts -> 'financial_pending';
  end if;
end;
$$;

-- ─── Filtro por consultora (string livre, comparação normalizada) ──────────────
do $$
declare
  v_counts jsonb;
begin
  v_counts := public.admin_operational_counts('  ester caiafa  ');

  if (v_counts -> 'appointments' ->> 'count')::int <> 1 then
    raise exception 'filtro de consultora nao restringiu compromissos: %', v_counts -> 'appointments';
  end if;

  -- A solicitacao nova nao tem dono ainda: filtrar por consultora especifica zera o bloco.
  if (v_counts -> 'requests_new' ->> 'count')::int <> 0 then
    raise exception 'filtro de consultora vazou solicitacao sem dono: %', v_counts -> 'requests_new';
  end if;

  if (v_counts -> 'awaiting_client' ->> 'count')::int <> 1 then
    raise exception 'filtro de consultora nao bateu com aguardando cliente: %', v_counts -> 'awaiting_client';
  end if;

  -- Evidencia pendente filtra pela consultora da INSPECAO do item pai (bug #1), nunca pelo setor
  -- em `responsible`: so a do item da visita da Ester, e nao a do item de relatorio oculto (bug #2).
  if (v_counts -> 'evidence_pending' ->> 'count')::int <> 1 then
    raise exception 'filtro de consultora nao restringiu evidencia pela inspecao: %', v_counts -> 'evidence_pending';
  end if;

  if (v_counts -> 'action_items_overdue' ->> 'count')::int <> 1 then
    raise exception 'filtro de consultora nao bateu com plano vencido: %', v_counts -> 'action_items_overdue';
  end if;
end;
$$;

-- ─── Filtro por cliente/unidade ─────────────────────────────────────────────────
do $$
declare
  v_counts jsonb;
begin
  v_counts := public.admin_operational_counts(null, '20000000-0000-4000-8000-000000000011');

  if (v_counts -> 'appointments' ->> 'count')::int <> 1 then
    raise exception 'filtro de cliente nao restringiu compromissos: %', v_counts -> 'appointments';
  end if;

  if (v_counts -> 'requests_new' ->> 'count')::int <> 0 then
    raise exception 'filtro de cliente vazou solicitacao de outra unidade: %', v_counts -> 'requests_new';
  end if;

  if (v_counts -> 'financial_pending' ->> 'count')::int <> 0 then
    raise exception 'filtro de cliente deveria excluir a conta em dia da unidade A2: %', v_counts -> 'financial_pending';
  end if;
end;
$$;

-- ─── Itens paginados: filtro combinado, tipo, prazo e deep link ────────────────
do $$
declare
  v_result jsonb;
  v_items jsonb;
begin
  -- Compromissos: ampliando a janela para 40 dias, os 3 futuros nao cancelados entram.
  v_result := public.admin_operational_items('appointments', null, null, null, null, 40, 20, 0);
  if (v_result ->> 'total_count')::int <> 3 then
    raise exception 'paginacao de compromissos nao bateu com janela ampliada: %', v_result;
  end if;

  -- Todo item devolvido pertence a um cliente do tenant A (nunca do tenant B) — a base do deep link.
  v_items := v_result -> 'items';
  if exists (
    select 1 from jsonb_array_elements(v_items) it
    where (it ->> 'client_id')::uuid not in (
      '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011'
    )
  ) then
    raise exception 'item operacional vazou cliente fora do tenant: %', v_items;
  end if;

  -- Solicitacoes novas filtradas por tipo (categoria).
  v_result := public.admin_operational_items('requests_new', null, null, 'documentacao');
  if (v_result ->> 'total_count')::int <> 1
     or (v_result -> 'items' -> 0 ->> 'id') <> '40000000-0000-4000-8000-000000000201' then
    raise exception 'filtro de tipo nao bateu em solicitacoes novas: %', v_result;
  end if;

  -- Planos vencidos filtrados por prioridade (usada como "tipo" neste bloco).
  v_result := public.admin_operational_items('action_items_overdue', null, null, 'urgent');
  if (v_result ->> 'total_count')::int <> 1
     or (v_result -> 'items' -> 0 ->> 'id') <> '50000000-0000-4000-8000-000000000301' then
    raise exception 'filtro de tipo nao bateu em planos vencidos: %', v_result;
  end if;

  -- Bloco invalido nao derruba a chamada, devolve erro estruturado.
  v_result := public.admin_operational_items('bloco_que_nao_existe');
  if v_result ->> 'error' is null then
    raise exception 'bloco invalido deveria devolver erro estruturado: %', v_result;
  end if;
end;
$$;

-- ─── Paginação com volume representativo ───────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_i integer;
begin
  for v_i in 1..25 loop
    insert into public.client_service_requests (
      tenant_id, client_id, request_number, category, subject, description, status, priority, submission_key
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001',
      200 + v_i, 'outro', 'Solicitacao de volume ' || v_i, 'Descricao de teste com tamanho suficiente para passar na validacao.',
      'open', 'normal', gen_random_uuid()
    );
  end loop;

  v_result := public.admin_operational_items('requests_new', null, null, null, null, 14, 20, 0);
  if jsonb_array_length(v_result -> 'items') <> 20 then
    raise exception 'primeira pagina deveria trazer 20 itens: %', jsonb_array_length(v_result -> 'items');
  end if;
  -- 25 novas de volume + a original (40000000-…-000201) = 26.
  if (v_result ->> 'total_count')::int <> 26 then
    raise exception 'total_count da paginacao errado: %', v_result ->> 'total_count';
  end if;

  v_result := public.admin_operational_items('requests_new', null, null, null, null, 14, 20, 20);
  if jsonb_array_length(v_result -> 'items') <> 6 then
    raise exception 'segunda pagina deveria trazer os 6 restantes: %', jsonb_array_length(v_result -> 'items');
  end if;
end;
$$;

-- ─── Falha isolada por bloco não derruba os demais ─────────────────────────────
do $$
declare
  v_counts jsonb;
begin
  alter table public.client_portal_accounts rename to client_portal_accounts_broken_for_test;

  v_counts := public.admin_operational_counts();

  if v_counts -> 'financial_pending' ->> 'error' is distinct from 'true' then
    raise exception 'bloco financeiro deveria reportar erro com a tabela renomeada: %', v_counts -> 'financial_pending';
  end if;

  if (v_counts -> 'appointments' ->> 'count') is null
     or (v_counts -> 'requests_new' ->> 'count') is null
     or (v_counts -> 'action_items_overdue' ->> 'count') is null
     or (v_counts -> 'evidence_pending' ->> 'count') is null then
    raise exception 'falha isolada no bloco financeiro derrubou outro bloco: %', v_counts;
  end if;

  alter table public.client_portal_accounts_broken_for_test rename to client_portal_accounts;
end;
$$;
