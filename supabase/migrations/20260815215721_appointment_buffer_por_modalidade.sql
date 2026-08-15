-- Agenda: margem de conflito passa a ser por modalidade (presencial x online), nao mais por
-- tipo do compromisso. Ate aqui toda inspecao (presencial ou online) recebia +-4h simetricas
-- pensadas pra deslocamento fisico; uma inspecao online as 13h bloqueava a manha inteira sem
-- motivo nenhum, ja que nao ha deslocamento. Ester: presencial continua reservando deslocamento
-- (1h antes / 3h depois do horario do evento), online cai pra 30min antes / 2h depois -- o
-- suficiente pra troca entre chamadas, sem comer a manha ou a tarde inteira.
--
-- attendance_mode so existia em appointment_requests; schedules ganha a coluna aqui, com
-- backfill a partir da solicitacao vinculada (schedule_id). Agenda criada direto em schedules
-- sem solicitacao (fluxo legado/manual) fica com attendance_mode nulo e cai no default
-- 'presencial' dentro das funcoes de margem abaixo -- o lado mais conservador dos dois.
--
-- Rollback: recriar private.appointment_conflict_buffer(text, interval) e
-- private.appointment_has_conflict na versao de 20260804140000; dropar as funcoes _before/_after
-- e a coluna schedules.attendance_mode.

alter table public.schedules
  add column if not exists attendance_mode text
    check (attendance_mode in ('presencial', 'online'));

comment on column public.schedules.attendance_mode is
  'Presencial reserva deslocamento (buffer maior); online so precisa de troca entre chamadas. NULL (agenda criada direto, sem solicitacao vinculada) cai no default presencial dentro da margem de conflito.';

update public.schedules s
set attendance_mode = ar.attendance_mode
from public.appointment_requests ar
where ar.schedule_id = s.id
  and s.attendance_mode is null
  and ar.attendance_mode is not null;

create or replace function private.appointment_conflict_buffer_before(
  p_attendance_mode text,
  p_max interval
)
returns interval
language sql
immutable
set search_path = ''
as $$
  select least(
    coalesce(p_max, interval '0 minutes'),
    case coalesce(nullif(p_attendance_mode, ''), 'presencial')
      when 'online' then interval '30 minutes'
      else interval '1 hour'
    end
  );
$$;

create or replace function private.appointment_conflict_buffer_after(
  p_attendance_mode text,
  p_max interval
)
returns interval
language sql
immutable
set search_path = ''
as $$
  select least(
    coalesce(p_max, interval '0 minutes'),
    case coalesce(nullif(p_attendance_mode, ''), 'presencial')
      when 'online' then interval '2 hours'
      else interval '3 hours'
    end
  );
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
          < p_ends_at + private.appointment_conflict_buffer_before(s.attendance_mode, p_public_buffer)
        and s.scheduled_at + make_interval(mins => coalesce(s.duration_minutes, 60))
          > p_starts_at - private.appointment_conflict_buffer_after(s.attendance_mode, p_public_buffer)
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
        -- Agenda vinculada excluida: a solicitacao e um fantasma, nao ocupa mais o horario.
        and not exists (
          select 1
          from public.schedules sd
          where sd.id = ar.schedule_id
            and sd.deleted_at is not null
        )
        and ar.requested_starts_at
          < p_ends_at + private.appointment_conflict_buffer_before(ar.attendance_mode, p_public_buffer)
        and ar.requested_ends_at
          > p_starts_at - private.appointment_conflict_buffer_after(ar.attendance_mode, p_public_buffer)
        and (
          coalesce(cardinality(p_consultant_names), 0) = 0
          or coalesce(cardinality(ar.consultant_names), 0) = 0
          or ar.consultant_names && p_consultant_names
        )
    );
$$;

drop function if exists private.appointment_conflict_buffer(text, interval);

revoke all on function private.appointment_conflict_buffer_before(text, interval)
  from public, anon, authenticated;
revoke all on function private.appointment_conflict_buffer_after(text, interval)
  from public, anon, authenticated;
revoke all on function private.appointment_has_conflict(uuid, timestamptz, timestamptz, text[], uuid, uuid, uuid, interval)
  from public, anon, authenticated;
