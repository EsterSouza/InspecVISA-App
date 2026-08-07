\set ON_ERROR_STOP on

-- P360-011 — continua de onde o fixture do PORT-01 para (contas, unidades, visitas,
-- `client_action_items` publicados, travas por conta e os helpers `private`).
\ir portal_feature_gates.test.sql

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;

-- Trilha de auditoria: existe em produção desde o PROD-01, mas não no fixture.
create table if not exists public.client_portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid,
  client_id uuid,
  appointment_request_id uuid,
  attachment_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

\ir ../migrations/20260807184950_client_action_evidence.sql

-- Atalhos: os itens nascem da publicação do relatório, então são procurados pela origem.
create or replace function public.test_item_id(p_source text)
returns uuid
language sql
stable
as $$
  -- `item-pia` tem duas linhas (a resolvida e a recorrência); o aberto vem primeiro.
  select id from public.client_action_items
  where source_item_id = p_source
  order by (status = 'resolved'), created_at
  limit 1;
$$;

create or replace function public.test_portal_item(p_source text)
returns jsonb
language sql
stable
as $$
  select item
  from jsonb_array_elements(
    public.client_portal_action_items('20000000-0000-4000-8000-000000000003') -> 'items'
  ) as item
  where (item ->> 'id')::uuid = public.test_item_id(p_source)
  limit 1;
$$;

-- ─── Permissões ───────────────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.client_action_evidence'::regclass) then
    raise exception 'RLS nao esta ativo em client_action_evidence';
  end if;

  -- Tabela nova no `public` nasce com ALL para anon/authenticated no Supabase.
  if has_table_privilege('anon', 'public.client_action_evidence', 'select')
     or has_table_privilege('anon', 'public.client_action_evidence', 'insert') then
    raise exception 'anon enxerga a evidencia no nivel de tabela';
  end if;

  if not has_table_privilege('authenticated', 'public.client_action_evidence', 'select') then
    raise exception 'staff perdeu a leitura da evidencia';
  end if;

  if has_table_privilege('authenticated', 'public.client_action_evidence', 'insert')
     or has_table_privilege('authenticated', 'public.client_action_evidence', 'update')
     or has_table_privilege('authenticated', 'public.client_action_evidence', 'delete') then
    raise exception 'staff escreve direto na evidencia em vez de passar pela RPC de revisao';
  end if;

  if has_table_privilege('anon', 'public.client_action_evidence_notifications', 'select')
     or has_table_privilege('authenticated', 'public.client_action_evidence_notifications', 'insert') then
    raise exception 'a idempotencia de notificacao ficou escrivel fora do service role';
  end if;

  -- Registrar/listar/descartar evidencia exige ter o arquivo na mao: so a Edge Function.
  if has_function_privilege('anon', 'public.client_portal_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.client_portal_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text)'::regprocedure, 'execute') then
    raise exception 'o navegador registra evidencia sem passar pela Edge Function';
  end if;

  if has_function_privilege('anon', 'public.client_portal_list_evidence(uuid,uuid)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.client_portal_list_evidence(uuid,uuid)'::regprocedure, 'execute') then
    raise exception 'o navegador le storage_path da evidencia direto';
  end if;

  if has_function_privilege('anon', 'public.client_portal_discard_evidence(uuid,uuid)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.client_portal_discard_evidence(uuid,uuid)'::regprocedure, 'execute') then
    raise exception 'o navegador apaga evidencia direto';
  end if;

  if not has_function_privilege('service_role', 'public.client_portal_submit_evidence(uuid,uuid,uuid,text,text,bigint,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('service_role', 'public.client_portal_list_evidence(uuid,uuid)'::regprocedure, 'execute')
     or not has_function_privilege('service_role', 'public.client_portal_discard_evidence(uuid,uuid)'::regprocedure, 'execute') then
    raise exception 'a Edge Function perdeu o grant das RPCs de evidencia';
  end if;

  -- Revisao e do staff logado, nunca do publico.
  if has_function_privilege('anon', 'public.admin_review_client_action_evidence(uuid,text,text,boolean,text)'::regprocedure, 'execute') then
    raise exception 'anon revisa evidencia';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_review_client_action_evidence(uuid,text,text,boolean,text)'::regprocedure, 'execute') then
    raise exception 'staff perdeu o grant da revisao';
  end if;

  -- A leitura do plano de acao continua chamavel pelos dois papeis (cliente Supabase unico).
  if not has_function_privilege('anon', 'public.client_portal_action_items(uuid,uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_action_items(uuid,uuid)'::regprocedure, 'execute') then
    raise exception 'a RPC do plano de acao perdeu grant ao ganhar o resumo da evidencia';
  end if;
end;
$$;

-- ─── Nome de arquivo: extensão vem do MIME, caminho vindo do cliente é descartado ──
do $$
declare
  v text;
begin
  v := private.safe_evidence_file_name('../../etc/passwd', 'application/pdf');
  if v <> 'passwd.pdf' then
    raise exception 'travessia de diretorio sobreviveu ao nome: %', v;
  end if;

  v := private.safe_evidence_file_name('Laudo Técnico Final.pdf.exe', 'application/pdf');
  if v <> 'laudo-tecnico-final.pdf.pdf' then
    raise exception 'extensao dupla nao foi neutralizada: %', v;
  end if;

  v := private.safe_evidence_file_name('C:\Users\cliente\Alvará 2026.JPG', 'image/jpeg');
  if v <> 'alvara-2026.jpg' then
    raise exception 'caminho do Windows ou acento sobreviveu: %', v;
  end if;

  v := private.safe_evidence_file_name('...', 'image/png');
  if v <> 'evidencia.png' then
    raise exception 'nome vazio nao virou padrao: %', v;
  end if;

  -- A extensao NUNCA vem do que o cliente digitou: quem manda e o MIME conferido no servidor.
  v := private.safe_evidence_file_name('foto.pdf', 'image/webp');
  if v <> 'foto.webp' then
    raise exception 'extensao seguiu o nome em vez do MIME: %', v;
  end if;
end;
$$;

-- ─── Envio: o item NÃO se resolve sozinho ─────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
  v_evidence public.client_action_evidence%rowtype;
  v_portal jsonb;
begin
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003',
    v_item,
    '70000000-0000-4000-8000-000000000001',
    'Protocolo da Vigilância.pdf',
    'application/pdf',
    204800,
    'Segue o protocolo de renovacao.',
    'Mozilla/5.0 (teste)'
  );

  if v_result ->> 'ok' is distinct from 'true' or (v_result ->> 'duplicate')::boolean then
    raise exception 'envio valido foi recusado: %', v_result;
  end if;

  select * into v_evidence from public.client_action_evidence where id = (v_result ->> 'evidence_id')::uuid;

  if v_evidence.status <> 'pending' then
    raise exception 'evidencia nasceu revisada: %', v_evidence.status;
  end if;
  if v_evidence.file_name <> 'protocolo-da-vigilancia.pdf' then
    raise exception 'nome nao foi sanitizado no envio: %', v_evidence.file_name;
  end if;
  if v_evidence.storage_bucket <> 'client-action-evidence' then
    raise exception 'evidencia foi parar em bucket alheio: %', v_evidence.storage_bucket;
  end if;
  if v_evidence.storage_path <> (
    v_evidence.tenant_id || '/' || v_evidence.client_id || '/' || v_item
      || '/70000000-0000-4000-8000-000000000001-protocolo-da-vigilancia.pdf'
  ) then
    raise exception 'caminho do Storage nao foi gerado no servidor: %', v_evidence.storage_path;
  end if;

  -- O ponto do card: upload não resolve pendência.
  if (select status from public.client_action_items where id = v_item) <> 'published' then
    raise exception 'o upload resolveu o item sozinho';
  end if;

  v_portal := public.test_portal_item('item-alvara');
  if v_portal ->> 'evidence_status' <> 'pending' or (v_portal ->> 'evidence_count')::int <> 1 then
    raise exception 'o cliente nao acompanha o estado da evidencia: %', v_portal;
  end if;
  if (v_portal ->> 'accepts_evidence')::boolean is not true then
    raise exception 'item aberto deixou de aceitar evidencia: %', v_portal;
  end if;
  -- A projeção do cliente nunca carrega caminho de Storage.
  if v_portal::text ~* 'storage_path|client-action-evidence|signed' then
    raise exception 'o plano de acao vazou o caminho do arquivo: %', v_portal;
  end if;

  -- Auditoria: registra o que aconteceu, sem conteudo e sem URL.
  if not exists (
    select 1 from public.client_portal_audit_events
    where event_type = 'evidence_submitted'
      and (payload ->> 'evidence_id')::uuid = v_evidence.id
  ) then
    raise exception 'envio de evidencia nao foi auditado';
  end if;
  if exists (
    select 1 from public.client_portal_audit_events
    where event_type = 'evidence_submitted' and payload::text ~* 'storage|token|http'
  ) then
    raise exception 'a auditoria gravou caminho ou URL do arquivo';
  end if;
end;
$$;

-- ─── Retry não duplica ────────────────────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_first jsonb;
  v_retry jsonb;
begin
  select jsonb_build_object('id', id, 'path', storage_path) into v_first
  from public.client_action_evidence
  where action_item_id = v_item and upload_key = '70000000-0000-4000-8000-000000000001';

  -- Mesma chave, ate com nome diferente (o usuario clicou duas vezes e a rede repetiu).
  v_retry := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003',
    v_item,
    '70000000-0000-4000-8000-000000000001',
    'outro-nome.pdf',
    'application/pdf',
    204800
  );

  if (v_retry ->> 'duplicate')::boolean is not true then
    raise exception 'retry nao foi reconhecido como repeticao: %', v_retry;
  end if;
  if v_retry ->> 'evidence_id' <> (v_first ->> 'id') or v_retry ->> 'storage_path' <> (v_first ->> 'path') then
    raise exception 'retry apontou para outra linha ou outro objeto: % / %', v_retry, v_first;
  end if;
  if (select count(*) from public.client_action_evidence where action_item_id = v_item) <> 1 then
    raise exception 'retry duplicou a evidencia';
  end if;
end;
$$;

-- ─── MIME, tamanho e arquivo vazio ────────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_before bigint;
  v_result jsonb;
begin
  select count(*) into v_before from public.client_action_evidence;

  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '70000000-0000-4000-8000-000000000002', 'macro.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024
  );
  if v_result ->> 'error' is distinct from 'tipo de arquivo nao aceito' then
    raise exception 'MIME fora da lista foi aceito: %', v_result;
  end if;

  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '70000000-0000-4000-8000-000000000003', 'vazio.pdf', 'application/pdf', 0
  );
  if v_result ->> 'error' is distinct from 'arquivo vazio' then
    raise exception 'arquivo vazio foi aceito: %', v_result;
  end if;

  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '70000000-0000-4000-8000-000000000004', 'enorme.pdf', 'application/pdf', 10485761
  );
  if v_result ->> 'error' is distinct from 'arquivo acima do limite de 10 MB' then
    raise exception 'arquivo acima do limite foi aceito: %', v_result;
  end if;

  -- No limite exato passa (e sai do caminho para nao poluir os testes seguintes).
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '70000000-0000-4000-8000-000000000005', 'no-limite.pdf', 'application/pdf', 10485760
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'arquivo exatamente no limite foi recusado: %', v_result;
  end if;
  delete from public.client_action_evidence where id = (v_result ->> 'evidence_id')::uuid;

  if (select count(*) from public.client_action_evidence) <> v_before then
    raise exception 'envio recusado gravou linha mesmo assim';
  end if;
end;
$$;

-- ─── Item de outro cliente, de outro tenant e token inválido ──────────────────
do $$
declare
  v_result jsonb;
  v_before bigint;
begin
  select count(*) into v_before from public.client_action_evidence;

  -- Unidade do mesmo tenant, mas fora do acesso da conta.
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003',
    public.test_item_id('item-outra-unidade'),
    '70000000-0000-4000-8000-000000000010', 'prova.pdf', 'application/pdf', 1024
  );
  if v_result ->> 'error' is distinct from 'item fora do acesso' then
    raise exception 'evidencia foi aceita em item de unidade nao vinculada: %', v_result;
  end if;

  -- Conta da outra consultoria mirando item do primeiro tenant: nem existencia ela confirma.
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000023',
    public.test_item_id('item-alvara'),
    '70000000-0000-4000-8000-000000000011', 'prova.pdf', 'application/pdf', 1024
  );
  if v_result ->> 'error' is distinct from 'item invalido' then
    raise exception 'tenant vizinho enviou evidencia (ou descobriu que o item existe): %', v_result;
  end if;

  v_result := public.client_portal_submit_evidence(
    '99999999-9999-4999-8999-999999999999',
    public.test_item_id('item-alvara'),
    '70000000-0000-4000-8000-000000000012', 'prova.pdf', 'application/pdf', 1024
  );
  if v_result ->> 'error' is distinct from 'acesso invalido' then
    raise exception 'token invalido enviou evidencia: %', v_result;
  end if;

  if (select count(*) from public.client_action_evidence) <> v_before then
    raise exception 'envio negado gravou evidencia mesmo assim';
  end if;
end;
$$;

-- ─── Item oculto, resolvido e relatório oculto não recebem evidência ──────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_result jsonb;
begin
  -- Relatorio oculto: o item existe, mas o cliente nao o enxerga.
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003',
    (select id from public.client_action_items where source_item_id = 'item-oculto'),
    '70000000-0000-4000-8000-000000000020', 'prova.pdf', 'application/pdf', 1024
  );
  if v_result ->> 'error' is distinct from 'item nao esta aberto para evidencia' then
    raise exception 'item de relatorio oculto recebeu evidencia: %', v_result;
  end if;

  -- Item resolvido nao recebe arquivo novo.
  perform public.admin_set_client_action_item_status(v_item, 'resolved');
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '70000000-0000-4000-8000-000000000021', 'prova.pdf', 'application/pdf', 1024
  );
  if v_result ->> 'error' is distinct from 'item nao esta aberto para evidencia' then
    raise exception 'item resolvido recebeu evidencia: %', v_result;
  end if;
  if (public.test_portal_item('item-alvara') ->> 'accepts_evidence')::boolean is not false then
    raise exception 'item resolvido continuou anunciando que aceita evidencia';
  end if;

  -- Item oculto pela consultora tambem nao.
  perform public.admin_set_client_action_item_status(v_item, 'hidden');
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '70000000-0000-4000-8000-000000000022', 'prova.pdf', 'application/pdf', 1024
  );
  if v_result ->> 'error' is distinct from 'item nao esta aberto para evidencia' then
    raise exception 'item oculto recebeu evidencia: %', v_result;
  end if;

  perform public.admin_set_client_action_item_status(v_item, 'published');
end;
$$;

-- ─── Trava do portal fecha o envio junto com a leitura ────────────────────────
do $$
declare
  v_result jsonb;
begin
  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'hidden');

  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003',
    public.test_item_id('item-alvara'),
    '70000000-0000-4000-8000-000000000030', 'prova.pdf', 'application/pdf', 1024
  );
  if v_result ->> 'error' is distinct from 'plano de acao indisponivel' then
    raise exception 'plano de acao fechado continuou recebendo arquivo: %', v_result;
  end if;

  v_result := public.client_portal_list_evidence('20000000-0000-4000-8000-000000000003');
  if jsonb_array_length(v_result -> 'evidence') <> 0 then
    raise exception 'plano de acao fechado continuou listando evidencia: %', v_result;
  end if;

  perform public.admin_set_portal_feature('20000000-0000-4000-8000-000000000002', 'action_plan', 'released');
end;
$$;

-- ─── Teto de arquivos por pendência ───────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-pia');
  v_result jsonb;
  i integer;
begin
  for i in 1..10 loop
    v_result := public.client_portal_submit_evidence(
      '20000000-0000-4000-8000-000000000003', v_item,
      ('71000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      'prova-' || i || '.jpg', 'image/jpeg', 2048
    );
    if v_result ->> 'ok' is distinct from 'true' then
      raise exception 'envio % dentro do teto foi recusado: %', i, v_result;
    end if;
  end loop;

  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '71000000-0000-4000-8000-000000000099', 'prova-11.jpg', 'image/jpeg', 2048
  );
  if v_result ->> 'error' is distinct from 'limite de 10 arquivos por pendencia atingido' then
    raise exception 'teto de arquivos por pendencia nao segurou: %', v_result;
  end if;

  delete from public.client_action_evidence where action_item_id = v_item;
end;
$$;

-- ─── Descarte quando a subida falha ───────────────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-pia');
  v_registered jsonb;
  v_result jsonb;
begin
  v_registered := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '72000000-0000-4000-8000-000000000001', 'subida-falhou.pdf', 'application/pdf', 4096
  );

  v_result := public.client_portal_discard_evidence(
    '20000000-0000-4000-8000-000000000003', (v_registered ->> 'evidence_id')::uuid
  );
  if (v_result ->> 'ok')::boolean is not true then
    raise exception 'descarte da evidencia orfa falhou: %', v_result;
  end if;
  if exists (select 1 from public.client_action_evidence where id = (v_registered ->> 'evidence_id')::uuid) then
    raise exception 'a linha orfa continuou apos o descarte';
  end if;

  -- Conta alheia nao descarta evidencia dos outros.
  v_registered := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '72000000-0000-4000-8000-000000000002', 'minha.pdf', 'application/pdf', 4096
  );
  v_result := public.client_portal_discard_evidence(
    '20000000-0000-4000-8000-000000000023', (v_registered ->> 'evidence_id')::uuid
  );
  if (v_result ->> 'ok')::boolean is not false then
    raise exception 'conta de outra consultoria apagou evidencia alheia: %', v_result;
  end if;

  delete from public.client_action_evidence where id = (v_registered ->> 'evidence_id')::uuid;
end;
$$;

-- ─── Aprovar, devolver, reenviar e reabrir ───────────────────────────────────
do $$
declare
  v_item uuid := public.test_item_id('item-alvara');
  v_evidence uuid;
  v_result jsonb;
  v_portal jsonb;
  v_reviewed_at timestamptz;
begin
  select id into v_evidence from public.client_action_evidence where action_item_id = v_item;

  -- Devolver sem orientacao e recusado: "ajuste isso" sem dizer o que devolve o cliente a zero.
  v_result := public.admin_review_client_action_evidence(v_evidence, 'changes_requested', '   ');
  if v_result ->> 'error' is distinct from 'informe a orientacao para o cliente' then
    raise exception 'devolucao sem orientacao foi aceita: %', v_result;
  end if;

  v_result := public.admin_review_client_action_evidence(v_evidence, 'arquivado', 'nota');
  if v_result ->> 'error' is distinct from 'situacao invalida' then
    raise exception 'situacao fora da lista foi aceita: %', v_result;
  end if;

  -- Devolver com orientacao.
  v_result := public.admin_review_client_action_evidence(
    v_evidence, 'changes_requested', 'O protocolo esta ilegivel. Reenvie o PDF original.',
    false, 'Ester'
  );
  if v_result ->> 'ok' is distinct from 'true' or (v_result ->> 'item_resolved')::boolean then
    raise exception 'devolucao falhou ou resolveu o item: %', v_result;
  end if;

  v_portal := public.test_portal_item('item-alvara');
  if v_portal ->> 'evidence_status' <> 'changes_requested'
     or v_portal ->> 'evidence_review_note' <> 'O protocolo esta ilegivel. Reenvie o PDF original.' then
    raise exception 'o cliente nao recebeu o estado e o comentario da consultora: %', v_portal;
  end if;
  if (select status from public.client_action_items where id = v_item) <> 'published' then
    raise exception 'devolver a evidencia mexeu no item';
  end if;

  -- Reenviar: arquivo novo, estado volta a pendente, e o anterior continua no historico.
  v_result := public.client_portal_submit_evidence(
    '20000000-0000-4000-8000-000000000003', v_item,
    '73000000-0000-4000-8000-000000000001', 'protocolo-legivel.pdf', 'application/pdf', 307200
  );
  if v_result ->> 'ok' is distinct from 'true' then
    raise exception 'reenvio depois da devolucao foi recusado: %', v_result;
  end if;

  v_portal := public.test_portal_item('item-alvara');
  if v_portal ->> 'evidence_status' <> 'pending' or (v_portal ->> 'evidence_count')::int <> 2 then
    raise exception 'o reenvio nao virou o estado do item: %', v_portal;
  end if;

  -- Aprovar SEM resolver: a prova serve, a pendencia segue aberta ate a consultora decidir.
  v_evidence := (v_result ->> 'evidence_id')::uuid;
  v_result := public.admin_review_client_action_evidence(v_evidence, 'approved', 'Documento aceito.', false, 'Ester');
  if (v_result ->> 'item_resolved')::boolean then
    raise exception 'aprovar a evidencia resolveu a pendencia sozinho: %', v_result;
  end if;
  if (select status from public.client_action_items where id = v_item) <> 'published' then
    raise exception 'o item se resolveu com a aprovacao do arquivo';
  end if;
  v_reviewed_at := (v_result ->> 'reviewed_at')::timestamptz;

  -- Aprovar E resolver, em ação explícita.
  v_result := public.admin_review_client_action_evidence(v_evidence, 'approved', 'Documento aceito.', true, 'Ester');
  if (v_result ->> 'item_resolved')::boolean is not true then
    raise exception 'a acao explicita de resolver nao resolveu: %', v_result;
  end if;
  if (select status from public.client_action_items where id = v_item) <> 'resolved' then
    raise exception 'o item nao foi resolvido pela acao explicita';
  end if;

  -- Revisao nova gera carimbo novo, e e ele que dedupe a notificacao do cliente.
  if (v_result ->> 'reviewed_at')::timestamptz = v_reviewed_at then
    raise exception 'a segunda revisao reaproveitou o carimbo da primeira';
  end if;

  -- Reabrir a pendencia mantem o historico de evidencia.
  perform public.admin_set_client_action_item_status(v_item, 'published');
  if (select count(*) from public.client_action_evidence where action_item_id = v_item) <> 2 then
    raise exception 'reabrir o item perdeu o historico de evidencia';
  end if;

  if not exists (
    select 1 from public.client_portal_audit_events
    where event_type = 'evidence_reviewed' and (payload ->> 'item_resolved')::boolean
  ) then
    raise exception 'a revisao que resolveu o item nao foi auditada';
  end if;
end;
$$;

-- ─── Tenant cruzado na revisão ────────────────────────────────────────────────
do $$
declare
  v_evidence uuid;
  v_result jsonb;
begin
  select id into v_evidence from public.client_action_evidence limit 1;

  -- is_tenant_staff do fixture so reconhece o tenant "aaaa..."; forca a evidencia para o outro.
  update public.client_action_evidence set tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  where id = v_evidence;

  v_result := public.admin_review_client_action_evidence(v_evidence, 'approved');
  if v_result ->> 'error' is distinct from 'sem permissao' then
    raise exception 'staff de um tenant revisou evidencia do tenant vizinho: %', v_result;
  end if;

  update public.client_action_evidence set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  where id = v_evidence;

  v_result := public.admin_review_client_action_evidence(
    '99999999-9999-4999-8999-999999999999', 'approved'
  );
  if v_result ->> 'error' is distinct from 'evidencia invalida' then
    raise exception 'revisao de evidencia inexistente nao foi tratada: %', v_result;
  end if;
end;
$$;

-- ─── A listagem do cliente é do cliente ───────────────────────────────────────
do $$
declare
  v_mine jsonb;
  v_theirs jsonb;
begin
  v_mine := public.client_portal_list_evidence('20000000-0000-4000-8000-000000000003');
  if jsonb_array_length(v_mine -> 'evidence') <> 2 then
    raise exception 'a conta nao enxergou as proprias evidencias: %', v_mine;
  end if;

  -- A Edge Function precisa do caminho para assinar; ele so existe nesta RPC.
  if v_mine -> 'evidence' -> 0 ->> 'storage_path' is null then
    raise exception 'a RPC da Edge Function parou de devolver o caminho do objeto';
  end if;

  v_theirs := public.client_portal_list_evidence('20000000-0000-4000-8000-000000000023');
  if jsonb_array_length(v_theirs -> 'evidence') <> 0 then
    raise exception 'conta de outra consultoria listou evidencia alheia: %', v_theirs;
  end if;

  if public.client_portal_list_evidence('99999999-9999-4999-8999-999999999999') ->> 'error'
     is distinct from 'acesso invalido' then
    raise exception 'token invalido listou evidencia';
  end if;
end;
$$;

-- ─── Idempotência da notificação ──────────────────────────────────────────────
do $$
declare
  v_evidence uuid;
  v_inserted integer;
begin
  select id into v_evidence from public.client_action_evidence order by submitted_at limit 1;

  insert into public.client_action_evidence_notifications (evidence_id, event_type, dedupe_key)
  values (v_evidence, 'submitted', 'submitted')
  on conflict do nothing;

  insert into public.client_action_evidence_notifications (evidence_id, event_type, dedupe_key)
  values (v_evidence, 'submitted', 'submitted')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted <> 0 then
    raise exception 'o retry da notificacao de envio passou pelo cadeado';
  end if;

  -- Revisao nova (carimbo diferente) e notificacao logicamente nova.
  insert into public.client_action_evidence_notifications (evidence_id, event_type, dedupe_key)
  values (v_evidence, 'reviewed', '2026-08-07T10:00:00Z');
  insert into public.client_action_evidence_notifications (evidence_id, event_type, dedupe_key)
  values (v_evidence, 'reviewed', '2026-08-07T18:30:00Z');

  if (select count(*) from public.client_action_evidence_notifications where evidence_id = v_evidence) <> 3 then
    raise exception 'a chave de dedupe da revisao nao separou as duas revisoes';
  end if;
end;
$$;

select 'Client action evidence (P360-011) tests passed' as result;
