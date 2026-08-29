-- PORT-07 — Servicos contratados
--
-- Tres marcacoes de contrato ja existiam em `clients` e quase nao faziam nada: a pasta
-- sanitaria personalizada so escondia um botao, e auditoria/acompanhamento online apenas
-- acrescentavam uma linha "Sem data prevista" no cronograma do link publico, porque nenhuma
-- tela criava compromisso desses tipos. Esta migration faz as tres valerem alguma coisa:
--
-- 1. `has_evidence_support` passa a nascer DESMARCADA, como as outras. O formulario de criacao
--    de cliente passa a perguntar as tres — nada e assumido em silencio. Linhas existentes nao
--    mudam: `set default` nao reescreve o que ja esta gravado.
-- 2. A auditoria vira uma inspecao com outro nome. Aqui isso significa a faixa de duracao da
--    inspecao (15 a 720 min) em vez da faixa de reuniao (30/60/90) — o lado do app cuida de
--    executar roteiro e publicar relatorio.
-- 3. Agendar auditoria ou acompanhamento online exige a marcacao no cadastro da unidade.
-- 4. Abrir solicitacao da categoria "Documentacao" exige a pasta sanitaria personalizada.
--
-- Os itens 3 e 4 sao recusas de ESCRITA, no servidor. Esconder a opcao no formulario e
-- cortesia; o que vale e isto.

alter table public.clients
  alter column has_evidence_support set default false;

comment on column public.clients.has_evidence_support is
  'Contrato inclui revisao de evidencia de correcao pela consultoria (PORT-06). Falso = cliente '
  'de vistoria: o plano de acao aparece inteiro e ele ainda declara situacao e marca topicos, '
  'mas o envio de arquivo some do portal e e recusado no servidor. Nasce desmarcada desde o '
  'PORT-07 — quem cadastra o cliente responde as tres marcacoes de contrato no formulario.';

-- ─── 1. Duracao: auditoria sai da faixa de reuniao ────────────────────────────
create or replace function private.resolve_appointment_duration_minutes(
  p_appointment_type text,
  p_duration_minutes integer default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_type text := coalesce(nullif(p_appointment_type, ''), 'inspection');
  v_derived integer;
  v_duration integer;
begin
  if p_starts_at is not null and p_ends_at is not null then
    if p_ends_at <= p_starts_at then
      raise exception 'o horario final deve ser posterior ao horario inicial'
        using errcode = 'check_violation';
    end if;
    if (p_ends_at at time zone 'America/Sao_Paulo')::date
       <> (p_starts_at at time zone 'America/Sao_Paulo')::date then
      raise exception 'o compromisso deve terminar no mesmo dia em America/Sao_Paulo'
        using errcode = 'check_violation';
    end if;
    v_derived := round(extract(epoch from (p_ends_at - p_starts_at)) / 60)::integer;
  end if;

  -- Briefing tem default proprio porque as RPCs de listagem consultam sem duracao.
  -- PORT-07: auditoria e uma inspecao com outro nome, entao herda o default de 60.
  v_duration := coalesce(p_duration_minutes, v_derived,
    case v_type when 'inspection' then 60 when 'audit' then 60 when 'briefing' then 45 end);

  if v_duration is null then
    raise exception 'duracao obrigatoria para este tipo de compromisso'
      using errcode = 'check_violation';
  end if;

  if p_starts_at is not null and p_ends_at is not null
     and p_ends_at <> p_starts_at + make_interval(mins => v_duration) then
    raise exception 'duracao nao corresponde ao intervalo informado'
      using errcode = 'check_violation';
  end if;

  -- PORT-07: a auditoria mensal e uma fiscalizacao presencial completa, nao uma reuniao de
  -- 30 a 90 minutos. Ela sai da faixa de reuniao e passa a valer a faixa da inspecao.
  if v_type in ('inspection', 'audit') then
    if v_duration not between 15 and 720 then
      raise exception 'duracao de inspecao fora do limite de 15 a 720 minutos'
        using errcode = 'check_violation';
    end if;
  elsif v_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'online_followup') then
    if v_duration not in (30, 60, 90) then
      raise exception 'reunioes e orientacoes aceitam 30, 60 ou 90 minutos'
        using errcode = 'check_violation';
    end if;
  elsif v_type = 'training' then
    if v_duration not between 30 and 480 or v_duration % 30 <> 0 then
      raise exception 'treinamentos aceitam de 30 a 480 minutos, em passos de 30'
        using errcode = 'check_violation';
    end if;
  elsif v_type = 'other' then
    if v_duration not between 15 and 480 or v_duration % 15 <> 0 then
      raise exception 'outros compromissos aceitam de 15 a 480 minutos, em passos de 15'
        using errcode = 'check_violation';
    end if;
  elsif v_type = 'briefing' then
    if v_duration not in (15, 30, 45, 60) then
      raise exception 'briefing aceita 15, 30, 45 ou 60 minutos'
        using errcode = 'check_violation';
    end if;
  else
    raise exception 'tipo de compromisso invalido'
      using errcode = 'check_violation';
  end if;

  return v_duration;
end;
$$;

revoke all on function private.resolve_appointment_duration_minutes(text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;

-- ─── 1b. A mesma regra nas travas do banco ────────────────────────────────────
--
-- `resolve_appointment_duration_minutes` valida na porta de entrada do portal; estes dois
-- checks valem para QUALQUER escrita, inclusive a do admin, que insere direto na tabela. Mover
-- a auditoria so na funcao deixaria a RPC aceitar 180 min e a linha ser recusada pelo check.

alter table public.appointment_requests
  drop constraint if exists appointment_requests_duration_minutes_check;
alter table public.appointment_requests
  add constraint appointment_requests_duration_minutes_check check (
    duration_minutes is null
    or (appointment_type in ('inspection', 'audit') and duration_minutes between 15 and 720)
    or (appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'online_followup')
        and duration_minutes in (30, 60, 90))
    or (appointment_type = 'training' and duration_minutes between 30 and 480 and duration_minutes % 30 = 0)
    or (appointment_type = 'other' and duration_minutes between 15 and 480 and duration_minutes % 15 = 0)
    or (appointment_type = 'briefing' and duration_minutes in (15, 30, 45, 60))
  );

alter table public.schedules
  drop constraint if exists schedules_duration_minutes_check;
alter table public.schedules
  add constraint schedules_duration_minutes_check check (
    duration_minutes is null
    or (appointment_type in ('inspection', 'audit') and duration_minutes between 15 and 720)
    or (appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'online_followup')
        and duration_minutes in (30, 60, 90))
    or (appointment_type = 'training' and duration_minutes between 30 and 480 and duration_minutes % 30 = 0)
    or (appointment_type = 'other' and duration_minutes between 15 and 480 and duration_minutes % 15 = 0)
    or (appointment_type = 'briefing' and duration_minutes in (15, 30, 45, 60))
  );

-- ─── 2. Agendar auditoria / acompanhamento online exige a marcacao ────────────
create or replace function public.client_portal_create_appointment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid := nullif(p_payload->>'portal_token', '')::uuid;
  v_client_id uuid := nullif(p_payload->>'client_id', '')::uuid;
  v_account public.client_portal_accounts%rowtype;
  v_tenant_id uuid;
  v_unit_name text;
  v_client_state text;
  v_client_email text;
  v_has_audit boolean;
  v_has_online_followup boolean;
  v_attendance_mode text := coalesce(nullif(btrim(p_payload->>'attendance_mode'), ''), 'presencial');
  v_municipality text := nullif(btrim(p_payload->>'municipality'), '');
  v_district text := nullif(btrim(p_payload->>'district'), '');
  v_appointment_type text := coalesce(nullif(btrim(p_payload->>'appointment_type'), ''), 'inspection');
  v_duration_minutes integer := nullif(p_payload->>'duration_minutes', '')::integer;
  v_subject text := nullif(btrim(p_payload->>'subject'), '');
  v_participant_names text[];
  v_consultant_names text[];
  v_starts_at timestamptz := nullif(p_payload->>'requested_starts_at', '')::timestamptz;
  v_ends_at timestamptz := nullif(p_payload->>'requested_ends_at', '')::timestamptz;
  v_starts_local timestamp;
  v_slot_minutes integer;
  v_new_token uuid;
begin
  if v_token is null then raise exception 'sessao invalida'; end if;
  select * into v_account from public.client_portal_accounts where portal_token = v_token and is_active;
  if not found then raise exception 'sessao invalida'; end if;
  v_tenant_id := v_account.tenant_id;
  if coalesce((private.portal_account_gates(v_account.id) ->> 'scheduling_suspended')::boolean, false) then raise exception 'agendamentos suspensos por pendencia de pagamento'; end if;
  if v_appointment_type = 'briefing' then raise exception 'briefing e exclusivo do canal publico de primeiro contato'; end if;
  if v_client_id is null or not exists (select 1 from public.client_portal_account_clients ac where ac.account_id = v_account.id and ac.client_id = v_client_id) then raise exception 'unidade nao vinculada a este acesso'; end if;

  select c.name, c.state, c.email, c.has_audit_service, c.has_online_followup
    into v_unit_name, v_client_state, v_client_email, v_has_audit, v_has_online_followup
  from public.clients c
  where c.id = v_client_id and c.tenant_id = v_tenant_id and c.deleted_at is null;
  if v_unit_name is null then raise exception 'unidade invalida'; end if;

  -- PORT-07: auditoria e acompanhamento online so existem para quem contratou. A lista de
  -- finalidades ja esconde a opcao no portal; isto e o que impede trocar o payload na mao.
  if v_appointment_type = 'audit' and not coalesce(v_has_audit, false) then
    raise exception 'auditoria nao faz parte do contrato desta unidade';
  end if;
  if v_appointment_type = 'online_followup' and not coalesce(v_has_online_followup, false) then
    raise exception 'acompanhamento online nao faz parte do contrato desta unidade';
  end if;
  if v_attendance_mode = 'presencial' and upper(coalesce(btrim(v_client_state), '')) not in ('RJ', 'RIO DE JANEIRO') then raise exception 'vistoria presencial permitida apenas para unidades cadastradas no RJ'; end if;
  if v_subject is not null and length(v_subject) > 300 then raise exception 'subject muito longo'; end if;
  if v_starts_at is null or v_ends_at is null then raise exception 'horario obrigatorio'; end if;

  select array_agg(btrim(item.value)) into v_participant_names
  from jsonb_array_elements_text(coalesce(p_payload->'participant_names', '[]'::jsonb)) as item(value)
  where btrim(item.value) <> '';
  if coalesce(array_length(v_participant_names, 1), 0) > 50 then raise exception 'participant_names muito longo'; end if;

  select array_agg(btrim(item.value)) into v_consultant_names
  from jsonb_array_elements_text(coalesce(p_payload->'consultant_names', '[]'::jsonb)) as item(value)
  where btrim(item.value) <> '';

  v_duration_minutes := private.resolve_appointment_duration_minutes(v_appointment_type, v_duration_minutes, v_starts_at, v_ends_at);
  if v_starts_at < now() + interval '24 hours' then raise exception 'agendamento exige antecedencia minima de 24 horas'; end if;
  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
  -- A trava de uma inspecao por mes segue literal em 'inspection' de proposito (PORT-07): a
  -- auditoria e mensal por contrato e esbarraria nela todo mes.
  if v_appointment_type = 'inspection' and exists (
    select 1
    from public.appointment_requests ar
    where ar.tenant_id = v_tenant_id
      and ar.client_id = v_client_id
      and ar.appointment_type = 'inspection'
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled', 'completed')
      and ar.requested_date >= date_trunc('month', v_starts_local)::date
      and ar.requested_date < (date_trunc('month', v_starts_local) + interval '1 month')::date
  ) then
    raise exception 'esta unidade ja possui uma inspecao solicitada neste mes';
  end if;
  v_slot_minutes := extract(hour from v_starts_local) * 60 + extract(minute from v_starts_local);
  if extract(isodow from v_starts_local) not between 1 and 5 then raise exception 'agendamento permitido apenas de segunda a sexta'; end if;
  if not ((v_slot_minutes >= 570 and v_slot_minutes <= 690) or (v_slot_minutes >= 780 and v_slot_minutes <= 960)) then raise exception 'horario indisponivel'; end if;
  if not private.consultant_available(v_tenant_id, v_consultant_names, v_starts_at) then raise exception 'horario indisponivel'; end if;
  if v_attendance_mode = 'presencial' and (v_district is null or v_municipality is null) then raise exception 'bairro e municipio sao obrigatorios para atendimento presencial'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_starts_local::date::text, 0));
  if private.appointment_has_conflict(v_tenant_id, v_starts_at, v_ends_at, v_consultant_names, null, null, null, interval '4 hours') then raise exception 'horario indisponivel' using errcode = 'exclusion_violation'; end if;

  insert into public.appointment_requests (
    tenant_id, client_id, unit_name, district, municipality, attendance_mode, responsible_name, phone, email,
    requested_date, requested_time, requested_period, requested_starts_at, requested_ends_at,
    appointment_type, subject, duration_minutes, participant_names, consultant_names, notes
  ) values (
    v_tenant_id, v_client_id, v_unit_name, v_district, v_municipality, v_attendance_mode,
    nullif(btrim(p_payload->>'responsible_name'), ''), nullif(btrim(p_payload->>'phone'), ''),
    v_client_email, v_starts_local::date, to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at, v_ends_at, v_appointment_type, v_subject, v_duration_minutes, v_participant_names,
    v_consultant_names, nullif(btrim(p_payload->>'notes'), '')
  ) returning public_token into v_new_token;

  return jsonb_build_object('public_token', v_new_token);
end;
$$;

-- Cliente Supabase unico: com sessao de staff no navegador a mesma RPC chega como
-- `authenticated`. Os dois papeis, sempre. Nao ha `revoke` aqui de proposito — `create or
-- replace` preserva a ACL, e um revoke incompleto e exatamente o defeito que quase foi para
-- producao no PORT-06.
grant execute on function public.client_portal_create_appointment(jsonb) to anon;
grant execute on function public.client_portal_create_appointment(jsonb) to authenticated;

-- ─── 3. Solicitar documento exige a pasta sanitaria personalizada ─────────────
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

  -- PORT-07: pedir a elaboracao de documento (POP, manual, registro) e o servico da pasta
  -- sanitaria personalizada. Sem ela no contrato, o formulario nao oferece a categoria e o
  -- servidor tambem recusa -- as demais categorias seguem abertas a qualquer unidade.
  if v_category = 'documentacao' and not exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.tenant_id = v_account.tenant_id
      and c.has_personalized_sanitary_folder
  ) then
    return jsonb_build_object('error', 'a elaboracao de documentos faz parte da pasta sanitaria personalizada, que nao esta no contrato desta unidade');
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


grant execute on function public.client_portal_create_service_request(uuid, uuid, text, text, text, uuid, text, text, text) to anon;
grant execute on function public.client_portal_create_service_request(uuid, uuid, text, text, text, uuid, text, text, text) to authenticated;
