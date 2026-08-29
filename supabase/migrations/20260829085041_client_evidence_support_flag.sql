-- PORT-06 — Cliente de vistoria: plano de ação sem envio de evidência.
--
-- O caso: parte dos contratos é só vistoria. A consultora entrega o relatório e o plano de
-- ação, mas não acompanha a correção depois — ninguém do lado dela vai revisar arquivo. Hoje
-- o portal oferece o upload para todo mundo, e o cliente de vistoria manda a prova para uma
-- caixa que nunca é aberta. Pior que não ter o botão é ter um botão que não leva a nada.
--
-- **Só o ARQUIVO é vedado.** Declarar a situação ("já corrigi", "estou providenciando", "ainda
-- não fiz") e marcar os tópicos da ação continuam liberados: são autodeclaração, não geram
-- trabalho de revisão e são a única forma de o cliente de vistoria registrar o andamento. Por
-- isso entra um campo NOVO por item — `accepts_file_evidence` — em vez de reaproveitar
-- `accepts_evidence`, que segue governando status e tópicos, sem mudança de comportamento.
--
-- Não confundir com a Central de acesso do portal (PORT-01): lá a consultora tranca uma função
-- temporariamente, por atraso ou decisão do momento, e destranca depois. Aqui é o que o
-- contrato estruturalmente inclui — fica no cadastro do cliente, junto de auditoria e
-- acompanhamento online.

alter table public.clients
  add column if not exists has_evidence_support boolean not null default true;

comment on column public.clients.has_evidence_support is
  'Contrato inclui revisão de evidência de correção pela consultoria (PORT-06). Falso = cliente '
  'de vistoria: o plano de ação aparece inteiro e ele ainda declara situação e marca tópicos, '
  'mas o envio de arquivo some do portal e é recusado no servidor.';

-- ─── A trava mora onde os dois caminhos passam ────────────────────────────────
--
-- `client_portal_submit_evidence` (conta) e `public_report_submit_evidence` (link do relatório)
-- chamam esta função. Checar aqui vale para os dois de uma vez, sem duas cópias da mesma regra
-- para divergir depois. Corpo idêntico ao do PORT-02, com a checagem nova no topo.

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
  -- Antes de tudo: se o contrato da unidade não inclui revisão de evidência, nada é gravado.
  -- Vem primeiro de propósito — não faz sentido cobrar assinatura de um envio que não entra.
  if not coalesce(
    (select c.has_evidence_support from public.clients c where c.id = p_item.client_id),
    true
  ) then
    return jsonb_build_object('error', 'sem_suporte_evidencia');
  end if;

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

-- ─── As duas leituras dizem, por item, se o arquivo é aceito ──────────────────
--
-- Corpo do PORT-05 com um campo a mais. `accepts_evidence` fica como está: é ele que libera
-- declarar situação e marcar tópicos, e isso o cliente de vistoria continua podendo fazer.

create or replace function public.public_report_action_items(p_visit_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visit public.appointment_requests%rowtype;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_evidence_support boolean;
  v_items jsonb;
begin
  select * into v_visit
  from public.appointment_requests
  where public_token = p_visit_token;

  if not found or v_visit.client_id is null then
    return jsonb_build_object('error', 'link invalido');
  end if;

  if coalesce(v_visit.report_hidden, false) then
    return jsonb_build_object('error', 'relatorio indisponivel');
  end if;

  -- O link é de UMA visita, logo de uma unidade só: resolve uma vez e vale para todos os itens.
  select coalesce(c.has_evidence_support, true) into v_evidence_support
  from public.clients c
  where c.id = v_visit.client_id;

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
        'client_status', cai.client_status,
        'client_status_note', cai.client_status_note,
        'client_status_at', cai.client_status_at,
        'client_status_by_name', cai.client_status_by_name,
        'client_status_by_role', cai.client_status_by_role,
        'checkpoints', coalesce(cps.list, '[]'::jsonb),
        'accepts_evidence', cai.status = 'published',
        'accepts_file_evidence', cai.status = 'published' and coalesce(v_evidence_support, true)
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
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'text', cp.text,
        'ordinal', cp.ordinal,
        'done', cp.done_at is not null,
        'done_at', cp.done_at,
        'done_by_name', cp.done_by_name
      )
      order by cp.ordinal, cp.text
    ) as list
    from public.client_action_checkpoints cp
    where cp.action_item_id = cai.id
      and cp.dropped_at is null
  ) cps on true
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
        'client_status', cai.client_status,
        'client_status_note', cai.client_status_note,
        'client_status_at', cai.client_status_at,
        'client_status_by_name', cai.client_status_by_name,
        'client_status_by_role', cai.client_status_by_role,
        'checkpoints', coalesce(cps.list, '[]'::jsonb),
        'accepts_evidence', cai.status = 'published',
        'accepts_file_evidence', cai.status = 'published' and coalesce(c.has_evidence_support, true)
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
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'text', cp.text,
        'ordinal', cp.ordinal,
        'done', cp.done_at is not null,
        'done_at', cp.done_at,
        'done_by_name', cp.done_by_name
      )
      order by cp.ordinal, cp.text
    ) as list
    from public.client_action_checkpoints cp
    where cp.action_item_id = cai.id
      and cp.dropped_at is null
  ) cps on true
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
