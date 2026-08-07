\set ON_ERROR_STOP on

-- P360-010 — reaproveita o schema falso do fixture de disponibilidade (contas de portal,
-- clientes, solicitações e os helpers `private`) e continua de onde ele para.
\ir appointment_availability.test.sql

-- Colunas que o fixture não cria e a migration referencia.
alter table public.appointment_requests add column if not exists report_hidden boolean not null default false;
alter table public.appointment_requests add column if not exists inspection_id uuid;

-- Segunda unidade do MESMO tenant, propositalmente FORA do acesso da conta de portal.
insert into public.clients (id, tenant_id, name, state)
values (
  '20000000-0000-4000-8000-000000000011',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Unidade sem vinculo com a conta',
  'RJ'
);

-- Consultoria vizinha: outro tenant, outra conta de portal, outra unidade.
insert into public.tenants (id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.clients (id, tenant_id, name, state)
values (
  '20000000-0000-4000-8000-000000000021',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Unidade de outra consultoria',
  'SP'
);

insert into public.client_portal_accounts (id, tenant_id, name, portal_token)
values (
  '20000000-0000-4000-8000-000000000022',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Conta de outra consultoria',
  '20000000-0000-4000-8000-000000000023'
);

insert into public.client_portal_account_clients (account_id, client_id)
values (
  '20000000-0000-4000-8000-000000000022',
  '20000000-0000-4000-8000-000000000021'
);

-- Visita da unidade que a conta enxerga (inspeção 1).
insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, district, status, requested_date,
  appointment_type, inspection_id
) values (
  '50000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'Unidade teste',
  'Centro',
  'report_available',
  date '2026-03-10',
  'inspection',
  '60000000-0000-4000-8000-000000000001'
);

-- Visita seguinte da MESMA unidade (inspeção 2), para a recorrência.
insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, district, status, requested_date,
  appointment_type, inspection_id
) values (
  '50000000-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000004',
  'Unidade teste',
  'Centro',
  'report_available',
  date '2026-06-10',
  'inspection',
  '60000000-0000-4000-8000-000000000002'
);

-- Visita com relatório oculto, da mesma unidade.
insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, district, status, requested_date,
  appointment_type, inspection_id, report_hidden
) values (
  '50000000-0000-4000-8000-000000000005',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000006',
  'Unidade teste',
  'Centro',
  'report_available',
  date '2026-07-10',
  'inspection',
  '60000000-0000-4000-8000-000000000003',
  true
);

-- Visita da unidade sem vínculo com a conta (mesmo tenant).
insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, district, status, requested_date,
  appointment_type, inspection_id
) values (
  '50000000-0000-4000-8000-000000000007',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000011',
  '50000000-0000-4000-8000-000000000008',
  'Unidade sem vinculo com a conta',
  'Centro',
  'report_available',
  date '2026-05-10',
  'inspection',
  '60000000-0000-4000-8000-000000000004'
);

-- Visita da outra consultoria.
insert into public.appointment_requests (
  id, tenant_id, client_id, public_token, unit_name, district, status, requested_date,
  appointment_type, inspection_id
) values (
  '50000000-0000-4000-8000-000000000009',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '20000000-0000-4000-8000-000000000021',
  '50000000-0000-4000-8000-000000000010',
  'Unidade de outra consultoria',
  'Centro',
  'report_available',
  date '2026-05-20',
  'inspection',
  '60000000-0000-4000-8000-000000000005'
);

\ir ../migrations/20260807102311_client_action_items.sql

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if not (
    select relrowsecurity from pg_class where oid = 'public.client_action_items'::regclass
  ) then
    raise exception 'RLS nao esta ativo em client_action_items';
  end if;

  -- Tabela nova no `public` nasce com ALL para anon/authenticated no Supabase.
  if has_table_privilege('anon', 'public.client_action_items', 'select')
     or has_table_privilege('anon', 'public.client_action_items', 'insert') then
    raise exception 'anon enxerga a projecao do plano de acao no nivel de tabela';
  end if;

  if not has_table_privilege('authenticated', 'public.client_action_items', 'select') then
    raise exception 'staff perdeu a leitura da projecao';
  end if;

  if has_table_privilege('authenticated', 'public.client_action_items', 'insert')
     or has_table_privilege('authenticated', 'public.client_action_items', 'update')
     or has_table_privilege('authenticated', 'public.client_action_items', 'delete') then
    raise exception 'staff escreve direto na projecao em vez de passar pelas RPCs';
  end if;

  -- O app usa um cliente Supabase so: a RPC publica precisa dos dois papeis.
  if not has_function_privilege('anon', 'public.client_portal_action_items(uuid,uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_action_items(uuid,uuid)'::regprocedure, 'execute') then
    raise exception 'a RPC de leitura do cliente perdeu grant para anon ou authenticated';
  end if;

  -- As RPCs de staff nao podem ser chamaveis pelo publico.
  if has_function_privilege('anon', 'public.admin_publish_client_action_items(uuid,jsonb)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.admin_set_client_action_item_status(uuid,text)'::regprocedure, 'execute') then
    raise exception 'anon executa RPC de staff do plano de acao';
  end if;
end;
$$;

-- ─── Publicação e idempotência ────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_item public.client_action_items%rowtype;
  v_payload jsonb := jsonb_build_array(
    jsonb_build_object(
      'source_item_id', 'item-alvara',
      'title', 'Possuir alvara sanitario vigente',
      'situation', 'Alvara vencido desde janeiro.',
      'recommended_action', 'Protocolar a renovacao na vigilancia municipal.',
      'priority', 'urgent',
      'responsible', 'Direcao tecnica',
      'due_date', '2026-03-25'
    ),
    jsonb_build_object(
      'source_item_id', 'item-pia',
      'title', 'Lavatorio exclusivo para higienizacao das maos',
      'situation', 'Sala de curativos sem lavatorio.',
      'recommended_action', 'Instalar lavatorio com sabonete liquido e papel toalha.',
      'priority', 'important',
      'due_date', '2026-04-09'
    )
  );
begin
  v_result := public.admin_publish_client_action_items('50000000-0000-4000-8000-000000000001', v_payload);
  if v_result ->> 'ok' is distinct from 'true' or (v_result ->> 'created')::int <> 2 then
    raise exception 'primeira publicacao nao criou os dois itens: %', v_result;
  end if;

  -- Republicar o MESMO relatorio e idempotente: nao cria linha nem soma ocorrencia.
  v_result := public.admin_publish_client_action_items('50000000-0000-4000-8000-000000000001', v_payload);
  if (v_result ->> 'created')::int <> 0 or (v_result ->> 'updated')::int <> 2 then
    raise exception 'republicacao do mesmo relatorio nao foi idempotente: %', v_result;
  end if;

  if (select count(*) from public.client_action_items) <> 2 then
    raise exception 'republicacao duplicou linhas na projecao';
  end if;

  select * into v_item from public.client_action_items where source_item_id = 'item-alvara';
  if v_item.occurrence_count <> 1 then
    raise exception 'republicacao somou ocorrencia indevida: %', v_item.occurrence_count;
  end if;
  if v_item.status <> 'published' or v_item.published_at is null then
    raise exception 'item publicado nao ficou publicado: % / %', v_item.status, v_item.published_at;
  end if;
  if v_item.first_detected_on <> date '2026-03-10' or v_item.due_date <> date '2026-03-25' then
    raise exception 'origem ou prazo do item saiu errado: % / %', v_item.first_detected_on, v_item.due_date;
  end if;
end;
$$;

-- ─── Item recorrente mantém rastreabilidade entre inspeções ───────────────────
do $$
declare
  v_result jsonb;
  v_item public.client_action_items%rowtype;
begin
  v_result := public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000003',
    jsonb_build_array(jsonb_build_object(
      'source_item_id', 'item-alvara',
      'title', 'Possuir alvara sanitario vigente',
      'situation', 'Alvara continua vencido na segunda visita.',
      'recommended_action', 'Protocolar a renovacao com urgencia.',
      'priority', 'urgent',
      'due_date', '2026-06-20'
    ))
  );
  if (v_result ->> 'created')::int <> 0 or (v_result ->> 'updated')::int <> 1 then
    raise exception 'inspecao seguinte criou item novo em vez de atualizar o aberto: %', v_result;
  end if;

  select * into v_item from public.client_action_items where source_item_id = 'item-alvara';
  if v_item.occurrence_count <> 2 then
    raise exception 'item recorrente nao somou ocorrencia: %', v_item.occurrence_count;
  end if;
  if v_item.first_detected_on <> date '2026-03-10' then
    raise exception 'item recorrente perdeu a data da primeira deteccao: %', v_item.first_detected_on;
  end if;
  if v_item.last_detected_on <> date '2026-06-10' then
    raise exception 'item recorrente nao registrou a deteccao mais recente: %', v_item.last_detected_on;
  end if;
  if v_item.situation <> 'Alvara continua vencido na segunda visita.' then
    raise exception 'item recorrente nao atualizou o achado';
  end if;
end;
$$;

-- ─── Resolver preserva histórico; recorrência depois de resolvido vira linha nova ──
do $$
declare
  v_result jsonb;
  v_resolved_id uuid;
  v_open_id uuid;
begin
  select id into v_resolved_id from public.client_action_items where source_item_id = 'item-pia';

  v_result := public.admin_set_client_action_item_status(v_resolved_id, 'resolved');
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'resolver item falhou: %', v_result;
  end if;

  -- Nova inspecao aponta o mesmo requisito: o resolvido continua de pe e nasce um item novo.
  v_result := public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000003',
    jsonb_build_array(jsonb_build_object(
      'source_item_id', 'item-pia',
      'title', 'Lavatorio exclusivo para higienizacao das maos',
      'situation', 'Lavatorio instalado, mas sem papel toalha.',
      'recommended_action', 'Repor insumos e manter rotina de reposicao.',
      'priority', 'important'
    ))
  );
  if (v_result ->> 'created')::int <> 1 then
    raise exception 'recorrencia depois de resolvido nao criou item novo: %', v_result;
  end if;

  if (select count(*) from public.client_action_items where source_item_id = 'item-pia') <> 2 then
    raise exception 'o item resolvido foi apagado quando a nova inspecao publicou';
  end if;

  if not exists (
    select 1 from public.client_action_items
    where id = v_resolved_id and status = 'resolved' and resolved_at is not null
  ) then
    raise exception 'o item resolvido perdeu o carimbo de resolucao';
  end if;

  -- Reabrir o resolvido enquanto ha outro aberto para o mesmo requisito e recusado com erro,
  -- nao com excecao crua.
  v_result := public.admin_set_client_action_item_status(v_resolved_id, 'published');
  if v_result ->> 'error' is distinct from 'ja existe um item aberto para este requisito' then
    raise exception 'reabrir com item aberto duplicado nao foi tratado: %', v_result;
  end if;

  -- Sem concorrente aberto, reabrir funciona.
  select id into v_open_id
  from public.client_action_items
  where source_item_id = 'item-pia' and status <> 'resolved';

  v_result := public.admin_set_client_action_item_status(v_open_id, 'resolved');
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'resolver o item aberto falhou: %', v_result;
  end if;

  v_result := public.admin_set_client_action_item_status(v_resolved_id, 'published');
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'reabrir item resolvido sem concorrente falhou: %', v_result;
  end if;

  -- Volta ao estado esperado pelos testes seguintes.
  perform public.admin_set_client_action_item_status(v_resolved_id, 'resolved');
  perform public.admin_set_client_action_item_status(v_open_id, 'published');
end;
$$;

-- ─── Tenant cruzado negado ────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_before bigint;
begin
  select count(*) into v_before from public.client_action_items;

  -- is_tenant_staff do fixture so reconhece o tenant "aaaa...".
  v_result := public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000009',
    jsonb_build_array(jsonb_build_object('source_item_id', 'item-invasor', 'title', 'Item de outro tenant'))
  );
  if v_result ->> 'error' is distinct from 'sem permissao' then
    raise exception 'staff de um tenant publicou projecao no tenant vizinho: %', v_result;
  end if;

  if (select count(*) from public.client_action_items) <> v_before then
    raise exception 'a publicacao negada gravou linha mesmo assim';
  end if;
end;
$$;

-- ─── Cliente cruzado: unidade fora do acesso da conta ─────────────────────────
do $$
declare
  v_result jsonb;
begin
  -- Item real da unidade que a conta NAO enxerga (mesmo tenant).
  perform public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000007',
    jsonb_build_array(jsonb_build_object(
      'source_item_id', 'item-outra-unidade',
      'title', 'Item da unidade sem vinculo',
      'situation', 'Achado de outra unidade.',
      'recommended_action', 'Corrigir.'
    ))
  );

  v_result := public.client_portal_action_items('20000000-0000-4000-8000-000000000003');
  if v_result -> 'items' @> jsonb_build_array(jsonb_build_object('title', 'Item da unidade sem vinculo')) then
    raise exception 'a conta enxergou item de unidade nao vinculada';
  end if;

  -- Filtro explicito por unidade fora do acesso e recusado.
  v_result := public.client_portal_action_items(
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000011'
  );
  if v_result ->> 'error' is distinct from 'unidade fora do acesso' then
    raise exception 'filtro por unidade nao vinculada foi aceito: %', v_result;
  end if;

  -- Conta da outra consultoria nao ve nada da primeira.
  v_result := public.client_portal_action_items('20000000-0000-4000-8000-000000000023');
  if jsonb_array_length(v_result -> 'items') <> 0 then
    raise exception 'conta de outra consultoria enxergou a projecao alheia: %', v_result;
  end if;

  -- Token inexistente.
  v_result := public.client_portal_action_items('99999999-9999-4999-8999-999999999999');
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'token inexistente foi aceito: %', v_result;
  end if;
end;
$$;

-- ─── Relatório oculto não vaza item ───────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_item public.client_action_items%rowtype;
begin
  perform public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000005',
    jsonb_build_array(jsonb_build_object(
      'source_item_id', 'item-oculto',
      'title', 'Item de relatorio oculto',
      'situation', 'Achado de relatorio que o cliente nao pode ver.',
      'recommended_action', 'Corrigir.'
    ))
  );

  select * into v_item from public.client_action_items where source_item_id = 'item-oculto';
  if v_item.status <> 'hidden' or v_item.published_at is not null then
    raise exception 'item de relatorio oculto nasceu publicado: % / %', v_item.status, v_item.published_at;
  end if;

  v_result := public.client_portal_action_items('20000000-0000-4000-8000-000000000003');
  if v_result -> 'items' @> jsonb_build_array(jsonb_build_object('title', 'Item de relatorio oculto')) then
    raise exception 'relatorio oculto vazou item para o cliente';
  end if;

  -- Ocultar o relatorio DEPOIS tambem some com os itens ja publicados daquela visita.
  update public.appointment_requests
  set report_hidden = true
  where id = '50000000-0000-4000-8000-000000000003';

  v_result := public.client_portal_action_items('20000000-0000-4000-8000-000000000003');
  if v_result -> 'items' @> jsonb_build_array(jsonb_build_object('title', 'Possuir alvara sanitario vigente')) then
    raise exception 'ocultar o relatorio depois nao escondeu o item ja publicado';
  end if;

  update public.appointment_requests
  set report_hidden = false
  where id = '50000000-0000-4000-8000-000000000003';

  -- Item que a consultora ocultou individualmente tambem nao sai.
  perform public.admin_set_client_action_item_status(
    (select id from public.client_action_items where source_item_id = 'item-alvara'),
    'hidden'
  );
  v_result := public.client_portal_action_items('20000000-0000-4000-8000-000000000003');
  if v_result -> 'items' @> jsonb_build_array(jsonb_build_object('title', 'Possuir alvara sanitario vigente')) then
    raise exception 'item ocultado pela consultora continuou visivel ao cliente';
  end if;

  perform public.admin_set_client_action_item_status(
    (select id from public.client_action_items where source_item_id = 'item-alvara'),
    'published'
  );
end;
$$;

-- ─── Prazo vencido no fuso correto ────────────────────────────────────────────
do $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_utc jsonb;
  v_kiritimati jsonb;
  v_items jsonb;
begin
  update public.client_action_items set due_date = v_today - 1 where source_item_id = 'item-alvara';
  update public.client_action_items
  set due_date = v_today
  where source_item_id = 'item-pia' and status <> 'resolved';

  set time zone 'UTC';
  v_utc := public.client_portal_action_items('20000000-0000-4000-8000-000000000003');
  -- Fuso de sessao a +14h: uma implementacao que usasse current_date marcaria o item de hoje
  -- como vencido durante boa parte do dia. O veredito tem de ser identico ao de UTC.
  set time zone 'Pacific/Kiritimati';
  v_kiritimati := public.client_portal_action_items('20000000-0000-4000-8000-000000000003');
  set time zone 'UTC';

  -- So os vencimentos: timestamptz no jsonb e renderizado no fuso da sessao, entao comparar o
  -- objeto inteiro acusaria diferenca em `resolved_at` sem nada a ver com o prazo.
  if jsonb_path_query_array(v_utc, '$.items[*].is_overdue')
     is distinct from jsonb_path_query_array(v_kiritimati, '$.items[*].is_overdue')
     or jsonb_path_query_array(v_utc, '$.items[*].due_date')
        is distinct from jsonb_path_query_array(v_kiritimati, '$.items[*].due_date') then
    raise exception 'o vencimento mudou com o fuso da sessao (nao esta ancorado em America/Sao_Paulo)';
  end if;

  v_items := v_utc -> 'items';

  if not (v_items @> jsonb_build_array(jsonb_build_object('title', 'Possuir alvara sanitario vigente', 'is_overdue', true))) then
    raise exception 'item com prazo de ontem nao foi marcado como vencido: %', v_items;
  end if;

  if not (v_items @> jsonb_build_array(jsonb_build_object('title', 'Lavatorio exclusivo para higienizacao das maos', 'is_overdue', false))) then
    raise exception 'item que vence hoje foi marcado como vencido: %', v_items;
  end if;
end;
$$;

-- ─── O que o cliente recebe ───────────────────────────────────────────────────
do $$
declare
  v_first jsonb;
begin
  v_first := (public.client_portal_action_items('20000000-0000-4000-8000-000000000003') -> 'items') -> 0;

  -- Situacao, acao recomendada, responsavel, prazo e prioridade.
  if v_first ->> 'situation' is null
     or v_first ->> 'recommended_action' is null
     or v_first ->> 'priority' is null
     or v_first ->> 'due_date' is null
     or v_first ->> 'unit_name' is null then
    raise exception 'o cliente nao recebeu os campos minimos do plano de acao: %', v_first;
  end if;

  -- Nada da estrutura interna do checklist pode atravessar.
  if v_first ? 'source_item_id' or v_first ? 'inspection_id'
     or v_first ? 'appointment_request_id' or v_first ? 'tenant_id' then
    raise exception 'a projecao vazou estrutura interna do checklist: %', v_first;
  end if;

  -- O item vencido vem antes: ordenacao por prazo, nulos por ultimo.
  if v_first ->> 'title' <> 'Possuir alvara sanitario vigente' then
    raise exception 'o item mais urgente nao veio primeiro: %', v_first ->> 'title';
  end if;
end;
$$;

select 'Client action items (P360-010) tests passed' as result;
