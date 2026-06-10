-- ============================================================
-- 017_client_portal_accounts_blocked_dates.sql
-- 1. Portal do cliente (franquias/multi-unidades): login por
--    e-mail + codigo de acesso gerado pela equipe.
-- 2. Bloqueio de datas (feriados/ferias) no calendario publico.
-- 3. Endurecimento de RLS: profiles so edita o proprio perfil;
--    checklists/legislacoes so por staff cadastrado.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ─── 1. Bloqueio de datas ────────────────────────────────────
create table if not exists public.appointment_blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  day        date not null,
  reason     text,
  created_at timestamptz default now(),
  unique (tenant_id, day)
);

alter table public.appointment_blocked_dates enable row level security;

drop policy if exists "staff manage blocked dates" on public.appointment_blocked_dates;
create policy "staff manage blocked dates"
  on public.appointment_blocked_dates for all to authenticated
  using (tenant_id in (select private.my_tenant_ids()) and private.is_tenant_staff(tenant_id))
  with check (tenant_id in (select private.my_tenant_ids()) and private.is_tenant_staff(tenant_id));

-- ─── 2. Contas do portal do cliente ──────────────────────────
create table if not exists public.client_portal_accounts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  name              text not null,
  email             text not null,
  access_code_hash  text not null,
  portal_token      uuid not null unique default gen_random_uuid(),
  is_active         boolean not null default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create unique index if not exists idx_client_portal_accounts_email
  on public.client_portal_accounts (tenant_id, lower(email));

create table if not exists public.client_portal_account_clients (
  account_id uuid not null references public.client_portal_accounts(id) on delete cascade,
  client_id  uuid not null,
  primary key (account_id, client_id)
);

alter table public.client_portal_accounts enable row level security;
alter table public.client_portal_account_clients enable row level security;

drop policy if exists "staff manage portal accounts" on public.client_portal_accounts;
create policy "staff manage portal accounts"
  on public.client_portal_accounts for all to authenticated
  using (tenant_id in (select private.my_tenant_ids()) and private.is_tenant_staff(tenant_id))
  with check (tenant_id in (select private.my_tenant_ids()) and private.is_tenant_staff(tenant_id));

drop policy if exists "staff manage portal account clients" on public.client_portal_account_clients;
create policy "staff manage portal account clients"
  on public.client_portal_account_clients for all to authenticated
  using (
    account_id in (
      select a.id from public.client_portal_accounts a
      where a.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(a.tenant_id)
    )
  )
  with check (
    account_id in (
      select a.id from public.client_portal_accounts a
      where a.tenant_id in (select private.my_tenant_ids())
        and private.is_tenant_staff(a.tenant_id)
    )
  );

-- ─── 3. RPCs administrativas (staff) ─────────────────────────
create or replace function public.admin_create_client_portal_account(
  p_tenant_id uuid,
  p_name text,
  p_email text,
  p_code text,
  p_client_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_id uuid;
begin
  if p_tenant_id is null
     or p_tenant_id not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(p_tenant_id) then
    raise exception 'sem permissao';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'nome e email sao obrigatorios';
  end if;
  if length(coalesce(p_code, '')) < 6 then
    raise exception 'codigo de acesso deve ter ao menos 6 caracteres';
  end if;
  if p_client_ids is null or array_length(p_client_ids, 1) is null then
    raise exception 'selecione ao menos uma unidade';
  end if;

  insert into public.client_portal_accounts (tenant_id, name, email, access_code_hash)
  values (p_tenant_id, trim(p_name), lower(trim(p_email)), extensions.crypt(p_code, extensions.gen_salt('bf')))
  returning id into v_id;

  insert into public.client_portal_account_clients (account_id, client_id)
  select v_id, unnest(p_client_ids);

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[]) to authenticated;

create or replace function public.admin_set_portal_access_code(p_account_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.client_portal_accounts where id = p_account_id;
  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;
  if length(coalesce(p_code, '')) < 6 then
    raise exception 'codigo de acesso deve ter ao menos 6 caracteres';
  end if;
  update public.client_portal_accounts
  set access_code_hash = extensions.crypt(p_code, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_account_id;
end;
$$;

grant execute on function public.admin_set_portal_access_code(uuid, text) to authenticated;

-- ─── 4. RPCs publicas do portal do cliente ───────────────────
create or replace function public.client_portal_login(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.client_portal_accounts%rowtype;
begin
  select * into v_row
  from public.client_portal_accounts
  where lower(email) = lower(trim(coalesce(p_email, '')))
    and is_active
    and access_code_hash = extensions.crypt(coalesce(p_code, ''), access_code_hash)
  limit 1;

  if not found then
    return jsonb_build_object('error', 'credenciais invalidas');
  end if;

  return jsonb_build_object('portal_token', v_row.portal_token, 'account_name', v_row.name);
end;
$$;

grant execute on function public.client_portal_login(text, text) to anon;

create or replace function public.client_portal_overview(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.client_portal_accounts%rowtype;
  v_units jsonb;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  select coalesce(jsonb_agg(unit order by unit->>'client_name'), '[]'::jsonb) into v_units
  from (
    select jsonb_build_object(
      'client_name', c.name,
      'city', c.city,
      'visits', coalesce((
        select jsonb_agg(jsonb_build_object(
          'public_token', ar.public_token,
          'unit_name', ar.unit_name,
          'status', ar.status,
          'requested_date', ar.requested_date,
          'requested_time', ar.requested_time,
          'report_due_at', ar.report_due_at,
          'created_at', ar.created_at
        ) order by ar.requested_date desc nulls last, ar.created_at desc)
        from public.appointment_requests ar
        where ar.client_id = c.id
          and ar.tenant_id = v_account.tenant_id
      ), '[]'::jsonb)
    ) as unit
    from public.client_portal_account_clients ac
    join public.clients c on c.id = ac.client_id and c.deleted_at is null
    where ac.account_id = v_account.id
  ) t;

  return jsonb_build_object(
    'account_name', v_account.name,
    'units', v_units
  );
end;
$$;

grant execute on function public.client_portal_overview(uuid) to anon;

-- ─── 5. Calendario publico: respeitar datas bloqueadas ───────
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
      (time '11:30'), (time '12:00'), (time '12:30'), (time '13:00'),
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
      (time '11:30'), (time '12:00'), (time '12:30'), (time '13:00'),
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

  if extract(isodow from v_starts_local) not between 1 and 5 then
    raise exception 'agendamento permitido apenas de segunda a sexta';
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

-- ─── 6. Endurecimento de RLS em tabelas globais ──────────────
-- profiles: cada usuario so altera o proprio perfil
drop policy if exists "profiles_authenticated_write" on public.profiles;
create policy "profiles_authenticated_write"
  on public.profiles for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- checklists/legislacoes: escrita apenas por staff cadastrado em algum tenant
drop policy if exists "checklist_templates_authenticated_write" on public.checklist_templates;
create policy "checklist_templates_authenticated_write"
  on public.checklist_templates for all to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()))
  with check (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()));

drop policy if exists "checklist_sections_authenticated_write" on public.checklist_sections;
create policy "checklist_sections_authenticated_write"
  on public.checklist_sections for all to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()))
  with check (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()));

drop policy if exists "checklist_items_authenticated_write" on public.checklist_items;
create policy "checklist_items_authenticated_write"
  on public.checklist_items for all to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()))
  with check (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()));

drop policy if exists "legislations_authenticated_write" on public.legislations;
create policy "legislations_authenticated_write"
  on public.legislations for all to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()))
  with check (exists (select 1 from public.tenant_users tu where tu.user_id = auth.uid()));
