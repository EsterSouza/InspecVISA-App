\set ON_ERROR_STOP on

-- PORT-02 — continua de onde o fixture do P360-011 para (itens publicados, evidências,
-- travas por conta e os helpers `private`).
\ir client_action_evidence.test.sql

-- O P360-011 deixou evidências sem autoria; a migration exige nome e função de todas. Em
-- produção a tabela estava vazia quando a migration foi aplicada, então a checagem passou.
-- Aqui o fixture precisa limpar antes — e é justamente esse o comportamento desejado: se
-- houvesse linha anônima em produção, a migration teria FALHADO em vez de deixá-la passar.
delete from public.client_action_evidence;

\ir ../migrations/20260807193920_report_link_and_evidence_authorship.sql

-- Tokens do fixture: a visita que a conta enxerga é a `5000…0002`; a `5000…0010` é da outra
-- consultoria, e a `5000…0006` é a de relatório oculto.
\set VISITA '50000000-0000-4000-8000-000000000002'
\set VISITA_OCULTA '50000000-0000-4000-8000-000000000006'
\set VISITA_VIZINHA '50000000-0000-4000-8000-000000000010'
\set CONTA '20000000-0000-4000-8000-000000000003'

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  -- A leitura pelo link é do navegador: precisa dos dois papéis (cliente Supabase único).
  if not has_function_privilege('anon', 'public.public_report_action_items(uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.public_report_action_items(uuid)'::regprocedure, 'execute') then
    raise exception 'a leitura do relatorio por link perdeu grant';
  end if;

  -- Escrever continua sendo só da Edge Function: quem registra precisa ter o arquivo na mão.
  if has_function_privilege('anon', 'public.public_report_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text,text,text)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.public_report_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text,text,text)'::regprocedure, 'execute') then
    raise exception 'o navegador registra evidencia pelo link sem passar pela Edge Function';
  end if;
  if not has_function_privilege('service_role', 'public.public_report_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text,text,text)'::regprocedure, 'execute') then
    raise exception 'a Edge Function perdeu o grant do envio por link';
  end if;

  if has_function_privilege('anon', 'public.public_report_list_evidence(uuid,uuid)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.public_report_list_evidence(uuid,uuid)'::regprocedure, 'execute') then
    raise exception 'o navegador le storage_path pelo link';
  end if;

  -- A assinatura antiga (sem autoria) tem de ter sumido, senao sobra porta para evidencia anonima.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'client_portal_submit_evidence'
      and pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, uuid, text, text, bigint, text, text'
  ) then
    raise exception 'a versao sem nome e funcao de client_portal_submit_evidence continua no banco';
  end if;
end;
$$;

-- ─── Autoria é obrigatória nos dois caminhos ──────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
begin
  -- Pela conta do portal.
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item, '80000000-0000-4000-8000-000000000001',
    'prova.pdf', 'application/pdf', 2048, '  ', 'Gestor'
  );
  if v_result ->> 'error' is distinct from 'informe seu nome e sua funcao' then
    raise exception 'conta enviou evidencia sem nome: %', v_result;
  end if;

  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item, '80000000-0000-4000-8000-000000000002',
    'prova.pdf', 'application/pdf', 2048, 'Maria', null
  );
  if v_result ->> 'error' is distinct from 'informe seu nome e sua funcao' then
    raise exception 'conta enviou evidencia sem funcao: %', v_result;
  end if;

  -- Pelo link do relatorio.
  v_result := public.public_report_submit_evidence(
    '50000000-0000-4000-8000-000000000002', v_item, '80000000-0000-4000-8000-000000000003',
    'prova.pdf', 'application/pdf', 2048, '', ''
  );
  if v_result ->> 'error' is distinct from 'informe seu nome e sua funcao' then
    raise exception 'link enviou evidencia sem assinatura: %', v_result;
  end if;

  if (select count(*) from public.client_action_evidence) <> 0 then
    raise exception 'envio sem assinatura gravou linha mesmo assim';
  end if;
end;
$$;

-- ─── Envio pelo link, com assinatura ──────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
  v_row public.client_action_evidence%rowtype;
begin
  v_result := public.public_report_submit_evidence(
    '50000000-0000-4000-8000-000000000002', v_item, '80000000-0000-4000-8000-000000000010',
    'Alvará protocolado.pdf', 'application/pdf', 4096,
    'Joana Prado', 'Gestora da unidade', 'Protocolo aberto na VISA municipal.'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'envio valido pelo link foi recusado: %', v_result;
  end if;

  select * into v_row from public.client_action_evidence where id = (v_result ->> 'evidence_id')::uuid;

  if v_row.account_id is not null then
    raise exception 'envio por link inventou uma conta: %', v_row.account_id;
  end if;
  if v_row.source <> 'report_link' then
    raise exception 'origem do envio saiu errada: %', v_row.source;
  end if;
  if v_row.submitted_by_name <> 'Joana Prado' or v_row.submitted_by_role <> 'Gestora da unidade' then
    raise exception 'assinatura nao foi gravada: % / %', v_row.submitted_by_name, v_row.submitted_by_role;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'evidencia por link nasceu revisada: %', v_row.status;
  end if;

  -- O item continua aberto: link nenhum resolve pendencia.
  if (select status from public.client_action_items where id = v_item) <> 'published' then
    raise exception 'o envio pelo link resolveu o item sozinho';
  end if;

  -- Auditoria guarda quem assinou, e nada do arquivo.
  if not exists (
    select 1 from public.client_portal_audit_events
    where event_type = 'evidence_submitted'
      and payload ->> 'by_name' = 'Joana Prado'
      and payload ->> 'source' = 'report_link'
      and account_id is null
  ) then
    raise exception 'a auditoria do envio por link nao registrou a assinatura';
  end if;
  if exists (
    select 1 from public.client_portal_audit_events
    where event_type = 'evidence_submitted' and payload::text ~* 'storage|http'
  ) then
    raise exception 'a auditoria gravou caminho ou URL';
  end if;
end;
$$;

-- ─── Retry pelo link não duplica ──────────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
begin
  v_result := public.public_report_submit_evidence(
    '50000000-0000-4000-8000-000000000002', v_item, '80000000-0000-4000-8000-000000000010',
    'outro-nome.pdf', 'application/pdf', 4096, 'Joana Prado', 'Gestora da unidade'
  );
  if (v_result ->> 'duplicate')::boolean is not true then
    raise exception 'retry pelo link nao foi reconhecido: %', v_result;
  end if;
  if (select count(*) from public.client_action_evidence where action_item_id = v_item) <> 1 then
    raise exception 'retry pelo link duplicou a evidencia';
  end if;
end;
$$;

-- ─── O link é da unidade daquela visita, e só dela ────────────────────────────
do $$
declare
  v_result jsonb;
  v_before bigint;
begin
  select count(*) into v_before from public.client_action_evidence;

  -- Item de outra unidade do MESMO tenant, usando o link desta visita.
  v_result := public.public_report_submit_evidence(
    '50000000-0000-4000-8000-000000000002', public.test_item_id('item-outra-unidade'), '80000000-0000-4000-8000-000000000020',
    'x.pdf', 'application/pdf', 2048, 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'item invalido' then
    raise exception 'o link de uma casa aceitou evidencia da casa vizinha: %', v_result;
  end if;

  -- Link da outra consultoria mirando item deste tenant.
  v_result := public.public_report_submit_evidence(
    '50000000-0000-4000-8000-000000000010', public.test_item_id('item-alvara'), '80000000-0000-4000-8000-000000000021',
    'x.pdf', 'application/pdf', 2048, 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'item invalido' then
    raise exception 'link de outro tenant enviou evidencia: %', v_result;
  end if;

  -- Token que não existe.
  v_result := public.public_report_submit_evidence(
    '99999999-9999-4999-8999-999999999999', public.test_item_id('item-alvara'),
    '80000000-0000-4000-8000-000000000022', 'x.pdf', 'application/pdf', 2048, 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'link invalido' then
    raise exception 'token inexistente enviou evidencia: %', v_result;
  end if;

  if (select count(*) from public.client_action_evidence) <> v_before then
    raise exception 'envio negado pelo link gravou linha mesmo assim';
  end if;
end;
$$;

-- ─── Relatório oculto fecha o link inteiro ────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  v_result := public.public_report_action_items('50000000-0000-4000-8000-000000000006');
  if v_result ->> 'error' is distinct from 'relatorio indisponivel' then
    raise exception 'relatorio oculto continuou abrindo pelo link: %', v_result;
  end if;

  v_result := public.public_report_submit_evidence(
    '50000000-0000-4000-8000-000000000006', public.test_item_id('item-alvara'), '80000000-0000-4000-8000-000000000030',
    'x.pdf', 'application/pdf', 2048, 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'link invalido' then
    raise exception 'link de relatorio oculto aceitou evidencia: %', v_result;
  end if;

  v_result := public.public_report_list_evidence('50000000-0000-4000-8000-000000000006');
  if v_result ->> 'error' is distinct from 'link invalido' then
    raise exception 'link de relatorio oculto listou evidencia: %', v_result;
  end if;
end;
$$;

-- ─── O que o link devolve ─────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_item jsonb;
begin
  v_result := public.public_report_action_items('50000000-0000-4000-8000-000000000002');

  if v_result ->> 'unit_name' is null then
    raise exception 'o link nao diz de que unidade e o relatorio: %', v_result;
  end if;
  if jsonb_array_length(v_result -> 'items') = 0 then
    raise exception 'o link abriu sem plano de acao nenhum: %', v_result;
  end if;

  select item into v_item
  from jsonb_array_elements(v_result -> 'items') as item
  where (item ->> 'id')::uuid = public.test_item_id('item-alvara');

  if v_item ->> 'evidence_status' <> 'pending' or (v_item ->> 'evidence_count')::int <> 1 then
    raise exception 'o link nao mostra o estado da evidencia: %', v_item;
  end if;
  if v_item ->> 'evidence_by_name' <> 'Joana Prado' then
    raise exception 'o link nao mostra quem assinou o envio: %', v_item;
  end if;

  -- O link nunca carrega caminho de arquivo nem identificador interno do roteiro.
  if v_result::text ~* 'storage_path|source_item_id|client-action-evidence|portal_token' then
    raise exception 'o link vazou dado interno: %', v_result;
  end if;

  -- Item da unidade vizinha nunca entra, mesmo sendo do mesmo tenant.
  if v_result -> 'items' @> jsonb_build_array(jsonb_build_object('title', 'Item da unidade sem vinculo')) then
    raise exception 'o link mostrou item de outra unidade';
  end if;
end;
$$;

-- ─── A trava por conta NÃO alcança o link (decisão registrada) ────────────────
do $$
declare
  v_result jsonb;
begin
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'hidden');

  -- Pela conta, fechado.
  if jsonb_array_length(public.client_portal_action_items('20000000-0000-4000-8000-000000000003') -> 'items') <> 0 then
    raise exception 'a trava por conta parou de valer no portal logado';
  end if;

  -- Pelo link, aberto: a trava é da CONTA, e o link não tem conta. Quem fecha o link é
  -- `report_hidden` da visita. Está registrado no handoff como decisão, não como esquecimento.
  v_result := public.public_report_action_items('50000000-0000-4000-8000-000000000002');
  if jsonb_array_length(v_result -> 'items') = 0 then
    raise exception 'o link deixou de abrir por causa de uma trava de conta: %', v_result;
  end if;

  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'released');
end;
$$;

-- ─── Envio pela conta grava a assinatura e a origem ───────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-pia');
  v_result jsonb;
  v_row public.client_action_evidence%rowtype;
begin
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item, '80000000-0000-4000-8000-000000000040',
    'foto.jpg', 'image/jpeg', 3072, 'Carlos Lima', 'Responsavel tecnico', 'Lavatorio instalado.'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'envio pela conta com assinatura foi recusado: %', v_result;
  end if;

  select * into v_row from public.client_action_evidence where id = (v_result ->> 'evidence_id')::uuid;
  if v_row.source <> 'portal_account' or v_row.account_id is null then
    raise exception 'origem do envio pela conta saiu errada: % / %', v_row.source, v_row.account_id;
  end if;
  if v_row.submitted_by_name <> 'Carlos Lima' or v_row.submitted_by_role <> 'Responsavel tecnico' then
    raise exception 'assinatura pela conta nao foi gravada: % / %', v_row.submitted_by_name, v_row.submitted_by_role;
  end if;

  -- E a leitura pela conta mostra quem assinou.
  if public.test_portal_item('item-pia') ->> 'evidence_by_name' <> 'Carlos Lima' then
    raise exception 'a leitura pela conta nao mostra quem assinou';
  end if;
end;
$$;

-- ─── Descarte pelo link só alcança o que veio pelo link ───────────────────────
do $$
declare
  v_pelo_link uuid;
  v_pela_conta uuid;
  v_result jsonb;
begin
  select id into v_pelo_link from public.client_action_evidence where source = 'report_link' limit 1;
  select id into v_pela_conta from public.client_action_evidence where source = 'portal_account' limit 1;

  -- O link não apaga o que a conta enviou.
  v_result := public.public_report_discard_evidence('50000000-0000-4000-8000-000000000002', v_pela_conta);
  if (v_result ->> 'ok')::boolean is not false then
    raise exception 'o link apagou evidencia enviada pela conta: %', v_result;
  end if;

  v_result := public.public_report_discard_evidence('50000000-0000-4000-8000-000000000002', v_pelo_link);
  if (v_result ->> 'ok')::boolean is not true then
    raise exception 'descarte do proprio envio pelo link falhou: %', v_result;
  end if;
  if exists (select 1 from public.client_action_evidence where id = v_pelo_link) then
    raise exception 'a linha continuou apos o descarte pelo link';
  end if;
end;
$$;

-- ─── Revisão continua sendo da consultora, venha o envio de onde vier ─────────
do $$
declare
  v_evidence uuid;
  v_item uuid := public.test_item_id('item-pia');
  v_result jsonb;
begin
  select id into v_evidence from public.client_action_evidence where action_item_id = v_item limit 1;

  v_result := public.admin_review_client_action_evidence(v_evidence, 'approved', 'Aceito.', false, 'Ester');
  if (v_result ->> 'item_resolved')::boolean then
    raise exception 'aprovar resolveu a pendencia sozinho depois do PORT-02: %', v_result;
  end if;
  if (select status from public.client_action_items where id = v_item) <> 'published' then
    raise exception 'o item fechou sem acao explicita';
  end if;
end;
$$;

select 'Report link + evidence authorship (PORT-02) tests passed' as result;
