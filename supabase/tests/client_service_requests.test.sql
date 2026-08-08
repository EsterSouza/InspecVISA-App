\set ON_ERROR_STOP on

-- P360-012 — continua de onde o fixture do P360-011 para (contas, unidades, visitas, plano de
-- ação, travas por conta, auditoria, `private.safe_evidence_file_name` e os papéis).
\ir client_action_evidence.test.sql

-- Papéis do tenant: existem em produção desde sempre, mas não no fixture. É por aqui que a
-- migration distingue consultora de administradora na hora de cancelar.
create table if not exists public.tenant_users (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  primary key (user_id, tenant_id)
);

-- `auth.uid()` do fixture é este usuário. Começa como consultora.
insert into public.tenant_users (user_id, tenant_id, role)
values (
  '10000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'consultant'
)
on conflict (user_id, tenant_id) do update set role = excluded.role;

\ir ../migrations/20260808001200_client_service_requests.sql

-- Tokens em jogo, para não confundir mais adiante:
--   conta A  = 20000000-…-000003 (tenant A, enxerga a unidade …0001)
--   conta B  = 20000000-…-000023 (outra consultoria, tenant B)
--   unidade fora do acesso da conta A = 20000000-…-000011

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.client_service_requests'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.client_service_request_events'::regclass) then
    raise exception 'RLS nao esta ativo nas tabelas de solicitacao';
  end if;

  -- Tabela nova no `public` nasce com ALL para anon/authenticated no Supabase.
  if has_table_privilege('anon', 'public.client_service_requests', 'select')
     or has_table_privilege('anon', 'public.client_service_requests', 'insert')
     or has_table_privilege('anon', 'public.client_service_request_events', 'select') then
    raise exception 'anon enxerga solicitacoes no nivel de tabela';
  end if;

  if not has_table_privilege('authenticated', 'public.client_service_requests', 'select')
     or not has_table_privilege('authenticated', 'public.client_service_request_events', 'select') then
    raise exception 'staff perdeu a leitura das solicitacoes';
  end if;

  if has_table_privilege('authenticated', 'public.client_service_requests', 'insert')
     or has_table_privilege('authenticated', 'public.client_service_requests', 'update')
     or has_table_privilege('authenticated', 'public.client_service_requests', 'delete')
     or has_table_privilege('authenticated', 'public.client_service_request_events', 'update')
     or has_table_privilege('authenticated', 'public.client_service_request_events', 'delete') then
    raise exception 'staff escreve direto nas solicitacoes em vez de passar pelas RPCs';
  end if;

  -- O app usa um cliente Supabase so: as RPCs publicas precisam dos dois papeis.
  if not has_function_privilege('anon', 'public.client_portal_create_service_request(uuid,uuid,text,text,text,uuid,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_create_service_request(uuid,uuid,text,text,text,uuid,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('anon', 'public.client_portal_service_requests(uuid,uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_service_requests(uuid,uuid)'::regprocedure, 'execute')
     or not has_function_privilege('anon', 'public.client_portal_reply_service_request(uuid,uuid,text,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_reply_service_request(uuid,uuid,text,text,text,text)'::regprocedure, 'execute') then
    raise exception 'RPC publica de solicitacao sem grant para anon ou authenticated';
  end if;

  -- RPC de staff nao pode ser chamavel pelo publico.
  if has_function_privilege('anon', 'public.admin_update_service_request(uuid,text,text,text,text,boolean,text)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.admin_set_service_request_sla(uuid,jsonb)'::regprocedure, 'execute') then
    raise exception 'anon executa RPC de staff de solicitacao';
  end if;

  -- Anexo so pela Edge Function: o navegador nao registra arquivo que nao subiu.
  if has_function_privilege('anon', 'public.client_portal_attach_service_request_file(uuid,uuid,text,text,bigint)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.client_portal_attach_service_request_file(uuid,uuid,text,text,bigint)'::regprocedure, 'execute') then
    raise exception 'o navegador registra anexo direto, sem passar pela Edge Function';
  end if;
  if not has_function_privilege('service_role', 'public.client_portal_attach_service_request_file(uuid,uuid,text,text,bigint)'::regprocedure, 'execute') then
    raise exception 'a Edge Function perdeu o grant para registrar anexo';
  end if;
end;
$$;

-- ─── Trava do tenant: desligado, ninguém abre nem lê ──────────────────────────
do $$
declare
  v_result jsonb;
begin
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'documentacao', 'Assunto de teste', 'Descricao suficientemente longa para passar.',
    '70000000-0000-4000-8000-000000000001'
  );
  if v_result ->> 'error' is distinct from 'solicitacoes indisponiveis' then
    raise exception 'abriu solicitacao com o modulo desligado no tenant: %', v_result;
  end if;

  v_result := public.client_portal_service_requests('20000000-0000-4000-8000-000000000003');
  if jsonb_array_length(v_result -> 'requests') <> 0 then
    raise exception 'leitura devolveu algo com o modulo desligado: %', v_result;
  end if;
end;
$$;

update public.client_portal_settings
set service_requests_enabled = true
where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- A outra consultoria também tem o módulo ligado: sem isto, o teste de isolamento passaria
-- pelo motivo errado (lista vazia por causa da trava, não por causa do tenant).
insert into public.client_portal_settings (tenant_id, service_requests_enabled)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true)
on conflict (tenant_id) do update set service_requests_enabled = true;

-- ─── Abertura, numeração e SLA ausente ────────────────────────────────────────
do $$
declare
  v_result jsonb;
  v_row public.client_service_requests%rowtype;
begin
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'licenciamento',
    'Renovacao do alvara sanitario',
    'Precisamos de apoio para renovar o alvara que vence no mes que vem.',
    '70000000-0000-4000-8000-000000000002',
    'Maria da Silva', 'Gerente'
  );
  if v_result ->> 'ok' is distinct from 'true' or (v_result ->> 'request_number')::int <> 1 then
    raise exception 'primeira solicitacao nao nasceu com numero 1: %', v_result;
  end if;

  -- Sem regra administrativa configurada, o portal NAO promete prazo nenhum.
  if v_result -> 'sla_days' <> 'null'::jsonb or v_result -> 'sla_hint_date' <> 'null'::jsonb then
    raise exception 'prometeu prazo sem SLA configurado: %', v_result;
  end if;

  select * into v_row from public.client_service_requests where id = (v_result ->> 'request_id')::uuid;
  -- …0002 é a CONTA; …0003 é o token dela.
  if v_row.status <> 'open' or v_row.priority <> 'normal' or v_row.account_id is distinct from '20000000-0000-4000-8000-000000000002' then
    raise exception 'solicitacao nasceu com estado errado: %', to_jsonb(v_row);
  end if;

  if not exists (
    select 1 from public.client_service_request_events
    where request_id = v_row.id and event_type = 'created' and actor_kind = 'client' and visible_to_client
  ) then
    raise exception 'abertura nao registrou o evento inicial';
  end if;

  if not exists (
    select 1 from public.client_portal_audit_events
    where event_type = 'service_request_created' and client_id = '20000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'abertura nao registrou auditoria';
  end if;
end;
$$;

-- ─── Validação de conteúdo ────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'categoria_que_nao_existe', 'Assunto valido', 'Descricao suficientemente longa para passar.',
    '70000000-0000-4000-8000-000000000003'
  );
  if v_result ->> 'error' is distinct from 'categoria invalida' then
    raise exception 'aceitou categoria fora da lista: %', v_result;
  end if;

  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'outro', 'ab', 'Descricao suficientemente longa para passar.',
    '70000000-0000-4000-8000-000000000004'
  );
  if v_result -> 'error' is null then
    raise exception 'aceitou assunto de 2 caracteres: %', v_result;
  end if;

  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'outro', 'Assunto valido', 'curto',
    '70000000-0000-4000-8000-000000000005'
  );
  if v_result -> 'error' is null then
    raise exception 'aceitou descricao de 5 caracteres: %', v_result;
  end if;
end;
$$;

-- ─── Isolamento: token, unidade e tenant ──────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  v_result := public.client_portal_create_service_request(
    '99999999-9999-4999-8999-999999999999', '20000000-0000-4000-8000-000000000001',
    'outro', 'Assunto valido', 'Descricao suficientemente longa para passar.',
    '70000000-0000-4000-8000-000000000006'
  );
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'token invalido abriu solicitacao: %', v_result;
  end if;

  -- Unidade do MESMO tenant, mas fora do acesso da conta.
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000011',
    'outro', 'Assunto valido', 'Descricao suficientemente longa para passar.',
    '70000000-0000-4000-8000-000000000007'
  );
  if v_result ->> 'error' is distinct from 'unidade fora do acesso' then
    raise exception 'abriu solicitacao para unidade fora do acesso: %', v_result;
  end if;

  -- Unidade de OUTRA consultoria: mesma resposta, para o erro não revelar que o id existe.
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000021',
    'outro', 'Assunto valido', 'Descricao suficientemente longa para passar.',
    '70000000-0000-4000-8000-000000000008'
  );
  if v_result ->> 'error' is distinct from 'unidade fora do acesso' then
    raise exception 'abriu solicitacao cruzando tenant: %', v_result;
  end if;

  -- A conta da outra consultoria não enxerga nada do tenant A.
  if jsonb_array_length(
    public.client_portal_service_requests('20000000-0000-4000-8000-000000000023') -> 'requests'
  ) <> 0 then
    raise exception 'conta de outra consultoria enxergou solicitacao do tenant A';
  end if;
end;
$$;

-- ─── Duplo clique e retry ─────────────────────────────────────────────────────
do $$
declare
  v_first jsonb;
  v_again jsonb;
  v_similar jsonb;
  v_total integer;
begin
  v_first := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'treinamento', 'Treinamento de boas praticas', 'Queremos treinar a equipe da cozinha em boas praticas.',
    '70000000-0000-4000-8000-000000000009'
  );

  -- Mesma submissão (retry de rede, clique duplo): devolve a MESMA linha, com o mesmo número.
  v_again := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'treinamento', 'Treinamento de boas praticas', 'Queremos treinar a equipe da cozinha em boas praticas.',
    '70000000-0000-4000-8000-000000000009'
  );
  if v_again ->> 'duplicate' is distinct from 'true'
     or v_again ->> 'request_id' is distinct from (v_first ->> 'request_id') then
    raise exception 'retry criou solicitacao nova: % vs %', v_first, v_again;
  end if;

  -- Submissão diferente, mesmo conteúdo, minutos depois: também não duplica.
  v_similar := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'treinamento', 'treinamento de boas praticas', 'Digitou tudo de novo achando que nao tinha ido.',
    '70000000-0000-4000-8000-000000000010'
  );
  if v_similar ->> 'duplicate' is distinct from 'true'
     or v_similar ->> 'request_id' is distinct from (v_first ->> 'request_id') then
    raise exception 'reenvio do mesmo assunto criou duplicata: %', v_similar;
  end if;

  select count(*) into v_total
  from public.client_service_requests
  where subject ilike 'treinamento de boas praticas';
  if v_total <> 1 then
    raise exception 'existe mais de uma solicitacao para o mesmo assunto: %', v_total;
  end if;
end;
$$;

-- ─── Rate limit por conta ─────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
  i integer;
begin
  -- Já existem 2 nesta hora (alvará e treinamento). Mais 3 completam o teto de 5.
  for i in 1..3 loop
    v_result := public.client_portal_create_service_request(
      '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
      'outro', 'Pedido em sequencia ' || i, 'Descricao suficientemente longa para passar no limite.',
      ('70000000-0000-4000-8000-00000000002' || i)::uuid
    );
    if v_result ->> 'ok' is distinct from 'true' then
      raise exception 'rate limit disparou antes da hora (%): %', i, v_result;
    end if;
  end loop;

  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'outro', 'Pedido que passa do teto', 'Descricao suficientemente longa para passar no limite.',
    '70000000-0000-4000-8000-000000000030'
  );
  if v_result ->> 'error' not like 'muitas solicitacoes%' then
    raise exception 'sexta solicitacao na mesma hora passou: %', v_result;
  end if;
end;
$$;

-- Volta o relógio das antigas para liberar a janela do resto do teste.
update public.client_service_requests
set created_at = now() - interval '3 hours'
where subject <> 'Renovacao do alvara sanitario';

-- ─── SLA configurável, congelado na abertura ─────────────────────────────────
do $$
declare
  v_result jsonb;
  v_days integer;
begin
  v_result := public.admin_set_service_request_sla(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"licenciamento": 3, "default": 7}'::jsonb
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'nao salvou o SLA: %', v_result;
  end if;

  if public.admin_set_service_request_sla(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"categoria_inventada": 3}'::jsonb
  ) -> 'error' is null then
    raise exception 'aceitou SLA para categoria que nao existe';
  end if;

  if public.admin_set_service_request_sla(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"outro": "tres"}'::jsonb
  ) -> 'error' is null then
    raise exception 'aceitou SLA em texto';
  end if;

  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'licenciamento', 'Segunda via de licenca', 'Perdemos a via impressa e precisamos de outra.',
    '70000000-0000-4000-8000-000000000040'
  );
  if (v_result ->> 'sla_days')::int <> 3 then
    raise exception 'nao aplicou o SLA da categoria: %', v_result;
  end if;

  -- Categoria sem regra própria cai no `default`.
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    'obra_reforma', 'Parecer sobre planta da copa', 'Vamos reformar a copa e queremos parecer antes da obra.',
    '70000000-0000-4000-8000-000000000041'
  );
  if (v_result ->> 'sla_days')::int <> 7 then
    raise exception 'nao aplicou o SLA padrao: %', v_result;
  end if;

  -- Mudar a configuração depois NÃO reescreve o que já foi dito ao cliente.
  perform public.admin_set_service_request_sla(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"licenciamento": 30}'::jsonb
  );
  select sla_days into v_days
  from public.client_service_requests
  where subject = 'Segunda via de licenca';
  if v_days <> 3 then
    raise exception 'SLA congelado foi reescrito pela configuracao nova: %', v_days;
  end if;
end;
$$;

-- ─── Atendimento pela equipe, por papel ───────────────────────────────────────
do $$
declare
  v_id uuid;
  v_result jsonb;
  v_row public.client_service_requests%rowtype;
begin
  select id into v_id from public.client_service_requests where subject = 'Renovacao do alvara sanitario';

  -- Assumir: prioridade, responsável e status no mesmo gesto.
  v_result := public.admin_update_service_request(
    v_id, 'in_progress', 'high', 'Ester Caiafa', null, false, 'Ester Caiafa'
  );
  if v_result ->> 'waiting_on' is distinct from 'team' then
    raise exception 'em atendimento nao aguarda a equipe: %', v_result;
  end if;

  -- Perguntar ao cliente exige dizer o quê.
  v_result := public.admin_update_service_request(v_id, 'awaiting_client', null, null, null, false, 'Ester');
  if v_result -> 'error' is null then
    raise exception 'perguntou ao cliente sem dizer o que precisa: %', v_result;
  end if;

  v_result := public.admin_update_service_request(
    v_id, 'awaiting_client', null, null, 'Envie o contrato social atualizado.', false, 'Ester'
  );
  if v_result ->> 'waiting_on' is distinct from 'client' then
    raise exception 'nao passou a aguardar o cliente: %', v_result;
  end if;

  select * into v_row from public.client_service_requests where id = v_id;
  if v_row.awaiting_client_since is null then
    raise exception 'nao carimbou desde quando aguarda o cliente';
  end if;

  -- A pergunta é sempre visível para o cliente, mesmo pedida como interna.
  if not exists (
    select 1 from public.client_service_request_events
    where request_id = v_id and to_status = 'awaiting_client' and visible_to_client
      and note = 'Envie o contrato social atualizado.'
  ) then
    raise exception 'a pergunta ao cliente ficou invisivel para ele';
  end if;

  -- Nota interna não vai ao portal e não mexe na "última atualização" dele.
  v_result := public.admin_update_service_request(
    v_id, null, null, null, 'Conferir historico da unidade antes de responder.', false, 'Ester'
  );
  if not exists (
    select 1 from public.client_service_request_events
    where request_id = v_id and event_type = 'note' and not visible_to_client
  ) then
    raise exception 'nota interna nao foi registrada como interna';
  end if;

  -- Cancelar é só do administrador; hoje o usuário do fixture é consultora.
  v_result := public.admin_update_service_request(v_id, 'cancelled', null, null, null, false, 'Ester');
  if v_result ->> 'error' not like 'apenas o administrador%' then
    raise exception 'consultora cancelou solicitacao: %', v_result;
  end if;

  update public.tenant_users set role = 'admin'
  where user_id = '10000000-0000-4000-8000-000000000001';

  -- Situação inventada continua barrada mesmo para o admin.
  if public.admin_update_service_request(v_id, 'arquivada', null, null, null, false, 'Ester') -> 'error' is null then
    raise exception 'aceitou situacao fora da lista';
  end if;

  update public.tenant_users set role = 'consultant'
  where user_id = '10000000-0000-4000-8000-000000000001';
end;
$$;

-- ─── O que o cliente vê ───────────────────────────────────────────────────────
do $$
declare
  v_request jsonb;
  v_events jsonb;
begin
  select item into v_request
  from jsonb_array_elements(
    public.client_portal_service_requests('20000000-0000-4000-8000-000000000003') -> 'requests'
  ) as item
  where item ->> 'subject' = 'Renovacao do alvara sanitario';

  -- Critério de aceite: número, categoria, data, situação e última atualização.
  if v_request ->> 'request_number' is null
     or v_request ->> 'category' is null
     or v_request ->> 'created_at' is null
     or v_request ->> 'status' is null
     or v_request ->> 'last_event_at' is null then
    raise exception 'o cliente nao recebe o basico da solicitacao: %', v_request;
  end if;

  if v_request ->> 'waiting_on' is distinct from 'client'
     or v_request ->> 'accepts_reply' is distinct from 'true' then
    raise exception 'a tela do cliente nao mostra que a bola esta com ele: %', v_request;
  end if;

  -- Prioridade é gestão de fila interna e não sai para o cliente.
  if v_request ? 'priority' then
    raise exception 'a prioridade interna vazou para o cliente: %', v_request;
  end if;

  v_events := v_request -> 'events';
  if exists (
    select 1 from jsonb_array_elements(v_events) e
    where e ->> 'note' = 'Conferir historico da unidade antes de responder.'
  ) then
    raise exception 'nota interna da equipe vazou no historico do cliente';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_events) e
    where e ->> 'note' = 'Envie o contrato social atualizado.'
  ) then
    raise exception 'a pergunta da consultoria nao aparece no historico do cliente';
  end if;

  -- A solicitação que aguarda o cliente vem antes das que aguardam a equipe.
  if (
    select item ->> 'subject'
    from jsonb_array_elements(
      public.client_portal_service_requests('20000000-0000-4000-8000-000000000003') -> 'requests'
    ) with ordinality as t(item, pos)
    order by pos limit 1
  ) is distinct from 'Renovacao do alvara sanitario' then
    raise exception 'a lista do cliente nao poe primeiro o que depende dele';
  end if;
end;
$$;

-- ─── Resposta do cliente ──────────────────────────────────────────────────────
do $$
declare
  v_id uuid;
  v_outro uuid;
  v_result jsonb;
  v_row public.client_service_requests%rowtype;
begin
  select id into v_id from public.client_service_requests where subject = 'Renovacao do alvara sanitario';
  select id into v_outro from public.client_service_requests where subject = 'Segunda via de licenca';

  -- Isto não é chat: sem pergunta aberta, não há resposta.
  v_result := public.client_portal_reply_service_request(
    '20000000-0000-4000-8000-000000000003', v_outro, 'Oi, tudo bem?', 'Maria', 'Gerente'
  );
  if v_result ->> 'error' not like 'esta solicitacao nao esta aguardando%' then
    raise exception 'o cliente escreveu numa solicitacao que nao perguntou nada: %', v_result;
  end if;

  -- Token de outra conta não responde pela solicitação alheia.
  v_result := public.client_portal_reply_service_request(
    '20000000-0000-4000-8000-000000000023', v_id, 'Segue o contrato.', 'Fulano', 'Diretor'
  );
  if v_result ->> 'error' is distinct from 'solicitacao invalida' then
    raise exception 'conta de outra consultoria respondeu a solicitacao: %', v_result;
  end if;

  v_result := public.client_portal_reply_service_request(
    '20000000-0000-4000-8000-000000000003', v_id,
    'Segue o contrato social atualizado, protocolado semana passada.', 'Maria da Silva', 'Gerente'
  );
  if v_result ->> 'ok' is distinct from 'true' or v_result ->> 'status' is distinct from 'in_progress' then
    raise exception 'a resposta do cliente nao devolveu a bola para a equipe: %', v_result;
  end if;

  select * into v_row from public.client_service_requests where id = v_id;
  if v_row.awaiting_client_since is not null then
    raise exception 'continuou marcada como aguardando o cliente depois da resposta';
  end if;

  if not exists (
    select 1 from public.client_service_request_events
    where request_id = v_id and event_type = 'client_reply' and actor_kind = 'client' and visible_to_client
  ) then
    raise exception 'a resposta do cliente nao entrou no historico';
  end if;
end;
$$;

-- ─── Encerramento ─────────────────────────────────────────────────────────────
do $$
declare
  v_id uuid;
  v_result jsonb;
  v_row public.client_service_requests%rowtype;
begin
  select id into v_id from public.client_service_requests where subject = 'Renovacao do alvara sanitario';

  v_result := public.admin_update_service_request(
    v_id, 'resolved', null, null, 'Alvara renovado e arquivado na pasta sanitaria.', true, 'Ester Caiafa'
  );
  if v_result ->> 'waiting_on' is distinct from 'none' then
    raise exception 'solicitacao encerrada ainda aguarda alguem: %', v_result;
  end if;

  select * into v_row from public.client_service_requests where id = v_id;
  if v_row.closed_at is null then
    raise exception 'encerrou sem carimbar a data';
  end if;

  -- Encerrada não aceita mais resposta: o cliente abre outra, com número próprio.
  v_result := public.client_portal_reply_service_request(
    '20000000-0000-4000-8000-000000000003', v_id, 'Mais uma coisa...', 'Maria', 'Gerente'
  );
  if v_result -> 'error' is null then
    raise exception 'aceitou resposta em solicitacao encerrada: %', v_result;
  end if;

  if (
    select item ->> 'accepts_reply'
    from jsonb_array_elements(
      public.client_portal_service_requests('20000000-0000-4000-8000-000000000003') -> 'requests'
    ) as item
    where (item ->> 'id')::uuid = v_id
  ) is distinct from 'false' then
    raise exception 'a tela ainda oferece resposta em solicitacao encerrada';
  end if;
end;
$$;

-- ─── Anexo ────────────────────────────────────────────────────────────────────
do $$
declare
  v_id uuid;
  v_result jsonb;
begin
  select id into v_id from public.client_service_requests where subject = 'Segunda via de licenca';

  if public.client_portal_attach_service_request_file(
    '20000000-0000-4000-8000-000000000003', v_id, 'planta.dwg', 'application/octet-stream', 1000
  ) ->> 'error' is distinct from 'tipo de arquivo nao aceito' then
    raise exception 'aceitou anexo de tipo nao permitido';
  end if;

  if public.client_portal_attach_service_request_file(
    '20000000-0000-4000-8000-000000000003', v_id, 'laudo.pdf', 'application/pdf', 0
  ) ->> 'error' is distinct from 'arquivo vazio' then
    raise exception 'aceitou anexo vazio';
  end if;

  if public.client_portal_attach_service_request_file(
    '20000000-0000-4000-8000-000000000003', v_id, 'laudo.pdf', 'application/pdf', 10485761
  ) ->> 'error' not like 'arquivo acima do limite%' then
    raise exception 'aceitou anexo acima de 10 MB';
  end if;

  -- Conta de outra consultoria não anexa em solicitação alheia.
  if public.client_portal_attach_service_request_file(
    '20000000-0000-4000-8000-000000000023', v_id, 'laudo.pdf', 'application/pdf', 1000
  ) ->> 'error' is distinct from 'solicitacao invalida' then
    raise exception 'conta de outra consultoria anexou arquivo';
  end if;

  -- Caminho e nome são gerados no servidor: extensão vem do MIME, nunca do nome enviado.
  v_result := public.client_portal_attach_service_request_file(
    '20000000-0000-4000-8000-000000000003', v_id, '../../etc/passwd.exe', 'application/pdf', 2048
  );
  if v_result ->> 'file_name' <> 'passwd.pdf' then
    raise exception 'o nome do arquivo veio do cliente: %', v_result;
  end if;
  if v_result ->> 'storage_path' <> (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/20000000-0000-4000-8000-000000000001/' || v_id || '/passwd.pdf'
  ) then
    raise exception 'caminho do anexo fora do padrao tenant/unidade/solicitacao: %', v_result;
  end if;

  -- Um anexo por solicitação.
  if public.client_portal_attach_service_request_file(
    '20000000-0000-4000-8000-000000000003', v_id, 'outro.pdf', 'application/pdf', 2048
  ) ->> 'error' is distinct from 'esta solicitacao ja tem anexo' then
    raise exception 'aceitou um segundo anexo na mesma solicitacao';
  end if;

  -- Falha na subida: a Edge Function limpa o registro e a solicitação continua de pé.
  if public.client_portal_discard_service_request_file(
    '20000000-0000-4000-8000-000000000003', v_id
  ) ->> 'ok' is distinct from 'true' then
    raise exception 'nao conseguiu desfazer o registro do anexo';
  end if;
  if exists (select 1 from public.client_service_requests where id = v_id and attachment_path is not null) then
    raise exception 'o anexo continuou registrado depois do descarte';
  end if;
  if not exists (select 1 from public.client_service_requests where id = v_id) then
    raise exception 'o descarte do anexo apagou a solicitacao inteira';
  end if;
end;
$$;

-- ─── Estado vazio ─────────────────────────────────────────────────────────────
do $$
begin
  if jsonb_array_length(
    public.client_portal_service_requests('20000000-0000-4000-8000-000000000023') -> 'requests'
  ) <> 0 then
    raise exception 'conta sem solicitacao nao devolveu lista vazia';
  end if;
end;
$$;

\echo 'client_service_requests.test.sql OK'
