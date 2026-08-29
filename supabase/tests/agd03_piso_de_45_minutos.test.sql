\set ON_ERROR_STOP on

-- AGD-03 — continua do fixture do PORT-07, que ja traz a agenda inteira (tabelas, resolvedor de
-- duracao na versao com auditoria, RPCs do portal) e a unidade com os servicos contratados.
\ir port07_servicos_contratados.test.sql

-- Uma linha ANTERIOR ao piso, gravada antes da migration entrar. Producao tem duas assim: um
-- briefing de 15 min ja cancelado e uma reuniao de 30 min do tenant de homologacao. O card nao
-- reescreve o passado, entao esta linha tem de sobreviver.
insert into public.schedules (
  tenant_id, client_id, scheduled_at, status, appointment_type, attendance_mode,
  duration_minutes, consultant_names
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '20000000-0000-4000-8000-000000000001',
  '2027-07-01T12:30:00Z',
  'pending',
  'follow_up_meeting',
  'online',
  30,
  array['Consultora A']
);

\ir ../migrations/20260829110510_agd03_piso_de_45_minutos.sql

-- ─── O passado fica de pe ─────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from public.schedules
    where scheduled_at = '2027-07-01T12:30:00Z' and duration_minutes = 30
  ) then
    raise exception 'a migration apagou ou reescreveu compromisso curto ja gravado';
  end if;

  -- E o check e `not valid` mesmo, nao um check ausente.
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedules_duration_minutes_check' and not convalidated
  ) then
    raise exception 'o check da agenda nao esta marcado como not valid';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointment_requests_duration_minutes_check' and not convalidated
  ) then
    raise exception 'o check das solicitacoes nao esta marcado como not valid';
  end if;
end;
$$;

-- ─── Nenhum tipo aceita menos de 45 minutos ───────────────────────────────────
do $$
declare
  v_tipo text;
  v_minutos integer;
begin
  foreach v_tipo in array array[
    'inspection', 'audit', 'follow_up_meeting', 'results_meeting', 'document_guidance',
    'online_followup', 'training', 'other', 'briefing'
  ] loop
    foreach v_minutos in array array[15, 30, 44] loop
      begin
        perform private.resolve_appointment_duration_minutes(v_tipo, v_minutos);
        raise exception '% aceitou % minutos, abaixo do piso', v_tipo, v_minutos;
      exception when check_violation then
        null;
      end;
    end loop;
  end loop;
end;
$$;

-- ─── 45 minutos passa em todo tipo, menos treinamento ─────────────────────────
do $$
declare
  v_tipo text;
begin
  foreach v_tipo in array array[
    'inspection', 'audit', 'follow_up_meeting', 'results_meeting', 'document_guidance',
    'online_followup', 'other', 'briefing'
  ] loop
    if private.resolve_appointment_duration_minutes(v_tipo, 45) <> 45 then
      raise exception '% recusou 45 minutos, que e o piso', v_tipo;
    end if;
  end loop;

  -- Treinamento anda de 30 em 30: o primeiro valor acima do piso e 60, nao 45.
  begin
    perform private.resolve_appointment_duration_minutes('training', 45);
    raise exception 'treinamento aceitou 45, fora do passo de 30';
  exception when check_violation then
    null;
  end;
  if private.resolve_appointment_duration_minutes('training', 60) <> 60 then
    raise exception 'treinamento recusou 60 minutos';
  end if;

  -- Os tetos de cada faixa continuam onde estavam.
  if private.resolve_appointment_duration_minutes('inspection', 720) <> 720
     or private.resolve_appointment_duration_minutes('audit', 720) <> 720 then
    raise exception 'o teto da inspecao/auditoria mudou junto com o piso';
  end if;
  begin
    perform private.resolve_appointment_duration_minutes('follow_up_meeting', 75);
    raise exception 'reuniao aceitou 75 minutos, fora de 45/60/90';
  exception when check_violation then
    null;
  end;
end;
$$;

-- ─── A mensagem e a do piso, nao a da faixa ───────────────────────────────────
do $$
begin
  begin
    perform private.resolve_appointment_duration_minutes('inspection', 30);
    raise exception 'inspecao de 30 minutos passou';
  exception when check_violation then
    -- Quem tentou marcar 30 minutos precisa ler sobre 30 minutos, nao sobre "15 a 720".
    if sqlerrm not like '%45 minutos%' then
      raise exception 'a recusa nao explicou o piso: %', sqlerrm;
    end if;
  end;
end;
$$;

-- ─── Os checks de tabela cobram o piso em escrita nova ────────────────────────
do $$
begin
  begin
    insert into public.schedules (
      tenant_id, client_id, scheduled_at, status, appointment_type, attendance_mode,
      duration_minutes, consultant_names
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001',
      '2027-07-08T12:30:00Z', 'pending', 'follow_up_meeting', 'online', 30, array['Consultora A']
    );
    raise exception 'a agenda aceitou compromisso novo de 30 minutos';
  exception when check_violation then
    null;
  end;

  -- 45 entra normalmente.
  insert into public.schedules (
    tenant_id, client_id, scheduled_at, status, appointment_type, attendance_mode,
    duration_minutes, consultant_names
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001',
    '2027-07-08T12:30:00Z', 'pending', 'follow_up_meeting', 'online', 45, array['Consultora A']
  );

  begin
    insert into public.appointment_requests (
      tenant_id, client_id, unit_name, district, attendance_mode, requested_date,
      requested_starts_at, requested_ends_at, appointment_type, duration_minutes
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001',
      'Unidade A1', 'Online', 'online', '2027-07-09',
      '2027-07-09T12:30:00Z', '2027-07-09T13:00:00Z', 'follow_up_meeting', 30
    );
    raise exception 'a solicitacao aceitou compromisso novo de 30 minutos';
  exception when check_violation then
    null;
  end;
end;
$$;

-- ─── E o caminho do cliente, pela RPC ─────────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  begin
    perform public.client_portal_create_appointment(jsonb_build_object(
      'portal_token', '20000000-0000-4000-8000-000000000003',
      'client_id', '20000000-0000-4000-8000-000000000001',
      'attendance_mode', 'online',
      'district', 'Online',
      'appointment_type', 'follow_up_meeting',
      'duration_minutes', 30,
      'requested_starts_at', '2027-07-15T12:30:00Z',
      'requested_ends_at', '2027-07-15T13:00:00Z'
    ));
    raise exception 'o portal aceitou reuniao de 30 minutos';
  exception when others then
    if sqlerrm not like '%45 minutos%' then raise; end if;
  end;

  select public.client_portal_create_appointment(jsonb_build_object(
    'portal_token', '20000000-0000-4000-8000-000000000003',
    'client_id', '20000000-0000-4000-8000-000000000001',
    'attendance_mode', 'online',
    'district', 'Online',
    'appointment_type', 'follow_up_meeting',
    'duration_minutes', 45,
    'requested_starts_at', '2027-07-15T12:30:00Z',
    'requested_ends_at', '2027-07-15T13:15:00Z'
  )) into v_result;
  if v_result ->> 'public_token' is null then
    raise exception 'o portal recusou reuniao de 45 minutos, que e o piso';
  end if;
end;
$$;

select 'agd03_piso_de_45_minutos: ok' as resultado;
