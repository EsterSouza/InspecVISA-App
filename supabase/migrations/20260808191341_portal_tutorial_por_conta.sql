-- PORT-04 — o tutorial do portal passa a ser de cada conta, não um só para todo mundo.
--
-- `client_portal_settings` tem UMA linha por tenant, então `tutorial_pdf_url` valia igual para
-- todos os clientes do portal. Nunca chegou a ser preenchido em produção — e ainda bem: se
-- estivesse, todo cliente estaria vendo o mesmo PDF.
--
-- A decisão da Ester (08/08/2026) é **por conta do portal**: a conta é o login, a empresa. A Rede
-- Sênior tem um tutorial, valendo para as 16 unidades dela. Por unidade seria personalização que
-- ninguém pediu e um link a manter por endereço.
--
-- O campo do tenant continua existindo como PADRÃO: a conta sem tutorial próprio cai nele. Assim
-- dá para ter um "tutorial do portal" genérico e sobrescrever só onde faz diferença, sem
-- preencher conta por conta.

alter table public.client_portal_accounts
  add column if not exists tutorial_pdf_url text;

-- Mesma trava de HTTPS que já vale para a Pasta Principal e para o tutorial do tenant: link de
-- documento do cliente não pode sair em http.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'client_portal_accounts_tutorial_pdf_url_https'
      and conrelid = 'public.client_portal_accounts'::regclass
  ) then
    alter table public.client_portal_accounts
      add constraint client_portal_accounts_tutorial_pdf_url_https
      check (
        tutorial_pdf_url is null
        or tutorial_pdf_url ~* '^https://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?$'
      );
  end if;
end;
$$;

-- ─── Quem grava ───────────────────────────────────────────────────────────────
--
-- Sobrecarga de 5 argumentos da RPC que a tela de "Editar acesso" já usa. A de 4 argumentos
-- **continua existindo e não é tocada**: ela nunca menciona `tutorial_pdf_url`, então um app
-- antigo em cache (PWA) que salve por ela preserva o tutorial em vez de apagá-lo. Foi por isso
-- que não virou um parâmetro com default na mesma função — aí a chamada de 4 argumentos passaria
-- a limpar o campo sem querer.

create or replace function public.admin_update_client_portal_account_configuration(
  p_account_id uuid,
  p_email text,
  p_username text,
  p_main_drive_folder_url text,
  p_tutorial_pdf_url text
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
  v_tutorial_pdf_url text := nullif(btrim(coalesce(p_tutorial_pdf_url, '')), '');
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

  if v_tutorial_pdf_url is not null
     and v_tutorial_pdf_url !~* '^https://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?$' then
    raise exception 'tutorial deve usar uma URL HTTPS valida';
  end if;

  update public.client_portal_accounts
  set email = v_email,
      username = nullif(v_username, ''),
      main_drive_folder_url = v_main_drive_folder_url,
      tutorial_pdf_url = v_tutorial_pdf_url,
      updated_at = now()
  where id = p_account_id;
end;
$$;

revoke all on function public.admin_update_client_portal_account_configuration(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_client_portal_account_configuration(uuid, text, text, text, text)
  to authenticated;

-- ─── Quem lê ──────────────────────────────────────────────────────────────────
--
-- Corpo idêntico ao que já estava em produção (PORT-01, `20260807174939_portal_feature_gates`),
-- com UMA linha nova: o tutorial da conta ganha do tutorial do tenant. Reescrita inteira porque
-- `create or replace` não aceita remendo.

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
