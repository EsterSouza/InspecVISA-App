-- P360-011 — Evidências do cliente e revisão técnica.
--
-- O P360-010 deixou o cliente VER a pendência. Aqui ele responde: manda a prova de que
-- corrigiu, e a consultora aprova ou devolve com orientação.
--
-- Três decisões estruturais, todas com consequência sanitária:
--
-- 1. **Upload nunca resolve nada.** A evidência entra como `pending` e o item continua aberto.
--    Resolver é ação explícita da consultora — no fluxo de revisão, com uma escolha própria
--    (`p_resolve_item`), separada de aprovar o arquivo. Pendência sanitária fecha com laudo
--    técnico, não com anexo recebido.
-- 2. **O cliente nunca escolhe onde o arquivo cai.** Nome e caminho são gerados aqui dentro:
--    a extensão vem do MIME aceito (não do nome enviado), o nome é transliterado e reduzido a
--    `[a-z0-9._-]`, e o caminho é `<tenant>/<unidade>/<item>/<chave>-<nome>`. Não existe
--    caminho vindo do navegador, então não existe `../` nem extensão dupla.
-- 3. **Bucket próprio e privado.** `client-action-evidence` não é o `client-portal-files`: ali
--    mora o que a consultoria PUBLICA, aqui o que o cliente ENVIA. Misturar os dois faria a
--    policy `client_portal_published_assets_select_anon` — que libera para anon todo objeto
--    registrado em `appointment_attachments` — passar perto de arquivo de cliente. Nenhum
--    papel do navegador escreve neste bucket: quem grava é a Edge Function, com service role.
--
-- Idempotência: a identidade do envio é `(item, upload_key)`, com a chave gerada pelo
-- navegador uma vez por arquivo escolhido. Retry (rede caiu, usuário clicou duas vezes)
-- reencontra a mesma linha e sobrescreve o MESMO objeto no Storage — nunca duplica.

-- ─── Bucket privado ───────────────────────────────────────────────────────────
--
-- `storage` não existe no Postgres puro dos testes; a suíte SQL exercita as regras de
-- autorização, e o bucket é conferido em produção depois de aplicar.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'schema storage ausente (fixture de teste); bucket e policies nao criados';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'client-action-evidence',
    'client-action-evidence',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

  -- Leitura para o staff do tenant dono do primeiro segmento do caminho: é assim que a
  -- consultora assina a URL temporária do arquivo pelo app. Sem policy de insert/update para
  -- `authenticated` — a origem legítima do arquivo é o cliente, pela Edge Function. E sem
  -- policy nenhuma para `anon`: o cliente recebe URL assinada pela Edge Function, nunca
  -- privilégio direto no objeto.
  --
  -- Criar policy em `storage.objects` depende de o dono da migration mandar naquela tabela, o
  -- que varia com a versão do Storage. Se não der, o bucket continua privado (falha para o
  -- lado seguro) e só a assinatura pelo app deixa de funcionar — por isso avisa alto em vez
  -- de derrubar a migration inteira.
  begin
    execute $ddl$
      drop policy if exists "client_action_evidence_select_staff" on storage.objects;
      create policy "client_action_evidence_select_staff"
        on storage.objects for select to authenticated
        using (
          bucket_id = 'client-action-evidence'
          and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
          and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
        );

      drop policy if exists "client_action_evidence_delete_staff" on storage.objects;
      create policy "client_action_evidence_delete_staff"
        on storage.objects for delete to authenticated
        using (
          bucket_id = 'client-action-evidence'
          and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
          and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
        );
    $ddl$;
  exception
    when insufficient_privilege then
      raise warning 'ATENCAO: policies de storage.objects nao criadas (sem privilegio). '
        'Criar pelo painel do Supabase, senao a consultora nao consegue assinar a URL da evidencia.';
  end;
end;
$$;

-- ─── Evidência ────────────────────────────────────────────────────────────────

create table if not exists public.client_action_evidence (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  client_id      uuid not null references public.clients(id) on delete cascade,
  action_item_id uuid not null references public.client_action_items(id) on delete cascade,
  -- Conta do portal que enviou. `set null` porque apagar o acesso do cliente não pode apagar
  -- a prova técnica que ele já entregou.
  account_id     uuid references public.client_portal_accounts(id) on delete set null,
  upload_key     uuid not null,
  storage_bucket text not null default 'client-action-evidence',
  storage_path   text not null,
  file_name      text not null,
  mime_type      text not null,
  file_size      bigint not null,
  client_note    text,
  status         text not null default 'pending',
  review_note    text,
  reviewed_at    timestamptz,
  reviewed_by    text,
  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint client_action_evidence_status_check
    check (status in ('pending', 'approved', 'changes_requested')),
  constraint client_action_evidence_mime_check
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint client_action_evidence_size_check
    check (file_size > 0 and file_size <= 10485760),
  -- Devolver exige orientação: "ajuste isso" sem dizer o quê devolve o cliente para o zero.
  constraint client_action_evidence_changes_need_note
    check (status <> 'changes_requested' or nullif(btrim(coalesce(review_note, '')), '') is not null),
  unique (action_item_id, upload_key)
);

create index if not exists client_action_evidence_item_idx
  on public.client_action_evidence (action_item_id, submitted_at desc);

create index if not exists client_action_evidence_tenant_status_idx
  on public.client_action_evidence (tenant_id, status, submitted_at desc);

alter table public.client_action_evidence enable row level security;

-- Tabela nova no `public` nasce com ALL para anon/authenticated (default privileges do
-- Supabase); o revoke tem de ser explícito. Ver PROD-01.
revoke all on table public.client_action_evidence from public;
revoke all on table public.client_action_evidence from anon;
revoke all on table public.client_action_evidence from authenticated;
grant select on table public.client_action_evidence to authenticated;

drop policy if exists "staff reads action evidence" on public.client_action_evidence;
create policy "staff reads action evidence"
  on public.client_action_evidence for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Sem policy para anon: o cliente enxerga a própria evidência apenas pelas RPCs abaixo, que
-- validam o token da conta, e pela Edge Function que assina a URL temporária.

-- ─── Idempotência das notificações ────────────────────────────────────────────
--
-- Mesmo desenho de `appointment_notification_log` (P360-008): a linha é o cadeado. Quem
-- conseguiu inserir manda o e-mail; o retry encontra conflito e não manda de novo.
-- `dedupe_key` da revisão é o carimbo de `reviewed_at`, então uma revisão NOVA (devolver
-- depois de aprovar, por exemplo) notifica de novo, e o mesmo retry não.

create table if not exists public.client_action_evidence_notifications (
  evidence_id uuid not null references public.client_action_evidence(id) on delete cascade,
  event_type  text not null,
  dedupe_key  text not null,
  email_sent  boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (evidence_id, event_type, dedupe_key),
  constraint client_action_evidence_notifications_event_check
    check (event_type in ('submitted', 'reviewed'))
);

alter table public.client_action_evidence_notifications enable row level security;

revoke all on table public.client_action_evidence_notifications from public;
revoke all on table public.client_action_evidence_notifications from anon;
revoke all on table public.client_action_evidence_notifications from authenticated;
grant select on table public.client_action_evidence_notifications to authenticated;

drop policy if exists "staff reads evidence notifications" on public.client_action_evidence_notifications;
create policy "staff reads evidence notifications"
  on public.client_action_evidence_notifications for select to authenticated
  using (
    exists (
      select 1
      from public.client_action_evidence e
      where e.id = client_action_evidence_notifications.evidence_id
        and e.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(e.tenant_id)
    )
  );

-- ─── Nome de arquivo seguro ───────────────────────────────────────────────────
--
-- A extensão vem do MIME aceito, nunca do nome enviado: `laudo.pdf.exe` vira `laudo-pdf.pdf`,
-- e `../../etc/passwd` vira `passwd.pdf`. O nome original não é guardado — não acrescenta
-- nada técnico e é texto livre vindo de fora.

create or replace function private.safe_evidence_file_name(p_file_name text, p_mime_type text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select coalesce(nullif(base, ''), 'evidencia') || ext
  from (
    select
      left(
        btrim(
          regexp_replace(
            regexp_replace(
              lower(translate(
                -- só o nome do arquivo: qualquer coisa antes de / ou \ é caminho, e cai fora
                regexp_replace(
                  regexp_replace(coalesce(p_file_name, ''), '^.*[/\\]', ''),
                  '\.[A-Za-z0-9]{1,8}$', ''
                ),
                'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
              )),
              '[^a-z0-9._-]+', '-', 'g'
            ),
            '-{2,}', '-', 'g'
          ),
          '-._'
        ),
        60
      ) as base,
      case p_mime_type
        when 'application/pdf' then '.pdf'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'image/webp' then '.webp'
        else '.bin'
      end as ext
  ) parts;
$function$;

revoke all on function private.safe_evidence_file_name(text, text) from public;
revoke all on function private.safe_evidence_file_name(text, text) from anon;
revoke all on function private.safe_evidence_file_name(text, text) from authenticated;

-- ─── Registro do envio (chamado pela Edge Function, com service role) ─────────
--
-- Toda a autorização mora aqui, não no TypeScript: token da conta, trava do plano de ação,
-- vínculo do item com a unidade da conta, relatório oculto, situação do item, MIME, tamanho
-- e teto de arquivos por item. A Edge Function cuida só do byte.
--
-- Ordem deliberada: registra PRIMEIRO, sobe depois. O caminho é determinístico a partir da
-- `upload_key`, então o retry reencontra a linha e sobrescreve o mesmo objeto. Se a subida
-- falhar, a Edge Function apaga a linha que acabou de criar.

create or replace function public.client_portal_submit_evidence(
  p_token uuid,
  p_action_item_id uuid,
  p_upload_key uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_note text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_item public.client_action_items%rowtype;
  v_report_hidden boolean;
  v_existing public.client_action_evidence%rowtype;
  v_safe_name text;
  v_path text;
  v_id uuid;
begin
  if p_upload_key is null then
    return jsonb_build_object('error', 'envio invalido');
  end if;

  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  if not coalesce(
    (private.portal_account_gates(v_account.id) -> 'features' ->> 'action_plan')::boolean,
    true
  ) then
    return jsonb_build_object('error', 'plano de acao indisponivel');
  end if;

  select * into v_item
  from public.client_action_items
  where id = p_action_item_id
    and tenant_id = v_account.tenant_id;

  -- Item de outro tenant e item inexistente respondem igual: o cliente não descobre pelo
  -- erro que o id existe em outra consultoria.
  if not found then
    return jsonb_build_object('error', 'item invalido');
  end if;

  if not exists (
    select 1
    from public.client_portal_account_clients ac
    join public.clients c
      on c.id = ac.client_id
     and c.tenant_id = v_account.tenant_id
     and c.deleted_at is null
    where ac.account_id = v_account.id
      and ac.client_id = v_item.client_id
  ) then
    return jsonb_build_object('error', 'item fora do acesso');
  end if;

  -- O item só existe para o cliente enquanto a visita de origem estiver visível; enviar
  -- evidência para um item que ele não enxerga seria estado fantasma.
  select coalesce(ar.report_hidden, false) into v_report_hidden
  from public.appointment_requests ar
  where ar.id = v_item.appointment_request_id;

  if v_item.status <> 'published' or coalesce(v_report_hidden, false) then
    return jsonb_build_object('error', 'item nao esta aberto para evidencia');
  end if;

  if coalesce(p_mime_type, '') not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
    return jsonb_build_object('error', 'tipo de arquivo nao aceito');
  end if;

  if coalesce(p_file_size, 0) <= 0 then
    return jsonb_build_object('error', 'arquivo vazio');
  end if;

  if p_file_size > 10485760 then
    return jsonb_build_object('error', 'arquivo acima do limite de 10 MB');
  end if;

  -- Reenvio (retry ou clique duplo) devolve a linha que já existe, com o mesmo caminho.
  select * into v_existing
  from public.client_action_evidence
  where action_item_id = p_action_item_id
    and upload_key = p_upload_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'evidence_id', v_existing.id,
      'storage_bucket', v_existing.storage_bucket,
      'storage_path', v_existing.storage_path,
      'status', v_existing.status,
      'item_title', v_item.title,
      'account_name', v_account.name
    );
  end if;

  if (
    select count(*) from public.client_action_evidence where action_item_id = p_action_item_id
  ) >= 10 then
    return jsonb_build_object('error', 'limite de 10 arquivos por pendencia atingido');
  end if;

  v_safe_name := private.safe_evidence_file_name(p_file_name, p_mime_type);
  v_path := v_item.tenant_id || '/' || v_item.client_id || '/' || v_item.id || '/'
    || p_upload_key || '-' || v_safe_name;

  insert into public.client_action_evidence (
    tenant_id, client_id, action_item_id, account_id, upload_key,
    storage_path, file_name, mime_type, file_size, client_note
  ) values (
    v_item.tenant_id, v_item.client_id, v_item.id, v_account.id, p_upload_key,
    v_path, v_safe_name, p_mime_type, p_file_size, nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_id;

  -- Auditoria sem conteúdo e sem URL: o que aconteceu, em qual item, de que tipo e tamanho.
  insert into public.client_portal_audit_events (
    tenant_id, account_id, client_id, appointment_request_id, event_type, payload, user_agent
  ) values (
    v_item.tenant_id,
    v_account.id,
    v_item.client_id,
    v_item.appointment_request_id,
    'evidence_submitted',
    jsonb_build_object(
      'action_item_id', v_item.id,
      'evidence_id', v_id,
      'mime_type', p_mime_type,
      'file_size', p_file_size
    ),
    left(nullif(p_user_agent, ''), 500)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'evidence_id', v_id,
    'storage_bucket', 'client-action-evidence',
    'storage_path', v_path,
    'status', 'pending',
    'file_name', v_safe_name,
    -- Para o aviso à equipe, que sai da Edge Function e não pode ir buscar isso sozinha.
    'item_title', v_item.title,
    'unit_name', (select c.name from public.clients c where c.id = v_item.client_id),
    'account_name', v_account.name
  );
end;
$function$;

revoke all on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text) from public;
revoke all on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text) from anon;
revoke all on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text) from authenticated;
-- Só a Edge Function chama: quem registra a evidência precisa ter o arquivo na mão. Se o
-- navegador pudesse chamar direto, criaria linha apontando para objeto que nunca subiu.
grant execute on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text) to service_role;

-- Desfaz o registro quando a subida do arquivo falha (a Edge Function chama no catch).
-- Só apaga evidência ainda `pending` e nunca revisada — o que a consultora já leu, fica.
create or replace function public.client_portal_discard_evidence(
  p_token uuid,
  p_evidence_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_deleted integer;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  delete from public.client_action_evidence
  where id = p_evidence_id
    and account_id = v_account.id
    and tenant_id = v_account.tenant_id
    and status = 'pending'
    and reviewed_at is null;

  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok', v_deleted > 0);
end;
$function$;

revoke all on function public.client_portal_discard_evidence(uuid, uuid) from public;
revoke all on function public.client_portal_discard_evidence(uuid, uuid) from anon;
revoke all on function public.client_portal_discard_evidence(uuid, uuid) from authenticated;
grant execute on function public.client_portal_discard_evidence(uuid, uuid) to service_role;

-- ─── Leitura das evidências pelo cliente (Edge Function assina as URLs) ───────
--
-- Devolve `storage_path` porque quem chama é a Edge Function, que precisa dele para assinar.
-- Por isso não há grant para anon/authenticated: caminho de Storage não vai para o navegador.

create or replace function public.client_portal_list_evidence(
  p_token uuid,
  p_action_item_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_rows jsonb;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  if not coalesce(
    (private.portal_account_gates(v_account.id) -> 'features' ->> 'action_plan')::boolean,
    true
  ) then
    return jsonb_build_object('evidence', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'action_item_id', e.action_item_id,
        'file_name', e.file_name,
        'mime_type', e.mime_type,
        'file_size', e.file_size,
        'status', e.status,
        'client_note', e.client_note,
        'review_note', e.review_note,
        'submitted_at', e.submitted_at,
        'reviewed_at', e.reviewed_at,
        'storage_bucket', e.storage_bucket,
        'storage_path', e.storage_path
      )
      order by e.submitted_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.client_action_evidence e
  join public.client_action_items cai
    on cai.id = e.action_item_id
  join public.client_portal_account_clients ac
    on ac.client_id = e.client_id
   and ac.account_id = v_account.id
  left join public.appointment_requests ar
    on ar.id = cai.appointment_request_id
   and ar.tenant_id = v_account.tenant_id
  where e.tenant_id = v_account.tenant_id
    and (p_action_item_id is null or e.action_item_id = p_action_item_id)
    -- Mesma regra de visibilidade do item: o que o cliente não vê, ele também não baixa.
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object('evidence', v_rows);
end;
$function$;

revoke all on function public.client_portal_list_evidence(uuid, uuid) from public;
revoke all on function public.client_portal_list_evidence(uuid, uuid) from anon;
revoke all on function public.client_portal_list_evidence(uuid, uuid) from authenticated;
grant execute on function public.client_portal_list_evidence(uuid, uuid) to service_role;

-- ─── Revisão técnica (staff) ──────────────────────────────────────────────────
--
-- `p_resolve_item` é o ponto do card: aprovar o arquivo e resolver a pendência são duas
-- decisões, e a segunda é sempre explícita. Aprovar sem resolver é caso real — a prova serve,
-- mas a correção ainda vai ser conferida na próxima visita.

create or replace function public.admin_review_client_action_evidence(
  p_evidence_id uuid,
  p_status text,
  p_note text default null,
  p_resolve_item boolean default false,
  p_reviewed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_evidence public.client_action_evidence%rowtype;
  v_item public.client_action_items%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_resolved boolean := false;
  v_reviewed_at timestamptz;
begin
  if v_status not in ('approved', 'changes_requested') then
    return jsonb_build_object('error', 'situacao invalida');
  end if;

  if v_status = 'changes_requested' and v_note is null then
    return jsonb_build_object('error', 'informe a orientacao para o cliente');
  end if;

  select * into v_evidence
  from public.client_action_evidence
  where id = p_evidence_id;

  if not found then
    return jsonb_build_object('error', 'evidencia invalida');
  end if;

  if not private.is_tenant_staff(v_evidence.tenant_id) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  select * into v_item
  from public.client_action_items
  where id = v_evidence.action_item_id;

  -- `clock_timestamp()`, não `now()`: este carimbo é a chave de dedupe da notificação ao
  -- cliente. Duas revisões seguidas precisam de chaves diferentes mesmo se caírem na mesma
  -- transação, senão a segunda decisão nunca sai do servidor.
  v_reviewed_at := clock_timestamp();

  update public.client_action_evidence
  set status = v_status,
      review_note = v_note,
      reviewed_at = v_reviewed_at,
      reviewed_by = nullif(btrim(coalesce(p_reviewed_by, '')), ''),
      updated_at = now()
  where id = p_evidence_id;

  if v_status = 'approved' and coalesce(p_resolve_item, false) and v_item.status <> 'resolved' then
    update public.client_action_items
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
    where id = v_item.id;
    v_resolved := true;
  end if;

  insert into public.client_portal_audit_events (
    tenant_id, account_id, client_id, appointment_request_id, event_type, payload
  ) values (
    v_evidence.tenant_id,
    v_evidence.account_id,
    v_evidence.client_id,
    v_item.appointment_request_id,
    'evidence_reviewed',
    jsonb_build_object(
      'action_item_id', v_evidence.action_item_id,
      'evidence_id', v_evidence.id,
      'status', v_status,
      'item_resolved', v_resolved
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'item_resolved', v_resolved,
    'reviewed_at', v_reviewed_at
  );
end;
$function$;

revoke all on function public.admin_review_client_action_evidence(uuid, text, text, boolean, text) from public;
revoke all on function public.admin_review_client_action_evidence(uuid, text, text, boolean, text) from anon;
grant execute on function public.admin_review_client_action_evidence(uuid, text, text, boolean, text) to authenticated;

-- ─── O plano de ação do cliente passa a carregar o estado da evidência ────────
--
-- Mesmo corpo da versão do PORT-01, com um resumo por item: quantos arquivos, em que pé está
-- o mais recente e qual foi a orientação da consultora. Nenhum caminho de Storage e nenhuma
-- URL — só o que a tela precisa para dizer ao cliente onde ele está.

create or replace function public.client_portal_action_items(
  p_token uuid,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_today date;
  v_items jsonb;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  if not coalesce(
    (private.portal_account_gates(v_account.id) -> 'features' ->> 'action_plan')::boolean,
    true
  ) then
    return jsonb_build_object('items', '[]'::jsonb);
  end if;

  if p_client_id is not null and not exists (
    select 1
    from public.client_portal_account_clients ac
    join public.clients c
      on c.id = ac.client_id
     and c.tenant_id = v_account.tenant_id
     and c.deleted_at is null
    where ac.account_id = v_account.id
      and ac.client_id = p_client_id
  ) then
    return jsonb_build_object('error', 'unidade fora do acesso');
  end if;

  -- Prazo vencido é sempre "hoje no Brasil": o servidor roda em UTC e, entre 21h e 24h BRT,
  -- comparar com a data UTC marcaria como vencido um item que ainda vence hoje.
  v_today := (now() at time zone 'America/Sao_Paulo')::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cai.id,
        'client_id', cai.client_id,
        'unit_name', c.name,
        'title', cai.title,
        'situation', cai.situation,
        'recommended_action', cai.recommended_action,
        'priority', cai.priority,
        'responsible', cai.responsible,
        'due_date', cai.due_date,
        'status', cai.status,
        'is_overdue', cai.status = 'published' and cai.due_date is not null and cai.due_date < v_today,
        'occurrence_count', cai.occurrence_count,
        'first_detected_on', cai.first_detected_on,
        'last_detected_on', cai.last_detected_on,
        'resolved_at', cai.resolved_at,
        'visit_token', ar.public_token,
        -- P360-011: onde está a prova de correção deste item.
        'evidence_count', coalesce(ev.total, 0),
        'evidence_status', ev.status,
        'evidence_file_name', ev.file_name,
        'evidence_submitted_at', ev.submitted_at,
        'evidence_reviewed_at', ev.reviewed_at,
        'evidence_review_note', ev.review_note,
        -- Item resolvido ou oculto não recebe arquivo; a tela esconde o botão em vez de
        -- deixar o cliente descobrir pelo erro.
        'accepts_evidence', cai.status = 'published'
      )
      order by
        (cai.status = 'resolved'),
        (cai.due_date is null),
        cai.due_date,
        case cai.priority when 'urgent' then 1 when 'important' then 2 else 3 end,
        cai.title
    ),
    '[]'::jsonb
  )
  into v_items
  from public.client_action_items cai
  join public.client_portal_account_clients ac
    on ac.client_id = cai.client_id
   and ac.account_id = v_account.id
  join public.clients c
    on c.id = cai.client_id
   and c.tenant_id = v_account.tenant_id
   and c.deleted_at is null
  left join public.appointment_requests ar
    on ar.id = cai.appointment_request_id
   and ar.tenant_id = v_account.tenant_id
  left join lateral (
    select
      (select count(*) from public.client_action_evidence x where x.action_item_id = cai.id) as total,
      e.status, e.file_name, e.submitted_at, e.reviewed_at, e.review_note
    from public.client_action_evidence e
    where e.action_item_id = cai.id
    order by e.submitted_at desc
    limit 1
  ) ev on true
  where cai.tenant_id = v_account.tenant_id
    and (p_client_id is null or cai.client_id = p_client_id)
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object('items', v_items);
end;
$function$;

revoke all on function public.client_portal_action_items(uuid, uuid) from public;
grant execute on function public.client_portal_action_items(uuid, uuid) to anon;
grant execute on function public.client_portal_action_items(uuid, uuid) to authenticated;
