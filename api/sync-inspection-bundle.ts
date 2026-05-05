import {
  assertTenantAccess,
  authenticate,
  inspectionIdFromPayload,
  json,
  tenantIdFromPayload,
} from './_syncJobCore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const auth = await authenticate(req);
  if (auth.error) {
    return json(res, auth.error.status, { ok: false, error: auth.error.message });
  }

  const payload = req.body || {};
  const inspection = payload.inspection;
  const responses = Array.isArray(payload.responses) ? payload.responses : [];
  const photos = Array.isArray(payload.photos) ? payload.photos : [];
  const tenantId = tenantIdFromPayload(payload);
  const inspectionId = inspectionIdFromPayload(payload);
  const serverUpdatedAt = new Date().toISOString();

  if (!inspection || !tenantId || !inspectionId) {
    return json(res, 400, { ok: false, error: 'Payload sem inspection, tenant_id ou inspection.id.' });
  }

  const access = await assertTenantAccess(auth.admin, tenantId, auth.user.id);
  if (access.error) {
    return json(res, access.error.status, { ok: false, error: access.error.message });
  }

  const invalidResponse = responses.find((response: any) => response.tenant_id !== tenantId);
  if (invalidResponse) {
    return json(res, 400, { ok: false, error: 'Resposta com tenant_id divergente.' });
  }

  const invalidPhoto = photos.find((photo: any) => photo.tenant_id !== tenantId);
  if (invalidPhoto) {
    return json(res, 400, { ok: false, error: 'Foto com tenant_id divergente.' });
  }

  const clientSyncId = payload.clientSyncId || `${inspectionId}:${serverUpdatedAt}`;

  const { data: existingJob, error: existingError } = await auth.admin
    .from('sync_jobs')
    .select('id, status, attempts, updated_at, result')
    .eq('tenant_id', tenantId)
    .eq('inspection_id', inspectionId)
    .eq('client_sync_id', clientSyncId)
    .maybeSingle();

  if (existingError) {
    return json(res, 500, { ok: false, error: existingError.message });
  }

  if (existingJob?.status === 'completed') {
    return json(res, 200, existingJob.result || {
      ok: true,
      jobId: existingJob.id,
      inspectionId,
      status: 'completed',
      serverUpdatedAt: existingJob.updated_at,
      failedItems: [],
    });
  }

  if (existingJob?.status === 'processing') {
    return json(res, 202, {
      ok: true,
      jobId: existingJob.id,
      inspectionId,
      status: 'processing',
      serverUpdatedAt: existingJob.updated_at,
      failedItems: [],
    });
  }

  const { data: job, error: jobError } = await auth.admin
    .from('sync_jobs')
    .upsert({
      tenant_id: tenantId,
      inspection_id: inspectionId,
      client_sync_id: clientSyncId,
      status: 'queued',
      error: null,
      payload: {
        ...payload,
        clientSyncId,
      },
      result: null,
      created_by: auth.user.id,
      locked_at: null,
      updated_at: serverUpdatedAt,
      processed_at: null,
    }, { onConflict: 'tenant_id,inspection_id,client_sync_id' })
    .select('id, status, attempts, updated_at')
    .single();

  if (jobError) {
    return json(res, 500, { ok: false, error: jobError.message });
  }

  return json(res, 202, {
    ok: true,
    jobId: job.id,
    inspectionId,
    status: job.status,
    serverUpdatedAt: job.updated_at,
    failedItems: [],
  });
}
