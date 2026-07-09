-- Expõe as estatísticas de NC (critical_nc_count, important_nc_count, etc.) e a
-- lista compacta nc_items por visita na RPC pública do portal do cliente, para o
-- resumo executivo de rede (franchiseReport.ts). nc_items respeita report_hidden
-- igual ao report_count, para não vazar achados quando o relatório está oculto.
-- Base: definição viva em produção (20260627120000_portal_area_scores.sql).
create or replace function public.client_portal_overview(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      'state', c.state,
      'has_personalized_sanitary_folder', c.has_personalized_sanitary_folder,
      'personalized_sanitary_folder_url', c.personalized_sanitary_folder_url,
      'visits', coalesce((
        select jsonb_agg(jsonb_build_object(
          'public_token', ar.public_token,
          'unit_name', ar.unit_name,
          'status', ar.status,
          'requested_date', ar.requested_date,
          'requested_time', ar.requested_time,
          'report_due_at', ar.report_due_at,
          'compliance_score', ar.compliance_score,
          'sanitary_score', ar.sanitary_score,
          'nutrition_score', ar.nutrition_score,
          'critical_nc_count', ar.critical_nc_count,
          'important_nc_count', ar.important_nc_count,
          'total_nc_count', ar.total_nc_count,
          'recurring_nc_count', ar.recurring_nc_count,
          'immediate_nc_count', ar.immediate_nc_count,
          'nc_items', case when ar.report_hidden then '[]'::jsonb else coalesce(ar.nc_items, '[]'::jsonb) end,
          'report_count', case when ar.report_hidden then 0 else (
            select count(*) from public.appointment_attachments aa
            where aa.appointment_request_id = ar.id and aa.kind = 'report_pdf'
          ) end,
          'photo_count', (
            select count(*) from public.appointment_attachments aa
            where aa.appointment_request_id = ar.id and aa.kind = 'photo'
          ),
          'attachment_count', (
            select count(*) from public.appointment_attachments aa
            where aa.appointment_request_id = ar.id and aa.kind = 'attachment'
          ),
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
$function$;

grant execute on function public.client_portal_overview(uuid) to anon;
