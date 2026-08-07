-- PORT-01 — Central de acesso do portal por conta.
--
-- Até aqui, o que o cliente enxerga estava decidido em quatro lugares e três escopos:
-- `client_portal_settings` (tenant inteiro), `client_portal_accounts.scheduling_suspended`
-- (conta), `clients.has_*` (unidade) e `appointment_requests.report_hidden` (visita). Não
-- existia liga/desliga por CONTA para as entregas técnicas, e não existia liberação
-- programada em lugar nenhum.
--
-- Duas regras de produto que esta migration implementa, decididas pela Ester:
--
-- 1. **Inadimplência não apaga o que já foi entregue.** Antes, ligar "suspender
--    agendamento" fazia a edge function `client-appointment-assets` parar de assinar as URLs
--    de TODOS os anexos — o cliente via o relatório na lista e não conseguia abrir. Isso
--    acabou: suspensão passa a valer só para agendar. Esconder entrega é decisão separada,
--    explícita e por conta.
-- 2. **Suspensão de agendamento vira automática por atraso**, com trava manual de exceção
--    (`always_open`) para o cliente que ela sabe que vai pagar.
--
-- A liberação programada não precisa de cron nem job: quem decide é a LEITURA, comparando
-- com `now()` na hora em que o cliente abre o portal.

-- ─── Prazo de tolerância do tenant ────────────────────────────────────────────

alter table public.client_portal_settings
  add column if not exists overdue_grace_days integer not null default 5;

comment on column public.client_portal_settings.overdue_grace_days is
  'Dias de tolerância depois do vencimento antes de a conta contar como em atraso para os '
  'bloqueios automáticos do portal.';

-- ─── Modo de suspensão de agendamento, por conta ──────────────────────────────

alter table public.client_portal_accounts
  add column if not exists scheduling_suspension_mode text not null default 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'client_portal_accounts_scheduling_mode_check'
  ) then
    alter table public.client_portal_accounts
      add constraint client_portal_accounts_scheduling_mode_check
      check (scheduling_suspension_mode in ('auto', 'always_open', 'suspended'));
  end if;
end;
$$;

comment on column public.client_portal_accounts.scheduling_suspension_mode is
  'auto = suspende sozinho quando a conta está em atraso; always_open = trava manual que '
  'mantém liberado mesmo em atraso; suspended = suspenso manualmente, sempre.';

comment on column public.client_portal_accounts.scheduling_suspended is
  'LEGADO. Guarda apenas a parte manual do modo (mode = suspended). O valor efetivo vem de '
  'private.portal_account_gates, que também considera o atraso. Não ler direto.';

-- Quem já estava suspenso na mão continua suspenso na mão; o resto fica no `auto` do default,
-- que é a mudança de comportamento que a Ester pediu (suspende sozinho quando atrasa).
update public.client_portal_accounts
set scheduling_suspension_mode = 'suspended'
where scheduling_suspended
  and scheduling_suspension_mode <> 'suspended';

-- ─── Funções liberadas por conta ──────────────────────────────────────────────
--
-- Só as entregas técnicas entram aqui (decisão da Ester): relatórios e documentos, fotos,
-- plano de ação e indicadores de conformidade. Agendamento tem o modo próprio acima; o
-- tutorial, o WhatsApp e os acessos rápidos continuam no `client_portal_settings` do tenant.
-- Ausência de linha = liberado. Só o que a consultora tocou vira linha.

create table if not exists public.client_portal_account_features (
  account_id        uuid not null references public.client_portal_accounts(id) on delete cascade,
  tenant_id         uuid not null,
  feature           text not null,
  state             text not null default 'released',
  release_at        timestamptz,
  hide_at           timestamptz,
  lock_when_overdue boolean not null default false,
  updated_at        timestamptz not null default now(),
  updated_by        text,
  primary key (account_id, feature),
  constraint client_portal_account_features_feature_check
    check (feature in ('reports', 'photos', 'action_plan', 'compliance')),
  constraint client_portal_account_features_state_check
    check (state in ('released', 'hidden', 'scheduled')),
  -- "Liberar a partir de" sem data seria um bloqueio permanente disfarçado.
  constraint client_portal_account_features_scheduled_needs_date
    check (state <> 'scheduled' or release_at is not null)
);

create index if not exists client_portal_account_features_tenant_idx
  on public.client_portal_account_features (tenant_id);

alter table public.client_portal_account_features enable row level security;

revoke all on table public.client_portal_account_features from public;
revoke all on table public.client_portal_account_features from anon;
revoke all on table public.client_portal_account_features from authenticated;
grant select on table public.client_portal_account_features to authenticated;

drop policy if exists "staff reads portal features" on public.client_portal_account_features;
create policy "staff reads portal features"
  on public.client_portal_account_features for select to authenticated
  using (
    tenant_id in (select private.my_tenant_ids())
    and private.is_tenant_staff(tenant_id)
  );

-- ─── Resolução: a única fonte de verdade do que está liberado ─────────────────

create or replace function private.portal_account_gates(p_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_grace integer;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_overdue boolean;
  v_features jsonb;
begin
  select * into v_account
  from public.client_portal_accounts
  where id = p_account_id;

  if not found then
    return jsonb_build_object(
      'overdue', false,
      'scheduling_suspended', true,
      'features', jsonb_build_object(
        'reports', false, 'photos', false, 'action_plan', false, 'compliance', false
      )
    );
  end if;

  select overdue_grace_days into v_grace
  from public.client_portal_settings
  where tenant_id = v_account.tenant_id;
  v_grace := coalesce(v_grace, 5);

  -- Atraso exige data de vencimento explícita. Sem isso, toda conta que nunca teve
  -- vencimento cadastrado (a maioria hoje) seria cortada sozinha na primeira leitura.
  v_overdue := coalesce(v_account.payment_status, 'pending') <> 'paid'
    and v_account.payment_due_date is not null
    and v_today > v_account.payment_due_date + v_grace;

  select jsonb_object_agg(
    known.feature,
    case
      when caf.feature is null then true
      when caf.state = 'hidden' then false
      when caf.state = 'scheduled' and (caf.release_at is null or now() < caf.release_at) then false
      else true
    end
    and (caf.hide_at is null or now() < caf.hide_at)
    and not (coalesce(caf.lock_when_overdue, false) and v_overdue)
  )
  into v_features
  from (values ('reports'), ('photos'), ('action_plan'), ('compliance')) as known(feature)
  left join public.client_portal_account_features caf
    on caf.account_id = p_account_id
   and caf.feature = known.feature;

  return jsonb_build_object(
    'overdue', v_overdue,
    'payment_due_date', v_account.payment_due_date,
    'grace_days', v_grace,
    'scheduling_suspended', case v_account.scheduling_suspension_mode
      when 'suspended' then true
      when 'always_open' then false
      else v_overdue
    end,
    'features', coalesce(v_features, '{}'::jsonb)
  );
end;
$function$;

revoke all on function private.portal_account_gates(uuid) from public;
revoke all on function private.portal_account_gates(uuid) from anon;
revoke all on function private.portal_account_gates(uuid) from authenticated;

-- ─── Leitura das travas pelo cliente (usada pela Edge Function) ───────────────

create or replace function public.client_portal_feature_gates(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_account_id uuid;
begin
  select id into v_account_id
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  return private.portal_account_gates(v_account_id);
end;
$function$;

revoke all on function public.client_portal_feature_gates(uuid) from public;
grant execute on function public.client_portal_feature_gates(uuid) to anon;
grant execute on function public.client_portal_feature_gates(uuid) to authenticated;

-- ─── Ações de staff ───────────────────────────────────────────────────────────

create or replace function public.admin_set_portal_feature(
  p_account_id uuid,
  p_feature text,
  p_state text,
  p_release_at timestamptz default null,
  p_hide_at timestamptz default null,
  p_lock_when_overdue boolean default false,
  p_updated_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_feature text := lower(trim(coalesce(p_feature, '')));
  v_state text := lower(trim(coalesce(p_state, '')));
begin
  if v_feature not in ('reports', 'photos', 'action_plan', 'compliance') then
    return jsonb_build_object('error', 'funcao invalida');
  end if;

  if v_state not in ('released', 'hidden', 'scheduled') then
    return jsonb_build_object('error', 'situacao invalida');
  end if;

  if v_state = 'scheduled' and p_release_at is null then
    return jsonb_build_object('error', 'liberacao programada exige data');
  end if;

  select tenant_id into v_tenant
  from public.client_portal_accounts
  where id = p_account_id;

  if v_tenant is null or not private.is_tenant_staff(v_tenant) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  insert into public.client_portal_account_features as caf (
    account_id, tenant_id, feature, state, release_at, hide_at, lock_when_overdue, updated_by
  ) values (
    p_account_id, v_tenant, v_feature, v_state,
    case when v_state = 'scheduled' then p_release_at end,
    p_hide_at,
    coalesce(p_lock_when_overdue, false),
    nullif(trim(coalesce(p_updated_by, '')), '')
  )
  on conflict (account_id, feature) do update set
    state = excluded.state,
    release_at = excluded.release_at,
    hide_at = excluded.hide_at,
    lock_when_overdue = excluded.lock_when_overdue,
    updated_by = excluded.updated_by,
    updated_at = now();

  return jsonb_build_object('ok', true, 'feature', v_feature, 'state', v_state);
end;
$function$;

revoke all on function public.admin_set_portal_feature(uuid, text, text, timestamptz, timestamptz, boolean, text) from public;
revoke all on function public.admin_set_portal_feature(uuid, text, text, timestamptz, timestamptz, boolean, text) from anon;
grant execute on function public.admin_set_portal_feature(uuid, text, text, timestamptz, timestamptz, boolean, text) to authenticated;

-- RPC própria em vez de mais um parâmetro em `admin_save_client_portal_settings`: acrescentar
-- argumento com default naquela função criaria uma sobrecarga ambígua com a chamada atual.
create or replace function public.admin_set_portal_overdue_grace_days(
  p_tenant_id uuid,
  p_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_days is null or p_days < 0 or p_days > 180 then
    return jsonb_build_object('error', 'tolerancia invalida');
  end if;

  if not private.is_tenant_staff(p_tenant_id) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  insert into public.client_portal_settings (tenant_id, overdue_grace_days)
  values (p_tenant_id, p_days)
  on conflict (tenant_id) do update set overdue_grace_days = excluded.overdue_grace_days;

  return jsonb_build_object('ok', true, 'overdue_grace_days', p_days);
end;
$function$;

revoke all on function public.admin_set_portal_overdue_grace_days(uuid, integer) from public;
revoke all on function public.admin_set_portal_overdue_grace_days(uuid, integer) from anon;
grant execute on function public.admin_set_portal_overdue_grace_days(uuid, integer) to authenticated;

create or replace function public.admin_set_portal_scheduling_mode(
  p_account_id uuid,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid;
  v_mode text := lower(trim(coalesce(p_mode, '')));
begin
  if v_mode not in ('auto', 'always_open', 'suspended') then
    return jsonb_build_object('error', 'modo invalido');
  end if;

  select tenant_id into v_tenant
  from public.client_portal_accounts
  where id = p_account_id;

  if v_tenant is null or not private.is_tenant_staff(v_tenant) then
    return jsonb_build_object('error', 'sem permissao');
  end if;

  update public.client_portal_accounts
  set scheduling_suspension_mode = v_mode,
      -- Coluna legada mantida em sincronia só com a parte manual, para leitor antigo.
      scheduling_suspended = (v_mode = 'suspended'),
      updated_at = now()
  where id = p_account_id;

  return jsonb_build_object('ok', true, 'mode', v_mode);
end;
$function$;

revoke all on function public.admin_set_portal_scheduling_mode(uuid, text) from public;
revoke all on function public.admin_set_portal_scheduling_mode(uuid, text) from anon;
grant execute on function public.admin_set_portal_scheduling_mode(uuid, text) to authenticated;

-- O toggle antigo continua existindo e passa a escrever o modo, para não quebrar nada que
-- ainda o chame enquanto o app novo não estiver publicado.
create or replace function public.admin_set_portal_scheduling_suspended(
  p_account_id uuid,
  p_suspended boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  v_result := public.admin_set_portal_scheduling_mode(
    p_account_id,
    case when coalesce(p_suspended, false) then 'suspended' else 'auto' end
  );
  if v_result ? 'error' then
    raise exception '%', v_result ->> 'error';
  end if;
end;
$function$;

revoke all on function public.admin_set_portal_scheduling_suspended(uuid, boolean) from public;
revoke all on function public.admin_set_portal_scheduling_suspended(uuid, boolean) from anon;
grant execute on function public.admin_set_portal_scheduling_suspended(uuid, boolean) to authenticated;

-- ─── Aplicar as travas na leitura do cliente ──────────────────────────────────

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

grant execute on function public.client_portal_overview(uuid) to anon;
grant execute on function public.client_portal_overview(uuid) to authenticated;

-- Plano de ação também respeita a trava da conta.
create or replace function public.client_portal_action_items(
  p_token uuid,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.client_portal_accounts%rowtype;
  v_today date;
  v_items jsonb;
begin
  select * into v_account
  from public.client_portal_accounts
  where portal_token = p_token
    and is_active;

  if not found then
    return jsonb_build_object('error', 'acesso invalido');
  end if;

  if not coalesce(
    (private.portal_account_gates(v_account.id) -> 'features' ->> 'action_plan')::boolean,
    true
  ) then
    return jsonb_build_object('items', '[]'::jsonb);
  end if;

  if p_client_id is not null and not exists (
    select 1
    from public.client_portal_account_clients ac
    join public.clients c
      on c.id = ac.client_id
     and c.tenant_id = v_account.tenant_id
     and c.deleted_at is null
    where ac.account_id = v_account.id
      and ac.client_id = p_client_id
  ) then
    return jsonb_build_object('error', 'unidade fora do acesso');
  end if;

  -- Prazo vencido é sempre "hoje no Brasil": o servidor roda em UTC e, entre 21h e 24h BRT,
  -- comparar com a data UTC marcaria como vencido um item que ainda vence hoje.
  v_today := (now() at time zone 'America/Sao_Paulo')::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cai.id,
        'client_id', cai.client_id,
        'unit_name', c.name,
        'title', cai.title,
        'situation', cai.situation,
        'recommended_action', cai.recommended_action,
        'priority', cai.priority,
        'responsible', cai.responsible,
        'due_date', cai.due_date,
        'status', cai.status,
        'is_overdue', cai.status = 'published' and cai.due_date is not null and cai.due_date < v_today,
        'occurrence_count', cai.occurrence_count,
        'first_detected_on', cai.first_detected_on,
        'last_detected_on', cai.last_detected_on,
        'resolved_at', cai.resolved_at,
        'visit_token', ar.public_token
      )
      order by
        (cai.status = 'resolved'),
        (cai.due_date is null),
        cai.due_date,
        case cai.priority when 'urgent' then 1 when 'important' then 2 else 3 end,
        cai.title
    ),
    '[]'::jsonb
  )
  into v_items
  from public.client_action_items cai
  join public.client_portal_account_clients ac
    on ac.client_id = cai.client_id
   and ac.account_id = v_account.id
  join public.clients c
    on c.id = cai.client_id
   and c.tenant_id = v_account.tenant_id
   and c.deleted_at is null
  left join public.appointment_requests ar
    on ar.id = cai.appointment_request_id
   and ar.tenant_id = v_account.tenant_id
  where cai.tenant_id = v_account.tenant_id
    and (p_client_id is null or cai.client_id = p_client_id)
    and (cai.status = 'published' or (cai.status = 'resolved' and cai.published_at is not null))
    and coalesce(ar.report_hidden, false) = false;

  return jsonb_build_object('items', v_items);
end;
$function$;

revoke all on function public.client_portal_action_items(uuid, uuid) from public;
grant execute on function public.client_portal_action_items(uuid, uuid) to anon;
grant execute on function public.client_portal_action_items(uuid, uuid) to authenticated;

-- ─── Agendamento passa a ler o modo resolvido ─────────────────────────────────
--
-- `client_portal_create_appointment` tem ~100 linhas de regra de agenda que não mudam aqui.
-- Em vez de reescrevê-la inteira (e arriscar perder uma regra na transcrição), a definição
-- viva é lida e só a linha da suspensão é trocada. Se o marcador não existir mais, a
-- migration FALHA em vez de deixar a trava velha em produção sem ninguém perceber.

do $$
declare
  v_def text;
  v_old text := 'if coalesce(v_account.scheduling_suspended, false) then';
  v_new text := 'if coalesce((private.portal_account_gates(v_account.id) ->> ''scheduling_suspended'')::boolean, false) then';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'client_portal_create_appointment';

  if v_def is null then
    raise notice 'client_portal_create_appointment ausente (fixture de teste); nada a ajustar';
    return;
  end if;

  if position(v_new in v_def) > 0 then
    raise notice 'client_portal_create_appointment ja le o modo resolvido';
    return;
  end if;

  if position(v_old in v_def) = 0 then
    raise exception 'client_portal_create_appointment mudou: a trava de suspensao nao foi encontrada';
  end if;

  execute replace(v_def, v_old, v_new);
end;
$$;
