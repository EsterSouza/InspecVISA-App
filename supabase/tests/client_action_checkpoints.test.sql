\set ON_ERROR_STOP on

-- PORT-05 — continua de onde o fixture do PORT-03 para (contas, unidades, visitas, itens do
-- plano de ação já publicados, travas por conta, auditoria e os helpers `private`).
\ir client_declares_item_status.test.sql

\ir ../migrations/20260820234651_client_action_checkpoints.sql

-- Atalho: o tópico é procurado pelo texto, dentro do item de origem.
create or replace function public.test_checkpoint_id(p_source text, p_text text)
returns uuid
language sql
stable
as $$
  select cp.id
  from public.client_action_checkpoints cp
  where cp.action_item_id = public.test_item_id(p_source)
    and cp.text = p_text
  limit 1;
$$;

-- Os tópicos como o cliente os enxerga na conta do portal.
create or replace function public.test_portal_checkpoints(p_source text)
returns jsonb
language sql
stable
as $$
  select coalesce(public.test_portal_item(p_source) -> 'checkpoints', '[]'::jsonb);
$$;

-- Payload de publicação com tópicos. A chave é o texto normalizado, como o app gera.
create or replace function public.test_payload(p_checkpoints jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'source_item_id', 'item-alvara',
      'title', 'Possuir alvara sanitario vigente',
      'situation', 'Alvara vencido desde janeiro.',
      'recommended_action', 'Protocolar a renovacao na vigilancia municipal.',
      'priority', 'urgent',
      'responsible', 'Direcao tecnica',
      'due_date', '2026-03-25',
      'checkpoints', p_checkpoints
    )
  );
$$;

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.client_action_checkpoints'::regclass) then
    raise exception 'RLS desligada na tabela de topicos';
  end if;

  -- O navegador do cliente nunca toca na tabela: só as RPCs com token.
  if has_table_privilege('anon', 'public.client_action_checkpoints', 'select')
     or has_table_privilege('anon', 'public.client_action_checkpoints', 'insert')
     or has_table_privilege('anon', 'public.client_action_checkpoints', 'update')
     or has_table_privilege('anon', 'public.client_action_checkpoints', 'delete') then
    raise exception 'anon alcanca a tabela de topicos direto';
  end if;

  -- Staff lê (sob RLS), mas publicar continua sendo pela RPC.
  if not has_table_privilege('authenticated', 'public.client_action_checkpoints', 'select') then
    raise exception 'staff perdeu a leitura dos topicos';
  end if;
  if has_table_privilege('authenticated', 'public.client_action_checkpoints', 'insert')
     or has_table_privilege('authenticated', 'public.client_action_checkpoints', 'update')
     or has_table_privilege('authenticated', 'public.client_action_checkpoints', 'delete') then
    raise exception 'staff escreve direto na tabela de topicos';
  end if;

  if not has_function_privilege('anon', 'public.client_portal_set_checkpoint_done(uuid,uuid,boolean,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('anon', 'public.public_report_set_checkpoint_done(uuid,uuid,boolean,text,text,text)'::regprocedure, 'execute') then
    raise exception 'o cliente nao consegue marcar tarefa';
  end if;
end;
$$;

-- ─── Publicação cria os tópicos ───────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_checkpoints jsonb;
begin
  v_result := public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000001',
    public.test_payload(jsonb_build_array(
      jsonb_build_object('key', 'protocolar a renovacao', 'text', 'Protocolar a renovacao'),
      jsonb_build_object('key', 'afixar o alvara na recepcao', 'text', 'Afixar o alvara na recepcao'),
      jsonb_build_object('key', 'atualizar o contrato social', 'text', 'Atualizar o contrato social')
    ))
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'publicacao com topicos falhou: %', v_result;
  end if;

  if (select count(*) from public.client_action_checkpoints
      where action_item_id = public.test_item_id('item-alvara')) <> 3 then
    raise exception 'os tres topicos nao foram criados';
  end if;

  -- A ordem do array é a ordem em que ela escreveu.
  if (select text from public.client_action_checkpoints
      where action_item_id = public.test_item_id('item-alvara') and ordinal = 1) <> 'Protocolar a renovacao' then
    raise exception 'a ordem dos topicos nao seguiu o texto dela';
  end if;

  v_checkpoints := public.test_portal_checkpoints('item-alvara');
  if jsonb_array_length(v_checkpoints) <> 3 then
    raise exception 'o cliente nao enxergou os tres topicos: %', v_checkpoints;
  end if;
  if (v_checkpoints -> 0 ->> 'done')::boolean then
    raise exception 'topico nasceu marcado';
  end if;
  -- A chave interna nunca sai para o cliente.
  if v_checkpoints -> 0 ? 'checkpoint_key' then
    raise exception 'a chave interna vazou para o cliente';
  end if;
end;
$$;

-- ─── O clique do cliente ──────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_checkpoint uuid := public.test_checkpoint_id('item-alvara', 'Afixar o alvara na recepcao');
  v_row public.client_action_checkpoints%rowtype;
begin
  -- Sem assinatura não marca: a conta é da empresa, quem responde é a pessoa.
  v_result := public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000003', v_checkpoint, true, '  ', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'informe seu nome e sua funcao' then
    raise exception 'marcou tarefa sem assinatura: %', v_result;
  end if;

  v_result := public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000003', v_checkpoint, true, 'Joana', 'Gestora'
  );
  if v_result ->> 'ok' is distinct from 'true' or (v_result ->> 'done')::boolean is not true then
    raise exception 'nao marcou a tarefa: %', v_result;
  end if;

  select * into v_row from public.client_action_checkpoints where id = v_checkpoint;
  if v_row.done_at is null or v_row.done_by_name <> 'Joana' or v_row.done_by_role <> 'Gestora' then
    raise exception 'a marcacao nao guardou quem respondeu: %', v_row;
  end if;

  -- Só a tarefa clicada muda de estado.
  if (select count(*) from public.client_action_checkpoints
      where action_item_id = public.test_item_id('item-alvara') and done_at is not null) <> 1 then
    raise exception 'marcar uma tarefa marcou as outras';
  end if;

  -- Desmarcar volta ao estado de não cumprida.
  v_result := public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000003', v_checkpoint, false, 'Joana', 'Gestora'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'nao desmarcou a tarefa: %', v_result;
  end if;
  select * into v_row from public.client_action_checkpoints where id = v_checkpoint;
  if v_row.done_at is not null then
    raise exception 'a tarefa continuou marcada depois de desmarcar';
  end if;

  -- Marca de novo: é este estado que os próximos blocos usam.
  perform public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000003', v_checkpoint, true, 'Joana', 'Gestora'
  );

  -- A trilha registra os quatro movimentos.
  if (select count(*) from public.client_portal_audit_events
      where event_type = 'action_checkpoint_toggled') <> 3 then
    raise exception 'a auditoria nao registrou os cliques';
  end if;
end;
$$;

-- ─── O link aberto do relatório marca a mesma tarefa ──────────────────────────
do $$
declare
  v_result jsonb;
  v_checkpoint uuid := public.test_checkpoint_id('item-alvara', 'Protocolar a renovacao');
begin
  v_result := public.public_report_set_checkpoint_done(
    '50000000-0000-4000-8000-000000000002', v_checkpoint, true, 'Carlos', 'Responsavel tecnico'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'o link do relatorio nao marcou a tarefa: %', v_result;
  end if;

  -- Link de outra visita não alcança a tarefa desta unidade.
  v_result := public.public_report_set_checkpoint_done(
    '50000000-0000-4000-8000-000000000006', v_checkpoint, true, 'Carlos', 'Responsavel tecnico'
  );
  if v_result ->> 'error' is null then
    raise exception 'link de relatorio oculto marcou tarefa: %', v_result;
  end if;
end;
$$;

-- ─── Republicar preserva o que o cliente já marcou ────────────────────────────
do $$
declare
  v_checkpoints jsonb;
begin
  perform public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000001',
    public.test_payload(jsonb_build_array(
      jsonb_build_object('key', 'protocolar a renovacao', 'text', 'Protocolar a renovacao'),
      jsonb_build_object('key', 'afixar o alvara na recepcao', 'text', 'Afixar o alvara na recepcao'),
      jsonb_build_object('key', 'atualizar o contrato social', 'text', 'Atualizar o contrato social')
    ))
  );

  if (select count(*) from public.client_action_checkpoints
      where action_item_id = public.test_item_id('item-alvara')) <> 3 then
    raise exception 'republicar duplicou os topicos';
  end if;
  if (select count(*) from public.client_action_checkpoints
      where action_item_id = public.test_item_id('item-alvara') and done_at is not null) <> 2 then
    raise exception 'republicar apagou o que o cliente ja tinha marcado';
  end if;

  v_checkpoints := public.test_portal_checkpoints('item-alvara');
  if jsonb_array_length(v_checkpoints) <> 3 then
    raise exception 'o cliente perdeu topicos na republicacao: %', v_checkpoints;
  end if;
end;
$$;

-- ─── Tópico reescrito é tarefa nova; tópico retirado sai da vista ─────────────
do $$
declare
  v_checkpoints jsonb;
  v_retirado uuid := public.test_checkpoint_id('item-alvara', 'Atualizar o contrato social');
  v_marcado uuid := public.test_checkpoint_id('item-alvara', 'Afixar o alvara na recepcao');
begin
  perform public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000001',
    public.test_payload(jsonb_build_array(
      -- Reescrito: chave diferente, tarefa nova, sem herdar o "já fiz".
      jsonb_build_object('key', 'protocolar a renovacao na vigilancia municipal',
                         'text', 'Protocolar a renovacao na vigilancia municipal'),
      jsonb_build_object('key', 'afixar o alvara na recepcao', 'text', 'Afixar o alvara na recepcao')
      -- 'Atualizar o contrato social' saiu do apontamento, e ninguem tinha marcado.
    ))
  );

  -- O que ninguém marcou e saiu: some de vez.
  if exists (select 1 from public.client_action_checkpoints where id = v_retirado) then
    raise exception 'topico retirado e nunca respondido continuou na tabela';
  end if;

  -- O reescrito nasceu novo, e não marcado.
  if (select done_at from public.client_action_checkpoints
      where action_item_id = public.test_item_id('item-alvara')
        and text = 'Protocolar a renovacao na vigilancia municipal') is not null then
    raise exception 'topico reescrito herdou a marcacao do texto antigo';
  end if;

  -- O que o cliente marcou e continua apontado segue marcado.
  if (select done_at from public.client_action_checkpoints where id = v_marcado) is null then
    raise exception 'a reescrita de um topico apagou a marcacao de outro';
  end if;

  v_checkpoints := public.test_portal_checkpoints('item-alvara');
  if jsonb_array_length(v_checkpoints) <> 2 then
    raise exception 'o cliente nao viu os dois topicos vigentes: %', v_checkpoints;
  end if;
end;
$$;

-- ─── Tópico que o cliente marcou e depois saiu do apontamento ─────────────────
do $$
declare
  v_marcado uuid := public.test_checkpoint_id('item-alvara', 'Afixar o alvara na recepcao');
  v_checkpoints jsonb;
  v_result jsonb;
begin
  perform public.admin_publish_client_action_items(
    '50000000-0000-4000-8000-000000000001',
    public.test_payload(jsonb_build_array(
      jsonb_build_object('key', 'protocolar a renovacao na vigilancia municipal',
                         'text', 'Protocolar a renovacao na vigilancia municipal')
    ))
  );

  -- A resposta do cliente não é apagada: fica guardada, fora da vista dele.
  if (select dropped_at from public.client_action_checkpoints where id = v_marcado) is null then
    raise exception 'a resposta do cliente foi apagada em vez de guardada';
  end if;

  v_checkpoints := public.test_portal_checkpoints('item-alvara');
  if jsonb_array_length(v_checkpoints) <> 1 then
    raise exception 'topico retirado continuou aparecendo para o cliente: %', v_checkpoints;
  end if;

  -- E não aceita mais clique.
  v_result := public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000003', v_marcado, false, 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'tarefa nao esta mais no plano' then
    raise exception 'topico retirado ainda aceita clique: %', v_result;
  end if;
end;
$$;

-- ─── Trava por conta e alcance entre consultorias ─────────────────────────────
do $$
declare
  v_result jsonb;
  v_checkpoint uuid := public.test_checkpoint_id('item-alvara', 'Protocolar a renovacao na vigilancia municipal');
begin
  -- Conta de outra consultoria não alcança a tarefa desta.
  v_result := public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000023', v_checkpoint, true, 'Intruso', 'Curioso'
  );
  if v_result ->> 'error' is distinct from 'tarefa invalida' then
    raise exception 'conta de outro tenant alcancou a tarefa: %', v_result;
  end if;

  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'hidden');
  v_result := public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000003', v_checkpoint, true, 'Joana', 'Gestora'
  );
  if v_result ->> 'error' is distinct from 'plano de acao indisponivel' then
    raise exception 'plano travado aceitou clique em tarefa: %', v_result;
  end if;
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'released');
end;
$$;

select 'Client action checkpoints (PORT-05) tests passed' as result;
