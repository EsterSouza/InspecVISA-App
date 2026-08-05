-- DEBT-01 + agenda fantasma: uma redefinicao de private.appointment_has_conflict com duas
-- correcoes que vivem no mesmo lugar.
--
-- 1) Margem por registro. As RPCs publicas passavam sempre `interval '4 hours'`, margem pensada
--    para inspecao presencial (deslocamento). Aplicada a um briefing online de 15 min, bloqueava
--    mais de 8 horas de agenda em volta de um compromisso curto. Agora a margem vem do registro
--    que ja esta na agenda: inspecao 4 h, demais 30 min, sempre limitada pelo teto que o chamador
--    passa. O caminho interno continua passando 0 e segue sem margem nenhuma.
--    Efeito colateral desejado do card: briefing logo apos inspecao presencial continua barrado,
--    porque a margem grande e da inspecao.
--
-- 2) Solicitacao orfa nao bloqueia mais. Excluir um agendamento no app so marcava
--    `schedules.deleted_at`; a `appointment_requests` vinculada continuava `confirmed` e seguia
--    ocupando o horario, invisivel na tela de Agendamentos. Em 04/08/2026 isso deixou 7 horarios
--    fantasmas no tenant de producao. O bloqueio agora ignora solicitacao cuja agenda vinculada
--    foi excluida. O app tambem passou a liberar a solicitacao ao excluir o agendamento; esta
--    guarda e a rede de seguranca para o que ja aconteceu e para falha de sincronizacao.
--
-- Rollback: recriar a versao de 20260802105852 (sem a guarda e com p_public_buffer aplicado direto)
-- e remover private.appointment_conflict_buffer.

create or replace function private.appointment_conflict_buffer(
  p_appointment_type text,
  p_max interval
)
returns interval
language sql
immutable
set search_path = ''
as $$
  select least(
    coalesce(p_max, interval '0 minutes'),
    case coalesce(nullif(p_appointment_type, ''), 'inspection')
      when 'inspection' then interval '4 hours'
      else interval '30 minutes'
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
        -- Agenda vinculada excluida: a solicitacao e um fantasma, nao ocupa mais o horario.
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

revoke all on function private.appointment_conflict_buffer(text, interval)
  from public, anon, authenticated;
revoke all on function private.appointment_has_conflict(uuid, timestamptz, timestamptz, text[], uuid, uuid, uuid, interval)
  from public, anon, authenticated;
