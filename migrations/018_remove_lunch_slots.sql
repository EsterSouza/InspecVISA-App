-- ============================================================
-- 018_remove_lunch_slots.sql
-- Remove os horarios de almoco (12:00 e 12:30) do calendario publico.
-- Atendimento: 09:30-11:30 e 13:00-16:00 (almoco 12h-13h).
-- Redefine as 3 funcoes mantendo bloqueio por datas (017) e janela 4h.
-- ============================================================

create or replace function public.public_list_calendar_days(
  p_tenant_id uuid,
  p_start_date date default current_date,
  p_days integer default 45
)
returns table (
  day date,
  weekday integer,
  available_count integer
)
language sql
security definer
set search_path = public, private
as $$
  with days as (
    select generate_series(
      greatest(p_start_date, current_date),
      greatest(p_start_date, current_date) + make_interval(days => least(greatest(p_days, 1), 90) - 1),
      interval '1 day'
    )::date as day
  ),
  business_days as (
    select day
    from days
    where extract(isodow from day) between 1 and 5
      and not exists (
        select 1 from public.appointment_blocked_dates bd
        where bd.tenant_id = p_tenant_id and bd.day = days.day
      )
  ),
  default_slots as (
    select
      bd.day,
      (bd.day::timestamp + slot_time) at time zone 'America/Sao_Paulo' as starts_at
    from business_days bd
    cross join (values
      (time '09:30'), (time '10:00'), (time '10:30'), (time '11:00'),
      (time '11:30'), (time '13:00'),
      (time '13:30'), (time '14:00'), (time '14:30'), (time '15:00'),
      (time '15:30'), (time '16:00')
    ) as s(slot_time)
  ),
  busy as (
    select s.scheduled_at as starts_at
    from public.schedules s
    where s.tenant_id = p_tenant_id
      and s.deleted_at is null
      and s.status in ('pending', 'in_progress')
      and s.scheduled_at >= greatest(p_start_date, current_date)::timestamptz - interval '4 hours'
    union all
    select ar.requested_starts_at
    from public.appointment_requests ar
    where ar.tenant_id = p_tenant_id
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
      and ar.requested_starts_at is not null
      and ar.requested_starts_at >= greatest(p_start_date, current_date)::timestamptz - interval '4 hours'
  )
  select
    ds.day,
    extract(isodow from ds.day)::integer as weekday,
    count(*) filter (
      where ds.starts_at > now()
        and not exists (
          select 1 from busy b
          where b.starts_at > ds.starts_at - interval '4 hours'
            and b.starts_at < ds.starts_at + interval '4 hours'
        )
    )::integer as available_count
  from default_slots ds
  group by ds.day
  having count(*) filter (
    where ds.starts_at > now()
      and not exists (
        select 1 from busy b
        where b.starts_at > ds.starts_at - interval '4 hours'
          and b.starts_at < ds.starts_at + interval '4 hours'
      )
  ) > 0
  order by ds.day;
$$;

create or replace function public.public_list_available_times(
  p_tenant_id uuid,
  p_day date
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  label text
)
language sql
security definer
set search_path = public, private
as $$
  with default_slots as (
    select
      (p_day::timestamp + slot_time) at time zone 'America/Sao_Paulo' as starts_at,
      (p_day::timestamp + slot_time + interval '1 hour') at time zone 'America/Sao_Paulo' as ends_at,
      to_char(slot_time, 'HH24:MI') as label
    from (values
      (time '09:30'), (time '10:00'), (time '10:30'), (time '11:00'),
      (time '11:30'), (time '13:00'),
      (time '13:30'), (time '14:00'), (time '14:30'), (time '15:00'),
      (time '15:30'), (time '16:00')
    ) as s(slot_time)
    where extract(isodow from p_day) between 1 and 5
      and not exists (
        select 1 from public.appointment_blocked_dates bd
        where bd.tenant_id = p_tenant_id and bd.day = p_day
      )
  ),
  busy as (
    select s.scheduled_at as starts_at
    from public.schedules s
    where s.tenant_id = p_tenant_id
      and s.deleted_at is null
      and s.status in ('pending', 'in_progress')
      and (s.scheduled_at at time zone 'America/Sao_Paulo')::date = p_day
    union all
    select ar.requested_starts_at
    from public.appointment_requests ar
    where ar.tenant_id = p_tenant_id
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
      and ar.requested_starts_at is not null
      and (ar.requested_starts_at at time zone 'America/Sao_Paulo')::date = p_day
  )
  select ds.starts_at, ds.ends_at, ds.label
  from default_slots ds
  where ds.starts_at > now()
    and not exists (
      select 1 from busy b
      where b.starts_at > ds.starts_at - interval '4 hours'
        and b.starts_at < ds.starts_at + interval '4 hours'
    )
  order by ds.starts_at;
$$;

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
  v_starts_local timestamp;
  v_slot_minutes integer;
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

  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
  v_slot_minutes := extract(hour from v_starts_local) * 60 + extract(minute from v_starts_local);

  if extract(isodow from v_starts_local) not between 1 and 5 then
    raise exception 'agendamento permitido apenas de segunda a sexta';
  end if;
  -- Janela valida: 09:30-11:30 e 13:00-16:00 (almoco 12h-13h)
  if not (
    (v_slot_minutes >= 570 and v_slot_minutes <= 690) or
    (v_slot_minutes >= 780 and v_slot_minutes <= 960)
  ) then
    raise exception 'horario indisponivel';
  end if;
  if exists (
    select 1 from public.appointment_blocked_dates bd
    where bd.tenant_id = v_tenant_id and bd.day = v_starts_local::date
  ) then
    raise exception 'horario indisponivel';
  end if;
  if v_attendance_mode = 'presencial' and (v_district is null or v_municipality is null) then
    raise exception 'bairro e municipio sao obrigatorios para atendimento presencial';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_tenant_id::text || v_starts_local::date::text));

  if exists (
    select 1
    from public.schedules s
    where s.tenant_id = v_tenant_id
      and s.deleted_at is null
      and s.status in ('pending', 'in_progress')
      and s.scheduled_at > v_starts_at - interval '4 hours'
      and s.scheduled_at < v_starts_at + interval '4 hours'
  ) or exists (
    select 1
    from public.appointment_requests ar
    where ar.tenant_id = v_tenant_id
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
      and ar.requested_starts_at is not null
      and ar.requested_starts_at > v_starts_at - interval '4 hours'
      and ar.requested_starts_at < v_starts_at + interval '4 hours'
  ) then
    raise exception 'horario indisponivel';
  end if;

  insert into public.appointment_requests (
    tenant_id, unit_name, district, municipality, attendance_mode,
    responsible_name, phone, email,
    requested_date, requested_time, requested_period,
    requested_starts_at, requested_ends_at, notes
  )
  values (
    v_tenant_id,
    v_unit_name,
    v_district,
    v_municipality,
    v_attendance_mode,
    nullif(trim(p_payload->>'responsible_name'), ''),
    v_phone,
    nullif(trim(p_payload->>'email'), ''),
    v_starts_local::date,
    to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at,
    v_ends_at,
    nullif(trim(p_payload->>'notes'), '')
  )
  returning public_token into v_token;

  return jsonb_build_object('public_token', v_token);
end;
$$;

grant execute on function public.public_create_calendar_appointment_request(jsonb) to anon;
