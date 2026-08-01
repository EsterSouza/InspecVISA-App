-- P360-004: dominio multiuso de compromissos.
-- Migration aditiva: preserva tabelas, horarios e status legados.

alter table public.appointment_requests
  add column if not exists appointment_type text,
  add column if not exists subject text,
  add column if not exists duration_minutes integer,
  add column if not exists consultant_names text[],
  add column if not exists preferred_consultant_name text,
  add column if not exists meeting_url text,
  add column if not exists participant_names text[],
  add column if not exists cancellation_reason text;

alter table public.schedules
  add column if not exists appointment_type text,
  add column if not exists subject text,
  add column if not exists duration_minutes integer,
  add column if not exists meeting_url text,
  add column if not exists participant_names text[],
  add column if not exists cancellation_reason text;

-- Todo registro anterior ao dominio multiuso e uma inspecao.
update public.appointment_requests
set appointment_type = 'inspection'
where appointment_type is null;

update public.schedules
set appointment_type = 'inspection'
where appointment_type is null;

-- Deriva a duracao sem reescrever nenhum horario legado.
update public.appointment_requests
set duration_minutes = floor(extract(epoch from (requested_ends_at - requested_starts_at)) / 60)::integer
where duration_minutes is null
  and requested_starts_at is not null
  and requested_ends_at is not null
  and requested_ends_at > requested_starts_at;

alter table public.appointment_requests
  alter column appointment_type set default 'inspection',
  alter column appointment_type set not null;

alter table public.schedules
  alter column appointment_type set default 'inspection',
  alter column appointment_type set not null;

alter table public.appointment_requests
  drop constraint if exists appointment_requests_appointment_type_check,
  add constraint appointment_requests_appointment_type_check
    check (appointment_type in (
      'inspection',
      'follow_up_meeting',
      'results_meeting',
      'document_guidance',
      'training',
      'other'
    )),
  drop constraint if exists appointment_requests_duration_minutes_check,
  add constraint appointment_requests_duration_minutes_check
    check (duration_minutes is null or duration_minutes > 0),
  drop constraint if exists appointment_requests_non_inspection_sanitary_check,
  add constraint appointment_requests_non_inspection_sanitary_check
    check (
      appointment_type = 'inspection'
      or (
        inspection_id is null
        and report_due_at is null
        and report_due_source is null
        and report_pdf_path is null
        and compliance_score is null
        and sanitary_score is null
        and nutrition_score is null
        and critical_nc_count is null
        and important_nc_count is null
        and total_nc_count is null
        and recurring_nc_count is null
        and immediate_nc_count is null
        and coalesce(nc_items, '[]'::jsonb) = '[]'::jsonb
        and status not in ('in_progress', 'report_available')
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
      'other'
    )),
  drop constraint if exists schedules_duration_minutes_check,
  add constraint schedules_duration_minutes_check
    check (duration_minutes is null or duration_minutes > 0),
  drop constraint if exists schedules_non_inspection_inspection_check,
  add constraint schedules_non_inspection_inspection_check
    check (appointment_type = 'inspection' or inspection_id is null);

create or replace function private.enforce_sanitary_appointment_attachment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_appointment_type text;
begin
  if new.kind not in ('report_pdf', 'photo') then
    return new;
  end if;

  select ar.appointment_type
  into v_appointment_type
  from public.appointment_requests ar
  where ar.id = new.appointment_request_id;

  if not found or v_appointment_type <> 'inspection' then
    raise exception 'anexo sanitario exige compromisso do tipo inspection'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_sanitary_appointment_attachment
  on public.appointment_attachments;
create trigger enforce_sanitary_appointment_attachment
before insert or update of kind, appointment_request_id
on public.appointment_attachments
for each row execute function private.enforce_sanitary_appointment_attachment();

create index if not exists idx_appointment_requests_tenant_type
  on public.appointment_requests (tenant_id, appointment_type);

create index if not exists idx_schedules_tenant_type
  on public.schedules (tenant_id, appointment_type);

comment on column public.appointment_requests.appointment_type is
  'Finalidade controlada do compromisso. Registros legados sao inspection.';
comment on column public.appointment_requests.duration_minutes is
  'Duracao prevista do compromisso; horarios legados permanecem inalterados.';
comment on column public.schedules.appointment_type is
  'Finalidade controlada do compromisso confirmado. Apenas inspection pode vincular inspection_id.';

-- Base integral: 20260801134443_portal_main_folder_and_settings.sql.
-- Acrescenta o dominio do compromisso sem retirar configuracoes, pagamentos,
-- scores, NCs, contadores ou pastas ja retornados ao portal.
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

revoke all on function public.client_portal_overview(uuid) from public, authenticated;
grant execute on function public.client_portal_overview(uuid) to anon;
