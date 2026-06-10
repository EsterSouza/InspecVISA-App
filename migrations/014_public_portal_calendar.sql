-- ============================================================
-- 014_public_portal_calendar.sql
-- Portal permanente com calendario calculado por agenda real
-- ============================================================

alter table public.appointment_requests
  add column if not exists attendance_mode text
    check (attendance_mode in ('presencial', 'online')),
  add column if not exists municipality text,
  add column if not exists requested_starts_at timestamptz,
  add column if not exists requested_ends_at timestamptz,
  add column if not exists matched_client_name text;

create index if not exists idx_appointment_requests_tenant_requested_starts
  on public.appointment_requests(tenant_id, requested_starts_at)
  where requested_starts_at is not null;

create index if not exists idx_appointment_requests_tenant_public_token
  on public.appointment_requests(tenant_id, public_token);

-- Horarios padrao exibidos ao cliente em dias uteis.
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
  ),
  default_slots as (
    select
      bd.day,
      slot_time::time as slot_time,
      (bd.day::timestamp + slot_time) at time zone 'America/Sao_Paulo' as starts_at
    from business_days bd
    cross join (values
      (time '09:30'),
      (time '10:00'),
      (time '10:30'),
      (time '11:00'),
      (time '11:30'),
      (time '12:00'),
      (time '12:30'),
      (time '13:00'),
      (time '13:30'),
      (time '14:00'),
      (time '14:30'),
      (time '15:00'),
      (time '15:30'),
      (time '16:00')
    ) as s(slot_time)
  ),
  busy as (
    select s.scheduled_at as starts_at
    from public.schedules s
    where s.tenant_id = p_tenant_id
      and s.deleted_at is null
      and s.status in ('pending', 'in_progress')
      and s.scheduled_at >= greatest(p_start_date, current_date)::timestamptz
    union all
    select ar.requested_starts_at
    from public.appointment_requests ar
    where ar.tenant_id = p_tenant_id
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
      and ar.requested_starts_at is not null
      and ar.requested_starts_at >= greatest(p_start_date, current_date)::timestamptz
  )
  select
    ds.day,
    extract(isodow from ds.day)::integer as weekday,
    count(*) filter (
      where ds.starts_at > now()
        and not exists (
          select 1
          from busy b
          where b.starts_at >= ds.starts_at
            and b.starts_at < ds.starts_at + interval '1 hour'
        )
    )::integer as available_count
  from default_slots ds
  group by ds.day
  having count(*) filter (
    where ds.starts_at > now()
      and not exists (
        select 1
        from busy b
        where b.starts_at >= ds.starts_at
          and b.starts_at < ds.starts_at + interval '1 hour'
      )
  ) > 0
  order by ds.day;
$$;

grant execute on function public.public_list_calendar_days(uuid, date, integer) to anon;

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
      (time '09:30'),
      (time '10:00'),
      (time '10:30'),
      (time '11:00'),
      (time '11:30'),
      (time '12:00'),
      (time '12:30'),
      (time '13:00'),
      (time '13:30'),
      (time '14:00'),
      (time '14:30'),
      (time '15:00'),
      (time '15:30'),
      (time '16:00')
    ) as s(slot_time)
    where extract(isodow from p_day) between 1 and 5
  ),
  busy as (
    select s.scheduled_at as starts_at
    from public.schedules s
    where s.tenant_id = p_tenant_id
      and s.deleted_at is null
      and s.status in ('pending', 'in_progress')
      and s.scheduled_at::date = p_day
    union all
    select ar.requested_starts_at
    from public.appointment_requests ar
    where ar.tenant_id = p_tenant_id
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
      and ar.requested_starts_at is not null
      and ar.requested_starts_at::date = p_day
  )
  select ds.starts_at, ds.ends_at, ds.label
  from default_slots ds
  where ds.starts_at > now()
    and not exists (
      select 1
      from busy b
      where b.starts_at >= ds.starts_at
        and b.starts_at < ds.ends_at
    )
  order by ds.starts_at;
$$;

grant execute on function public.public_list_available_times(uuid, date) to anon;

create or replace function public.public_search_clients(
  p_tenant_id uuid,
  p_query text
)
returns table (
  id uuid,
  name text,
  city text,
  state text
)
language sql
security definer
set search_path = public, private
as $$
  select c.id, c.name, c.city, c.state
  from public.clients c
  where c.tenant_id = p_tenant_id
    and c.deleted_at is null
    and length(trim(coalesce(p_query, ''))) >= 2
    and c.name ilike '%' || trim(p_query) || '%'
  order by c.name
  limit 8;
$$;

grant execute on function public.public_search_clients(uuid, text) to anon;

create or replace function public.public_create_calendar_appointment_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_tenant_id uuid := (p_payload->>'tenant_id')::uuid;
  v_unit_name text := trim(p_payload->>'unit_name');
  v_phone text := trim(p_payload->>'phone');
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
  if v_phone is null or v_phone = '' then
    raise exception 'phone e obrigatorio';
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

create or replace function public.public_get_appointment_status(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row public.appointment_requests%rowtype;
begin
  select * into v_row
  from public.appointment_requests
  where public_token = p_token;

  if not found then
    return jsonb_build_object('error', 'token invalido');
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'unit_name', v_row.unit_name,
    'district', v_row.district,
    'municipality', v_row.municipality,
    'attendance_mode', v_row.attendance_mode,
    'status', v_row.status,
    'requested_date', v_row.requested_date,
    'requested_time', v_row.requested_time,
    'requested_period', v_row.requested_period,
    'requested_starts_at', v_row.requested_starts_at,
    'requested_ends_at', v_row.requested_ends_at,
    'report_due_at', v_row.report_due_at,
    'report_due_source', v_row.report_due_source,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.public_get_appointment_status(uuid) to anon;
