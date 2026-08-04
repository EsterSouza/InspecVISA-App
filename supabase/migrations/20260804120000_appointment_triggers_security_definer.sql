-- Corrige "permission denied for function resolve_appointment_duration_minutes" ao agendar.
-- Os gatilhos de disponibilidade rodavam com os privilegios de quem escreve (authenticated),
-- mas as funcoes auxiliares em `private` estao revogadas de authenticated desde
-- 20260802105852. Resultado: qualquer insert/update em schedules, appointment_requests
-- ou appointment_blocks feito pelo app logado morria com 42501.
-- Solucao: os gatilhos passam a ser security definer (dono postgres), entao as auxiliares
-- continuam inacessiveis para authenticated e a checagem de conflito enxerga todas as
-- linhas do tenant, sem depender do RLS de quem esta gravando.
-- Rollback: recriar as tres funcoes sem `security definer` (versoes de 20260802105852).

create or replace function private.enforce_appointment_request_availability()
returns trigger
language plpgsql
security definer
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
security definer
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
security definer
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

-- create or replace preserva a ACL; os revokes ficam explicitos para o arquivo ser autossuficiente.
revoke all on function private.enforce_appointment_request_availability()
  from public, anon, authenticated;
revoke all on function private.enforce_schedule_availability()
  from public, anon, authenticated;
revoke all on function private.enforce_appointment_block_availability()
  from public, anon, authenticated;
