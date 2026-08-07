-- P360-008: detalhe, notificacoes e calendario do compromisso.
--
-- 1. Duas novas finalidades de compromisso (audit, online_followup), no mesmo padrao de como
--    'briefing' foi adicionado em 20260803190000_public_briefing_only.sql: reaproveita toda a
--    maquina existente de status/timeline/RPC em vez de um dominio novo de "marcos de contrato".
-- 2. Flags de contrato em clients (has_audit_service, has_online_followup), mesmo padrao do
--    has_personalized_sanitary_folder ja existente.
-- 3. Tabela de idempotencia para o e-mail de confirmacao/remarcacao/cancelamento (WhatsApp
--    continua manual, sem "reenvio" a deduplicar).
-- 4. client_portal_overview passa a devolver os dois novos flags por unidade.

-- 1a. Flags de contrato.
alter table public.clients
  add column if not exists has_audit_service boolean not null default false,
  add column if not exists has_online_followup boolean not null default false;

-- 1b. Novo tipo de compromisso em appointment_requests, no mesmo bucket de duracao de
-- follow_up_meeting/results_meeting/document_guidance (30/60/90 minutos).
alter table public.appointment_requests
  drop constraint if exists appointment_requests_appointment_type_check,
  add constraint appointment_requests_appointment_type_check
    check (appointment_type in (
      'inspection',
      'follow_up_meeting',
      'results_meeting',
      'document_guidance',
      'training',
      'other',
      'briefing',
      'audit',
      'online_followup'
    )),
  drop constraint if exists appointment_requests_duration_minutes_check,
  add constraint appointment_requests_duration_minutes_check check (
    duration_minutes is null
    or (
      appointment_type = 'inspection'
      and duration_minutes between 15 and 720
    )
    or (
      appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'audit', 'online_followup')
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
    or (
      appointment_type = 'briefing'
      and duration_minutes in (15, 30, 45)
    )
  );

alter table public.schedules
  drop constraint if exists schedules_appointment_type_check,
  add constraint schedules_appointment_type_check
    check (appointment_type in (
      'inspection',
      'follow_up_meeting',
      'results_meeting',
      'document_guidance',
      'training',
      'other',
      'briefing',
      'audit',
      'online_followup'
    )),
  drop constraint if exists schedules_duration_minutes_check,
  add constraint schedules_duration_minutes_check check (
    duration_minutes is null
    or (
      appointment_type = 'inspection'
      and duration_minutes between 15 and 720
    )
    or (
      appointment_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'audit', 'online_followup')
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
    or (
      appointment_type = 'briefing'
      and duration_minutes in (15, 30, 45)
    )
  );

-- Mesma extensao no resolvedor de duracao usado pelas RPCs publicas/portal.
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
  v_duration := coalesce(p_duration_minutes, v_derived,
    case v_type when 'inspection' then 60 when 'briefing' then 30 end);

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
  elsif v_type in ('follow_up_meeting', 'results_meeting', 'document_guidance', 'audit', 'online_followup') then
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
  elsif v_type = 'briefing' then
    if v_duration not in (15, 30, 45) then
      raise exception 'briefing aceita 15, 30 ou 45 minutos'
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

-- 2. Cronograma unico: quais marcos, alem da Pasta Sanitaria Personalizada, o cliente contratou.
comment on column public.clients.has_audit_service is
  'Cliente contratou auditoria como marco recorrente do cronograma do portal (P360-008).';
comment on column public.clients.has_online_followup is
  'Cliente contratou acompanhamento online como marco recorrente do cronograma do portal (P360-008).';

-- 3. Idempotencia do e-mail de confirmacao/remarcacao/cancelamento. Escrita apenas pela edge
-- function notify-appointment-event via service role; para o staff e somente leitura.
create table if not exists public.appointment_notification_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  event_type text not null check (event_type in ('confirmed', 'rescheduled', 'cancelled')),
  dedupe_key text not null,
  email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (appointment_request_id, event_type, dedupe_key)
);

comment on table public.appointment_notification_log is
  'Idempotencia de notificacoes de compromisso (P360-008): garante que retry de confirmacao/'
  'remarcacao/cancelamento nao reenvia o mesmo e-mail. Escrita apenas pela edge function '
  'notify-appointment-event via service role; para o staff e somente leitura.';

create index if not exists idx_appointment_notification_log_tenant_created
  on public.appointment_notification_log (tenant_id, created_at desc);

create index if not exists idx_appointment_notification_log_request
  on public.appointment_notification_log (appointment_request_id);

alter table public.appointment_notification_log enable row level security;

drop policy if exists "staff read appointment notification log" on public.appointment_notification_log;
create policy "staff read appointment notification log"
  on public.appointment_notification_log for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- Tabela nova no schema public nasce com ALL para anon/authenticated por default privilege;
-- precisa revogar explicitamente para ficar somente-leitura para o staff (ver memoria do projeto).
revoke all on table public.appointment_notification_log from public;
revoke all on table public.appointment_notification_log from anon;
revoke all on table public.appointment_notification_log from authenticated;
grant select on table public.appointment_notification_log to authenticated;

-- 4. client_portal_overview: mesmo corpo de 20260801161550_appointment_domain.sql, acrescentando
-- has_audit_service/has_online_followup por unidade. create or replace preserva a ACL ja concedida
-- (anon + authenticated, via 20260803190000_public_briefing_only.sql).
create or replace function public.client_portal_overview(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.client_portal_accounts%rowtype;
  v_units jsonb;
  v_tutorial_pdf_url text;
  v_support_whatsapp text;
  v_quick_access_enabled boolean := true;
  v_multi_purpose_schedule boolean := false;
  v_action_plan_enabled boolean := false;
  v_service_requests_enabled boolean := false;
begin
  select *
  into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  select
    tutorial_pdf_url,
    support_whatsapp,
    quick_access_enabled,
    multi_purpose_schedule,
    action_plan_enabled,
    service_requests_enabled
  into
    v_tutorial_pdf_url,
    v_support_whatsapp,
    v_quick_access_enabled,
    v_multi_purpose_schedule,
    v_action_plan_enabled,
    v_service_requests_enabled
  from public.client_portal_settings
  where tenant_id = v_account.tenant_id;

  select coalesce(jsonb_agg(unit order by unit->>'client_name'), '[]'::jsonb)
  into v_units
  from (
    select jsonb_build_object(
      'client_id', c.id,
      'client_name', c.name,
      'city', c.city,
      'state', c.state,
      'has_personalized_sanitary_folder', c.has_personalized_sanitary_folder,
      'personalized_sanitary_folder_url', c.personalized_sanitary_folder_url,
      'has_audit_service', c.has_audit_service,
      'has_online_followup', c.has_online_followup,
      'visits', coalesce((
        select jsonb_agg(jsonb_build_object(
          'public_token', ar.public_token,
          'unit_name', ar.unit_name,
          'appointment_type', ar.appointment_type,
          'subject', ar.subject,
          'duration_minutes', ar.duration_minutes,
          'consultant_names', ar.consultant_names,
          'status', ar.status,
          'requested_date', ar.requested_date,
          'requested_time', ar.requested_time,
          'report_due_at', case when ar.appointment_type = 'inspection' then ar.report_due_at end,
          'compliance_score', case when ar.appointment_type = 'inspection' then ar.compliance_score end,
          'sanitary_score', case when ar.appointment_type = 'inspection' then ar.sanitary_score end,
          'nutrition_score', case when ar.appointment_type = 'inspection' then ar.nutrition_score end,
          'critical_nc_count', case when ar.appointment_type = 'inspection' then ar.critical_nc_count end,
          'important_nc_count', case when ar.appointment_type = 'inspection' then ar.important_nc_count end,
          'total_nc_count', case when ar.appointment_type = 'inspection' then ar.total_nc_count end,
          'recurring_nc_count', case when ar.appointment_type = 'inspection' then ar.recurring_nc_count end,
          'immediate_nc_count', case when ar.appointment_type = 'inspection' then ar.immediate_nc_count end,
          'nc_items', case
            when ar.appointment_type <> 'inspection' or ar.report_hidden then '[]'::jsonb
            else coalesce(ar.nc_items, '[]'::jsonb)
          end,
          'report_count', case
            when ar.appointment_type <> 'inspection' or ar.report_hidden then 0
            else (
              select count(*)
              from public.appointment_attachments aa
              where aa.appointment_request_id = ar.id
                and aa.kind = 'report_pdf'
            )
          end,
          'photo_count', case
            when ar.appointment_type <> 'inspection' then 0
            else (
              select count(*)
              from public.appointment_attachments aa
              where aa.appointment_request_id = ar.id
                and aa.kind = 'photo'
            )
          end,
          'attachment_count', (
            select count(*)
            from public.appointment_attachments aa
            where aa.appointment_request_id = ar.id
              and aa.kind = 'attachment'
          ),
          'created_at', ar.created_at
        ) order by ar.requested_date desc nulls last, ar.created_at desc)
        from public.appointment_requests ar
        where ar.client_id = c.id
          and ar.tenant_id = v_account.tenant_id
      ), '[]'::jsonb)
    ) as unit
    from public.client_portal_account_clients ac
    join public.clients c
      on c.id = ac.client_id
     and c.tenant_id = v_account.tenant_id
     and c.deleted_at is null
    where ac.account_id = v_account.id
  ) scoped_units;

  return jsonb_build_object(
    'account_name', v_account.name,
    'main_drive_folder_url', v_account.main_drive_folder_url,
    'tutorial_pdf_url', v_tutorial_pdf_url,
    'support_whatsapp', v_support_whatsapp,
    'quick_access_enabled', coalesce(v_quick_access_enabled, true),
    'multi_purpose_schedule', coalesce(v_multi_purpose_schedule, false),
    'action_plan_enabled', coalesce(v_action_plan_enabled, false),
    'service_requests_enabled', coalesce(v_service_requests_enabled, false),
    'scheduling_suspended', coalesce(v_account.scheduling_suspended, false),
    'payment', jsonb_build_object(
      'type', v_account.payment_type,
      'status', coalesce(v_account.payment_status, 'pending'),
      'link', v_account.payment_link,
      'links', coalesce(v_account.payment_links, '[]'::jsonb),
      'due_date', v_account.payment_due_date,
      'updated_at', v_account.payment_updated_at
    ),
    'units', v_units
  );
end;
$$;
