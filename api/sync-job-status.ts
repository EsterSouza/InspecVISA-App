import { assertTenantAccess, authenticate, json } from './syncJobCore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const auth = await authenticate(req);
  if (auth.error) {
    return json(res, auth.error.status, { ok: false, error: auth.error.message });
  }

  const jobId = req.query?.jobId;
  if (!jobId) {
    return json(res, 400, { ok: false, error: 'Missing jobId.' });
  }

  const { data: job, error } = await auth.admin
    .from('sync_jobs')
    .select('id, tenant_id, inspection_id, status, attempts, error, result, updated_at, processed_at')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
  if (!job) {
    return json(res, 404, { ok: false, error: 'Job de sincronizacao nao encontrado.' });
  }

  const access = await assertTenantAccess(auth.admin, job.tenant_id, auth.user.id);
  if (access.error) {
    return json(res, access.error.status, { ok: false, error: access.error.message });
  }

  return json(res, 200, {
    ok: true,
    jobId: job.id,
    inspectionId: job.inspection_id,
    status: job.status,
    attempts: job.attempts,
    error: job.error,
    result: job.result,
    serverUpdatedAt: job.updated_at,
    processedAt: job.processed_at,
    failedItems: job.result?.failedItems || [],
  });
}
