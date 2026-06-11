-- ============================================================
-- 023_public_request_flood_guard.sql
-- Proteção anti-spam no formulário público (/agendar):
--  - limite de 15 solicitações por tenant na última hora;
--  - limite de tamanho do nome da unidade (evita payload abusivo).
-- O portal autenticado do cliente (client_portal_create_appointment)
-- não passa por aqui e não é limitado.
-- Recria public_create_calendar_appointment_request preservando todas
-- as validações (fuso America/Sao_Paulo, janela 09h30-11h30 e 13h-16h,
-- datas bloqueadas, intervalo de 4h, lock anti-corrida).
-- ============================================================

create or replace function public.public_create_calendar_appointment_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
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
  if length(v_unit_name) > 200 then
    raise exception 'unit_name muito longo';
  end if;
  if v_starts_at is null or v_ends_at is null then
    raise exception 'requested_starts_at e obrigatorio';
  end if;

  if (
    select count(*) from public.appointment_requests ar
    where ar.tenant_id = v_tenant_id and ar.created_at > now() - interval '1 hour'
  ) >= 15 then
    raise exception 'muitas solicitacoes em pouco tempo. tente novamente mais tarde.';
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
$function$;

grant execute on function public.public_create_calendar_appointment_request(jsonb) to anon;
