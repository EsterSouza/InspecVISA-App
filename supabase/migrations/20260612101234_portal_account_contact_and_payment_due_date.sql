alter table public.client_portal_accounts
  add column if not exists payment_due_date date;

create unique index if not exists idx_client_portal_accounts_username
  on public.client_portal_accounts (tenant_id, lower(username))
  where username is not null and btrim(username) <> '';

create or replace function public.admin_update_client_portal_account(
  p_account_id uuid,
  p_email text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_tenant uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_username text := lower(trim(coalesce(p_username, '')));
begin
  select tenant_id into v_tenant from public.client_portal_accounts where id = p_account_id;
  if v_tenant is null
     or v_tenant not in (select private.my_tenant_ids())
     or not private.is_tenant_staff(v_tenant) then
    raise exception 'sem permissao';
  end if;

  if v_email = '' then
    raise exception 'email obrigatorio';
  end if;

  update public.client_portal_accounts
  set email = v_email,
      username = nullif(v_username, ''),
      updated_at = now()
  where id = p_account_id;
end;
$$;

revoke execute on function public.admin_update_client_portal_account(uuid, text, text) from public;
revoke execute on function public.admin_update_client_portal_account(uuid, text, text) from anon;
grant execute on function public.admin_update_client_portal_account(uuid, text, text) to authenticated;

create or replace function public.admin_set_portal_payment(
  p_account_id uuid,
  p_type text,
  p_status text,
  p_link text,
  p_due_date date default null
)
returns void
language plpgsql
security definer
set search_path = public, private
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
  if p_type is not null and p_type not in ('monthly','one_time') then
    raise exception 'tipo de pagamento invalido';
  end if;
  if coalesce(p_status,'pending') not in ('pending','paid') then
    raise exception 'status de pagamento invalido';
  end if;

  update public.client_portal_accounts
  set payment_type = p_type,
      payment_status = coalesce(p_status, 'pending'),
      payment_link = nullif(trim(p_link), ''),
      payment_due_date = case when p_type = 'monthly' then p_due_date else null end,
      payment_updated_at = now(),
      updated_at = now()
  where id = p_account_id;
end;
$$;

revoke execute on function public.admin_set_portal_payment(uuid, text, text, text, date) from public;
revoke execute on function public.admin_set_portal_payment(uuid, text, text, text, date) from anon;
grant execute on function public.admin_set_portal_payment(uuid, text, text, text, date) to authenticated;

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
          'compliance_score', ar.compliance_score,
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

  return jsonb_build_object(
    'account_name', v_account.name,
    'payment', jsonb_build_object(
      'type', v_account.payment_type,
      'status', coalesce(v_account.payment_status, 'pending'),
      'link', v_account.payment_link,
      'due_date', v_account.payment_due_date,
      'updated_at', v_account.payment_updated_at
    ),
    'units', v_units
  );
end;
$$;

grant execute on function public.client_portal_overview(uuid) to anon;
