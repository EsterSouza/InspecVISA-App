-- ============================================================
-- Migration 004 - Backfill missing tenant_id values
-- InspecVISA - run before enabling/enforcing RLS
-- ============================================================
--
-- This fixes records that would become invisible after tenant-scoped RLS.
-- It derives tenant_id through existing relationships instead of guessing:
-- inspections -> clients
-- responses   -> inspections
-- photos      -> responses
-- schedules   -> clients

BEGIN;

UPDATE public.inspections AS i
SET tenant_id = c.tenant_id
FROM public.clients AS c
WHERE i.tenant_id IS NULL
  AND i.client_id = c.id
  AND c.tenant_id IS NOT NULL;

UPDATE public.responses AS r
SET tenant_id = i.tenant_id
FROM public.inspections AS i
WHERE r.tenant_id IS NULL
  AND r.inspection_id = i.id
  AND i.tenant_id IS NOT NULL;

UPDATE public.photos AS p
SET tenant_id = r.tenant_id
FROM public.responses AS r
WHERE p.tenant_id IS NULL
  AND p.response_id = r.id
  AND r.tenant_id IS NOT NULL;

UPDATE public.schedules AS s
SET tenant_id = c.tenant_id
FROM public.clients AS c
WHERE s.tenant_id IS NULL
  AND s.client_id = c.id
  AND c.tenant_id IS NOT NULL;

COMMIT;

-- Verify after running:
--
-- SELECT 'clients' table_name, count(*) FROM public.clients WHERE tenant_id IS NULL
-- UNION ALL SELECT 'inspections', count(*) FROM public.inspections WHERE tenant_id IS NULL
-- UNION ALL SELECT 'responses', count(*) FROM public.responses WHERE tenant_id IS NULL
-- UNION ALL SELECT 'photos', count(*) FROM public.photos WHERE tenant_id IS NULL
-- UNION ALL SELECT 'schedules', count(*) FROM public.schedules WHERE tenant_id IS NULL;

