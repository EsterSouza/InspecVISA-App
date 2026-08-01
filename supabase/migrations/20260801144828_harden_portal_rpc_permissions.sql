-- Harden legacy portal RPC grants without changing function behavior.
-- Public portal endpoints remain explicitly available to anon.

revoke all on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[]) from public, anon;
grant execute on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[]) to authenticated, service_role;

revoke all on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[], text) from public, anon;
grant execute on function public.admin_create_client_portal_account(uuid, text, text, text, uuid[], text) to authenticated, service_role;

revoke all on function public.admin_regenerate_client_portal_token(uuid) from public, anon;
grant execute on function public.admin_regenerate_client_portal_token(uuid) to authenticated, service_role;

revoke all on function public.admin_set_portal_access_code(uuid, text) from public, anon;
grant execute on function public.admin_set_portal_access_code(uuid, text) to authenticated, service_role;

revoke all on function public.admin_set_portal_payment(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_portal_payment(uuid, text, text, text) to authenticated, service_role;

revoke all on function public.admin_set_portal_payment(uuid, text, text, text, date) from public, anon;
grant execute on function public.admin_set_portal_payment(uuid, text, text, text, date) to authenticated, service_role;

revoke all on function public.admin_set_portal_payment(uuid, text, text, text, date, jsonb) from public, anon;
grant execute on function public.admin_set_portal_payment(uuid, text, text, text, date, jsonb) to authenticated, service_role;

revoke all on function public.admin_set_portal_scheduling_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_portal_scheduling_suspended(uuid, boolean) to authenticated, service_role;

revoke all on function public.admin_update_client_portal_account(uuid, text, text) from public, anon;
grant execute on function public.admin_update_client_portal_account(uuid, text, text) to authenticated, service_role;

-- These helpers are used by authenticated RLS policies, not by anonymous RPCs.
revoke all on function public.is_tenant_admin(uuid) from public, anon;
grant execute on function public.is_tenant_admin(uuid) to authenticated, service_role;

revoke all on function public.is_tenant_staff(uuid) from public, anon;
grant execute on function public.is_tenant_staff(uuid) to authenticated, service_role;

revoke all on function public.my_tenant_ids() from public, anon;
grant execute on function public.my_tenant_ids() to authenticated, service_role;

-- Trigger and maintenance functions must never be exposed through PostgREST.
revoke all on function public.notify_new_appointment() from public, anon, authenticated, service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
