-- ============================================================
-- 021_client_portal_scheduling_and_units.sql
-- 1. client_portal_overview passa a expor client_id por unidade.
-- 2. client_portal_create_appointment: agendamento autenticado pelo
--    portal, vinculando direto ao client_id e validando que a unidade
--    pertence a conta do token (isolamento forte — cliente nunca agenda
--    nem ve unidade de outro cadastro).
-- A edicao das unidades vinculadas (incluir/excluir) e feita pelo painel
-- via tabela client_portal_account_clients (RLS de staff ja existente).
-- ============================================================

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
      'client_id', c.id,
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

  return jsonb_build_object('account_name', v_account.name, 'units', v_units);
end;
$$;

grant execute on function public.client_portal_overview(uuid) to anon;

create or replace function public.client_portal_create_appointment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_token uuid := nullif(p_payload->>'portal_token', '')::uuid;
  v_client_id uuid := nullif(p_payload->>'client_id', '')::uuid;
  v_account public.client_portal_accounts%rowtype;
  v_tenant_id uuid;
  v_unit_name text;
  v_attendance_mode text := coalesce(nullif(trim(p_payload->>'attendance_mode'), ''), 'presencial');
  v_municipality text := nullif(trim(p_payload->>'municipality'), '');
  v_district text := nullif(trim(p_payload->>'district'), '');
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

  -- ISOLAMENTO: a unidade precisa pertencer a esta conta
  if v_client_id is null or not exists (
    select 1 from public.client_portal_account_clients ac
    where ac.account_id = v_account.id and ac.client_id = v_client_id
  ) then
    raise exception 'unidade nao vinculada a este acesso';
  end if;

  select name into v_unit_name from public.clients
  where id = v_client_id and tenant_id = v_tenant_id and deleted_at is null;
  if v_unit_name is null then
    raise exception 'unidade invalida';
  end if;

  if v_starts_at is null or v_ends_at is null then
    raise exception 'horario obrigatorio';
  end if;
  v_starts_local := v_starts_at at time zone 'America/Sao_Paulo';
  v_slot_minutes := extract(hour from v_starts_local) * 60 + extract(minute from v_starts_local);

  if extract(isodow from v_starts_local) not between 1 and 5 then
    raise exception 'agendamento permitido apenas de segunda a sexta';
  end if;
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
    select 1 from public.schedules s
    where s.tenant_id = v_tenant_id and s.deleted_at is null
      and s.status in ('pending', 'in_progress')
      and s.scheduled_at > v_starts_at - interval '4 hours'
      and s.scheduled_at < v_starts_at + interval '4 hours'
  ) or exists (
    select 1 from public.appointment_requests ar
    where ar.tenant_id = v_tenant_id
      and ar.status in ('requested', 'confirmed', 'in_progress', 'rescheduled')
      and ar.requested_starts_at is not null
      and ar.requested_starts_at > v_starts_at - interval '4 hours'
      and ar.requested_starts_at < v_starts_at + interval '4 hours'
  ) then
    raise exception 'horario indisponivel';
  end if;

  insert into public.appointment_requests (
    tenant_id, client_id, unit_name, district, municipality, attendance_mode,
    responsible_name, phone, email,
    requested_date, requested_time, requested_period,
    requested_starts_at, requested_ends_at, notes
  )
  values (
    v_tenant_id, v_client_id, v_unit_name, v_district, v_municipality, v_attendance_mode,
    nullif(trim(p_payload->>'responsible_name'), ''),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'email'), ''),
    v_starts_local::date,
    to_char(v_starts_local, 'HH24:MI'),
    case when extract(hour from v_starts_local) < 12 then 'manha' else 'tarde' end,
    v_starts_at, v_ends_at,
    nullif(trim(p_payload->>'notes'), '')
  )
  returning public_token into v_new_token;

  return jsonb_build_object('public_token', v_new_token);
end;
$$;

grant execute on function public.client_portal_create_appointment(jsonb) to anon;
