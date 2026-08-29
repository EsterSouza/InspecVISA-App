-- AGD-02b (parte 2) — client_portal_overview passa a levar os marcos visíveis de cada unidade.
--
-- Corpo idêntico ao de 20260810200532_portal_service_dates.sql (a versão vigente em produção —
-- nenhuma migration entre aquela e esta redefine a função), com uma chave nova por unidade:
-- `milestones`, só os marcos com visible_to_client = true, mais leve que uma visita (sem hora,
-- sem status) — o portal decide como desenhar.

create or replace function public.client_portal_overview(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_units jsonb;
  v_gates jsonb;
  v_reports boolean;
  v_photos boolean;
  v_compliance boolean;
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

  v_gates := private.portal_account_gates(v_account.id);
  v_reports := coalesce((v_gates -> 'features' ->> 'reports')::boolean, true);
  v_photos := coalesce((v_gates -> 'features' ->> 'photos')::boolean, true);
  v_compliance := coalesce((v_gates -> 'features' ->> 'compliance')::boolean, true);

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

  -- O tutorial da conta ganha do padrão do tenant. Conta sem tutorial próprio continua vendo o
  -- genérico; conta com o dela vê o dela.
  v_tutorial_pdf_url := coalesce(v_account.tutorial_pdf_url, v_tutorial_pdf_url);

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
      'personalized_sanitary_folder_expected_delivery_date', c.personalized_sanitary_folder_expected_delivery_date,
      'has_audit_service', c.has_audit_service,
      'has_online_followup', c.has_online_followup,
      'milestones', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', cm.id,
          'title', cm.title,
          'note', cm.note,
          'milestone_date', cm.milestone_date,
          'done_at', cm.done_at
        ) order by cm.milestone_date)
        from public.client_milestones cm
        where cm.client_id = c.id
          and cm.tenant_id = v_account.tenant_id
          and cm.visible_to_client = true
      ), '[]'::jsonb),
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
          'report_delivered_at', case when ar.appointment_type = 'inspection' then ar.report_delivered_at end,
          -- Indicadores de conformidade seguem a trava `compliance` da conta.
          'compliance_score', case when v_compliance and ar.appointment_type = 'inspection' then ar.compliance_score end,
          'sanitary_score', case when v_compliance and ar.appointment_type = 'inspection' then ar.sanitary_score end,
          'nutrition_score', case when v_compliance and ar.appointment_type = 'inspection' then ar.nutrition_score end,
          'critical_nc_count', case when v_compliance and ar.appointment_type = 'inspection' then ar.critical_nc_count end,
          'important_nc_count', case when v_compliance and ar.appointment_type = 'inspection' then ar.important_nc_count end,
          'total_nc_count', case when v_compliance and ar.appointment_type = 'inspection' then ar.total_nc_count end,
          'recurring_nc_count', case when v_compliance and ar.appointment_type = 'inspection' then ar.recurring_nc_count end,
          'immediate_nc_count', case when v_compliance and ar.appointment_type = 'inspection' then ar.immediate_nc_count end,
          'nc_items', case
            when not v_compliance or ar.appointment_type <> 'inspection' or ar.report_hidden then '[]'::jsonb
            else coalesce(ar.nc_items, '[]'::jsonb)
          end,
          'report_count', case
            when not v_reports or ar.appointment_type <> 'inspection' or ar.report_hidden then 0
            else (
              select count(*)
              from public.appointment_attachments aa
              where aa.appointment_request_id = ar.id
                and aa.kind = 'report_pdf'
            )
          end,
          'photo_count', case
            when not v_photos or ar.appointment_type <> 'inspection' then 0
            else (
              select count(*)
              from public.appointment_attachments aa
              where aa.appointment_request_id = ar.id
                and aa.kind = 'photo'
            )
          end,
          'attachment_count', case
            when not v_reports then 0
            else (
              select count(*)
              from public.appointment_attachments aa
              where aa.appointment_request_id = ar.id
                and aa.kind = 'attachment'
            )
          end,
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
    'scheduling_suspended', coalesce((v_gates ->> 'scheduling_suspended')::boolean, false),
    'feature_gates', v_gates -> 'features',
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
$function$;

revoke all on function public.client_portal_overview(uuid) from public;
grant execute on function public.client_portal_overview(uuid) to anon;
grant execute on function public.client_portal_overview(uuid) to authenticated;
