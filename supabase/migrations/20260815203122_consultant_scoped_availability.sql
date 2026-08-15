-- Agenda por consultora: grade semanal fixa por consultora, bloqueios (dia inteiro e
-- parciais) escopados por consultora, e disponibilidade nas RPCs publicas/portal
-- passam a considerar qual(is) consultora(s) foram selecionadas.

-- 1. Grade semanal fixa (09:30-17:00, seg-sex) por consultora ---------------------
create table public.consultant_weekly_availability (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  consultant_name text not null,
  weekday integer not null check (weekday between 1 and 5),
  period text not null check (period in ('manha', 'tarde')),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (tenant_id, consultant_name, weekday, period)
);

comment on table public.consultant_weekly_availability is
  'Grade semanal fixa (09:30-17:00, seg-sex): em quais dias/turnos cada consultora participa da agenda. Ausencia de linha = indisponivel naquele dia/turno.';

alter table public.consultant_weekly_availability enable row level security;

create policy "staff manage consultant availability"
  on public.consultant_weekly_availability
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

revoke all on table public.consultant_weekly_availability from public, anon, authenticated;
grant select, insert, delete on table public.consultant_weekly_availability to authenticated;

-- Seed: todas as tenants existentes comecam com as duas consultoras disponiveis em
-- todos os dias/turnos (mantem o comportamento atual de "sempre aberto" no dia do
-- deploy). A equipe ajusta depois pela UI.
insert into public.consultant_weekly_availability (tenant_id, consultant_name, weekday, period)
select t.id, c.name, w.weekday, p.period
from public.tenants t
cross join (values ('Ester Caiafa'), ('Ana Roberta Ribeiro')) as c(name)
cross join generate_series(1, 5) as w(weekday)
cross join (values ('manha'), ('tarde')) as p(period)
on conflict do nothing;

-- 2. Bloqueios ganham escopo por consultora ----------------------------------------
alter table public.appointment_blocks
  add column if not exists consultant_name text;

comment on column public.appointment_blocks.consultant_name is
  'NULL bloqueia todo mundo (feriado, viagem da equipe); preenchido bloqueia so essa consultora.';

alter table public.appointment_blocked_dates
  add column if not exists consultant_name text;

comment on column public.appointment_blocked_dates.consultant_name is
  'NULL bloqueia o dia pra todo mundo; preenchido bloqueia so essa consultora.';

-- 3. private.consultant_available: grade semanal + bloqueios, por consultora ------
create or replace function private.consultant_available(
  p_tenant_id uuid,
  p_consultant_names text[],
  p_starts_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    -- bloqueio do dia sem consultora associada (feriado etc.) vale sempre, mesmo
    -- sem nenhuma consultora selecionada.
    not exists (
      select 1
      from public.appointment_blocked_dates bd
      where bd.tenant_id = p_tenant_id
        and bd.day = (p_starts_at at time zone 'America/Sao_Paulo')::date
        and bd.consultant_name is null
    )
    and not exists (
      select 1
      from unnest(coalesce(p_consultant_names, '{}'::text[])) as cn(name)
      where not exists (
        select 1
        from public.consultant_weekly_availability cwa
        where cwa.tenant_id = p_tenant_id
          and cwa.consultant_name = cn.name
          and cwa.weekday = extract(isodow from (p_starts_at at time zone 'America/Sao_Paulo'))::integer
          and cwa.period = case
            when extract(hour from (p_starts_at at time zone 'America/Sao_Paulo')) < 12 then 'manha'
            else 'tarde'
          end
      )
      or exists (
        select 1
        from public.appointment_blocked_dates bd2
        where bd2.tenant_id = p_tenant_id
          and bd2.day = (p_starts_at at time zone 'America/Sao_Paulo')::date
          and bd2.consultant_name = cn.name
      )
    );
$$;

comment on function private.consultant_available(uuid, text[], timestamptz) is
  'True se TODAS as consultoras em p_consultant_names estiverem na grade semanal para o dia/turno de p_starts_at e sem bloqueio (geral ou delas). Lista vazia/nula = sem filtro (so checa bloqueio geral do dia).';

-- 4. appointment_has_conflict: bloqueios parciais tambem respeitam consultora -----
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
          < p_ends_at + private.appointment_conflict_buffer(s.appointment_type, p_public_buffer)
        and s.scheduled_at + make_interval(mins => coalesce(s.duration_minutes, 60))
          > p_starts_at - private.appointment_conflict_buffer(s.appointment_type, p_public_buffer)
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
        and not exists (
          select 1
          from public.schedules sd
          where sd.id = ar.schedule_id
            and sd.deleted_at is not null
        )
        and ar.requested_starts_at
          < p_ends_at + private.appointment_conflict_buffer(ar.appointment_type, p_public_buffer)
        and ar.requested_ends_at
          > p_starts_at - private.appointment_conflict_buffer(ar.appointment_type, p_public_buffer)
        and (
          coalesce(cardinality(p_consultant_names), 0) = 0
          or coalesce(cardinality(ar.consultant_names), 0) = 0
          or ar.consultant_names && p_consultant_names
        )
    );
$$;

-- 5. public_list_calendar_days: novo parametro p_consultant_names -----------------
drop function if exists public.public_list_calendar_days(uuid, date, integer, text, integer);
create function public.public_list_calendar_days(
  p_tenant_id uuid,
  p_start_date date default ((now() at time zone 'America/Sao_Paulo')::date),
  p_days integer default 45,
  p_appointment_type text default 'inspection',
  p_duration_minutes integer default null,
  p_consultant_names text[] default null
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
  )
  select
    ds.day,
    extract(isodow from ds.day)::integer as weekday,
    count(*)::integer as available_count
  from default_slots ds
  where ds.starts_at >= now() + interval '24 hours'
    and private.consultant_available(p_tenant_id, p_consultant_names, ds.starts_at)
    and not private.appointment_has_conflict(
      p_tenant_id,
      ds.starts_at,
      ds.ends_at,
      p_consultant_names,
      null,
      null,
      null,
      interval '4 hours'
    )
  group by ds.day
  having count(*) > 0
  order by ds.day;
$$;

-- 6. public_list_available_times: novo parametro p_consultant_names ---------------
drop function if exists public.public_list_available_times(uuid, date, text, integer);
create function public.public_list_available_times(
  p_tenant_id uuid,
  p_day date,
  p_appointment_type text default 'inspection',
  p_duration_minutes integer default null,
  p_consultant_names text[] default null
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
  )
  select ds.starts_at, ds.ends_at, ds.label
  from default_slots ds
  where ds.starts_at >= now() + interval '24 hours'
    and private.consultant_available(p_tenant_id, p_consultant_names, ds.starts_at)
    and not private.appointment_has_conflict(
      p_tenant_id,
      ds.starts_at,
      ds.ends_at,
      p_consultant_names,
      null,
      null,
      null,
      interval '4 hours'
    )
  order by ds.starts_at;
$$;

-- 7. public_create_calendar_appointment_request: aceita e grava consultant_names --
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

-- 8. client_portal_create_appointment: aceita e grava consultant_names ------------
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

  select c.name, c.state, c.email into v_unit_name, v_client_state, v_client_email from public.clients c
  where c.id = v_client_id and c.tenant_id = v_tenant_id and c.deleted_at is null;
  if v_unit_name is null then raise exception 'unidade invalida'; end if;
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

-- 9. admin_create_appointment_blocks: novo parametro p_consultant_name ------------
drop function if exists public.admin_create_appointment_blocks(uuid, timestamptz, integer, text, text, integer);
create function public.admin_create_appointment_blocks(
  p_tenant_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_reason text default null,
  p_recurrence text default 'none',
  p_occurrences integer default 1,
  p_consultant_name text default null
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
      consultant_name,
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
      nullif(btrim(coalesce(p_consultant_name, '')), ''),
      auth.uid()
    )
    returning * into v_row;

    return next v_row;
  end loop;
end;
$$;
