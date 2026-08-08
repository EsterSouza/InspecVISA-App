-- P360-012 — Solicitações estruturadas de consultoria.
--
-- O cliente já vê o que a consultoria apontou (P360-010) e já responde com evidência
-- (P360-011). O que faltava era o caminho inverso: ele **pede** alguma coisa. Hoje isso chega
-- por WhatsApp, se perde no meio da conversa e não tem número, data nem estado.
--
-- Três decisões estruturais:
--
-- 1. **Isto não é chat.** Não existe mensagem livre nos dois sentidos. O cliente abre uma
--    demanda com assunto e descrição, e só volta a escrever quando a solicitação está
--    explicitamente `awaiting_client` — quer dizer, quando a consultoria perguntou algo. Fora
--    disso o campo de resposta nem existe. Sem isso, "solicitação" vira caixa de entrada e
--    cria a expectativa de resposta instantânea que o card proíbe.
-- 2. **Prazo não se promete sozinho.** `sla_days` sai da configuração do tenant, é congelado
--    na linha no momento da abertura e nasce NULO quando a Ester não configurou nada. Sem
--    regra administrativa, o portal não fala em prazo — não escreve "em breve", não estima.
-- 3. **Quem espera quem é derivado, nunca digitado.** `waiting_on` vem do status. Não há como
--    a consultora marcar "aguardando cliente" e esquecer de mudar o status, nem o contrário.
--
-- Idempotência da abertura: a identidade da submissão é `(tenant_id, submission_key)`, com a
-- chave gerada pelo navegador uma vez por formulário preenchido. Clique duplo, retry de rede e
-- reenvio do mesmo formulário caem na mesma linha. Além disso há uma segunda trava, por
-- conteúdo: mesmo assunto, mesma unidade, ainda aberta, nos últimos 10 minutos — para o caso
-- de o cliente recarregar a página e digitar tudo de novo achando que não foi.

-- ─── SLA configurável (por categoria), no tenant ──────────────────────────────
--
-- jsonb e não coluna por categoria: a lista de categorias muda com o tempo, e um `alter table`
-- por categoria nova seria migration para cada ajuste comercial. `{}` = nada prometido.

alter table public.client_portal_settings
  add column if not exists service_request_sla jsonb not null default '{}'::jsonb;

comment on column public.client_portal_settings.service_request_sla is
  'Prazo INFORMATIVO de primeiro retorno, em dias corridos, por categoria de solicitação: '
  '{"documentacao": 3, "default": 5}. Ausente/vazio = o portal não fala em prazo.';

-- ─── Anexo: bucket privado próprio ────────────────────────────────────────────
--
-- Bucket separado do `client-action-evidence` de propósito. Ali mora prova de correção de
-- pendência sanitária, que a consultora revisa e que entra no relatório; aqui mora anexo de
-- pedido administrativo. Misturar os dois faria uma policy futura de um vazar para o outro.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'schema storage ausente (fixture de teste); bucket e policies nao criados';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'client-service-request-files',
    'client-service-request-files',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

  -- Só leitura e remoção pelo staff do tenant dono do primeiro segmento do caminho. Nenhum
  -- papel do navegador escreve: quem grava é a Edge Function, com service role. Mesmo motivo
  -- e mesma tolerância a falta de privilégio do P360-011.
  begin
    execute $ddl$
      drop policy if exists "client_service_request_files_select_staff" on storage.objects;
      create policy "client_service_request_files_select_staff"
        on storage.objects for select to authenticated
        using (
          bucket_id = 'client-service-request-files'
          and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
          and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
        );

      drop policy if exists "client_service_request_files_delete_staff" on storage.objects;
      create policy "client_service_request_files_delete_staff"
        on storage.objects for delete to authenticated
        using (
          bucket_id = 'client-service-request-files'
          and ((storage.foldername(name))[1])::uuid in (select private.my_tenant_ids())
          and private.is_tenant_staff(((storage.foldername(name))[1])::uuid)
        );
    $ddl$;
  exception
    when insufficient_privilege then
      raise warning 'ATENCAO: policies de storage.objects nao criadas (sem privilegio). '
        'Criar pelo painel do Supabase, senao a consultora nao consegue abrir o anexo da solicitacao.';
  end;
end;
$$;

-- ─── A solicitação ────────────────────────────────────────────────────────────

create table if not exists public.client_service_requests (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  -- Unidade a que a demanda se refere. Obrigatória: "minha empresa" não diz onde fica o
  -- problema, e a consultora atende unidade por unidade.
  client_id           uuid not null references public.clients(id) on delete cascade,
  -- Conta que abriu. `set null` porque apagar o acesso não pode apagar a demanda registrada.
  account_id          uuid references public.client_portal_accounts(id) on delete set null,
  -- Número que o cliente enxerga e cita ("solicitação 14"). Sequencial por tenant.
  request_number      integer not null,
  category            text not null,
  subject             text not null,
  description         text not null,
  status              text not null default 'open',
  priority            text not null default 'normal',
  -- Nome da consultora responsável. Atribuição por nome, nunca por user_id — ver seção 3 do
  -- handoff.
  assigned_to         text,
  -- Identidade da submissão: uma por formulário preenchido no navegador.
  submission_key      uuid not null,
  opened_by_name      text,
  opened_by_role      text,
  -- SLA congelado na abertura. Mudar a configuração depois não reescreve o que já foi dito.
  sla_days            integer,
  sla_hint_date       date,
  attachment_bucket   text,
  attachment_path     text,
  attachment_name     text,
  attachment_mime     text,
  attachment_size     bigint,
  -- "Última atualização" que o cliente vê. Não é `updated_at`: uma correção de digitação da
  -- consultora não deve parecer movimento no atendimento.
  last_event_at       timestamptz not null default now(),
  awaiting_client_since timestamptz,
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint client_service_requests_category_check
    check (category in (
      'documentacao', 'licenciamento', 'notificacao_visa', 'obra_reforma',
      'treinamento', 'produto_equipamento', 'boas_praticas', 'outro'
    )),
  constraint client_service_requests_status_check
    check (status in ('open', 'in_progress', 'awaiting_client', 'resolved', 'cancelled')),
  constraint client_service_requests_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint client_service_requests_subject_check
    check (length(btrim(subject)) between 3 and 160),
  constraint client_service_requests_description_check
    check (length(btrim(description)) between 10 and 4000),
  -- Anexo é tudo ou nada: caminho sem nome, ou nome sem tamanho, viraria card quebrado na tela.
  constraint client_service_requests_attachment_complete
    check (
      attachment_path is null
      or (attachment_bucket is not null and attachment_name is not null
          and attachment_mime is not null and attachment_size is not null)
    ),
  unique (tenant_id, request_number),
  unique (tenant_id, submission_key)
);

create index if not exists client_service_requests_client_idx
  on public.client_service_requests (client_id, status, created_at desc);

create index if not exists client_service_requests_tenant_idx
  on public.client_service_requests (tenant_id, status, last_event_at desc);

create index if not exists client_service_requests_account_idx
  on public.client_service_requests (account_id, created_at desc);

alter table public.client_service_requests enable row level security;

-- Tabela nova no `public` nasce com ALL para anon/authenticated (default privileges do
-- Supabase); o revoke tem de ser explícito. Ver PROD-01.
revoke all on table public.client_service_requests from public;
revoke all on table public.client_service_requests from anon;
revoke all on table public.client_service_requests from authenticated;
grant select on table public.client_service_requests to authenticated;

drop policy if exists "staff reads service requests" on public.client_service_requests;
create policy "staff reads service requests"
  on public.client_service_requests for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Sem policy para anon: o cliente lê as próprias solicitações só por
-- public.client_portal_service_requests, que valida o token da conta.

-- ─── Histórico ────────────────────────────────────────────────────────────────
--
-- Append-only por desenho: não há RPC de update nem de delete, e o staff só tem `select`.
-- O que aconteceu no atendimento não se reescreve.

create table if not exists public.client_service_request_events (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.client_service_requests(id) on delete cascade,
  tenant_id         uuid not null,
  event_type        text not null,
  from_status       text,
  to_status         text,
  note              text,
  actor_kind        text not null,
  actor_name        text,
  actor_role        text,
  -- Nota interna da equipe não vai para o portal. O default é `false` de propósito: o
  -- descuido tem de ser no sentido de guardar demais, nunca de vazar.
  visible_to_client boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint client_service_request_events_type_check
    check (event_type in (
      'created', 'status_changed', 'priority_changed', 'assigned',
      'note', 'client_reply', 'attachment_added'
    )),
  constraint client_service_request_events_actor_check
    check (actor_kind in ('client', 'staff', 'system'))
);

create index if not exists client_service_request_events_request_idx
  on public.client_service_request_events (request_id, created_at);

alter table public.client_service_request_events enable row level security;

revoke all on table public.client_service_request_events from public;
revoke all on table public.client_service_request_events from anon;
revoke all on table public.client_service_request_events from authenticated;
grant select on table public.client_service_request_events to authenticated;

drop policy if exists "staff reads service request events" on public.client_service_request_events;
create policy "staff reads service request events"
  on public.client_service_request_events for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- ─── Aviso por e-mail: mesmo cadeado do P360-008/011 ──────────────────────────
--
-- A linha é o cadeado: quem conseguiu inserir manda o e-mail, o retry encontra conflito e não
-- manda de novo. `dedupe_key` da mudança para "aguardando cliente" é o carimbo de
-- `awaiting_client_since`, então uma NOVA pergunta à casa notifica de novo, e o mesmo retry não.

create table if not exists public.client_service_request_notifications (
  request_id uuid not null references public.client_service_requests(id) on delete cascade,
  event_type text not null,
  dedupe_key text not null,
  email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (request_id, event_type, dedupe_key),
  constraint client_service_request_notifications_event_check
    check (event_type in ('created', 'awaiting_client', 'resolved'))
);

alter table public.client_service_request_notifications enable row level security;

revoke all on table public.client_service_request_notifications from public;
revoke all on table public.client_service_request_notifications from anon;
revoke all on table public.client_service_request_notifications from authenticated;
grant select on table public.client_service_request_notifications to authenticated;

drop policy if exists "staff reads service request notifications" on public.client_service_request_notifications;
create policy "staff reads service request notifications"
  on public.client_service_request_notifications for select to authenticated
  using (
    exists (
      select 1
      from public.client_service_requests r
      where r.id = client_service_request_notifications.request_id
        and r.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(r.tenant_id)
    )
  );

-- ─── Quem está esperando quem ─────────────────────────────────────────────────
--
-- Derivado do status, nunca digitado. É o critério de aceite do card ("a consultora distingue
-- claramente o que aguarda cliente do que aguarda equipe") e a única fonte da distinção, no
-- portal e no painel interno.

create or replace function private.service_request_waiting_on(p_status text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case p_status
    when 'awaiting_client' then 'client'
    when 'open' then 'team'
    when 'in_progress' then 'team'
    else 'none'
  end;
$function$;

revoke all on function private.service_request_waiting_on(text) from public;
revoke all on function private.service_request_waiting_on(text) from anon;
revoke all on function private.service_request_waiting_on(text) from authenticated;

-- ─── Abertura pela conta do portal ────────────────────────────────────────────

create or replace function public.client_portal_create_service_request(
  p_token uuid,
  p_client_id uuid,
  p_category text,
  p_subject text,
  p_description text,
  p_submission_key uuid,
  p_by_name text default null,
  p_by_role text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_enabled boolean;
  v_category text := lower(btrim(coalesce(p_category, '')));
  v_subject text := btrim(coalesce(p_subject, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_by_name text := nullif(btrim(coalesce(p_by_name, '')), '');
  v_by_role text := nullif(btrim(coalesce(p_by_role, '')), '');
  v_existing public.client_service_requests%rowtype;
  v_sla jsonb;
  v_sla_days integer;
  v_number integer;
  v_id uuid;
begin
  if p_submission_key is null then
    return jsonb_build_object('error', 'envio invalido');
  end if;

  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  select coalesce(service_requests_enabled, false) into v_enabled
  from public.client_portal_settings
  where tenant_id = v_account.tenant_id;

  if not coalesce(v_enabled, false) then
    return jsonb_build_object('error', 'solicitacoes indisponiveis');
  end if;

  -- Unidade fora do acesso e unidade inexistente respondem igual: o cliente não descobre pelo
  -- erro que o id existe em outra conta.
  if not exists (
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

  if v_category not in (
    'documentacao', 'licenciamento', 'notificacao_visa', 'obra_reforma',
    'treinamento', 'produto_equipamento', 'boas_praticas', 'outro'
  ) then
    return jsonb_build_object('error', 'categoria invalida');
  end if;

  if length(v_subject) < 3 or length(v_subject) > 160 then
    return jsonb_build_object('error', 'o assunto precisa ter de 3 a 160 caracteres');
  end if;

  if length(v_description) < 10 or length(v_description) > 4000 then
    return jsonb_build_object('error', 'descreva o pedido em pelo menos 10 caracteres (limite de 4000)');
  end if;

  -- Duplicidade 1: a MESMA submissão (clique duplo, retry de rede). Devolve a linha que já
  -- existe, com o mesmo número — nunca uma segunda solicitação.
  select * into v_existing
  from public.client_service_requests
  where tenant_id = v_account.tenant_id
    and submission_key = p_submission_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'request_id', v_existing.id,
      'request_number', v_existing.request_number,
      'status', v_existing.status,
      'sla_days', v_existing.sla_days,
      'sla_hint_date', v_existing.sla_hint_date
    );
  end if;

  -- Duplicidade 2: mesma unidade, mesmo assunto, ainda em aberto, nos últimos 10 minutos —
  -- o caso de recarregar a página e digitar tudo de novo achando que não foi.
  select * into v_existing
  from public.client_service_requests
  where tenant_id = v_account.tenant_id
    and client_id = p_client_id
    and lower(btrim(subject)) = lower(v_subject)
    and status in ('open', 'in_progress', 'awaiting_client')
    and created_at > now() - interval '10 minutes'
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'request_id', v_existing.id,
      'request_number', v_existing.request_number,
      'status', v_existing.status,
      'sla_days', v_existing.sla_days,
      'sla_hint_date', v_existing.sla_hint_date
    );
  end if;

  -- Rate limit por conta. Os dois tetos existem por motivos diferentes: o da hora contém
  -- script e teclado preso; o de abertas contém a fila que ninguém consegue atender.
  if (
    select count(*)
    from public.client_service_requests
    where account_id = v_account.id
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    return jsonb_build_object('error', 'muitas solicitacoes em pouco tempo; tente de novo em uma hora');
  end if;

  if (
    select count(*)
    from public.client_service_requests
    where account_id = v_account.id
      and status in ('open', 'in_progress', 'awaiting_client')
  ) >= 15 then
    return jsonb_build_object('error', 'limite de 15 solicitacoes em aberto atingido; aguarde o retorno das atuais');
  end if;

  -- SLA informativo: só existe se a consultoria configurou. Sem configuração, a linha nasce
  -- sem prazo e o portal não fala em prazo nenhum.
  select service_request_sla into v_sla
  from public.client_portal_settings
  where tenant_id = v_account.tenant_id;

  -- Só número entra. Configuração escrita como texto ("3") não vira prazo: melhor não
  -- prometer nada do que prometer errado.
  v_sla_days := case
    when jsonb_typeof(coalesce(v_sla -> v_category, v_sla -> 'default')) = 'number'
      then (coalesce(v_sla -> v_category, v_sla -> 'default'))::text::numeric::integer
  end;
  if v_sla_days is not null and (v_sla_days <= 0 or v_sla_days > 365) then
    v_sla_days := null;
  end if;

  -- Numeração sequencial por tenant. O lock de transação serializa duas aberturas
  -- simultâneas do mesmo tenant; sem ele, as duas leriam o mesmo max() e a segunda quebraria
  -- no índice único.
  perform pg_advisory_xact_lock(hashtext('client_service_requests:' || v_account.tenant_id::text));

  select coalesce(max(request_number), 0) + 1 into v_number
  from public.client_service_requests
  where tenant_id = v_account.tenant_id;

  insert into public.client_service_requests (
    tenant_id, client_id, account_id, request_number, category, subject, description,
    submission_key, opened_by_name, opened_by_role, sla_days, sla_hint_date
  ) values (
    v_account.tenant_id, p_client_id, v_account.id, v_number, v_category, v_subject, v_description,
    p_submission_key, v_by_name, v_by_role, v_sla_days,
    case
      when v_sla_days is not null
        then ((now() at time zone 'America/Sao_Paulo')::date + v_sla_days)
    end
  )
  returning id into v_id;

  insert into public.client_service_request_events (
    request_id, tenant_id, event_type, to_status, note, actor_kind, actor_name, actor_role,
    visible_to_client
  ) values (
    v_id, v_account.tenant_id, 'created', 'open', null, 'client', v_by_name, v_by_role, true
  );

  insert into public.client_portal_audit_events (
    tenant_id, account_id, client_id, event_type, payload, user_agent
  ) values (
    v_account.tenant_id,
    v_account.id,
    p_client_id,
    'service_request_created',
    jsonb_build_object('request_id', v_id, 'request_number', v_number, 'category', v_category),
    left(nullif(p_user_agent, ''), 500)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'request_id', v_id,
    'request_number', v_number,
    'status', 'open',
    'sla_days', v_sla_days,
    'sla_hint_date', case
      when v_sla_days is not null
        then ((now() at time zone 'America/Sao_Paulo')::date + v_sla_days)
    end,
    -- Para o aviso à equipe, que sai da Edge Function e não pode ir buscar isso sozinha.
    'unit_name', (select c.name from public.clients c where c.id = p_client_id),
    'account_name', v_account.name,
    'subject', v_subject
  );
end;
$function$;

revoke all on function public.client_portal_create_service_request(uuid, uuid, text, text, text, uuid, text, text, text) from public;
-- O app usa um cliente Supabase só: com sessão de staff no navegador, a RPC pública é chamada
-- como `authenticated`. Os dois papéis precisam do grant. Ver seção 3 do handoff.
grant execute on function public.client_portal_create_service_request(uuid, uuid, text, text, text, uuid, text, text, text) to anon;
grant execute on function public.client_portal_create_service_request(uuid, uuid, text, text, text, uuid, text, text, text) to authenticated;

-- ─── Leitura pela conta do portal ─────────────────────────────────────────────

create or replace function public.client_portal_service_requests(
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
  v_enabled boolean;
  v_rows jsonb;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  select coalesce(service_requests_enabled, false) into v_enabled
  from public.client_portal_settings
  where tenant_id = v_account.tenant_id;

  if not coalesce(v_enabled, false) then
    return jsonb_build_object('requests', '[]'::jsonb);
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'request_number', r.request_number,
        'client_id', r.client_id,
        'unit_name', c.name,
        'category', r.category,
        'subject', r.subject,
        'description', r.description,
        'status', r.status,
        'waiting_on', private.service_request_waiting_on(r.status),
        -- Responsável e prioridade são decisão interna. O cliente vê o NOME de quem atende
        -- (isso ele já sabe), mas não a prioridade — que é gestão de fila, não promessa.
        'assigned_to', r.assigned_to,
        'sla_days', r.sla_days,
        'sla_hint_date', r.sla_hint_date,
        'attachment_name', r.attachment_name,
        'opened_by_name', r.opened_by_name,
        'opened_by_role', r.opened_by_role,
        'created_at', r.created_at,
        'last_event_at', r.last_event_at,
        'closed_at', r.closed_at,
        -- Responder só quando a consultoria perguntou. É isto que impede a caixa de entrada.
        'accepts_reply', r.status = 'awaiting_client',
        'events', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'event_type', e.event_type,
              'to_status', e.to_status,
              'note', e.note,
              'actor_kind', e.actor_kind,
              'actor_name', e.actor_name,
              'created_at', e.created_at
            ) order by e.created_at
          )
          from public.client_service_request_events e
          where e.request_id = r.id
            and e.visible_to_client
        ), '[]'::jsonb)
      )
      order by
        -- Primeiro o que depende do cliente; depois o que está em curso; encerrado por último.
        case private.service_request_waiting_on(r.status)
          when 'client' then 1 when 'team' then 2 else 3
        end,
        r.last_event_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.client_service_requests r
  join public.client_portal_account_clients ac
    on ac.client_id = r.client_id
   and ac.account_id = v_account.id
  join public.clients c
    on c.id = r.client_id
   and c.tenant_id = v_account.tenant_id
   and c.deleted_at is null
  where r.tenant_id = v_account.tenant_id
    and (p_client_id is null or r.client_id = p_client_id);

  return jsonb_build_object('requests', v_rows);
end;
$function$;

revoke all on function public.client_portal_service_requests(uuid, uuid) from public;
grant execute on function public.client_portal_service_requests(uuid, uuid) to anon;
grant execute on function public.client_portal_service_requests(uuid, uuid) to authenticated;

-- ─── Resposta do cliente quando a consultoria perguntou ───────────────────────

create or replace function public.client_portal_reply_service_request(
  p_token uuid,
  p_request_id uuid,
  p_message text,
  p_by_name text default null,
  p_by_role text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_request public.client_service_requests%rowtype;
  v_message text := btrim(coalesce(p_message, ''));
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  select * into v_request
  from public.client_service_requests
  where id = p_request_id
    and tenant_id = v_account.tenant_id;

  if not found then
    return jsonb_build_object('error', 'solicitacao invalida');
  end if;

  if not exists (
    select 1
    from public.client_portal_account_clients ac
    where ac.account_id = v_account.id
      and ac.client_id = v_request.client_id
  ) then
    return jsonb_build_object('error', 'solicitacao fora do acesso');
  end if;

  -- A trava do card: sem pergunta aberta, não há campo de resposta. Isto não é chat.
  if v_request.status <> 'awaiting_client' then
    return jsonb_build_object('error', 'esta solicitacao nao esta aguardando resposta sua');
  end if;

  if length(v_message) < 2 or length(v_message) > 2000 then
    return jsonb_build_object('error', 'escreva sua resposta (limite de 2000 caracteres)');
  end if;

  insert into public.client_service_request_events (
    request_id, tenant_id, event_type, from_status, to_status, note,
    actor_kind, actor_name, actor_role, visible_to_client
  ) values (
    v_request.id, v_request.tenant_id, 'client_reply', 'awaiting_client', 'in_progress', v_message,
    'client', nullif(btrim(coalesce(p_by_name, '')), ''), nullif(btrim(coalesce(p_by_role, '')), ''), true
  );

  -- Responder devolve a bola para a equipe. Sem isso, a solicitação ficaria "aguardando
  -- cliente" para sempre e sumiria da fila de quem tem de agir.
  update public.client_service_requests
  set status = 'in_progress',
      awaiting_client_since = null,
      last_event_at = now(),
      updated_at = now()
  where id = v_request.id;

  insert into public.client_portal_audit_events (
    tenant_id, account_id, client_id, event_type, payload, user_agent
  ) values (
    v_request.tenant_id, v_account.id, v_request.client_id,
    'service_request_replied',
    jsonb_build_object('request_id', v_request.id, 'request_number', v_request.request_number),
    left(nullif(p_user_agent, ''), 500)
  );

  return jsonb_build_object('ok', true, 'status', 'in_progress');
end;
$function$;

revoke all on function public.client_portal_reply_service_request(uuid, uuid, text, text, text, text) from public;
grant execute on function public.client_portal_reply_service_request(uuid, uuid, text, text, text, text) to anon;
grant execute on function public.client_portal_reply_service_request(uuid, uuid, text, text, text, text) to authenticated;

-- ─── Anexo: registrar antes de subir (chamado pela Edge Function) ─────────────
--
-- Mesma ordem e mesmo motivo do P360-011: o caminho é determinístico a partir do id da
-- solicitação, o registro vem primeiro e a Edge Function limpa as colunas se a subida falhar.
-- Um anexo por solicitação — quem precisa mandar cinco arquivos manda um PDF ou responde
-- depois; caixa de arquivos é outro produto.

create or replace function public.client_portal_attach_service_request_file(
  p_token uuid,
  p_request_id uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_request public.client_service_requests%rowtype;
  v_safe_name text;
  v_path text;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  select * into v_request
  from public.client_service_requests
  where id = p_request_id
    and tenant_id = v_account.tenant_id;

  if not found then
    return jsonb_build_object('error', 'solicitacao invalida');
  end if;

  if v_request.account_id is distinct from v_account.id then
    return jsonb_build_object('error', 'solicitacao fora do acesso');
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

  -- Anexo entra junto com a abertura. Depois que a consultoria começou a atender, mandar
  -- arquivo é responder — passa pelo caminho da resposta, com o estado certo.
  if v_request.attachment_path is not null then
    return jsonb_build_object('error', 'esta solicitacao ja tem anexo');
  end if;

  -- O cliente nunca escolhe o caminho: a extensão vem do MIME aceito e o nome é transliterado
  -- e reduzido a [a-z0-9._-]. Reusa a função do P360-011 — a regra é a mesma.
  v_safe_name := private.safe_evidence_file_name(p_file_name, p_mime_type);
  v_path := v_request.tenant_id || '/' || v_request.client_id || '/' || v_request.id || '/' || v_safe_name;

  update public.client_service_requests
  set attachment_bucket = 'client-service-request-files',
      attachment_path = v_path,
      attachment_name = v_safe_name,
      attachment_mime = p_mime_type,
      attachment_size = p_file_size,
      updated_at = now()
  where id = v_request.id;

  insert into public.client_service_request_events (
    request_id, tenant_id, event_type, note, actor_kind, actor_name, visible_to_client
  ) values (
    v_request.id, v_request.tenant_id, 'attachment_added', v_safe_name,
    'client', v_request.opened_by_name, true
  );

  return jsonb_build_object(
    'ok', true,
    'storage_bucket', 'client-service-request-files',
    'storage_path', v_path,
    'file_name', v_safe_name
  );
end;
$function$;

revoke all on function public.client_portal_attach_service_request_file(uuid, uuid, text, text, bigint) from public;
revoke all on function public.client_portal_attach_service_request_file(uuid, uuid, text, text, bigint) from anon;
revoke all on function public.client_portal_attach_service_request_file(uuid, uuid, text, text, bigint) from authenticated;
-- Só a Edge Function chama: quem registra o anexo precisa ter o arquivo na mão. Se o navegador
-- pudesse chamar direto, criaria linha apontando para objeto que nunca subiu.
grant execute on function public.client_portal_attach_service_request_file(uuid, uuid, text, text, bigint) to service_role;

create or replace function public.client_portal_discard_service_request_file(
  p_token uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_updated integer;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  update public.client_service_requests
  set attachment_bucket = null,
      attachment_path = null,
      attachment_name = null,
      attachment_mime = null,
      attachment_size = null,
      updated_at = now()
  where id = p_request_id
    and tenant_id = v_account.tenant_id
    and account_id = v_account.id;

  get diagnostics v_updated = row_count;

  delete from public.client_service_request_events
  where request_id = p_request_id
    and event_type = 'attachment_added';

  return jsonb_build_object('ok', v_updated > 0);
end;
$function$;

revoke all on function public.client_portal_discard_service_request_file(uuid, uuid) from public;
revoke all on function public.client_portal_discard_service_request_file(uuid, uuid) from anon;
revoke all on function public.client_portal_discard_service_request_file(uuid, uuid) from authenticated;
grant execute on function public.client_portal_discard_service_request_file(uuid, uuid) to service_role;

-- ─── Atendimento pela equipe ──────────────────────────────────────────────────
--
-- Uma RPC só para status, prioridade, responsável e nota: as quatro coisas costumam mudar no
-- mesmo gesto ("assumo, é urgente, e vou perguntar tal coisa"), e separá-las criaria quatro
-- linhas de histórico para uma decisão só.
--
-- Papel: consultora e admin atendem; **cancelar é só do admin**. Cancelar apaga a demanda da
-- vista do cliente sem entregar nada, e é a única ação daqui que não tem volta prática.

create or replace function public.admin_update_service_request(
  p_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_to text default null,
  p_note text default null,
  p_note_visible boolean default false,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.client_service_requests%rowtype;
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_priority text := nullif(lower(btrim(coalesce(p_priority, ''))), '');
  v_assigned text := btrim(coalesce(p_assigned_to, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_actor text := nullif(btrim(coalesce(p_actor_name, '')), '');
  v_is_admin boolean;
  v_awaiting timestamptz;
begin
  select * into v_request
  from public.client_service_requests
  where id = p_id;

  if not found then
    return jsonb_build_object('error', 'solicitacao invalida');
  end if;

  if not private.is_tenant_staff(v_request.tenant_id) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  if v_status is not null and v_status not in
    ('open', 'in_progress', 'awaiting_client', 'resolved', 'cancelled') then
    return jsonb_build_object('error', 'situacao invalida');
  end if;

  if v_priority is not null and v_priority not in ('low', 'normal', 'high', 'urgent') then
    return jsonb_build_object('error', 'prioridade invalida');
  end if;

  if v_status = 'cancelled' then
    select exists (
      select 1 from public.tenant_users
      where user_id = (select auth.uid())
        and tenant_id = v_request.tenant_id
        and role = 'admin'
    ) into v_is_admin;

    if not coalesce(v_is_admin, false) then
      return jsonb_build_object('error', 'apenas o administrador pode cancelar uma solicitacao');
    end if;
  end if;

  -- Perguntar sem dizer o quê devolve o cliente para o zero: ele vê "aguardando você" e não
  -- sabe o que responder. Mesma regra do `changes_requested` da evidência (P360-011).
  if v_status = 'awaiting_client' and v_note is null then
    return jsonb_build_object('error', 'diga ao cliente o que voce precisa que ele responda');
  end if;

  -- A pergunta ao cliente é sempre visível para ele — senão a tela dele fica sem o texto que
  -- explica por que está esperando.
  if v_status = 'awaiting_client' then
    p_note_visible := true;
  end if;

  if v_status = 'awaiting_client' then
    -- `clock_timestamp()` e não `now()`: este carimbo é a chave de dedupe do aviso ao cliente.
    -- Duas perguntas seguidas na mesma transação precisam de chaves diferentes, senão a
    -- segunda nunca sai do servidor.
    v_awaiting := clock_timestamp();
  end if;

  update public.client_service_requests
  set status = coalesce(v_status, status),
      priority = coalesce(v_priority, priority),
      assigned_to = case when p_assigned_to is null then assigned_to else nullif(v_assigned, '') end,
      awaiting_client_since = case
        when v_status = 'awaiting_client' then v_awaiting
        when v_status is not null then null
        else awaiting_client_since
      end,
      closed_at = case
        when v_status in ('resolved', 'cancelled') then coalesce(closed_at, now())
        when v_status is not null then null
        else closed_at
      end,
      -- Nota interna não move a "última atualização" que o cliente vê. Movimento no portal
      -- tem de significar movimento no atendimento dele.
      last_event_at = case
        when v_status is not null or coalesce(p_note_visible, false) then now()
        else last_event_at
      end,
      updated_at = now()
  where id = p_id;

  if v_status is not null and v_status is distinct from v_request.status then
    insert into public.client_service_request_events (
      request_id, tenant_id, event_type, from_status, to_status, note,
      actor_kind, actor_name, visible_to_client
    ) values (
      v_request.id, v_request.tenant_id, 'status_changed', v_request.status, v_status, v_note,
      'staff', v_actor, coalesce(p_note_visible, false) or v_note is null
    );
  elsif v_note is not null then
    insert into public.client_service_request_events (
      request_id, tenant_id, event_type, note, actor_kind, actor_name, visible_to_client
    ) values (
      v_request.id, v_request.tenant_id, 'note', v_note, 'staff', v_actor, coalesce(p_note_visible, false)
    );
  end if;

  if v_priority is not null and v_priority is distinct from v_request.priority then
    insert into public.client_service_request_events (
      request_id, tenant_id, event_type, note, actor_kind, actor_name, visible_to_client
    ) values (
      v_request.id, v_request.tenant_id, 'priority_changed', v_priority, 'staff', v_actor, false
    );
  end if;

  if p_assigned_to is not null and nullif(v_assigned, '') is distinct from v_request.assigned_to then
    insert into public.client_service_request_events (
      request_id, tenant_id, event_type, note, actor_kind, actor_name, visible_to_client
    ) values (
      v_request.id, v_request.tenant_id, 'assigned', nullif(v_assigned, ''), 'staff', v_actor, true
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', coalesce(v_status, v_request.status),
    'waiting_on', private.service_request_waiting_on(coalesce(v_status, v_request.status)),
    'awaiting_client_since', v_awaiting
  );
end;
$function$;

revoke all on function public.admin_update_service_request(uuid, text, text, text, text, boolean, text) from public;
revoke all on function public.admin_update_service_request(uuid, text, text, text, text, boolean, text) from anon;
grant execute on function public.admin_update_service_request(uuid, text, text, text, text, boolean, text) to authenticated;

-- ─── SLA configurável pela equipe ─────────────────────────────────────────────

create or replace function public.admin_set_service_request_sla(
  p_tenant_id uuid,
  p_sla jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_key text;
  v_value jsonb;
begin
  if not private.is_tenant_staff(p_tenant_id) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  if p_sla is null or jsonb_typeof(p_sla) <> 'object' then
    return jsonb_build_object('error', 'configuracao invalida');
  end if;

  for v_key, v_value in select * from jsonb_each(p_sla) loop
    if v_key <> 'default' and v_key not in (
      'documentacao', 'licenciamento', 'notificacao_visa', 'obra_reforma',
      'treinamento', 'produto_equipamento', 'boas_praticas', 'outro'
    ) then
      return jsonb_build_object('error', 'categoria invalida: ' || v_key);
    end if;

    if jsonb_typeof(v_value) <> 'number'
       or (v_value)::text::numeric <= 0
       or (v_value)::text::numeric > 365 then
      return jsonb_build_object('error', 'prazo invalido em ' || v_key || ' (use de 1 a 365 dias)');
    end if;
  end loop;

  insert into public.client_portal_settings (tenant_id, service_request_sla)
  values (p_tenant_id, p_sla)
  on conflict (tenant_id) do update set service_request_sla = excluded.service_request_sla;

  return jsonb_build_object('ok', true, 'service_request_sla', p_sla);
end;
$function$;

revoke all on function public.admin_set_service_request_sla(uuid, jsonb) from public;
revoke all on function public.admin_set_service_request_sla(uuid, jsonb) from anon;
grant execute on function public.admin_set_service_request_sla(uuid, jsonb) to authenticated;
