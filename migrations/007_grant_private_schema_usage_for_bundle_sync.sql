-- Migration 007 - Allow authenticated users to resolve private tenant helper functions
-- Required by public RPC/policies that reference private.my_tenant_ids()
-- and private.is_tenant_staff(). The helper functions themselves remain
-- explicitly execute-granted only to authenticated users.

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sync_batches TO authenticated;
GRANT SELECT, INSERT ON public.inspection_report_versions TO authenticated;
