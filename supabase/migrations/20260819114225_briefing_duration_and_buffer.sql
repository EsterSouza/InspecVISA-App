-- Briefing precisa reservar tempo de verdade e ter intervalo entre um e outro.
--
-- 1) Duracao. O canal publico so oferecia 15/30/45 minutos para briefing (o "primeiro contato"
--    com um lead). Na pratica isso e curto demais para a Ester conduzir a conversa; ela pediu
--    45 a 60 minutos. A constraint de banco e o resolvedor de duracao ganham 60 como opcao
--    valida, ADITIVO: 15/30/45 continuam aceitos para nao invalidar as ~15 solicitacoes ja
--    confirmadas em setembro/2026 com 30 minutos (e a de 18/08 com 15). O corte de verdade
--    acontece no front: `publicAppointmentDurations('briefing')` (src/utils/publicAppointmentForm.ts)
--    e `isAllowedAppointmentDuration` (src/utils/appointmentType.ts) passam a oferecer/aceitar
--    so 45 e 60 para agendamento NOVO. O default do resolvedor (usado quando as RPCs de listagem
--    consultam sem duracao) sobe de 30 para 45.
--
-- 2) Intervalo entre briefings. private.appointment_conflict_buffer_before/after so olhavam
--    attendance_mode (presencial 1h/3h, online 30min/2h -- 20260815215721). Briefing e sempre
--    online, entao herdava a margem de 2h depois pensada para reuniao online generica. Um
--    briefing de 15min as 9h30 bloqueava ate 11h45 -- o suficiente para varrer toda a grade da
--    manha (09:30-11:30), sobrando so a tarde. E o que aconteceu em producao em 18/08/2026
--    (schedules.id = 34b7e10a-9b14-42dc-91fb-e9f96c1278ec). As funcoes ganham p_appointment_type:
--    briefing agora e 30min antes / 30min depois -- o intervalo que a Ester pediu entre um
--    briefing e outro -- e os demais tipos continuam na regra por attendance_mode de antes.
--    Efeito colateral desejado (igual ao card anterior): briefing logo apos inspecao presencial
--    continua barrado, porque a margem grande e da inspecao (do lado do registro existente).
--
-- Rollback: recriar appointment_conflict_buffer_before/after com a assinatura de 2 argumentos
-- (texto do attendance_mode) da versao de 20260815215721.sql, refazer appointment_has_conflict
-- sem o argumento de appointment_type, e devolver resolve_appointment_duration_minutes e as
-- constraints de duration_minutes ao conjunto (15, 30, 45) / default 30 para briefing.

-- 1a. Duracao: 60 minutos passa a ser opcao valida para briefing (aditivo).
alter table public.appointment_requests
  drop constraint if exists appointment_requests_duration_minutes_check,
  add constraint appointment_requests_duration_minutes_check check (
    duration_minutes is null
    or (
      appointment_type = 'inspection'
      and duration_minutes between 15 and 720
    )
    or (
      appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'audit', 'online_followup')
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
      and duration_minutes in (15, 30, 45, 60)
    )
  );

alter table public.schedules
  drop constraint if exists schedules_duration_minutes_check,
  add constraint schedules_duration_minutes_check check (
    duration_minutes is null
    or (
      appointment_type = 'inspection'
      and duration_minutes between 15 and 720
    )
    or (
      appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'audit', 'online_followup')
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
      and duration_minutes in (15, 30, 45, 60)
    )
  );

-- 1b. Resolvedor de duracao: default de briefing sobe de 30 para 45; 60 passa a ser aceito.
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
    case v_type when 'inspection' then 60 when 'briefing' then 45 end);

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
  elsif v_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'audit', 'online_followup') then
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

-- 2a. Margem de conflito: agora depende do tipo do compromisso, alem da modalidade. Briefing
-- (sempre online) ganha regra propria de 30min/30min; os demais mantem a regra por
-- attendance_mode de 20260815215721 (presencial 1h/3h, online 30min/2h).
drop function if exists private.appointment_conflict_buffer_before(text, interval);
drop function if exists private.appointment_conflict_buffer_after(text, interval);

create function private.appointment_conflict_buffer_before(
  p_appointment_type text,
  p_attendance_mode text,
  p_max interval
)
returns interval
language sql
immutable
set search_path = ''
as $$
  select least(
    coalesce(p_max, interval '0 minutes'),
    case
      when p_appointment_type = 'briefing' then interval '30 minutes'
      when coalesce(nullif(p_attendance_mode, ''), 'presencial') = 'online' then interval '30 minutes'
      else interval '1 hour'
    end
  );
$$;

create function private.appointment_conflict_buffer_after(
  p_appointment_type text,
  p_attendance_mode text,
  p_max interval
)
returns interval
language sql
immutable
set search_path = ''
as $$
  select least(
    coalesce(p_max, interval '0 minutes'),
    case
      when p_appointment_type = 'briefing' then interval '30 minutes'
      when coalesce(nullif(p_attendance_mode, ''), 'presencial') = 'online' then interval '2 hours'
      else interval '3 hours'
    end
  );
$$;

-- 2b. appointment_has_conflict passa appointment_type para as funcoes de margem.
create or replace function private.appointment_has_conflict(
  p_tenant_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_consultant_names text[] default null,
  p_exclude_request_id uuid default null,
  p_exclude_schedule_id uuid default null,
  p_exclude_block_id uuid default null,
  p_public_buffer interval default interval '0 minutes'
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.appointment_blocks b
      where b.tenant_id = p_tenant_id
        and b.cancelled_at is null
        and (p_exclude_block_id is null or b.id <> p_exclude_block_id)
        and b.starts_at < p_ends_at
        and b.ends_at > p_starts_at
        and (
          coalesce(cardinality(p_consultant_names), 0) = 0
          or b.consultant_name is null
          or b.consultant_name = any(p_consultant_names)
        )
    )
    or exists (
      select 1
      from public.schedules s
      where s.tenant_id = p_tenant_id
        and s.deleted_at is null
        and s.status in ('pending', 'in_progress')
        and (p_exclude_schedule_id is null or s.id <> p_exclude_schedule_id)
        and s.scheduled_at
          < p_ends_at + private.appointment_conflict_buffer_before(s.appointment_type, s.attendance_mode, p_public_buffer)
        and s.scheduled_at + make_interval(mins => coalesce(s.duration_minutes, 60))
          > p_starts_at - private.appointment_conflict_buffer_after(s.appointment_type, s.attendance_mode, p_public_buffer)
        and (
          coalesce(cardinality(p_consultant_names), 0) = 0
          or coalesce(cardinality(s.consultant_names), 0) = 0
          or s.consultant_names && p_consultant_names
        )
    )
    or exists (
      select 1
      from public.appointment_requests ar
      where ar.tenant_id = p_tenant_id
        and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
        and ar.requested_starts_at is not null
        and ar.requested_ends_at is not null
        and (p_exclude_request_id is null or ar.id <> p_exclude_request_id)
        and (
          p_exclude_schedule_id is null
          or ar.schedule_id is distinct from p_exclude_schedule_id
        )
        -- Agenda vinculada excluida: a solicitacao e um fantasma, nao ocupa mais o horario.
        and not exists (
          select 1
          from public.schedules sd
          where sd.id = ar.schedule_id
            and sd.deleted_at is not null
        )
        and ar.requested_starts_at
          < p_ends_at + private.appointment_conflict_buffer_before(ar.appointment_type, ar.attendance_mode, p_public_buffer)
        and ar.requested_ends_at
          > p_starts_at - private.appointment_conflict_buffer_after(ar.appointment_type, ar.attendance_mode, p_public_buffer)
        and (
          coalesce(cardinality(p_consultant_names), 0) = 0
          or coalesce(cardinality(ar.consultant_names), 0) = 0
          or ar.consultant_names && p_consultant_names
        )
    );
$$;

-- 3. Mensagem de erro do canal publico citava o teto antigo de 45 minutos.
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
  v_consultant_names text[];
  v_starts_at timestamptz := nullif(p_payload->>'requested_starts_at', '')::timestamptz;
  v_ends_at timestamptz := nullif(p_payload->>'requested_ends_at', '')::timestamptz;
  v_starts_local timestamp;
  v_slot_minutes integer;
  v_token uuid;
begin
  if v_tenant_id is null then raise exception 'tenant_id e obrigatorio'; end if;

  -- Inspecao, reuniao, orientacao e treinamento exigem vinculo de cliente: so pelo portal.
  if v_appointment_type <> 'briefing' then
    raise exception 'este canal aceita apenas briefing de ate 60 minutos. entre no portal do cliente para os demais compromissos.';
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

  select array_agg(btrim(item.value)) into v_consultant_names
  from jsonb_array_elements_text(coalesce(p_payload->'consultant_names', '[]'::jsonb)) as item(value)
  where btrim(item.value) <> '';

  v_duration_minutes := private.resolve_appointment_duration_minutes(v_appointment_type, v_duration_minutes, v_starts_at, v_ends_at);
  if v_starts_at < now() + interval '24 hours' then raise exception 'agendamento exige antecedencia minima de 24 horas'; end if;
  if (select count(*) from public.appointment_requests ar where ar.tenant_id = v_tenant_id and ar.created_at > now() - interval '1 hour') >= 15 then
    raise exception 'muitas solicitacoes em pouco tempo. tente novamente mais tarde.';
  end if;

  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
  v_slot_minutes := extract(hour from v_starts_local) * 60 + extract(minute from v_starts_local);
  if extract(isodow from v_starts_local) not between 1 and 5 then raise exception 'agendamento permitido apenas de segunda a sexta'; end if;
  if not ((v_slot_minutes >= 570 and v_slot_minutes <= 690) or (v_slot_minutes >= 780 and v_slot_minutes <= 960)) then raise exception 'horario indisponivel'; end if;
  if not private.consultant_available(v_tenant_id, v_consultant_names, v_starts_at) then raise exception 'horario indisponivel'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_starts_local::date::text, 0));
  if private.appointment_has_conflict(v_tenant_id, v_starts_at, v_ends_at, v_consultant_names, null, null, null, interval '4 hours') then
    raise exception 'horario indisponivel' using errcode = 'exclusion_violation';
  end if;

  -- Briefing e sempre online: modalidade e endereco vindos do payload sao ignorados.
  insert into public.appointment_requests (
    tenant_id, unit_name, district, municipality, attendance_mode, responsible_name, phone, email,
    requested_date, requested_time, requested_period, requested_starts_at, requested_ends_at,
    appointment_type, subject, duration_minutes, participant_names, consultant_names, notes
  ) values (
    v_tenant_id, v_unit_name, 'Online', null, 'online',
    v_responsible_name, v_phone, nullif(btrim(p_payload->>'email'), ''),
    v_starts_local::date, to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at, v_ends_at, v_appointment_type, v_subject, v_duration_minutes, v_participant_names,
    v_consultant_names, nullif(btrim(p_payload->>'notes'), '')
  ) returning public_token into v_token;

  return jsonb_build_object('public_token', v_token);
end;
$$;

revoke all on function private.appointment_conflict_buffer_before(text, text, interval)
  from public, anon, authenticated;
revoke all on function private.appointment_conflict_buffer_after(text, text, interval)
  from public, anon, authenticated;
revoke all on function private.appointment_has_conflict(uuid, timestamptz, timestamptz, text[], uuid, uuid, uuid, interval)
  from public, anon, authenticated;
revoke all on function public.public_create_calendar_appointment_request(jsonb) from public;
grant execute on function public.public_create_calendar_appointment_request(jsonb) to anon, authenticated;
