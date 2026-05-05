-- Durable server-side sync queue for inspection bundles.
-- Additive only: does not alter existing inspection/template data.

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id UUID NOT NULL,
  client_sync_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  payload JSONB NOT NULL,
  result JSONB,
  created_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT sync_jobs_unique_client_sync
    UNIQUE (tenant_id, inspection_id, client_sync_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_status
  ON public.sync_jobs(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_inspection
  ON public.sync_jobs(tenant_id, inspection_id, created_at DESC);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.sync_jobs TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_jobs'
      AND policyname = 'sync_jobs_select_tenant'
  ) THEN
    CREATE POLICY sync_jobs_select_tenant ON public.sync_jobs
      FOR SELECT TO authenticated
      USING (
        private.is_tenant_staff(tenant_id)
      );
  END IF;
END $$;
