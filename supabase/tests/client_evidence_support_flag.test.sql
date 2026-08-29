\set ON_ERROR_STOP on

-- PORT-06 — continua de onde o fixture do PORT-05 para (contas, unidades, visitas, itens
-- publicados com tópicos, evidências e os helpers `private`).
\ir client_action_checkpoints.test.sql

\ir ../migrations/20260829085041_client_evidence_support_flag.sql

-- Os testes anteriores deixaram evidências no item; o limite de 10 arquivos por pendência
-- atrapalharia os casos daqui. Zera para o cenário ser o do card, e não o acumulado.
delete from public.client_action_evidence;

-- O mesmo item, como o link do relatório o entrega.
create or replace function public.test_report_item(p_source text)
returns jsonb
language sql
stable
as $$
  select item
  from jsonb_array_elements(
    public.public_report_action_items('50000000-0000-4000-8000-000000000002') -> 'items'
  ) as item
  where (item ->> 'id')::uuid = public.test_item_id(p_source)
  limit 1;
$$;

-- ─── Permissões ───────────────────────────────────────────────────────────────
--
-- `create or replace` numa RPC pública é onde o grant se perde: as suítes anteriores checam os
-- grants ANTES desta migration, então quem reescreve a função precisa reafirmá-los aqui.
do $$
begin
  -- Cliente Supabase único: com sessão de staff no navegador a RPC pública chega como
  -- `authenticated`. Os dois papéis, nas duas leituras.
  if not has_function_privilege('anon', 'public.public_report_action_items(uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.public_report_action_items(uuid)'::regprocedure, 'execute') then
    raise exception 'a leitura do relatorio por link perdeu grant na reescrita';
  end if;
  if not has_function_privilege('anon', 'public.client_portal_action_items(uuid,uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_action_items(uuid,uuid)'::regprocedure, 'execute') then
    raise exception 'a leitura do plano de acao pela conta perdeu grant na reescrita';
  end if;

  -- Escrever continua só da Edge Function; o navegador não alcança nem a função interna.
  if has_function_privilege('anon', 'private.register_action_evidence(public.client_action_items,uuid,text,uuid,text,text,bigint,text,text,text,text)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'private.register_action_evidence(public.client_action_items,uuid,text,uuid,text,text,bigint,text,text,text,text)'::regprocedure, 'execute') then
    raise exception 'o navegador alcanca o registro de evidencia direto';
  end if;
  if not has_function_privilege('service_role', 'public.client_portal_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('service_role', 'public.public_report_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text,text,text)'::regprocedure, 'execute') then
    raise exception 'a Edge Function perdeu o grant do envio';
  end if;
end;
$$;

-- ─── A coluna nasce ligada ────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = 'has_evidence_support' and is_nullable = 'NO'
  ) then
    raise exception 'a coluna do suporte a evidencia nao existe ou aceita nulo';
  end if;

  -- Default true: ninguém perde o upload por causa desta migration.
  if exists (select 1 from public.clients where has_evidence_support is not true) then
    raise exception 'cliente existente nasceu sem suporte a evidencia';
  end if;
end;
$$;

-- ─── Com suporte (o padrão): nada muda ────────────────────────────────────────
do $$
declare
  v_portal jsonb := public.test_portal_item('item-alvara');
  v_link jsonb := public.test_report_item('item-alvara');
begin
  if (v_portal ->> 'accepts_file_evidence')::boolean is not true
     or (v_link ->> 'accepts_file_evidence')::boolean is not true then
    raise exception 'cliente com suporte perdeu o envio de arquivo: % / %', v_portal, v_link;
  end if;
  if (v_portal ->> 'accepts_evidence')::boolean is not true then
    raise exception 'o campo antigo mudou de comportamento: %', v_portal;
  end if;
end;
$$;

-- ─── Cliente de vistoria: o arquivo some, o resto fica ────────────────────────
update public.clients set has_evidence_support = false
where id = '20000000-0000-4000-8000-000000000001';

do $$
declare
  v_portal jsonb := public.test_portal_item('item-alvara');
  v_link jsonb := public.test_report_item('item-alvara');
begin
  if (v_portal ->> 'accepts_file_evidence')::boolean is not false
     or (v_link ->> 'accepts_file_evidence')::boolean is not false then
    raise exception 'cliente de vistoria continuou recebendo o envio: % / %', v_portal, v_link;
  end if;

  -- O que o card NÃO tira: declarar situação e marcar tópicos seguem liberados.
  if (v_portal ->> 'accepts_evidence')::boolean is not true
     or (v_link ->> 'accepts_evidence')::boolean is not true then
    raise exception 'a trava do arquivo derrubou status e topicos junto: % / %', v_portal, v_link;
  end if;

  -- E o plano de ação continua inteiro: a pendência não some da vista do cliente.
  if v_portal ->> 'title' is null or v_portal ->> 'recommended_action' is null then
    raise exception 'a pendencia sumiu para o cliente de vistoria: %', v_portal;
  end if;
end;
$$;

-- ─── O envio é recusado nos DOIS caminhos, sem gravar nada ────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
begin
  -- Pela conta do portal.
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item, '90000000-0000-4000-8000-000000000001',
    'prova.pdf', 'application/pdf', 2048, 'Joana Prado', 'Gestora da unidade'
  );
  if v_result ->> 'error' is distinct from 'sem_suporte_evidencia' then
    raise exception 'a conta enviou evidencia sem suporte contratado: %', v_result;
  end if;

  -- Pelo link do relatório, que não passa por nenhuma trava de conta.
  v_result := public.public_report_submit_evidence(
    '50000000-0000-4000-8000-000000000002', v_item, '90000000-0000-4000-8000-000000000002',
    'prova.pdf', 'application/pdf', 2048, 'Joana Prado', 'Gestora da unidade'
  );
  if v_result ->> 'error' is distinct from 'sem_suporte_evidencia' then
    raise exception 'o link enviou evidencia sem suporte contratado: %', v_result;
  end if;

  if (select count(*) from public.client_action_evidence) <> 0 then
    raise exception 'envio recusado gravou linha mesmo assim';
  end if;
end;
$$;

-- ─── Declarar situação e marcar tópico continuam funcionando ──────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_checkpoint uuid;
  v_result jsonb;
begin
  v_result := public.client_portal_set_item_status(
    '20000000-0000-4000-8000-000000000003', v_item, 'in_progress',
    'Joana Prado', 'Gestora da unidade', 'Protocolo aberto na VISA.'
  );
  if v_result ->> 'error' is not null then
    raise exception 'cliente de vistoria nao conseguiu declarar a situacao: %', v_result;
  end if;
  if (select client_status from public.client_action_items where id = v_item) <> 'in_progress' then
    raise exception 'a declaracao nao foi gravada';
  end if;

  select cp.id into v_checkpoint
  from public.client_action_checkpoints cp
  where cp.action_item_id = v_item and cp.dropped_at is null
  order by cp.ordinal, cp.text
  limit 1;

  if v_checkpoint is null then
    raise exception 'o fixture deixou de ter topico ativo no item-alvara';
  end if;

  v_result := public.client_portal_set_checkpoint_done(
    '20000000-0000-4000-8000-000000000003', v_checkpoint, true,
    'Joana Prado', 'Gestora da unidade'
  );
  if v_result ->> 'error' is not null then
    raise exception 'cliente de vistoria nao conseguiu marcar o topico: %', v_result;
  end if;
end;
$$;

-- ─── Religar devolve o envio ──────────────────────────────────────────────────
update public.clients set has_evidence_support = true
where id = '20000000-0000-4000-8000-000000000001';

do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
begin
  if (public.test_portal_item('item-alvara') ->> 'accepts_file_evidence')::boolean is not true then
    raise exception 'religar o suporte nao devolveu o envio na leitura';
  end if;

  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item, '90000000-0000-4000-8000-000000000003',
    'prova.pdf', 'application/pdf', 2048, 'Joana Prado', 'Gestora da unidade'
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'religar o suporte nao devolveu o envio: %', v_result;
  end if;
end;
$$;

select 'client_evidence_support_flag: ok' as resultado;
