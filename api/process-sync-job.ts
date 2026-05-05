import { authenticate, json, processSyncJob } from './_syncJobCore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const auth = await authenticate(req);
  if (auth.error) {
    return json(res, auth.error.status, { ok: false, error: auth.error.message });
  }

  const jobId = req.body?.jobId || req.query?.jobId;
  if (!jobId) {
    return json(res, 400, { ok: false, error: 'Missing jobId.' });
  }

  try {
    const result = await processSyncJob(auth.admin, jobId, auth.user.id);
    return json(res, result.ok === false ? 500 : 200, result);
  } catch (err: any) {
    return json(res, err?.status || 500, {
      ok: false,
      jobId,
      error: err?.message || 'Erro ao processar job de sincronizacao.',
      failedItems: [],
    });
  }
}
