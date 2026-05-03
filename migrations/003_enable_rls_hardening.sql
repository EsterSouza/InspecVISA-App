-- ============================================================
-- Migration 003 - Enable RLS and tenant policies safely
-- InspecVISA - RLS hardening
-- ============================================================
--
-- Safe to run from the Supabase SQL Editor. It enables RLS on the app tables,
-- moves helper functions to a private schema, and recreates policies
-- idempotently so reruns do not fail on existing policy names.
--
-- Before enabling in production, check whether operational rows have tenant_id:
--
--   SELECT 'clients' table_name, count(*) FROM public.clients WHERE tenant_id IS NULL
--   UNION ALL SELECT 'inspections', count(*) FROM public.inspections WHERE tenant_id IS NULL
--   UNION ALL SELECT 'responses', count(*) FROM public.responses WHERE tenant_id IS NULL
--   UNION ALL SELECT 'photos', count(*) FROM public.photos WHERE tenant_id IS NULL
--   UNION ALL SELECT 'schedules', count(*) FROM public.schedules WHERE tenant_id IS NULL;
--
-- Rows with NULL tenant_id will become invisible to the app after these policies.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.my_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.tenant_users
  WHERE user_id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = (SELECT auth.uid())
      AND tenant_id = p_tenant_id
      AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION private.is_tenant_staff(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = (SELECT auth.uid())
      AND tenant_id = p_tenant_id
      AND role IN ('admin', 'consultant')
  )
$$;

REVOKE ALL ON FUNCTION private.my_tenant_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_tenant_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_tenant_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.my_tenant_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_tenant_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_tenant_staff(UUID) TO authenticated;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_checklist_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.legislations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checklist_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT TO authenticated
  USING (id IN (SELECT private.my_tenant_ids()));
CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE TO authenticated
  USING (private.is_tenant_admin(id))
  WITH CHECK (private.is_tenant_admin(id));
CREATE POLICY "tenants_delete" ON public.tenants FOR DELETE TO authenticated
  USING (private.is_tenant_admin(id));

DROP POLICY IF EXISTS "tenant_users_select" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_insert" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_update" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_delete" ON public.tenant_users;
CREATE POLICY "tenant_users_select" ON public.tenant_users FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT private.my_tenant_ids())
    AND (private.is_tenant_staff(tenant_id) OR user_id = (SELECT auth.uid()))
  );
CREATE POLICY "tenant_users_insert" ON public.tenant_users FOR INSERT TO authenticated
  WITH CHECK (private.is_tenant_admin(tenant_id));
CREATE POLICY "tenant_users_update" ON public.tenant_users FOR UPDATE TO authenticated
  USING (private.is_tenant_admin(tenant_id))
  WITH CHECK (private.is_tenant_admin(tenant_id));
CREATE POLICY "tenant_users_delete" ON public.tenant_users FOR DELETE TO authenticated
  USING (private.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "tca_select" ON public.tenant_checklist_access;
DROP POLICY IF EXISTS "tca_insert" ON public.tenant_checklist_access;
DROP POLICY IF EXISTS "tca_update" ON public.tenant_checklist_access;
DROP POLICY IF EXISTS "tca_delete" ON public.tenant_checklist_access;
CREATE POLICY "tca_select" ON public.tenant_checklist_access FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()));
CREATE POLICY "tca_insert" ON public.tenant_checklist_access FOR INSERT TO authenticated
  WITH CHECK (private.is_tenant_admin(tenant_id));
CREATE POLICY "tca_update" ON public.tenant_checklist_access FOR UPDATE TO authenticated
  USING (private.is_tenant_admin(tenant_id))
  WITH CHECK (private.is_tenant_admin(tenant_id));
CREATE POLICY "tca_delete" ON public.tenant_checklist_access FOR DELETE TO authenticated
  USING (private.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id))
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated
  USING (private.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "inspections_select" ON public.inspections;
DROP POLICY IF EXISTS "inspections_insert" ON public.inspections;
DROP POLICY IF EXISTS "inspections_update" ON public.inspections;
DROP POLICY IF EXISTS "inspections_delete" ON public.inspections;
CREATE POLICY "inspections_select" ON public.inspections FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()));
CREATE POLICY "inspections_insert" ON public.inspections FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "inspections_update" ON public.inspections FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id))
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "inspections_delete" ON public.inspections FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "responses_select" ON public.responses;
DROP POLICY IF EXISTS "responses_insert" ON public.responses;
DROP POLICY IF EXISTS "responses_update" ON public.responses;
DROP POLICY IF EXISTS "responses_delete" ON public.responses;
CREATE POLICY "responses_select" ON public.responses FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()));
CREATE POLICY "responses_insert" ON public.responses FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "responses_update" ON public.responses FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id))
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "responses_delete" ON public.responses FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "schedules_select" ON public.schedules;
DROP POLICY IF EXISTS "schedules_insert" ON public.schedules;
DROP POLICY IF EXISTS "schedules_update" ON public.schedules;
DROP POLICY IF EXISTS "schedules_delete" ON public.schedules;
CREATE POLICY "schedules_select" ON public.schedules FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()));
CREATE POLICY "schedules_insert" ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "schedules_update" ON public.schedules FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id))
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "schedules_delete" ON public.schedules FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "photos_select" ON public.photos;
DROP POLICY IF EXISTS "photos_insert" ON public.photos;
DROP POLICY IF EXISTS "photos_update" ON public.photos;
DROP POLICY IF EXISTS "photos_delete" ON public.photos;
CREATE POLICY "photos_select" ON public.photos FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()));
CREATE POLICY "photos_insert" ON public.photos FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "photos_update" ON public.photos FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id))
  WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
CREATE POLICY "photos_delete" ON public.photos FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "legislations_authenticated_read" ON public.legislations;
DROP POLICY IF EXISTS "legislations_authenticated_write" ON public.legislations;
CREATE POLICY "legislations_authenticated_read" ON public.legislations FOR SELECT TO authenticated USING (true);
CREATE POLICY "legislations_authenticated_write" ON public.legislations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "checklist_templates_authenticated_read" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_authenticated_write" ON public.checklist_templates;
CREATE POLICY "checklist_templates_authenticated_read" ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_templates_authenticated_write" ON public.checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "checklist_sections_authenticated_read" ON public.checklist_sections;
DROP POLICY IF EXISTS "checklist_sections_authenticated_write" ON public.checklist_sections;
CREATE POLICY "checklist_sections_authenticated_read" ON public.checklist_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_sections_authenticated_write" ON public.checklist_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "checklist_items_authenticated_read" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items_authenticated_write" ON public.checklist_items;
CREATE POLICY "checklist_items_authenticated_read" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_items_authenticated_write" ON public.checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_authenticated_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_write" ON public.profiles;
CREATE POLICY "profiles_authenticated_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_authenticated_write" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
