-- ============================================================
-- 023_client_portal_access_links_and_folder
-- - Client personalized sanitary folder metadata.
-- - Portal account username, visible staff code, and token rotation.
-- - Client portal overview/status exposes only client-facing folder links.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.clients
  add column if not exists has_personalized_sanitary_folder boolean not null default false,
  add column if not exists personalized_sanitary_folder_url text;

alter table public.client_portal_accounts
  add column if not exists username text,
  add column if not exists access_code_plain text;

update public.client_portal_accounts
set username = 'cliente-' || left(id::text, 8)
where username is null or btrim(username) = '';

create unique index if not exists idx_client_portal_accounts_username
  on public.client_portal_accounts (tenant_id, lower(username))
  where username is not null and btrim(username) <> '';

create or replace function public.admin_create_client_portal_account(
  p_tenant_id uuid,
  p_name text,
  p_email text,
  p_code text,
  p_client_ids uuid[],
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_id uuid;
begin
  if p_tenant_id is null
     or p_tenant_id not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(p_tenant_id) then
    raise exception 'sem permissao';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'nome e email sao obrigatorios';
  end if;
  if length(coalesce(p_code, '')) < 6 then
    raise exception 'codigo de acesso deve ter ao menos 6 caracteres';
  end if;
  if p_client_ids is null or array_length(p_client_ids, 1) is null then
    raise exception 'selecione ao menos uma unidade';
  end if;

  insert into public.client_portal_accounts (
    tenant_id, name, email, username, access_code_hash, access_code_plain
  )
  values (
    p_tenant_id,
    trim(p_name),
    lower(trim(p_email)),
    nullif(lower(trim(coalesce(p_username, ''))), ''),
    extensions.crypt(p_code, extensions.gen_salt('bf')),
    p_code
  )
  returning id into v_id;

  insert into public.client_portal_account_clients (account_id, client_id)
  select v_id, unnest(p_client_ids);

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[], text) to authenticated;

create or replace function public.admin_set_portal_access_code(p_account_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.client_portal_accounts where id = p_account_id;
  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;
  if length(coalesce(p_code, '')) < 6 then
    raise exception 'codigo de acesso deve ter ao menos 6 caracteres';
  end if;
  update public.client_portal_accounts
  set access_code_hash = extensions.crypt(p_code, extensions.gen_salt('bf')),
      access_code_plain = p_code,
      updated_at = now()
  where id = p_account_id;
end;
$$;

grant execute on function public.admin_set_portal_access_code(uuid, text) to authenticated;

create or replace function public.admin_regenerate_client_portal_token(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_tenant uuid;
  v_token uuid := gen_random_uuid();
begin
  select tenant_id into v_tenant from public.client_portal_accounts where id = p_account_id;
  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  update public.client_portal_accounts
  set portal_token = v_token,
      updated_at = now()
  where id = p_account_id;

  return jsonb_build_object('portal_token', v_token);
end;
$$;

grant execute on function public.admin_regenerate_client_portal_token(uuid) to authenticated;

create or replace function public.client_portal_login(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_identifier text := lower(trim(coalesce(p_email, '')));
  v_row public.client_portal_accounts%rowtype;
begin
  select * into v_row
  from public.client_portal_accounts
  where is_active
    and (
      lower(email) = v_identifier
      or lower(coalesce(username, '')) = v_identifier
    )
    and access_code_hash = extensions.crypt(coalesce(p_code, ''), access_code_hash)
  limit 1;

  if not found then
    return jsonb_build_object('error', 'credenciais invalidas');
  end if;

  return jsonb_build_object('portal_token', v_row.portal_token, 'account_name', v_row.name);
end;
$$;

grant execute on function public.client_portal_login(text, text) to anon;

create or replace function public.client_portal_overview(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
          'report_count', (
            select count(*) from public.appointment_attachments aa
            where aa.appointment_request_id = ar.id and aa.kind = 'report_pdf'
          ),
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

  return jsonb_build_object('account_name', v_account.name, 'units', v_units);
end;
$$;

grant execute on function public.client_portal_overview(uuid) to anon;

create or replace function public.public_get_appointment_status(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.appointment_requests%rowtype;
  v_folder boolean := false;
  v_folder_url text := null;
begin
  select * into v_row
  from public.appointment_requests
  where public_token = p_token;

  if not found then
    return jsonb_build_object('error', 'token invalido');
  end if;

  if v_row.client_id is not null then
    select
      coalesce(c.has_personalized_sanitary_folder, false),
      c.personalized_sanitary_folder_url
    into v_folder, v_folder_url
    from public.clients c
    where c.id = v_row.client_id
      and c.tenant_id = v_row.tenant_id
      and c.deleted_at is null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'client_id', v_row.client_id,
    'unit_name', v_row.unit_name,
    'district', v_row.district,
    'municipality', v_row.municipality,
    'attendance_mode', v_row.attendance_mode,
    'status', v_row.status,
    'requested_date', v_row.requested_date,
    'requested_period', v_row.requested_period,
    'requested_time', v_row.requested_time,
    'requested_starts_at', v_row.requested_starts_at,
    'requested_ends_at', v_row.requested_ends_at,
    'report_due_at', v_row.report_due_at,
    'report_due_source', v_row.report_due_source,
    'has_personalized_sanitary_folder', v_folder,
    'personalized_sanitary_folder_url', v_folder_url,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.public_get_appointment_status(uuid) to anon;
