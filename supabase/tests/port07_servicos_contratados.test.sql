\set ON_ERROR_STOP on

-- PORT-07 — continua do fixture do P360-012 (contas, unidades, plano de ação e solicitações) e,
-- por baixo dele, do fixture de agenda: `client_portal_create_appointment` e a tabela de
-- solicitações de agendamento já existem aqui.
--
--   conta A  = 20000000-…-000003 (tenant A)
--   unidade  = 20000000-…-000001 (a que a conta A enxerga)
\ir client_service_requests.test.sql

-- A coluna do PORT-06 nasce noutro ramo de fixture (o dos tópicos do plano de ação). Aqui só o
-- default dela interessa, então basta existir — como `portal_feature_gates` faz com as outras
-- duas marcações de contrato.
alter table public.clients
  add column if not exists has_evidence_support boolean not null default true;

\ir ../migrations/20260829120000_port07_servicos_contratados.sql

-- ─── Permissões ───────────────────────────────────────────────────────────────
--
-- `create or replace` numa RPC pública é onde o grant se perde. As suítes anteriores checam os
-- grants ANTES desta migration, então quem reescreve reafirma aqui.
do $$
begin
  -- Cliente Supabase único: com sessão de staff no navegador a RPC do portal chega como
  -- `authenticated`. Os dois papéis, nas duas escritas.
  if not has_function_privilege('anon', 'public.client_portal_create_appointment(jsonb)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_create_appointment(jsonb)'::regprocedure, 'execute') then
    raise exception 'o agendamento pelo portal perdeu grant na reescrita';
  end if;
  if not has_function_privilege('anon', 'public.client_portal_create_service_request(uuid,uuid,text,text,text,uuid,text,text,text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'public.client_portal_create_service_request(uuid,uuid,text,text,text,uuid,text,text,text)'::regprocedure, 'execute') then
    raise exception 'a abertura de solicitacao perdeu grant na reescrita';
  end if;

  -- O resolvedor de duração é auxiliar interno: o navegador não o alcança.
  if has_function_privilege('anon', 'private.resolve_appointment_duration_minutes(text,integer,timestamptz,timestamptz)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'private.resolve_appointment_duration_minutes(text,integer,timestamptz,timestamptz)'::regprocedure, 'execute') then
    raise exception 'o navegador alcanca o resolvedor de duracao direto';
  end if;
end;
$$;

-- ─── As marcações de contrato nascem desmarcadas ──────────────────────────────
do $$
declare
  v_default text;
begin
  select column_default into v_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'clients' and column_name = 'has_evidence_support';
  if v_default is distinct from 'false' then
    raise exception 'a revisao de evidencia continua nascendo ligada: %', v_default;
  end if;

  -- E as três agora dizem a mesma coisa para um cliente novo: nada assumido em silêncio.
  insert into public.clients (id, tenant_id, name)
  values ('20000000-0000-4000-8000-0000000000f7', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cliente recem-cadastrado');

  if exists (
    select 1 from public.clients
    where id = '20000000-0000-4000-8000-0000000000f7'
      and (has_evidence_support or has_audit_service or has_online_followup
           or has_personalized_sanitary_folder)
  ) then
    raise exception 'cliente novo nasceu com servico de contrato marcado';
  end if;

  -- `set default` não reescreve linha existente: quem já tinha a revisão continua com ela.
  if not exists (
    select 1 from public.clients
    where id = '20000000-0000-4000-8000-000000000001' and has_evidence_support
  ) then
    raise exception 'a migration desligou a revisao de evidencia de quem ja tinha';
  end if;
end;
$$;

-- ─── Agendar auditoria exige a marcação no cadastro ───────────────────────────
update public.clients
set has_audit_service = false, has_online_followup = false
where id = '20000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    perform public.client_portal_create_appointment(jsonb_build_object(
      'portal_token', '20000000-0000-4000-8000-000000000003',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'district', 'Centro',
      'municipality', 'Rio de Janeiro',
      'attendance_mode', 'presencial',
      'appointment_type', 'audit',
      'duration_minutes', 180,
      'requested_starts_at', '2027-06-14T12:30:00Z',
      'requested_ends_at', '2027-06-14T15:30:00Z'
    ));
    raise exception 'unidade sem auditoria contratada conseguiu agendar auditoria';
  exception when others then
    if sqlerrm not like '%auditoria nao faz parte do contrato%' then raise; end if;
  end;

  begin
    perform public.client_portal_create_appointment(jsonb_build_object(
      'portal_token', '20000000-0000-4000-8000-000000000003',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'attendance_mode', 'online',
      'appointment_type', 'online_followup',
      'duration_minutes', 60,
      'requested_starts_at', '2027-06-15T12:30:00Z',
      'requested_ends_at', '2027-06-15T13:30:00Z'
    ));
    raise exception 'unidade sem acompanhamento online contratado conseguiu agendar';
  exception when others then
    if sqlerrm not like '%acompanhamento online nao faz parte do contrato%' then raise; end if;
  end;

  if exists (
    select 1 from public.appointment_requests
    where client_id = '20000000-0000-4000-8000-000000000001'
      and appointment_type in ('audit', 'online_followup')
  ) then
    raise exception 'agendamento recusado gravou solicitacao mesmo assim';
  end if;
end;
$$;

-- ─── Com a marcação, a auditoria entra — e com duração de fiscalização ────────
update public.clients
set has_audit_service = true, has_online_followup = true
where id = '20000000-0000-4000-8000-000000000001';

do $$
declare
  v_result jsonb;
  v_row public.appointment_requests%rowtype;
begin
  -- 180 minutos: fora da faixa de reunião (30/60/90) e dentro da faixa da inspeção. É o que
  -- prova que a auditoria deixou de ser tratada como reunião.
  select public.client_portal_create_appointment(jsonb_build_object(
    'portal_token', '20000000-0000-4000-8000-000000000003',
    'client_id', '20000000-0000-4000-8000-000000000001',
    'district', 'Centro',
    'municipality', 'Rio de Janeiro',
    'attendance_mode', 'presencial',
    'appointment_type', 'audit',
    'duration_minutes', 180,
    'requested_starts_at', '2027-06-14T12:30:00Z',
    'requested_ends_at', '2027-06-14T15:30:00Z'
  )) into v_result;

  select * into v_row from public.appointment_requests
  where public_token = (v_result ->> 'public_token')::uuid;
  if v_row.appointment_type <> 'audit' or v_row.duration_minutes <> 180 then
    raise exception 'auditoria nao foi gravada como auditoria de 180 min: % / %',
      v_row.appointment_type, v_row.duration_minutes;
  end if;

  -- A cota de uma inspeção por mês é da inspeção avulsa: a auditoria é mensal por contrato e
  -- não pode esbarrar nela.
  select public.client_portal_create_appointment(jsonb_build_object(
    'portal_token', '20000000-0000-4000-8000-000000000003',
    'client_id', '20000000-0000-4000-8000-000000000001',
    'district', 'Centro',
    'municipality', 'Rio de Janeiro',
    'attendance_mode', 'presencial',
    'appointment_type', 'audit',
    'duration_minutes', 180,
    'requested_starts_at', '2027-06-21T12:30:00Z',
    'requested_ends_at', '2027-06-21T15:30:00Z'
  )) into v_result;
  if v_result ->> 'public_token' is null then
    raise exception 'a segunda auditoria do mes foi recusada pela cota da inspecao';
  end if;

  -- Acompanhamento online segue como reunião: 180 minutos continua fora da faixa dele.
  begin
    perform public.client_portal_create_appointment(jsonb_build_object(
      'portal_token', '20000000-0000-4000-8000-000000000003',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'attendance_mode', 'online',
      'appointment_type', 'online_followup',
      'duration_minutes', 180,
      'requested_starts_at', '2027-06-22T12:30:00Z',
      'requested_ends_at', '2027-06-22T15:30:00Z'
    ));
    raise exception 'acompanhamento online aceitou duracao de fiscalizacao';
  exception when others then
    if sqlerrm not like '%reunioes e orientacoes aceitam%' then raise; end if;
  end;
end;
$$;

-- ─── Pedir documento exige a pasta sanitária personalizada ────────────────────
update public.clients
set has_personalized_sanitary_folder = false
where id = '20000000-0000-4000-8000-000000000001';

do $$
declare
  v_result jsonb;
  v_antes integer := (select count(*) from public.client_service_requests);
begin
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'documentacao',
    'Elaborar POP de higienizacao',
    'Precisamos do procedimento escrito para a equipe nova.',
    '70000000-0000-4000-8000-0000000000a1'
  );
  if v_result ->> 'error' not like '%pasta sanitaria personalizada%' then
    raise exception 'unidade sem a pasta conseguiu pedir elaboracao de documento: %', v_result;
  end if;
  if (select count(*) from public.client_service_requests) <> v_antes then
    raise exception 'pedido de documento recusado gravou solicitacao mesmo assim';
  end if;

  -- As outras categorias não dependem da pasta: continuam abertas a qualquer unidade.
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'boas_praticas',
    'Duvida de rotina na cozinha',
    'Queremos alinhar a rotina de higienizacao das bancadas.',
    '70000000-0000-4000-8000-0000000000a2'
  );
  if v_result ->> 'error' is not null then
    raise exception 'a trava do documento derrubou as outras categorias junto: %', v_result;
  end if;
end;
$$;

-- ─── Com a pasta contratada, o pedido entra ───────────────────────────────────
update public.clients
set has_personalized_sanitary_folder = true
where id = '20000000-0000-4000-8000-000000000001';

do $$
declare
  v_result jsonb;
begin
  v_result := public.client_portal_create_service_request(
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'documentacao',
    'Elaborar POP de higienizacao',
    'Precisamos do procedimento escrito para a equipe nova.',
    '70000000-0000-4000-8000-0000000000a3'
  );
  if v_result ->> 'error' is not null then
    raise exception 'contratar a pasta nao devolveu o pedido de documento: %', v_result;
  end if;
  if not exists (
    select 1 from public.client_service_requests
    where submission_key = '70000000-0000-4000-8000-0000000000a3'
      and category = 'documentacao'
  ) then
    raise exception 'o pedido de documento nao foi gravado';
  end if;
end;
$$;

select 'port07_servicos_contratados: ok' as resultado;
