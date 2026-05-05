-- Migration 009 - Vectorize bundle sync RPC
-- Keeps SECURITY INVOKER/RLS in place, but replaces row-by-row response/photo
-- loops with set-based jsonb_to_recordset upserts.

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
  v_invalid_count INTEGER;
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

  SELECT COUNT(*)
    INTO v_invalid_count
    FROM jsonb_to_recordset(v_responses) AS r(tenant_id UUID)
   WHERE r.tenant_id IS DISTINCT FROM v_tenant_id;

  IF v_invalid_count > 0 THEN
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
  SELECT
    r.id,
    v_inspection_id,
    r.item_id,
    r.result,
    NULLIF(r.situation_description, ''),
    NULLIF(r.corrective_action, ''),
    NULLIF(r.responsible, ''),
    NULLIF(r.deadline, ''),
    NULLIF(r.custom_description, ''),
    r.deleted_at,
    COALESCE(r.created_at, v_server_updated_at),
    COALESCE(r.updated_at, v_server_updated_at),
    v_tenant_id
  FROM jsonb_to_recordset(v_responses) AS r(
    id UUID,
    item_id TEXT,
    result TEXT,
    situation_description TEXT,
    corrective_action TEXT,
    responsible TEXT,
    deadline TEXT,
    custom_description TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    tenant_id UUID
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

  SELECT COUNT(*)
    INTO v_invalid_count
    FROM jsonb_to_recordset(v_photos) AS p(tenant_id UUID)
   WHERE p.tenant_id IS DISTINCT FROM v_tenant_id;

  IF v_invalid_count > 0 THEN
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
  SELECT
    p.id,
    p.response_id,
    NULLIF(p.data_url, ''),
    NULLIF(p.caption, ''),
    COALESCE(p.taken_at, v_server_updated_at),
    COALESCE(p.updated_at, v_server_updated_at),
    p.deleted_at,
    v_tenant_id
  FROM jsonb_to_recordset(v_photos) AS p(
    id UUID,
    response_id UUID,
    data_url TEXT,
    caption TEXT,
    taken_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    tenant_id UUID
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
