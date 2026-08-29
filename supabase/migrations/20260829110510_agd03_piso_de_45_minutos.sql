-- AGD-03 — Piso de 45 minutos para todo compromisso
--
-- Pedido da Ester (29/08/2026): "nao deve existir nenhum tipo de agendamento com duracao de 15
-- ou 30 min, tudo tem que ser a partir de 45min". Compromisso curto demais nao cabe no
-- deslocamento nem na conversa -- e o briefing de 15 minutos de 18/08/2026 varreu a manha
-- inteira da agenda por causa da margem de conflito.
--
-- A regra vive em tres lugares que precisam concordar: o TypeScript
-- (`isAllowedAppointmentDuration`), o resolvedor abaixo (porta de entrada das RPCs do portal) e
-- os dois checks de tabela, que valem para QUALQUER escrita -- inclusive o insert direto do
-- admin, que nao passa por RPC nenhuma.
--
-- Faixas depois deste card:
--   inspecao, auditoria ........... 45 a 720
--   reunioes, orientacao, online .. 45, 60 ou 90
--   treinamento ................... 60 a 480, passo de 30 (60 e o 1o multiplo acima do piso)
--   outro ......................... 45 a 480, passo de 15
--   briefing ...................... 45 ou 60
--
-- Bloqueio de agenda (`admin_create_appointment_blocks`) NAO entra: bloqueio nao e compromisso,
-- e reservar 15 minutos da propria agenda continua legitimo.

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

  -- Briefing tem default proprio porque as RPCs de listagem consultam sem duracao.
  -- PORT-07: auditoria e uma inspecao com outro nome, entao herda o default de 60.
  v_duration := coalesce(p_duration_minutes, v_derived,
    case v_type when 'inspection' then 60 when 'audit' then 60 when 'briefing' then 45 end);

  if v_duration is null then
    raise exception 'duracao obrigatoria para este tipo de compromisso'
      using errcode = 'check_violation';
  end if;

  if p_starts_at is not null and p_ends_at is not null
     and p_ends_at <> p_starts_at + make_interval(mins => v_duration) then
    raise exception 'duracao nao corresponde ao intervalo informado'
      using errcode = 'check_violation';
  end if;

  -- AGD-03: o piso vale para todo tipo, e vem antes das faixas para a mensagem ser a do piso --
  -- "fora do limite de 15 a 720" nao explicava nada a quem tentou marcar 30 minutos.
  if v_duration < 45 then
    raise exception 'compromisso mais curto que 45 minutos nao e permitido'
      using errcode = 'check_violation';
  end if;

  -- PORT-07: a auditoria mensal e uma fiscalizacao presencial completa, nao uma reuniao de
  -- 30 a 90 minutos. Ela sai da faixa de reuniao e passa a valer a faixa da inspecao.
  if v_type in ('inspection', 'audit') then
    if v_duration > 720 then
      raise exception 'duracao de inspecao fora do limite de 45 a 720 minutos'
        using errcode = 'check_violation';
    end if;
  elsif v_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'online_followup') then
    if v_duration not in (45, 60, 90) then
      raise exception 'reunioes e orientacoes aceitam 45, 60 ou 90 minutos'
        using errcode = 'check_violation';
    end if;
  elsif v_type = 'training' then
    if v_duration not between 60 and 480 or v_duration % 30 <> 0 then
      raise exception 'treinamentos aceitam de 60 a 480 minutos, em passos de 30'
        using errcode = 'check_violation';
    end if;
  elsif v_type = 'other' then
    if v_duration > 480 or v_duration % 15 <> 0 then
      raise exception 'outros compromissos aceitam de 45 a 480 minutos, em passos de 15'
        using errcode = 'check_violation';
    end if;
  elsif v_type = 'briefing' then
    if v_duration not in (45, 60) then
      raise exception 'briefing aceita 45 ou 60 minutos'
        using errcode = 'check_violation';
    end if;
  else
    raise exception 'tipo de compromisso invalido'
      using errcode = 'check_violation';
  end if;

  return v_duration;
end;
$$;

revoke all on function private.resolve_appointment_duration_minutes(text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;

-- ─── Os checks de tabela, com a mesma regra ───────────────────────────────────
--
-- `not valid` de proposito. Producao tem duas linhas anteriores ao piso: um briefing de 15
-- minutos ja CANCELADO (o caso real de 18/08/2026) e uma reuniao de 30 minutos do tenant de
-- homologacao do E2E. Validar reescreveria ou impediria a migration; `not valid` deixa o
-- passado como esta e cobra o piso de toda escrita nova, que e o que o pedido quer.
--
-- Consequencia aceita: um UPDATE nessas duas linhas passa a falhar. As duas estao encerradas --
-- uma cancelada, a outra de homologacao -- e nenhuma tela edita compromisso cancelado.

alter table public.appointment_requests
  drop constraint if exists appointment_requests_duration_minutes_check;
alter table public.appointment_requests
  add constraint appointment_requests_duration_minutes_check check (
    duration_minutes is null
    or (
      duration_minutes >= 45
      and (
        (appointment_type in ('inspection', 'audit') and duration_minutes <= 720)
        or (appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'online_followup')
            and duration_minutes in (45, 60, 90))
        or (appointment_type = 'training' and duration_minutes between 60 and 480 and duration_minutes % 30 = 0)
        or (appointment_type = 'other' and duration_minutes <= 480 and duration_minutes % 15 = 0)
        or (appointment_type = 'briefing' and duration_minutes in (45, 60))
      )
    )
  ) not valid;

alter table public.schedules
  drop constraint if exists schedules_duration_minutes_check;
alter table public.schedules
  add constraint schedules_duration_minutes_check check (
    duration_minutes is null
    or (
      duration_minutes >= 45
      and (
        (appointment_type in ('inspection', 'audit') and duration_minutes <= 720)
        or (appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'online_followup')
            and duration_minutes in (45, 60, 90))
        or (appointment_type = 'training' and duration_minutes between 60 and 480 and duration_minutes % 30 = 0)
        or (appointment_type = 'other' and duration_minutes <= 480 and duration_minutes % 15 = 0)
        or (appointment_type = 'briefing' and duration_minutes in (45, 60))
      )
    )
  ) not valid;
