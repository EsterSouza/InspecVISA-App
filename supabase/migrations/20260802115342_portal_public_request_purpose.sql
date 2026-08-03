-- P360-006: persiste os dados próprios de solicitações multiuso.
-- As regras geográficas existentes de atendimento presencial continuam iguais.
-- Rollback: recriar as versões de P360-005 sem as colunas subject/participant_names.

create or replace function public.public_create_calendar_appointment_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := nullif(p_payload->>'tenant_id', '')::uuid;
  v_unit_name text := btrim(p_payload->>'unit_name');
  v_phone text := nullif(btrim(p_payload->>'phone'), '');
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
  v_token uuid;
begin
  if v_tenant_id is null then raise exception 'tenant_id e obrigatorio'; end if;
  if v_unit_name is null or v_unit_name = '' then raise exception 'unit_name e obrigatorio'; end if;
  if length(v_unit_name) > 200 then raise exception 'unit_name muito longo'; end if;
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
  if v_attendance_mode = 'presencial' and (v_district is null or v_municipality is null) then raise exception 'bairro e municipio sao obrigatorios para atendimento presencial'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_starts_local::date::text, 0));
  if private.appointment_has_conflict(v_tenant_id, v_starts_at, v_ends_at, null, null, null, null, interval '4 hours') then
    raise exception 'horario indisponivel' using errcode = 'exclusion_violation';
  end if;

  insert into public.appointment_requests (
    tenant_id, unit_name, district, municipality, attendance_mode, responsible_name, phone, email,
    requested_date, requested_time, requested_period, requested_starts_at, requested_ends_at,
    appointment_type, subject, duration_minutes, participant_names, notes
  ) values (
    v_tenant_id, v_unit_name, v_district, v_municipality, v_attendance_mode,
    nullif(btrim(p_payload->>'responsible_name'), ''), v_phone, nullif(btrim(p_payload->>'email'), ''),
    v_starts_local::date, to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at, v_ends_at, v_appointment_type, v_subject, v_duration_minutes, v_participant_names,
    nullif(btrim(p_payload->>'notes'), '')
  ) returning public_token into v_token;

  return jsonb_build_object('public_token', v_token);
end;
$$;

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
