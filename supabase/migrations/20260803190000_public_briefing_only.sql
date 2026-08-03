-- P360-007: o canal publico anonimo passa a aceitar somente briefing online de ate 45 minutos.
-- Tambem devolve execute a `authenticated`: o app usa um unico cliente Supabase, entao quem
-- esta logado na plataforma chamava as RPCs publicas como `authenticated` e levava 42501.
-- Rollback: revogar de authenticated, remover 'briefing' das constraints e recriar as versoes
-- de P360-006 de public_create_calendar_appointment_request e client_portal_create_appointment.

-- 1. Acesso: `authenticated` volta a ter o mesmo alcance que `anon` ja tinha.
grant execute on function public.public_list_calendar_days(uuid, date, integer, text, integer)
  to authenticated;
grant execute on function public.public_list_available_times(uuid, date, text, integer)
  to authenticated;
grant execute on function public.public_create_calendar_appointment_request(jsonb)
  to authenticated;
grant execute on function public.client_portal_overview(uuid)
  to authenticated;
grant execute on function public.client_portal_create_appointment(jsonb)
  to authenticated;

-- 2. Novo tipo de compromisso: briefing (conversa inicial com um lead).
alter table public.appointment_requests
  drop constraint if exists appointment_requests_appointment_type_check,
  add constraint appointment_requests_appointment_type_check
    check (appointment_type in (
      'inspection',
      'follow_up_meeting',
      'results_meeting',
      'document_guidance',
      'training',
      'other',
      'briefing'
    )),
  drop constraint if exists appointment_requests_duration_minutes_check,
  add constraint appointment_requests_duration_minutes_check check (
    duration_minutes is null
    or (
      appointment_type = 'inspection'
      and duration_minutes between 15 and 720
    )
    or (
      appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance')
      and duration_minutes in (30, 60, 90)
    )
    or (
      appointment_type = 'training'
      and duration_minutes between 30 and 480
      and duration_minutes % 30 = 0
    )
    or (
      appointment_type = 'other'
      and duration_minutes between 15 and 480
      and duration_minutes % 15 = 0
    )
    or (
      appointment_type = 'briefing'
      and duration_minutes in (15, 30, 45)
    )
  );

alter table public.schedules
  drop constraint if exists schedules_appointment_type_check,
  add constraint schedules_appointment_type_check
    check (appointment_type in (
      'inspection',
      'follow_up_meeting',
      'results_meeting',
      'document_guidance',
      'training',
      'other',
      'briefing'
    )),
  drop constraint if exists schedules_duration_minutes_check,
  add constraint schedules_duration_minutes_check check (
    duration_minutes is null
    or (
      appointment_type = 'inspection'
      and duration_minutes between 15 and 720
    )
    or (
      appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance')
      and duration_minutes in (30, 60, 90)
    )
    or (
      appointment_type = 'training'
      and duration_minutes between 30 and 480
      and duration_minutes % 30 = 0
    )
    or (
      appointment_type = 'other'
      and duration_minutes between 15 and 480
      and duration_minutes % 15 = 0
    )
    or (
      appointment_type = 'briefing'
      and duration_minutes in (15, 30, 45)
    )
  );

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
  v_duration := coalesce(p_duration_minutes, v_derived,
    case v_type when 'inspection' then 60 when 'briefing' then 30 end);

  if v_duration is null then
    raise exception 'duracao obrigatoria para este tipo de compromisso'
      using errcode = 'check_violation';
  end if;

  if p_starts_at is not null and p_ends_at is not null
     and p_ends_at <> p_starts_at + make_interval(mins => v_duration) then
    raise exception 'duracao nao corresponde ao intervalo informado'
      using errcode = 'check_violation';
  end if;

  if v_type = 'inspection' then
    if v_duration not between 15 and 720 then
      raise exception 'duracao de inspecao fora do limite de 15 a 720 minutos'
        using errcode = 'check_violation';
    end if;
  elsif v_type in ('follow_up_meeting', 'results_meeting', 'document_guidance') then
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
    if v_duration not in (15, 30, 45) then
      raise exception 'briefing aceita 15, 30 ou 45 minutos'
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

-- 3. Canal publico anonimo: somente briefing, sempre online, com contato obrigatorio.
create or replace function public.public_create_calendar_appointment_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := nullif(p_payload->>'tenant_id', '')::uuid;
  v_unit_name text := btrim(p_payload->>'unit_name');
  v_responsible_name text := nullif(btrim(p_payload->>'responsible_name'), '');
  v_phone text := nullif(btrim(p_payload->>'phone'), '');
  v_appointment_type text := coalesce(nullif(btrim(p_payload->>'appointment_type'), ''), 'briefing');
  v_duration_minutes integer := nullif(p_payload->>'duration_minutes', '')::integer;
  v_subject text := nullif(btrim(p_payload->>'subject'), '');
  v_participant_names text[];
  v_starts_at timestamptz := nullif(p_payload->>'requested_starts_at', '')::timestamptz;
  v_ends_at timestamptz := nullif(p_payload->>'requested_ends_at', '')::timestamptz;
  v_starts_local timestamp;
  v_slot_minutes integer;
  v_token uuid;
begin
  if v_tenant_id is null then raise exception 'tenant_id e obrigatorio'; end if;

  -- Inspecao, reuniao, orientacao e treinamento exigem vinculo de cliente: so pelo portal.
  if v_appointment_type <> 'briefing' then
    raise exception 'este canal aceita apenas briefing de ate 45 minutos. entre no portal do cliente para os demais compromissos.';
  end if;

  if v_unit_name is null or v_unit_name = '' then raise exception 'unit_name e obrigatorio'; end if;
  if length(v_unit_name) > 200 then raise exception 'unit_name muito longo'; end if;
  if v_responsible_name is null then raise exception 'responsible_name e obrigatorio'; end if;
  if v_phone is null then raise exception 'phone e obrigatorio'; end if;
  if v_subject is not null and length(v_subject) > 300 then raise exception 'subject muito longo'; end if;
  if v_starts_at is null or v_ends_at is null then raise exception 'requested_starts_at e requested_ends_at sao obrigatorios'; end if;

  select array_agg(btrim(item.value)) into v_participant_names
  from jsonb_array_elements_text(coalesce(p_payload->'participant_names', '[]'::jsonb)) as item(value)
  where btrim(item.value) <> '';
  if coalesce(array_length(v_participant_names, 1), 0) > 50 then raise exception 'participant_names muito longo'; end if;

  v_duration_minutes := private.resolve_appointment_duration_minutes(v_appointment_type, v_duration_minutes, v_starts_at, v_ends_at);
  if v_starts_at < now() + interval '24 hours' then raise exception 'agendamento exige antecedencia minima de 24 horas'; end if;
  if (select count(*) from public.appointment_requests ar where ar.tenant_id = v_tenant_id and ar.created_at > now() - interval '1 hour') >= 15 then
    raise exception 'muitas solicitacoes em pouco tempo. tente novamente mais tarde.';
  end if;

  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
  v_slot_minutes := extract(hour from v_starts_local) * 60 + extract(minute from v_starts_local);
  if extract(isodow from v_starts_local) not between 1 and 5 then raise exception 'agendamento permitido apenas de segunda a sexta'; end if;
  if not ((v_slot_minutes >= 570 and v_slot_minutes <= 690) or (v_slot_minutes >= 780 and v_slot_minutes <= 960)) then raise exception 'horario indisponivel'; end if;
  if exists (select 1 from public.appointment_blocked_dates bd where bd.tenant_id = v_tenant_id and bd.day = v_starts_local::date) then raise exception 'horario indisponivel'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_starts_local::date::text, 0));
  if private.appointment_has_conflict(v_tenant_id, v_starts_at, v_ends_at, null, null, null, null, interval '4 hours') then
    raise exception 'horario indisponivel' using errcode = 'exclusion_violation';
  end if;

  -- Briefing e sempre online: modalidade e endereco vindos do payload sao ignorados.
  insert into public.appointment_requests (
    tenant_id, unit_name, district, municipality, attendance_mode, responsible_name, phone, email,
    requested_date, requested_time, requested_period, requested_starts_at, requested_ends_at,
    appointment_type, subject, duration_minutes, participant_names, notes
  ) values (
    v_tenant_id, v_unit_name, 'Online', null, 'online',
    v_responsible_name, v_phone, nullif(btrim(p_payload->>'email'), ''),
    v_starts_local::date, to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at, v_ends_at, v_appointment_type, v_subject, v_duration_minutes, v_participant_names,
    nullif(btrim(p_payload->>'notes'), '')
  ) returning public_token into v_token;

  return jsonb_build_object('public_token', v_token);
end;
$$;

-- 4. O portal e o caminho de quem ja e cliente: briefing e canal de lead, nao entra aqui.
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
  v_attendance_mode text := coalesce(nullif(btrim(p_payload->>'attendance_mode'), ''), 'presencial');
  v_municipality text := nullif(btrim(p_payload->>'municipality'), '');
  v_district text := nullif(btrim(p_payload->>'district'), '');
  v_appointment_type text := coalesce(nullif(btrim(p_payload->>'appointment_type'), ''), 'inspection');
  v_duration_minutes integer := nullif(p_payload->>'duration_minutes', '')::integer;
  v_subject text := nullif(btrim(p_payload->>'subject'), '');
  v_participant_names text[];
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
  if coalesce(v_account.scheduling_suspended, false) then raise exception 'agendamentos suspensos por pendencia de pagamento'; end if;
  if v_appointment_type = 'briefing' then raise exception 'briefing e exclusivo do canal publico de primeiro contato'; end if;
  if v_client_id is null or not exists (select 1 from public.client_portal_account_clients ac where ac.account_id = v_account.id and ac.client_id = v_client_id) then raise exception 'unidade nao vinculada a este acesso'; end if;

  select c.name, c.state into v_unit_name, v_client_state from public.clients c
  where c.id = v_client_id and c.tenant_id = v_tenant_id and c.deleted_at is null;
  if v_unit_name is null then raise exception 'unidade invalida'; end if;
  if v_attendance_mode = 'presencial' and upper(coalesce(btrim(v_client_state), '')) not in ('RJ', 'RIO DE JANEIRO') then raise exception 'vistoria presencial permitida apenas para unidades cadastradas no RJ'; end if;
  if v_subject is not null and length(v_subject) > 300 then raise exception 'subject muito longo'; end if;
  if v_starts_at is null or v_ends_at is null then raise exception 'horario obrigatorio'; end if;

  select array_agg(btrim(item.value)) into v_participant_names
  from jsonb_array_elements_text(coalesce(p_payload->'participant_names', '[]'::jsonb)) as item(value)
  where btrim(item.value) <> '';
  if coalesce(array_length(v_participant_names, 1), 0) > 50 then raise exception 'participant_names muito longo'; end if;

  v_duration_minutes := private.resolve_appointment_duration_minutes(v_appointment_type, v_duration_minutes, v_starts_at, v_ends_at);
  if v_starts_at < now() + interval '24 hours' then raise exception 'agendamento exige antecedencia minima de 24 horas'; end if;
  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
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
  if exists (select 1 from public.appointment_blocked_dates bd where bd.tenant_id = v_tenant_id and bd.day = v_starts_local::date) then raise exception 'horario indisponivel'; end if;
  if v_attendance_mode = 'presencial' and (v_district is null or v_municipality is null) then raise exception 'bairro e municipio sao obrigatorios para atendimento presencial'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_starts_local::date::text, 0));
  if private.appointment_has_conflict(v_tenant_id, v_starts_at, v_ends_at, null, null, null, null, interval '4 hours') then raise exception 'horario indisponivel' using errcode = 'exclusion_violation'; end if;

  insert into public.appointment_requests (
    tenant_id, client_id, unit_name, district, municipality, attendance_mode, responsible_name, phone, email,
    requested_date, requested_time, requested_period, requested_starts_at, requested_ends_at,
    appointment_type, subject, duration_minutes, participant_names, notes
  ) values (
    v_tenant_id, v_client_id, v_unit_name, v_district, v_municipality, v_attendance_mode,
    nullif(btrim(p_payload->>'responsible_name'), ''), nullif(btrim(p_payload->>'phone'), ''),
    nullif(btrim(p_payload->>'email'), ''), v_starts_local::date, to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at, v_ends_at, v_appointment_type, v_subject, v_duration_minutes, v_participant_names,
    nullif(btrim(p_payload->>'notes'), '')
  ) returning public_token into v_new_token;

  return jsonb_build_object('public_token', v_new_token);
end;
$$;

-- create or replace preserva a ACL; os grants ficam explicitos para o arquivo ser autossuficiente.
revoke all on function public.public_create_calendar_appointment_request(jsonb) from public;
grant execute on function public.public_create_calendar_appointment_request(jsonb) to anon, authenticated;
revoke all on function public.client_portal_create_appointment(jsonb) from public;
grant execute on function public.client_portal_create_appointment(jsonb) to anon, authenticated;
