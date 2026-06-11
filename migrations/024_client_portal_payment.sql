-- ============================================================
-- 024_client_portal_payment.sql
-- Pagamento por conta de portal: a equipe define link + tipo
-- (mensal/único) + situação (pendente/pago); o portal do cliente
-- mostra o status e um botão "Pagar agora" quando pendente.
-- ============================================================

alter table public.client_portal_accounts
  add column if not exists payment_type text check (payment_type in ('monthly','one_time')),
  add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  add column if not exists payment_link text,
  add column if not exists payment_updated_at timestamptz;

create or replace function public.admin_set_portal_payment(
  p_account_id uuid,
  p_type text,
  p_status text,
  p_link text
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
      payment_updated_at = now(),
      updated_at = now()
  where id = p_account_id;
end;
$$;

revoke execute on function public.admin_set_portal_payment(uuid, text, text, text) from anon;
grant execute on function public.admin_set_portal_payment(uuid, text, text, text) to authenticated;

-- client_portal_overview passa a expor o objeto payment (ver definição
-- completa aplicada via apply_migration: preserva contadores e pasta sanitária
-- e adiciona payment = { type, status, link, updated_at }).
