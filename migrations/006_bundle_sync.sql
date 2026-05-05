-- Migration 006 - Online-first inspection bundle sync
-- Additive only: no deletes, truncates, template changes, or local ID rewrites.

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS dependency_level1 INTEGER,
  ADD COLUMN IF NOT EXISTS dependency_level2 INTEGER,
  ADD COLUMN IF NOT EXISTS dependency_level3 INTEGER;

CREATE TABLE IF NOT EXISTS public.sync_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id UUID NOT NULL,
  client_sync_id TEXT,
  status TEXT NOT NULL DEFAULT 'syncing' CHECK (status IN ('pending', 'syncing', 'synced', 'failed', 'conflict')),
  error TEXT,
  payload JSONB,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_batches_tenant_inspection
  ON public.sync_batches(tenant_id, inspection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_batches_status
  ON public.sync_batches(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.inspection_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, version)
);

CREATE INDEX IF NOT EXISTS idx_report_versions_tenant_inspection
  ON public.inspection_report_versions(tenant_id, inspection_id, version DESC);

ALTER TABLE public.sync_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_report_versions ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sync_batches TO authenticated;
GRANT SELECT, INSERT ON public.inspection_report_versions TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_batches'
      AND policyname = 'sync_batches_select_tenant'
  ) THEN
    CREATE POLICY sync_batches_select_tenant ON public.sync_batches
      FOR SELECT
      USING (tenant_id IN (SELECT private.my_tenant_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_batches'
      AND policyname = 'sync_batches_insert_staff'
  ) THEN
    CREATE POLICY sync_batches_insert_staff ON public.sync_batches
      FOR INSERT
      WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_batches'
      AND policyname = 'sync_batches_update_staff'
  ) THEN
    CREATE POLICY sync_batches_update_staff ON public.sync_batches
      FOR UPDATE
      USING (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id))
      WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inspection_report_versions'
      AND policyname = 'report_versions_select_tenant'
  ) THEN
    CREATE POLICY report_versions_select_tenant ON public.inspection_report_versions
      FOR SELECT
      USING (tenant_id IN (SELECT private.my_tenant_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inspection_report_versions'
      AND policyname = 'report_versions_insert_staff'
  ) THEN
    CREATE POLICY report_versions_insert_staff ON public.inspection_report_versions
      FOR INSERT
      WITH CHECK (tenant_id IN (SELECT private.my_tenant_ids()) AND private.is_tenant_staff(tenant_id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_inspection_bundle(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  v_inspection JSONB := p_payload->'inspection';
  v_responses JSONB := COALESCE(p_payload->'responses', '[]'::jsonb);
  v_photos JSONB := COALESCE(p_payload->'photos', '[]'::jsonb);
  v_finalize_report BOOLEAN := COALESCE((p_payload->>'finalizeReport')::boolean, false);
  v_tenant_id UUID;
  v_inspection_id UUID;
  v_batch_id UUID;
  v_report_version_id UUID;
  v_next_version INTEGER;
  v_server_updated_at TIMESTAMPTZ := now();
  v_response JSONB;
  v_photo JSONB;
BEGIN
  IF v_inspection IS NULL THEN
    RAISE EXCEPTION 'Payload sem inspection';
  END IF;

  v_tenant_id := COALESCE(v_inspection->>'tenant_id', v_inspection->>'tenantId')::uuid;
  v_inspection_id := (v_inspection->>'id')::uuid;

  IF v_tenant_id IS NULL OR v_inspection_id IS NULL THEN
    RAISE EXCEPTION 'Payload sem tenant_id ou inspection.id';
  END IF;

  IF NOT private.is_tenant_staff(v_tenant_id) THEN
    RAISE EXCEPTION 'Usuario sem permissao para sincronizar este tenant';
  END IF;

  INSERT INTO public.sync_batches (
    tenant_id,
    inspection_id,
    client_sync_id,
    status,
    payload,
    updated_at
  )
  VALUES (
    v_tenant_id,
    v_inspection_id,
    p_payload->>'clientSyncId',
    'syncing',
    p_payload,
    v_server_updated_at
  )
  RETURNING id INTO v_batch_id;

  INSERT INTO public.inspections (
    id,
    client_id,
    template_id,
    consultant_name,
    inspection_date,
    status,
    observations,
    ilpi_capacity,
    residents_total,
    residents_male,
    residents_female,
    dependency_level1,
    dependency_level2,
    dependency_level3,
    dependency_level_1,
    dependency_level_2,
    dependency_level_3,
    accompanist_name,
    accompanist_role,
    signature_data_url,
    completed_at,
    deleted_at,
    created_at,
    updated_at,
    tenant_id
  )
  VALUES (
    v_inspection_id,
    (v_inspection->>'client_id')::uuid,
    v_inspection->>'template_id',
    v_inspection->>'consultant_name',
    (v_inspection->>'inspection_date')::timestamptz,
    v_inspection->>'status',
    NULLIF(v_inspection->>'observations', ''),
    NULLIF(v_inspection->>'ilpi_capacity', '')::integer,
    NULLIF(v_inspection->>'residents_total', '')::integer,
    NULLIF(v_inspection->>'residents_male', '')::integer,
    NULLIF(v_inspection->>'residents_female', '')::integer,
    NULLIF(v_inspection->>'dependency_level1', '')::integer,
    NULLIF(v_inspection->>'dependency_level2', '')::integer,
    NULLIF(v_inspection->>'dependency_level3', '')::integer,
    NULLIF(v_inspection->>'dependency_level_1', '')::integer,
    NULLIF(v_inspection->>'dependency_level_2', '')::integer,
    NULLIF(v_inspection->>'dependency_level_3', '')::integer,
    NULLIF(v_inspection->>'accompanist_name', ''),
    NULLIF(v_inspection->>'accompanist_role', ''),
    NULLIF(v_inspection->>'signature_data_url', ''),
    NULLIF(v_inspection->>'completed_at', '')::timestamptz,
    NULLIF(v_inspection->>'deleted_at', '')::timestamptz,
    COALESCE(NULLIF(v_inspection->>'created_at', '')::timestamptz, v_server_updated_at),
    COALESCE(NULLIF(v_inspection->>'updated_at', '')::timestamptz, v_server_updated_at),
    v_tenant_id
  )
  ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    template_id = EXCLUDED.template_id,
    consultant_name = EXCLUDED.consultant_name,
    inspection_date = EXCLUDED.inspection_date,
    status = EXCLUDED.status,
    observations = EXCLUDED.observations,
    ilpi_capacity = EXCLUDED.ilpi_capacity,
    residents_total = EXCLUDED.residents_total,
    residents_male = EXCLUDED.residents_male,
    residents_female = EXCLUDED.residents_female,
    dependency_level1 = EXCLUDED.dependency_level1,
    dependency_level2 = EXCLUDED.dependency_level2,
    dependency_level3 = EXCLUDED.dependency_level3,
    dependency_level_1 = EXCLUDED.dependency_level_1,
    dependency_level_2 = EXCLUDED.dependency_level_2,
    dependency_level_3 = EXCLUDED.dependency_level_3,
    accompanist_name = EXCLUDED.accompanist_name,
    accompanist_role = EXCLUDED.accompanist_role,
    signature_data_url = EXCLUDED.signature_data_url,
    completed_at = EXCLUDED.completed_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = EXCLUDED.updated_at,
    tenant_id = EXCLUDED.tenant_id
  WHERE public.inspections.tenant_id = v_tenant_id
     OR public.inspections.tenant_id IS NULL;

  IF NOT EXISTS (
    SELECT 1
      FROM public.inspections
     WHERE id = v_inspection_id
       AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Inspecao nao pertence ao tenant informado';
  END IF;

  FOR v_response IN SELECT * FROM jsonb_array_elements(v_responses)
  LOOP
    IF COALESCE(v_response->>'tenant_id', v_response->>'tenantId')::uuid IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'Resposta com tenant_id divergente';
    END IF;

    INSERT INTO public.responses (
      id,
      inspection_id,
      item_id,
      result,
      situation_description,
      corrective_action,
      responsible,
      deadline,
      custom_description,
      deleted_at,
      created_at,
      updated_at,
      tenant_id
    )
    VALUES (
      (v_response->>'id')::uuid,
      v_inspection_id,
      v_response->>'item_id',
      v_response->>'result',
      NULLIF(v_response->>'situation_description', ''),
      NULLIF(v_response->>'corrective_action', ''),
      NULLIF(v_response->>'responsible', ''),
      NULLIF(v_response->>'deadline', ''),
      NULLIF(v_response->>'custom_description', ''),
      NULLIF(v_response->>'deleted_at', '')::timestamptz,
      COALESCE(NULLIF(v_response->>'created_at', '')::timestamptz, v_server_updated_at),
      COALESCE(NULLIF(v_response->>'updated_at', '')::timestamptz, v_server_updated_at),
      v_tenant_id
    )
    ON CONFLICT (id) DO UPDATE SET
      inspection_id = EXCLUDED.inspection_id,
      item_id = EXCLUDED.item_id,
      result = EXCLUDED.result,
      situation_description = EXCLUDED.situation_description,
      corrective_action = EXCLUDED.corrective_action,
      responsible = EXCLUDED.responsible,
      deadline = EXCLUDED.deadline,
      custom_description = EXCLUDED.custom_description,
      deleted_at = EXCLUDED.deleted_at,
      updated_at = EXCLUDED.updated_at,
      tenant_id = EXCLUDED.tenant_id
    WHERE public.responses.tenant_id = v_tenant_id
       OR public.responses.tenant_id IS NULL;
  END LOOP;

  FOR v_photo IN SELECT * FROM jsonb_array_elements(v_photos)
  LOOP
    IF COALESCE(v_photo->>'tenant_id', v_photo->>'tenantId')::uuid IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'Foto com tenant_id divergente';
    END IF;

    INSERT INTO public.photos (
      id,
      response_id,
      data_url,
      caption,
      taken_at,
      updated_at,
      deleted_at,
      tenant_id
    )
    VALUES (
      (v_photo->>'id')::uuid,
      (v_photo->>'response_id')::uuid,
      NULLIF(v_photo->>'data_url', ''),
      NULLIF(v_photo->>'caption', ''),
      COALESCE(NULLIF(v_photo->>'taken_at', '')::timestamptz, v_server_updated_at),
      COALESCE(NULLIF(v_photo->>'updated_at', '')::timestamptz, v_server_updated_at),
      NULLIF(v_photo->>'deleted_at', '')::timestamptz,
      v_tenant_id
    )
    ON CONFLICT (id) DO UPDATE SET
      response_id = EXCLUDED.response_id,
      data_url = EXCLUDED.data_url,
      caption = EXCLUDED.caption,
      taken_at = EXCLUDED.taken_at,
      updated_at = EXCLUDED.updated_at,
      deleted_at = EXCLUDED.deleted_at,
      tenant_id = EXCLUDED.tenant_id
    WHERE public.photos.tenant_id = v_tenant_id
       OR public.photos.tenant_id IS NULL;
  END LOOP;

  IF v_finalize_report THEN
    SELECT COALESCE(MAX(version), 0) + 1
      INTO v_next_version
      FROM public.inspection_report_versions
     WHERE inspection_id = v_inspection_id
       AND tenant_id = v_tenant_id;

    INSERT INTO public.inspection_report_versions (
      tenant_id,
      inspection_id,
      version,
      snapshot_json,
      created_by
    )
    VALUES (
      v_tenant_id,
      v_inspection_id,
      v_next_version,
      p_payload,
      auth.uid()
    )
    RETURNING id INTO v_report_version_id;
  END IF;

  UPDATE public.sync_batches
     SET status = 'synced',
         error = NULL,
         result = jsonb_build_object(
           'ok', true,
           'inspectionId', v_inspection_id,
           'syncBatchId', v_batch_id,
           'serverUpdatedAt', v_server_updated_at,
           'reportVersionId', v_report_version_id,
           'failedItems', '[]'::jsonb
         ),
         updated_at = v_server_updated_at
   WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'inspectionId', v_inspection_id,
    'syncBatchId', v_batch_id,
    'serverUpdatedAt', v_server_updated_at,
    'reportVersionId', v_report_version_id,
    'failedItems', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_inspection_bundle(JSONB) TO authenticated;
