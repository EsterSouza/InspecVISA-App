-- ============================================================
-- 015_optional_public_contact_fields.sql
-- WhatsApp, email e observacoes sao opcionais no portal publico
-- ============================================================

create or replace function public.public_create_calendar_appointment_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_tenant_id uuid := (p_payload->>'tenant_id')::uuid;
  v_unit_name text := trim(p_payload->>'unit_name');
  v_phone text := nullif(trim(p_payload->>'phone'), '');
  v_attendance_mode text := coalesce(nullif(trim(p_payload->>'attendance_mode'), ''), 'presencial');
  v_municipality text := nullif(trim(p_payload->>'municipality'), '');
  v_district text := nullif(trim(p_payload->>'district'), '');
  v_starts_at timestamptz := nullif(p_payload->>'requested_starts_at', '')::timestamptz;
  v_ends_at timestamptz := nullif(p_payload->>'requested_ends_at', '')::timestamptz;
  v_existing_client_id uuid := nullif(p_payload->>'existing_client_id', '')::uuid;
  v_token uuid;
begin
  if v_tenant_id is null then
    raise exception 'tenant_id e obrigatorio';
  end if;
  if v_unit_name is null or v_unit_name = '' then
    raise exception 'unit_name e obrigatorio';
  end if;
  if v_starts_at is null or v_ends_at is null then
    raise exception 'requested_starts_at e obrigatorio';
  end if;
  if extract(isodow from v_starts_at) not between 1 and 5 then
    raise exception 'agendamento permitido apenas de segunda a sexta';
  end if;
  if v_attendance_mode = 'presencial' and (v_district is null or v_municipality is null) then
    raise exception 'bairro e municipio sao obrigatorios para atendimento presencial';
  end if;
  if v_existing_client_id is not null and not exists (
    select 1
    from public.clients c
    where c.id = v_existing_client_id
      and c.tenant_id = v_tenant_id
      and c.deleted_at is null
  ) then
    raise exception 'cliente selecionado invalido';
  end if;

  if exists (
    select 1
    from public.schedules s
    where s.tenant_id = v_tenant_id
      and s.deleted_at is null
      and s.status in ('pending', 'in_progress')
      and s.scheduled_at >= v_starts_at
      and s.scheduled_at < v_ends_at
  ) or exists (
    select 1
    from public.appointment_requests ar
    where ar.tenant_id = v_tenant_id
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
      and ar.requested_starts_at is not null
      and ar.requested_starts_at >= v_starts_at
      and ar.requested_starts_at < v_ends_at
  ) then
    raise exception 'horario indisponivel';
  end if;

  insert into public.appointment_requests (
    tenant_id,
    client_id,
    unit_name,
    district,
    municipality,
    attendance_mode,
    responsible_name,
    phone,
    email,
    requested_date,
    requested_time,
    requested_period,
    requested_starts_at,
    requested_ends_at,
    matched_client_name,
    notes
  )
  values (
    v_tenant_id,
    v_existing_client_id,
    v_unit_name,
    v_district,
    v_municipality,
    v_attendance_mode,
    nullif(trim(p_payload->>'responsible_name'), ''),
    v_phone,
    nullif(trim(p_payload->>'email'), ''),
    v_starts_at::date,
    to_char(v_starts_at, 'HH24:MI'),
    case when extract(hour from v_starts_at) < 12 then 'manha' else 'tarde' end,
    v_starts_at,
    v_ends_at,
    nullif(trim(p_payload->>'matched_client_name'), ''),
    nullif(trim(p_payload->>'notes'), '')
  )
  returning public_token into v_token;

  return jsonb_build_object('public_token', v_token);
end;
$$;

grant execute on function public.public_create_calendar_appointment_request(jsonb) to anon;

create or replace function public.public_create_appointment_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_name text;
  v_district text;
  v_phone text;
  v_tenant_id uuid;
  v_slot_id uuid;
  v_token uuid;
  v_slot_available integer;
begin
  v_unit_name := trim(p_payload->>'unit_name');
  v_district := trim(p_payload->>'district');
  v_phone := nullif(trim(p_payload->>'phone'), '');
  v_tenant_id := (p_payload->>'tenant_id')::uuid;

  if v_unit_name is null or v_unit_name = '' then
    raise exception 'unit_name e obrigatorio';
  end if;
  if v_district is null or v_district = '' then
    raise exception 'district e obrigatorio';
  end if;
  if v_tenant_id is null then
    raise exception 'tenant_id e obrigatorio';
  end if;

  v_slot_id := nullif(p_payload->>'slot_id', '')::uuid;
  if v_slot_id is not null then
    select (capacity - booked_count) into v_slot_available
    from public.appointment_slots
    where id = v_slot_id and tenant_id = v_tenant_id and status = 'available';

    if v_slot_available is null or v_slot_available <= 0 then
      raise exception 'slot indisponivel ou inexistente';
    end if;

    update public.appointment_slots
    set booked_count = booked_count + 1,
        status = case when (capacity - booked_count - 1) <= 0 then 'full' else 'available' end,
        updated_at = now()
    where id = v_slot_id;
  end if;

  insert into public.appointment_requests (
    tenant_id, slot_id, unit_name, district,
    responsible_name, phone, email,
    requested_date, requested_period, notes
  ) values (
    v_tenant_id,
    v_slot_id,
    v_unit_name,
    v_district,
    nullif(trim(p_payload->>'responsible_name'), ''),
    v_phone,
    nullif(trim(p_payload->>'email'), ''),
    nullif(p_payload->>'requested_date', '')::date,
    nullif(trim(p_payload->>'requested_period'), ''),
    nullif(trim(p_payload->>'notes'), '')
  )
  returning public_token into v_token;

  return jsonb_build_object('public_token', v_token);
end;
$$;

grant execute on function public.public_create_appointment_request(jsonb) to anon;
