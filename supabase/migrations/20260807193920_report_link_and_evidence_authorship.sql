-- PORT-02 — Link do relatório por unidade, e autoria de quem envia a evidência.
--
-- O caso que motivou: a Rede Sênior é uma rede de franquias com 13 casas atrás de UMA conta de
-- portal. Quem acompanha a correção em cada casa é o gestor dela — não o dono do contrato. Hoje
-- não há como dar acesso ao gestor sem entregar o login do dono, que abre as 13.
--
-- **Decisão da Ester, registrada:** o link do relatório passa a abrir **sem senha**. Ela conhece
-- o público e prefere a facilidade; o conteúdo é o relatório sanitário da própria unidade, sem
-- dado pessoal sensível. A contrapartida que ela pediu, e que está implementada aqui, é que
-- **todo envio de evidência exige nome e função de quem está inserindo** — é essa assinatura
-- que substitui a identificação do login e sustenta o relatório depois.
--
-- O que o link NÃO afrouxa:
--   * `report_hidden` continua valendo: relatório oculto some, link ou não link;
--   * o link é o `public_token` da visita, que já existe e já é imprevisível (uuid v4);
--   * o arquivo continua no bucket privado, só por URL temporária;
--   * o link **não** dá acesso a outras unidades — o plano de ação sai filtrado pela unidade
--     daquela visita, e o envio só é aceito para item da mesma unidade.
--
-- Autoria vale nos DOIS caminhos, não só no link: a conta do portal é da empresa, não da pessoa,
-- então saber que "a conta Rede Sênior enviou" nunca respondeu quem foi. Agora responde.

-- ─── Autoria e origem ─────────────────────────────────────────────────────────

alter table public.client_action_evidence
  add column if not exists submitted_by_name text,
  add column if not exists submitted_by_role text,
  add column if not exists source text not null default 'portal_account';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_action_evidence_source_check'
  ) then
    alter table public.client_action_evidence
      add constraint client_action_evidence_source_check
      check (source in ('portal_account', 'report_link'));
  end if;

  -- NOT NULL direto: a tabela nasceu hoje (P360-011) e está vazia em produção. Se um dia houver
  -- linha sem autoria, esta migration falha alto em vez de deixar evidência anônima passar.
  if not exists (
    select 1 from pg_constraint where conname = 'client_action_evidence_authorship_check'
  ) then
    alter table public.client_action_evidence
      add constraint client_action_evidence_authorship_check
      check (
        nullif(btrim(coalesce(submitted_by_name, '')), '') is not null
        and nullif(btrim(coalesce(submitted_by_role, '')), '') is not null
      );
  end if;
end;
$$;

comment on column public.client_action_evidence.submitted_by_name is
  'Nome de quem inseriu a evidência. Obrigatório: pelo link do relatório não há login, e mesmo '
  'pela conta do portal a conta é da empresa, não da pessoa (PORT-02).';
comment on column public.client_action_evidence.submitted_by_role is
  'Função de quem inseriu (gestor da unidade, responsável técnico, etc). Obrigatório (PORT-02).';
comment on column public.client_action_evidence.source is
  'Por onde entrou: `portal_account` (login da conta) ou `report_link` (link aberto do relatório).';

-- ─── Registro da evidência: uma regra só, dois caminhos ───────────────────────
--
-- Antes, a validação inteira morava em `client_portal_submit_evidence`. Com o link do relatório
-- surge um segundo caminho, e duas cópias da mesma regra divergem — é questão de tempo. O miolo
-- passa a viver aqui, e as duas RPCs públicas só resolvem QUEM está pedindo antes de chamar.

create or replace function private.register_action_evidence(
  p_item public.client_action_items,
  p_account_id uuid,
  p_source text,
  p_upload_key uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_by_name text,
  p_by_role text,
  p_note text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.client_action_evidence%rowtype;
  v_name text := nullif(btrim(coalesce(p_by_name, '')), '');
  v_role text := nullif(btrim(coalesce(p_by_role, '')), '');
  v_safe_name text;
  v_path text;
  v_id uuid;
begin
  if p_upload_key is null then
    return jsonb_build_object('error', 'envio invalido');
  end if;

  -- A assinatura é o que sustenta o relatório depois. Sem ela, não entra.
  if v_name is null or v_role is null then
    return jsonb_build_object('error', 'informe seu nome e sua funcao');
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
  where action_item_id = p_item.id
    and upload_key = p_upload_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'evidence_id', v_existing.id,
      'storage_bucket', v_existing.storage_bucket,
      'storage_path', v_existing.storage_path,
      'status', v_existing.status,
      'item_title', p_item.title,
      'unit_name', (select c.name from public.clients c where c.id = p_item.client_id)
    );
  end if;

  if (
    select count(*) from public.client_action_evidence where action_item_id = p_item.id
  ) >= 10 then
    return jsonb_build_object('error', 'limite de 10 arquivos por pendencia atingido');
  end if;

  v_safe_name := private.safe_evidence_file_name(p_file_name, p_mime_type);
  v_path := p_item.tenant_id || '/' || p_item.client_id || '/' || p_item.id || '/'
    || p_upload_key || '-' || v_safe_name;

  insert into public.client_action_evidence (
    tenant_id, client_id, action_item_id, account_id, upload_key,
    storage_path, file_name, mime_type, file_size, client_note,
    submitted_by_name, submitted_by_role, source
  ) values (
    p_item.tenant_id, p_item.client_id, p_item.id, p_account_id, p_upload_key,
    v_path, v_safe_name, p_mime_type, p_file_size, nullif(btrim(coalesce(p_note, '')), ''),
    left(v_name, 120), left(v_role, 120), p_source
  )
  returning id into v_id;

  -- Auditoria sem conteúdo e sem URL. Pelo link não há conta, e é a assinatura que responde
  -- "quem foi" — por isso ela entra no payload.
  insert into public.client_portal_audit_events (
    tenant_id, account_id, client_id, appointment_request_id, event_type, payload, user_agent
  ) values (
    p_item.tenant_id,
    p_account_id,
    p_item.client_id,
    p_item.appointment_request_id,
    'evidence_submitted',
    jsonb_build_object(
      'action_item_id', p_item.id,
      'evidence_id', v_id,
      'mime_type', p_mime_type,
      'file_size', p_file_size,
      'source', p_source,
      'by_name', left(v_name, 120),
      'by_role', left(v_role, 120)
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
    'item_title', p_item.title,
    'unit_name', (select c.name from public.clients c where c.id = p_item.client_id)
  );
end;
$function$;

revoke all on function private.register_action_evidence(public.client_action_items, uuid, text, uuid, text, text, bigint, text, text, text, text) from public;
revoke all on function private.register_action_evidence(public.client_action_items, uuid, text, uuid, text, text, bigint, text, text, text, text) from anon;
revoke all on function private.register_action_evidence(public.client_action_items, uuid, text, uuid, text, text, bigint, text, text, text, text) from authenticated;

-- ─── Envio pela conta do portal: mesma RPC, agora exigindo a assinatura ───────
--
-- A assinatura antiga sai de cena. Deixar as duas conviveria com uma sobrecarga que aceita
-- evidência anônima — exatamente o que o card fecha.

drop function if exists public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text);

create or replace function public.client_portal_submit_evidence(
  p_token uuid,
  p_action_item_id uuid,
  p_upload_key uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_by_name text,
  p_by_role text,
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
  v_result jsonb;
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
    return jsonb_build_object('error', 'plano de acao indisponivel');
  end if;

  select * into v_item
  from public.client_action_items
  where id = p_action_item_id
    and tenant_id = v_account.tenant_id;

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

  select coalesce(ar.report_hidden, false) into v_report_hidden
  from public.appointment_requests ar
  where ar.id = v_item.appointment_request_id;

  if v_item.status <> 'published' or coalesce(v_report_hidden, false) then
    return jsonb_build_object('error', 'item nao esta aberto para evidencia');
  end if;

  v_result := private.register_action_evidence(
    v_item, v_account.id, 'portal_account', p_upload_key,
    p_file_name, p_mime_type, p_file_size, p_by_name, p_by_role, p_note, p_user_agent
  );

  return v_result || jsonb_build_object('account_name', v_account.name);
end;
$function$;

revoke all on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) from public;
revoke all on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) from anon;
revoke all on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) from authenticated;
grant execute on function public.client_portal_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) to service_role;

-- ─── O relatório aberto pelo link ─────────────────────────────────────────────
--
-- Entrada: só o `public_token` da visita. Devolve o plano de ação da UNIDADE daquela visita —
-- não só os itens publicados por ela — porque a pendência é da casa e o gestor precisa ver o
-- que está aberto, não um recorte por data. Cada item continua sujeito ao `report_hidden` da
-- visita que o publicou, igual à leitura pela conta.

create or replace function public.public_report_action_items(p_visit_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_items jsonb;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null then
    return jsonb_build_object('error', 'link invalido');
  end if;

  -- Relatório oculto fecha o link junto. Ocultar no painel continua sendo o botão de pânico.
  if coalesce(v_visit.report_hidden, false) then
    return jsonb_build_object('error', 'relatorio indisponivel');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cai.id,
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
        'resolved_at', cai.resolved_at,
        'evidence_count', coalesce(ev.total, 0),
        'evidence_status', ev.status,
        'evidence_file_name', ev.file_name,
        'evidence_submitted_at', ev.submitted_at,
        'evidence_reviewed_at', ev.reviewed_at,
        'evidence_review_note', ev.review_note,
        'evidence_by_name', ev.submitted_by_name,
        'evidence_by_role', ev.submitted_by_role,
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
  left join public.appointment_requests ar
    on ar.id = cai.appointment_request_id
   and ar.tenant_id = cai.tenant_id
  left join lateral (
    select
      (select count(*) from public.client_action_evidence x where x.action_item_id = cai.id) as total,
      e.status, e.file_name, e.submitted_at, e.reviewed_at, e.review_note,
      e.submitted_by_name, e.submitted_by_role
    from public.client_action_evidence e
    where e.action_item_id = cai.id
    order by e.submitted_at desc
    limit 1
  ) ev on true
  where cai.tenant_id = v_visit.tenant_id
    and cai.client_id = v_visit.client_id
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object(
    'unit_name', (select c.name from public.clients c where c.id = v_visit.client_id),
    'visit_date', v_visit.requested_date,
    'items', v_items
  );
end;
$function$;

revoke all on function public.public_report_action_items(uuid) from public;
-- Cliente Supabase único: com sessão de staff no navegador a mesma RPC chega como
-- `authenticated`. Os dois papéis precisam do grant.
grant execute on function public.public_report_action_items(uuid) to anon;
grant execute on function public.public_report_action_items(uuid) to authenticated;

-- Envio pelo link. Sem conta, então `account_id` fica nulo e quem responde por isso é a
-- assinatura — nome e função, obrigatórios.
create or replace function public.public_report_submit_evidence(
  p_visit_token uuid,
  p_action_item_id uuid,
  p_upload_key uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_by_name text,
  p_by_role text,
  p_note text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_item public.client_action_items%rowtype;
  v_item_hidden boolean;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null or coalesce(v_visit.report_hidden, false) then
    return jsonb_build_object('error', 'link invalido');
  end if;

  select * into v_item
  from public.client_action_items
  where id = p_action_item_id
    and tenant_id = v_visit.tenant_id
    -- O link é da unidade daquela visita, e só dela: um token não abre a casa vizinha.
    and client_id = v_visit.client_id;

  if not found then
    return jsonb_build_object('error', 'item invalido');
  end if;

  select coalesce(ar.report_hidden, false) into v_item_hidden
  from public.appointment_requests ar
  where ar.id = v_item.appointment_request_id;

  if v_item.status <> 'published' or coalesce(v_item_hidden, false) then
    return jsonb_build_object('error', 'item nao esta aberto para evidencia');
  end if;

  return private.register_action_evidence(
    v_item, null, 'report_link', p_upload_key,
    p_file_name, p_mime_type, p_file_size, p_by_name, p_by_role, p_note, p_user_agent
  );
end;
$function$;

revoke all on function public.public_report_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) from public;
revoke all on function public.public_report_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) from anon;
revoke all on function public.public_report_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) from authenticated;
grant execute on function public.public_report_submit_evidence(uuid, uuid, uuid, text, text, bigint, text, text, text, text) to service_role;

-- Leitura das evidências pelo link, para a Edge Function assinar as URLs.
create or replace function public.public_report_list_evidence(
  p_visit_token uuid,
  p_action_item_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_rows jsonb;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null or coalesce(v_visit.report_hidden, false) then
    return jsonb_build_object('error', 'link invalido');
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
        'submitted_by_name', e.submitted_by_name,
        'submitted_by_role', e.submitted_by_role,
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
  left join public.appointment_requests ar
    on ar.id = cai.appointment_request_id
   and ar.tenant_id = cai.tenant_id
  where e.tenant_id = v_visit.tenant_id
    and e.client_id = v_visit.client_id
    and (p_action_item_id is null or e.action_item_id = p_action_item_id)
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object('evidence', v_rows);
end;
$function$;

revoke all on function public.public_report_list_evidence(uuid, uuid) from public;
revoke all on function public.public_report_list_evidence(uuid, uuid) from anon;
revoke all on function public.public_report_list_evidence(uuid, uuid) from authenticated;
grant execute on function public.public_report_list_evidence(uuid, uuid) to service_role;

-- Descarte pelo link, quando a subida do arquivo falha.
create or replace function public.public_report_discard_evidence(
  p_visit_token uuid,
  p_evidence_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_deleted integer;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null then
    return jsonb_build_object('error', 'link invalido');
  end if;

  delete from public.client_action_evidence
  where id = p_evidence_id
    and tenant_id = v_visit.tenant_id
    and client_id = v_visit.client_id
    and source = 'report_link'
    and status = 'pending'
    and reviewed_at is null;

  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok', v_deleted > 0);
end;
$function$;

revoke all on function public.public_report_discard_evidence(uuid, uuid) from public;
revoke all on function public.public_report_discard_evidence(uuid, uuid) from anon;
revoke all on function public.public_report_discard_evidence(uuid, uuid) from authenticated;
grant execute on function public.public_report_discard_evidence(uuid, uuid) to service_role;

-- ─── A leitura pela conta também mostra quem assinou ──────────────────────────
--
-- Só acrescenta `evidence_by_name`/`evidence_by_role` ao item; o resto é a versão do P360-011.

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
        'evidence_count', coalesce(ev.total, 0),
        'evidence_status', ev.status,
        'evidence_file_name', ev.file_name,
        'evidence_submitted_at', ev.submitted_at,
        'evidence_reviewed_at', ev.reviewed_at,
        'evidence_review_note', ev.review_note,
        'evidence_by_name', ev.submitted_by_name,
        'evidence_by_role', ev.submitted_by_role,
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
      e.status, e.file_name, e.submitted_at, e.reviewed_at, e.review_note,
      e.submitted_by_name, e.submitted_by_role
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
