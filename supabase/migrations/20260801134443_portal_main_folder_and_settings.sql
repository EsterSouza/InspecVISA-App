-- P360-002: pasta principal por conta e configuracao institucional do portal.
-- Migration aditiva: nao altera nem move as pastas sanitarias personalizadas
-- armazenadas em public.clients.
--
-- Rollback documentado (executar somente se a feature ainda nao tiver sido usada):
--   drop function if exists public.admin_save_client_portal_settings(uuid, text, text, boolean, boolean, boolean, boolean);
--   drop function if exists public.admin_update_client_portal_account_configuration(uuid, text, text, text);
--   drop table if exists public.client_portal_settings;
--   alter table public.client_portal_accounts drop constraint if exists client_portal_accounts_main_drive_folder_url_https;
--   alter table public.client_portal_accounts drop column if exists main_drive_folder_url;

alter table public.client_portal_accounts
  add column if not exists main_drive_folder_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_portal_accounts_main_drive_folder_url_https'
      and conrelid = 'public.client_portal_accounts'::regclass
  ) then
    alter table public.client_portal_accounts
      add constraint client_portal_accounts_main_drive_folder_url_https
      check (
        main_drive_folder_url is null
        or main_drive_folder_url ~* '^https://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?$'
      );
  end if;
end;
$$;

create table if not exists public.client_portal_settings (
  tenant_id uuid primary key,
  tutorial_pdf_url text,
  support_whatsapp text,
  quick_access_enabled boolean not null default true,
  multi_purpose_schedule boolean not null default false,
  action_plan_enabled boolean not null default false,
  service_requests_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_settings_tutorial_pdf_url_https check (
    tutorial_pdf_url is null
    or tutorial_pdf_url ~* '^https://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?$'
  ),
  constraint client_portal_settings_support_whatsapp_length check (
    support_whatsapp is null or char_length(support_whatsapp) <= 40
  )
);

alter table public.client_portal_settings enable row level security;

drop policy if exists "staff manage client portal settings" on public.client_portal_settings;
create policy "staff manage client portal settings"
  on public.client_portal_settings
  for all
  to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  )
  with check (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

revoke all on table public.client_portal_settings from public, anon, authenticated;
grant select, insert, update on table public.client_portal_settings to authenticated;

create or replace function public.admin_update_client_portal_account_configuration(
  p_account_id uuid,
  p_email text,
  p_username text,
  p_main_drive_folder_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_main_drive_folder_url text := nullif(btrim(coalesce(p_main_drive_folder_url, '')), '');
begin
  select tenant_id
  into v_tenant
  from public.client_portal_accounts
  where id = p_account_id;

  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  if v_email = '' then
    raise exception 'email obrigatorio';
  end if;

  if v_main_drive_folder_url is not null
     and v_main_drive_folder_url !~* '^https://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?$' then
    raise exception 'pasta principal deve usar uma URL HTTPS valida';
  end if;

  update public.client_portal_accounts
  set email = v_email,
      username = nullif(v_username, ''),
      main_drive_folder_url = v_main_drive_folder_url,
      updated_at = now()
  where id = p_account_id;
end;
$$;

revoke all on function public.admin_update_client_portal_account_configuration(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_client_portal_account_configuration(uuid, text, text, text)
  to authenticated;

create or replace function public.admin_save_client_portal_settings(
  p_tenant_id uuid,
  p_tutorial_pdf_url text,
  p_support_whatsapp text,
  p_quick_access_enabled boolean,
  p_multi_purpose_schedule boolean,
  p_action_plan_enabled boolean,
  p_service_requests_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutorial_pdf_url text := nullif(btrim(coalesce(p_tutorial_pdf_url, '')), '');
  v_support_whatsapp text := nullif(btrim(coalesce(p_support_whatsapp, '')), '');
begin
  if p_tenant_id is null
     or p_tenant_id not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(p_tenant_id) then
    raise exception 'sem permissao';
  end if;

  if v_tutorial_pdf_url is not null
     and v_tutorial_pdf_url !~* '^https://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?$' then
    raise exception 'tutorial deve usar uma URL HTTPS valida';
  end if;

  if v_support_whatsapp is not null and char_length(v_support_whatsapp) > 40 then
    raise exception 'WhatsApp de suporte invalido';
  end if;

  insert into public.client_portal_settings (
    tenant_id,
    tutorial_pdf_url,
    support_whatsapp,
    quick_access_enabled,
    multi_purpose_schedule,
    action_plan_enabled,
    service_requests_enabled
  ) values (
    p_tenant_id,
    v_tutorial_pdf_url,
    v_support_whatsapp,
    coalesce(p_quick_access_enabled, true),
    coalesce(p_multi_purpose_schedule, false),
    coalesce(p_action_plan_enabled, false),
    coalesce(p_service_requests_enabled, false)
  )
  on conflict (tenant_id) do update
  set tutorial_pdf_url = excluded.tutorial_pdf_url,
      support_whatsapp = excluded.support_whatsapp,
      quick_access_enabled = excluded.quick_access_enabled,
      multi_purpose_schedule = excluded.multi_purpose_schedule,
      action_plan_enabled = excluded.action_plan_enabled,
      service_requests_enabled = excluded.service_requests_enabled,
      updated_at = now();
end;
$$;

revoke all on function public.admin_save_client_portal_settings(uuid, text, text, boolean, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_save_client_portal_settings(uuid, text, text, boolean, boolean, boolean, boolean)
  to authenticated;

-- Base integral: 20260709060100_client_portal_overview_add_nc_stats.sql.
-- Preserva pagamentos, suspensao, scores, NCs, contadores e pastas por unidade.
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
          'nc_items', case
            when ar.report_hidden then '[]'::jsonb
            else coalesce(ar.nc_items, '[]'::jsonb)
          end,
          'report_count', case when ar.report_hidden then 0 else (
            select count(*)
            from public.appointment_attachments aa
            where aa.appointment_request_id = ar.id
              and aa.kind = 'report_pdf'
          ) end,
          'photo_count', (
            select count(*)
            from public.appointment_attachments aa
            where aa.appointment_request_id = ar.id
              and aa.kind = 'photo'
          ),
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
