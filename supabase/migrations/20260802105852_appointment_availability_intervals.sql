-- P360-005: disponibilidade por intervalo real, bloqueios parciais e concorrencia.
-- A agenda da equipe nao recebe a trava publica de 24h/4h. O portal continua
-- exigindo 24h de antecedencia e quatro horas livres ao redor de demandas.

update public.schedules
set duration_minutes = 60
where duration_minutes is null;

alter table public.schedules
  alter column duration_minutes set default 60;

alter table public.appointment_requests
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
  ),
  drop constraint if exists appointment_requests_interval_check,
  add constraint appointment_requests_interval_check check (
    (requested_starts_at is null and requested_ends_at is null)
    or (
      requested_starts_at is not null
      and requested_ends_at is not null
      and requested_ends_at > requested_starts_at
      and (requested_ends_at at time zone 'America/Sao_Paulo')::date
        = (requested_starts_at at time zone 'America/Sao_Paulo')::date
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
  );

create table public.appointment_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  recurrence_group_id uuid,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  occurrence_index integer not null default 1 check (occurrence_index > 0),
  occurrence_count integer not null default 1
    check (occurrence_count between 1 and 52),
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_blocks_interval_check check (
    ends_at > starts_at
    and extract(epoch from (ends_at - starts_at)) between 900 and 43200
    and (ends_at at time zone 'America/Sao_Paulo')::date
      = (starts_at at time zone 'America/Sao_Paulo')::date
  ),
  constraint appointment_blocks_recurrence_group_check check (
    (recurrence = 'none' and occurrence_count = 1 and recurrence_group_id is null)
    or (recurrence <> 'none' and recurrence_group_id is not null)
  )
);

comment on table public.appointment_blocks is
  'Bloqueios internos parciais sem cliente. Cada recorrencia e uma linha cancelavel isoladamente.';
comment on column public.appointment_blocks.reason is
  'Motivo interno opcional; nunca e retornado pelas RPCs publicas de disponibilidade.';

alter table public.appointment_blocks enable row level security;

create policy "staff manage appointment blocks"
  on public.appointment_blocks
  for all
  to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  )
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

revoke all on table public.appointment_blocks from public, anon, authenticated;
grant select, insert, update on table public.appointment_blocks to authenticated;

create index idx_appointment_blocks_tenant_interval
  on public.appointment_blocks (tenant_id, starts_at, ends_at)
  where cancelled_at is null;

create index idx_appointment_blocks_recurrence_group
  on public.appointment_blocks (tenant_id, recurrence_group_id)
  where recurrence_group_id is not null;

create index if not exists idx_appointment_requests_tenant_active_interval
  on public.appointment_requests (tenant_id, requested_starts_at, requested_ends_at)
  where status in ('requested', 'confirmed', 'in_progress', 'rescheduled');

create index if not exists idx_schedules_tenant_active_interval
  on public.schedules (tenant_id, scheduled_at)
  where deleted_at is null and status in ('pending', 'in_progress');

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

  v_duration := coalesce(p_duration_minutes, v_derived,
    case when v_type = 'inspection' then 60 end);

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
  else
    raise exception 'tipo de compromisso invalido'
      using errcode = 'check_violation';
  end if;

  return v_duration;
end;
$$;

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
    )
    or exists (
      select 1
      from public.schedules s
      where s.tenant_id = p_tenant_id
        and s.deleted_at is null
        and s.status in ('pending', 'in_progress')
        and (p_exclude_schedule_id is null or s.id <> p_exclude_schedule_id)
        and s.scheduled_at < p_ends_at + p_public_buffer
        and s.scheduled_at + make_interval(mins => coalesce(s.duration_minutes, 60))
          > p_starts_at - p_public_buffer
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
        and ar.requested_starts_at < p_ends_at + p_public_buffer
        and ar.requested_ends_at > p_starts_at - p_public_buffer
        and (
          coalesce(cardinality(p_consultant_names), 0) = 0
          or coalesce(cardinality(ar.consultant_names), 0) = 0
          or ar.consultant_names && p_consultant_names
        )
    );
$$;

create or replace function private.enforce_appointment_request_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requested_starts_at is null and new.requested_ends_at is null then
    if new.status in ('requested', 'confirmed', 'in_progress', 'rescheduled') then
      raise exception 'compromisso ativo exige horario inicial e final'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.requested_starts_at is null or new.requested_ends_at is null then
    raise exception 'horario inicial e final devem ser informados juntos'
      using errcode = 'check_violation';
  end if;

  new.duration_minutes := private.resolve_appointment_duration_minutes(
    new.appointment_type,
    new.duration_minutes,
    new.requested_starts_at,
    new.requested_ends_at
  );

  if new.status not in ('requested', 'confirmed', 'in_progress', 'rescheduled') then
    return new;
  end if;
  if new.tenant_id is null then
    raise exception 'tenant_id obrigatorio para compromisso ativo'
      using errcode = 'not_null_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    new.tenant_id::text || ':' ||
    ((new.requested_starts_at at time zone 'America/Sao_Paulo')::date)::text,
    0
  ));

  if private.appointment_has_conflict(
    new.tenant_id,
    new.requested_starts_at,
    new.requested_ends_at,
    new.consultant_names,
    new.id,
    new.schedule_id,
    null,
    interval '0 minutes'
  ) then
    raise exception 'horario indisponivel'
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_schedule_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ends_at timestamptz;
begin
  new.duration_minutes := private.resolve_appointment_duration_minutes(
    new.appointment_type,
    new.duration_minutes
  );
  v_ends_at := new.scheduled_at + make_interval(mins => new.duration_minutes);

  if (v_ends_at at time zone 'America/Sao_Paulo')::date
     <> (new.scheduled_at at time zone 'America/Sao_Paulo')::date then
    raise exception 'o compromisso deve terminar no mesmo dia em America/Sao_Paulo'
      using errcode = 'check_violation';
  end if;

  if new.deleted_at is not null or new.status not in ('pending', 'in_progress') then
    return new;
  end if;
  if new.tenant_id is null then
    raise exception 'tenant_id obrigatorio para compromisso ativo'
      using errcode = 'not_null_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    new.tenant_id::text || ':' ||
    ((new.scheduled_at at time zone 'America/Sao_Paulo')::date)::text,
    0
  ));

  if private.appointment_has_conflict(
    new.tenant_id,
    new.scheduled_at,
    v_ends_at,
    new.consultant_names,
    null,
    new.id,
    null,
    interval '0 minutes'
  ) then
    raise exception 'horario indisponivel'
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_appointment_block_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if new.cancelled_at is not null then
    if new.cancelled_by is null then
      new.cancelled_by := auth.uid();
    end if;
    return new;
  end if;
  if new.ends_at <= new.starts_at
     or extract(epoch from (new.ends_at - new.starts_at)) not between 900 and 43200
     or (new.ends_at at time zone 'America/Sao_Paulo')::date
        <> (new.starts_at at time zone 'America/Sao_Paulo')::date then
    raise exception 'bloqueio exige intervalo de 15 a 720 minutos no mesmo dia'
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    new.tenant_id::text || ':' ||
    ((new.starts_at at time zone 'America/Sao_Paulo')::date)::text,
    0
  ));

  if private.appointment_has_conflict(
    new.tenant_id,
    new.starts_at,
    new.ends_at,
    null,
    null,
    null,
    new.id,
    interval '0 minutes'
  ) then
    raise exception 'horario indisponivel'
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_appointment_request_availability
  on public.appointment_requests;
create trigger enforce_appointment_request_availability
before insert or update of
  tenant_id,
  status,
  appointment_type,
  duration_minutes,
  requested_starts_at,
  requested_ends_at,
  consultant_names,
  schedule_id
on public.appointment_requests
for each row execute function private.enforce_appointment_request_availability();

drop trigger if exists enforce_schedule_availability on public.schedules;
create trigger enforce_schedule_availability
before insert or update of
  tenant_id,
  status,
  appointment_type,
  duration_minutes,
  scheduled_at,
  consultant_names,
  deleted_at
on public.schedules
for each row execute function private.enforce_schedule_availability();

create trigger enforce_appointment_block_availability
before insert or update of
  tenant_id,
  starts_at,
  ends_at,
  cancelled_at
on public.appointment_blocks
for each row execute function private.enforce_appointment_block_availability();

create or replace function private.appointment_recurrence_start(
  p_base_starts_at timestamptz,
  p_recurrence text,
  p_occurrence_index integer
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base_local timestamp := p_base_starts_at at time zone 'America/Sao_Paulo';
  v_target_month date;
  v_target_date date;
  v_last_day integer;
begin
  if p_occurrence_index < 0 then
    raise exception 'indice de recorrencia invalido'
      using errcode = 'check_violation';
  end if;
  if p_recurrence = 'none' then
    if p_occurrence_index <> 0 then
      raise exception 'recorrencia none aceita apenas uma ocorrencia'
        using errcode = 'check_violation';
    end if;
    return p_base_starts_at;
  elsif p_recurrence = 'daily' then
    return (v_base_local + make_interval(days => p_occurrence_index))
      at time zone 'America/Sao_Paulo';
  elsif p_recurrence = 'weekly' then
    return (v_base_local + make_interval(days => p_occurrence_index * 7))
      at time zone 'America/Sao_Paulo';
  elsif p_recurrence = 'monthly' then
    v_target_month := (
      date_trunc('month', v_base_local) + make_interval(months => p_occurrence_index)
    )::date;
    v_last_day := extract(day from (v_target_month + interval '1 month - 1 day'))::integer;
    v_target_date := v_target_month
      + least(extract(day from v_base_local)::integer, v_last_day) - 1;
    return (v_target_date + v_base_local::time) at time zone 'America/Sao_Paulo';
  end if;

  raise exception 'recorrencia invalida'
    using errcode = 'check_violation';
end;
$$;

create or replace function public.admin_create_appointment_blocks(
  p_tenant_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_reason text default null,
  p_recurrence text default 'none',
  p_occurrences integer default 1
)
returns setof public.appointment_blocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_index integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_row public.appointment_blocks%rowtype;
begin
  if not (
    p_tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(p_tenant_id)
  ) then
    raise exception 'acesso negado'
      using errcode = 'insufficient_privilege';
  end if;
  if p_duration_minutes not between 15 and 720 then
    raise exception 'duracao do bloqueio deve ficar entre 15 e 720 minutos'
      using errcode = 'check_violation';
  end if;
  if p_recurrence not in ('none', 'daily', 'weekly', 'monthly') then
    raise exception 'recorrencia invalida'
      using errcode = 'check_violation';
  end if;
  if p_occurrences not between 1 and 52
     or (p_recurrence = 'none' and p_occurrences <> 1) then
    raise exception 'quantidade de ocorrencias invalida'
      using errcode = 'check_violation';
  end if;

  v_group_id := case when p_occurrences > 1 then gen_random_uuid() end;

  for v_index in 0..p_occurrences - 1 loop
    v_starts_at := private.appointment_recurrence_start(
      p_starts_at,
      p_recurrence,
      v_index
    );
    v_ends_at := v_starts_at + make_interval(mins => p_duration_minutes);

    insert into public.appointment_blocks (
      tenant_id,
      starts_at,
      ends_at,
      reason,
      recurrence_group_id,
      recurrence,
      occurrence_index,
      occurrence_count,
      created_by
    ) values (
      p_tenant_id,
      v_starts_at,
      v_ends_at,
      nullif(btrim(coalesce(p_reason, '')), ''),
      v_group_id,
      p_recurrence,
      v_index + 1,
      p_occurrences,
      auth.uid()
    )
    returning * into v_row;

    return next v_row;
  end loop;
end;
$$;

-- A assinatura antiga e removida para evitar ambiguidade no PostgREST.
drop function if exists public.public_list_calendar_days(uuid, date, integer);
create function public.public_list_calendar_days(
  p_tenant_id uuid,
  p_start_date date default ((now() at time zone 'America/Sao_Paulo')::date),
  p_days integer default 45,
  p_appointment_type text default 'inspection',
  p_duration_minutes integer default null
)
returns table (
  day date,
  weekday integer,
  available_count integer
)
language sql
security definer
set search_path = ''
as $$
  with params as (
    select private.resolve_appointment_duration_minutes(
      p_appointment_type,
      p_duration_minutes
    ) as duration_minutes
  ),
  days as (
    select generate_series(
      greatest(p_start_date, (now() at time zone 'America/Sao_Paulo')::date),
      greatest(p_start_date, (now() at time zone 'America/Sao_Paulo')::date)
        + make_interval(days => least(greatest(p_days, 1), 90) - 1),
      interval '1 day'
    )::date as day
  ),
  default_slots as (
    select
      d.day,
      (d.day::timestamp + s.slot_time) at time zone 'America/Sao_Paulo' as starts_at,
      (d.day::timestamp + s.slot_time + make_interval(mins => p.duration_minutes))
        at time zone 'America/Sao_Paulo' as ends_at
    from days d
    cross join params p
    cross join (values
      (time '09:30'), (time '10:00'), (time '10:30'), (time '11:00'),
      (time '11:30'), (time '13:00'), (time '13:30'), (time '14:00'),
      (time '14:30'), (time '15:00'), (time '15:30'), (time '16:00')
    ) as s(slot_time)
    where extract(isodow from d.day) between 1 and 5
      and not exists (
        select 1
        from public.appointment_blocked_dates bd
        where bd.tenant_id = p_tenant_id and bd.day = d.day
      )
  )
  select
    ds.day,
    extract(isodow from ds.day)::integer as weekday,
    count(*)::integer as available_count
  from default_slots ds
  where ds.starts_at >= now() + interval '24 hours'
    and not private.appointment_has_conflict(
      p_tenant_id,
      ds.starts_at,
      ds.ends_at,
      null,
      null,
      null,
      null,
      interval '4 hours'
    )
  group by ds.day
  having count(*) > 0
  order by ds.day;
$$;

drop function if exists public.public_list_available_times(uuid, date);
create function public.public_list_available_times(
  p_tenant_id uuid,
  p_day date,
  p_appointment_type text default 'inspection',
  p_duration_minutes integer default null
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  label text
)
language sql
security definer
set search_path = ''
as $$
  with params as (
    select private.resolve_appointment_duration_minutes(
      p_appointment_type,
      p_duration_minutes
    ) as duration_minutes
  ),
  default_slots as (
    select
      (p_day::timestamp + s.slot_time) at time zone 'America/Sao_Paulo' as starts_at,
      (p_day::timestamp + s.slot_time + make_interval(mins => p.duration_minutes))
        at time zone 'America/Sao_Paulo' as ends_at,
      to_char(s.slot_time, 'HH24:MI') as label
    from params p
    cross join (values
      (time '09:30'), (time '10:00'), (time '10:30'), (time '11:00'),
      (time '11:30'), (time '13:00'), (time '13:30'), (time '14:00'),
      (time '14:30'), (time '15:00'), (time '15:30'), (time '16:00')
    ) as s(slot_time)
    where extract(isodow from p_day) between 1 and 5
      and not exists (
        select 1
        from public.appointment_blocked_dates bd
        where bd.tenant_id = p_tenant_id and bd.day = p_day
      )
  )
  select ds.starts_at, ds.ends_at, ds.label
  from default_slots ds
  where ds.starts_at >= now() + interval '24 hours'
    and not private.appointment_has_conflict(
      p_tenant_id,
      ds.starts_at,
      ds.ends_at,
      null,
      null,
      null,
      null,
      interval '4 hours'
    )
  order by ds.starts_at;
$$;

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
  if length(v_unit_name) > 200 then
    raise exception 'unit_name muito longo';
  end if;
  if v_starts_at is null or v_ends_at is null then
    raise exception 'requested_starts_at e requested_ends_at sao obrigatorios';
  end if;

  v_duration_minutes := private.resolve_appointment_duration_minutes(
    v_appointment_type,
    v_duration_minutes,
    v_starts_at,
    v_ends_at
  );
  if v_starts_at < now() + interval '24 hours' then
    raise exception 'agendamento exige antecedencia minima de 24 horas';
  end if;

  if (
    select count(*)
    from public.appointment_requests ar
    where ar.tenant_id = v_tenant_id
      and ar.created_at > now() - interval '1 hour'
  ) >= 15 then
    raise exception 'muitas solicitacoes em pouco tempo. tente novamente mais tarde.';
  end if;

  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
  v_slot_minutes := extract(hour from v_starts_local) * 60
    + extract(minute from v_starts_local);

  if extract(isodow from v_starts_local) not between 1 and 5 then
    raise exception 'agendamento permitido apenas de segunda a sexta';
  end if;
  if not (
    (v_slot_minutes >= 570 and v_slot_minutes <= 690)
    or (v_slot_minutes >= 780 and v_slot_minutes <= 960)
  ) then
    raise exception 'horario indisponivel';
  end if;
  if exists (
    select 1
    from public.appointment_blocked_dates bd
    where bd.tenant_id = v_tenant_id
      and bd.day = v_starts_local::date
  ) then
    raise exception 'horario indisponivel';
  end if;
  if v_attendance_mode = 'presencial'
     and (v_district is null or v_municipality is null) then
    raise exception 'bairro e municipio sao obrigatorios para atendimento presencial';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_tenant_id::text || ':' || v_starts_local::date::text,
    0
  ));
  if private.appointment_has_conflict(
    v_tenant_id,
    v_starts_at,
    v_ends_at,
    null,
    null,
    null,
    null,
    interval '4 hours'
  ) then
    raise exception 'horario indisponivel'
      using errcode = 'exclusion_violation';
  end if;

  insert into public.appointment_requests (
    tenant_id,
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
    appointment_type,
    duration_minutes,
    notes
  ) values (
    v_tenant_id,
    v_unit_name,
    v_district,
    v_municipality,
    v_attendance_mode,
    nullif(btrim(p_payload->>'responsible_name'), ''),
    v_phone,
    nullif(btrim(p_payload->>'email'), ''),
    v_starts_local::date,
    to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at,
    v_ends_at,
    v_appointment_type,
    v_duration_minutes,
    nullif(btrim(p_payload->>'notes'), '')
  )
  returning public_token into v_token;

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
  v_starts_at timestamptz := nullif(p_payload->>'requested_starts_at', '')::timestamptz;
  v_ends_at timestamptz := nullif(p_payload->>'requested_ends_at', '')::timestamptz;
  v_starts_local timestamp;
  v_slot_minutes integer;
  v_new_token uuid;
begin
  if v_token is null then
    raise exception 'sessao invalida';
  end if;

  select * into v_account
  from public.client_portal_accounts
  where portal_token = v_token and is_active;
  if not found then
    raise exception 'sessao invalida';
  end if;
  v_tenant_id := v_account.tenant_id;

  if coalesce(v_account.scheduling_suspended, false) then
    raise exception 'agendamentos suspensos por pendencia de pagamento';
  end if;
  if v_client_id is null or not exists (
    select 1
    from public.client_portal_account_clients ac
    where ac.account_id = v_account.id and ac.client_id = v_client_id
  ) then
    raise exception 'unidade nao vinculada a este acesso';
  end if;

  select c.name, c.state
  into v_unit_name, v_client_state
  from public.clients c
  where c.id = v_client_id
    and c.tenant_id = v_tenant_id
    and c.deleted_at is null;
  if v_unit_name is null then
    raise exception 'unidade invalida';
  end if;
  if v_attendance_mode = 'presencial'
     and upper(coalesce(btrim(v_client_state), '')) not in ('RJ', 'RIO DE JANEIRO') then
    raise exception 'vistoria presencial permitida apenas para unidades cadastradas no RJ';
  end if;
  if v_starts_at is null or v_ends_at is null then
    raise exception 'horario obrigatorio';
  end if;

  v_duration_minutes := private.resolve_appointment_duration_minutes(
    v_appointment_type,
    v_duration_minutes,
    v_starts_at,
    v_ends_at
  );
  if v_starts_at < now() + interval '24 hours' then
    raise exception 'agendamento exige antecedencia minima de 24 horas';
  end if;

  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
  v_slot_minutes := extract(hour from v_starts_local) * 60
    + extract(minute from v_starts_local);
  if extract(isodow from v_starts_local) not between 1 and 5 then
    raise exception 'agendamento permitido apenas de segunda a sexta';
  end if;
  if not (
    (v_slot_minutes >= 570 and v_slot_minutes <= 690)
    or (v_slot_minutes >= 780 and v_slot_minutes <= 960)
  ) then
    raise exception 'horario indisponivel';
  end if;
  if exists (
    select 1
    from public.appointment_blocked_dates bd
    where bd.tenant_id = v_tenant_id
      and bd.day = v_starts_local::date
  ) then
    raise exception 'horario indisponivel';
  end if;
  if v_attendance_mode = 'presencial'
     and (v_district is null or v_municipality is null) then
    raise exception 'bairro e municipio sao obrigatorios para atendimento presencial';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_tenant_id::text || ':' || v_starts_local::date::text,
    0
  ));
  if private.appointment_has_conflict(
    v_tenant_id,
    v_starts_at,
    v_ends_at,
    null,
    null,
    null,
    null,
    interval '4 hours'
  ) then
    raise exception 'horario indisponivel'
      using errcode = 'exclusion_violation';
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
    appointment_type,
    duration_minutes,
    notes
  ) values (
    v_tenant_id,
    v_client_id,
    v_unit_name,
    v_district,
    v_municipality,
    v_attendance_mode,
    nullif(btrim(p_payload->>'responsible_name'), ''),
    nullif(btrim(p_payload->>'phone'), ''),
    nullif(btrim(p_payload->>'email'), ''),
    v_starts_local::date,
    to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at,
    v_ends_at,
    v_appointment_type,
    v_duration_minutes,
    nullif(btrim(p_payload->>'notes'), '')
  )
  returning public_token into v_new_token;

  return jsonb_build_object('public_token', v_new_token);
end;
$$;

revoke all on function private.resolve_appointment_duration_minutes(text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function private.appointment_has_conflict(uuid, timestamptz, timestamptz, text[], uuid, uuid, uuid, interval)
  from public, anon, authenticated;
revoke all on function private.enforce_appointment_request_availability()
  from public, anon, authenticated;
revoke all on function private.enforce_schedule_availability()
  from public, anon, authenticated;
revoke all on function private.enforce_appointment_block_availability()
  from public, anon, authenticated;
revoke all on function private.appointment_recurrence_start(timestamptz, text, integer)
  from public, anon, authenticated;

revoke all on function public.admin_create_appointment_blocks(uuid, timestamptz, integer, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_create_appointment_blocks(uuid, timestamptz, integer, text, text, integer)
  to authenticated;

revoke all on function public.public_list_calendar_days(uuid, date, integer, text, integer)
  from public, authenticated;
grant execute on function public.public_list_calendar_days(uuid, date, integer, text, integer)
  to anon;

revoke all on function public.public_list_available_times(uuid, date, text, integer)
  from public, authenticated;
grant execute on function public.public_list_available_times(uuid, date, text, integer)
  to anon;

revoke all on function public.public_create_calendar_appointment_request(jsonb)
  from public, authenticated;
grant execute on function public.public_create_calendar_appointment_request(jsonb)
  to anon;

revoke all on function public.client_portal_create_appointment(jsonb)
  from public, authenticated;
grant execute on function public.client_portal_create_appointment(jsonb)
  to anon;
