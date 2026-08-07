\set ON_ERROR_STOP on

-- PORT-03 — continua de onde o fixture do PORT-02 para.
\ir report_link_and_evidence_authorship.test.sql

\ir ../migrations/20260807233846_client_declares_item_status.sql

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  -- Declarar é texto, não arquivo: o navegador chama direto, com o token como autorização.
  -- Cliente Supabase único, então os dois papéis precisam do grant.
  if not has_function_privilege('anon', 'public.client_portal_set_item_status(uuid,uuid,text,text,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_set_item_status(uuid,uuid,text,text,text,text,text)'::regprocedure, 'execute') then
    raise exception 'a declaracao pela conta perdeu grant';
  end if;
  if not has_function_privilege('anon', 'public.public_report_set_item_status(uuid,uuid,text,text,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.public_report_set_item_status(uuid,uuid,text,text,text,text,text)'::regprocedure, 'execute') then
    raise exception 'a declaracao pelo link perdeu grant';
  end if;

  -- Escrever direto na projecao continua fora de alcance do navegador.
  if has_table_privilege('anon', 'public.client_action_items', 'update')
     or has_table_privilege('authenticated', 'public.client_action_items', 'update') then
    raise exception 'o navegador escreve direto na projecao do plano de acao';
  end if;
end;
$$;

-- ─── "Ainda não fiz" exige motivo ─────────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
begin
  v_result := public.public_report_set_item_status(
    '50000000-0000-4000-8000-000000000002', v_item, 'not_done', 'Joana', 'Gestora', '   '
  );
  if v_result ->> 'error' is distinct from 'explique por que ainda nao foi feito' then
    raise exception 'nao fiz sem motivo foi aceito: %', v_result;
  end if;

  -- Motivo sozinho nao basta: assinatura tambem e obrigatoria (PORT-02).
  v_result := public.public_report_set_item_status(
    '50000000-0000-4000-8000-000000000002', v_item, 'not_done', '', '', 'Obra parada.'
  );
  if v_result ->> 'error' is distinct from 'informe seu nome e sua funcao' then
    raise exception 'declaracao sem assinatura foi aceita: %', v_result;
  end if;

  v_result := public.public_report_set_item_status(
    '50000000-0000-4000-8000-000000000002', v_item, 'talvez', 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'situacao invalida' then
    raise exception 'situacao fora da lista foi aceita: %', v_result;
  end if;

  if (select client_status from public.client_action_items where id = v_item) is not null then
    raise exception 'declaracao recusada gravou situacao mesmo assim';
  end if;
end;
$$;

-- ─── Declarar pelo link, com motivo ───────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
  v_row public.client_action_items%rowtype;
  v_portal jsonb;
begin
  v_result := public.public_report_set_item_status(
    '50000000-0000-4000-8000-000000000002', v_item, 'not_done',
    'Joana Prado', 'Gestora da unidade',
    'A pasta sanitaria nao foi feita: o responsavel tecnico esta de licenca ate 20/09.'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'declaracao valida foi recusada: %', v_result;
  end if;

  select * into v_row from public.client_action_items where id = v_item;
  if v_row.client_status <> 'not_done' then
    raise exception 'situacao declarada nao foi gravada: %', v_row.client_status;
  end if;
  if v_row.client_status_note not like 'A pasta sanitaria nao foi feita%' then
    raise exception 'motivo nao foi gravado: %', v_row.client_status_note;
  end if;
  if v_row.client_status_by_name <> 'Joana Prado' then
    raise exception 'assinatura da declaracao nao foi gravada: %', v_row.client_status_by_name;
  end if;

  -- O ponto: declarar NAO mexe na situacao tecnica do item.
  if v_row.status <> 'published' then
    raise exception 'a declaracao do cliente mudou a situacao tecnica: %', v_row.status;
  end if;

  -- E a consultoria enxerga a declaracao na leitura pela conta.
  v_portal := public.test_portal_item('item-alvara');
  if v_portal ->> 'client_status' <> 'not_done'
     or v_portal ->> 'client_status_by_role' <> 'Gestora da unidade' then
    raise exception 'a leitura pela conta nao devolveu a declaracao: %', v_portal;
  end if;

  if not exists (
    select 1 from public.client_portal_audit_events
    where event_type = 'item_status_declared'
      and payload ->> 'client_status' = 'not_done'
      and payload ->> 'source' = 'report_link'
  ) then
    raise exception 'a declaracao pelo link nao foi auditada';
  end if;
end;
$$;

-- ─── "Já corrigi" e "estou providenciando" não exigem motivo ──────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-pia');
  v_result jsonb;
begin
  v_result := public.client_portal_set_item_status(
    '20000000-0000-4000-8000-000000000003', v_item, 'in_progress', 'Carlos Lima', 'Responsavel tecnico'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'estou providenciando sem texto foi recusado: %', v_result;
  end if;

  v_result := public.client_portal_set_item_status(
    '20000000-0000-4000-8000-000000000003', v_item, 'done', 'Carlos Lima', 'Responsavel tecnico'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'ja corrigi sem texto foi recusado: %', v_result;
  end if;

  -- Redeclarar troca o estado e o carimbo, sem criar linha nova em lugar nenhum.
  if (select client_status from public.client_action_items where id = v_item) <> 'done' then
    raise exception 'a segunda declaracao nao sobrescreveu a primeira';
  end if;
  if (select count(*) from public.client_action_items where source_item_id = 'item-pia') <> 2 then
    raise exception 'declarar duplicou item na projecao';
  end if;

  -- E continua sendo a consultora quem resolve.
  if (select status from public.client_action_items where id = v_item) <> 'published' then
    raise exception 'ja corrigi resolveu a pendencia sozinho';
  end if;
end;
$$;

-- ─── Isolamento: link não declara na casa vizinha, nem em outro tenant ───────
do $$
declare
  v_result jsonb;
begin
  v_result := public.public_report_set_item_status(
    '50000000-0000-4000-8000-000000000002',
    public.test_item_id('item-outra-unidade'), 'done', 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'item invalido' then
    raise exception 'o link de uma casa declarou na casa vizinha: %', v_result;
  end if;

  v_result := public.public_report_set_item_status(
    '50000000-0000-4000-8000-000000000010',
    public.test_item_id('item-alvara'), 'done', 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'item invalido' then
    raise exception 'link de outro tenant declarou: %', v_result;
  end if;

  v_result := public.client_portal_set_item_status(
    '20000000-0000-4000-8000-000000000023',
    public.test_item_id('item-alvara'), 'done', 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'item invalido' then
    raise exception 'conta de outra consultoria declarou: %', v_result;
  end if;

  v_result := public.public_report_set_item_status(
    '99999999-9999-4999-8999-999999999999',
    public.test_item_id('item-alvara'), 'done', 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'link invalido' then
    raise exception 'token invalido declarou: %', v_result;
  end if;
end;
$$;

-- ─── Relatório oculto e trava por conta ──────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  v_result := public.public_report_set_item_status(
    '50000000-0000-4000-8000-000000000006',
    public.test_item_id('item-alvara'), 'done', 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'link invalido' then
    raise exception 'link de relatorio oculto aceitou declaracao: %', v_result;
  end if;

  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'hidden');
  v_result := public.client_portal_set_item_status(
    '20000000-0000-4000-8000-000000000003',
    public.test_item_id('item-alvara'), 'done', 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'plano de acao indisponivel' then
    raise exception 'plano travado aceitou declaracao: %', v_result;
  end if;
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'released');
end;
$$;

select 'Client declares item status (PORT-03) tests passed' as result;
