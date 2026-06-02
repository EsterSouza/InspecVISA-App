import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PHOTO_BUCKET = 'inspection-photos';
const WRITE_CHUNK_SIZE = 100;
const PHOTO_UPLOAD_CONCURRENCY = 3;
const PROCESSING_STALE_MS = 5 * 60 * 1000;

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function runLimited<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

function bearerToken(req: any) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : '';
}

function dataUrlToUpload(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Formato de foto local invalido para upload.');
  return {
    contentType: match[1] || 'image/jpeg',
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function authenticate(req: any) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: { status: 500, message: 'Supabase server environment variables are not configured.' } };
  }

  const token = bearerToken(req);
  if (!token) return { error: { status: 401, message: 'Missing bearer token.' } };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return { error: { status: 401, message: 'Sessao invalida ou expirada.' } };

  return { user: data.user, admin };
}

async function assertTenantAccess(admin: any, tenantId: string, userId: string) {
  const { data: membership, error } = await admin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();

  if (error) return { error: { status: 500, message: error.message } };
  if (!membership) return { error: { status: 403, message: 'Usuario sem permissao para sincronizar este tenant.' } };
  return { role: membership.role };
}

function isProcessingStale(job: any) {
  if (job.status !== 'processing') return false;
  const base = job.locked_at || job.updated_at;
  return base ? Date.now() - new Date(base).getTime() > PROCESSING_STALE_MS : true;
}

async function processSyncJob(admin: any, jobId: string, userId: string) {
  const startedAt = new Date().toISOString();
  const { data: job, error: jobError } = await admin
    .from('sync_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) throw new Error('Job de sincronizacao nao encontrado.');

  const access = await assertTenantAccess(admin, job.tenant_id, userId);
  if (access.error) {
    const err = new Error(access.error.message) as any;
    err.status = access.error.status;
    throw err;
  }

  if (job.status === 'completed') {
    return job.result || {
      ok: true,
      jobId: job.id,
      inspectionId: job.inspection_id,
      status: 'completed',
      failedItems: [],
    };
  }

  if (job.status === 'processing' && !isProcessingStale(job)) {
    return {
      ok: true,
      jobId: job.id,
      inspectionId: job.inspection_id,
      status: 'processing',
      failedItems: [],
    };
  }

  const { data: locked, error: lockError } = await admin
    .from('sync_jobs')
    .update({
      status: 'processing',
      attempts: (job.attempts || 0) + 1,
      error: null,
      locked_at: startedAt,
      updated_at: startedAt,
    })
    .eq('id', job.id)
    .select('*')
    .single();

  if (lockError) throw lockError;

  const payload = locked.payload || {};
  const client = payload.client || null;
  const inspection = payload.inspection;
  const responses = Array.isArray(payload.responses) ? payload.responses : [];
  const photos = Array.isArray(payload.photos) ? payload.photos : [];
  const schedules = Array.isArray(payload.schedules) ? payload.schedules : [];
  const tenantId = locked.tenant_id;
  const inspectionId = locked.inspection_id;

  try {
    if (client) {
      if (client.tenant_id !== tenantId) {
        throw new Error('Cliente com tenant_id divergente.');
      }
      const { error: clientError } = await admin.from('clients').upsert(client);
      if (clientError) {
        throw new Error(`Falha ao sincronizar cliente antes da inspecao: ${clientError.message}`);
      }
    }

    const { error: inspectionError } = await admin.from('inspections').upsert(inspection);
    if (inspectionError) throw inspectionError;

    for (const chunk of chunkArray(responses, WRITE_CHUNK_SIZE)) {
      const { error } = await admin.from('responses').upsert(chunk);
      if (error) throw error;
    }

    const preparedPhotos = await runLimited(photos, PHOTO_UPLOAD_CONCURRENCY, async (rawPhoto) => {
      const photo = { ...rawPhoto };
      const localDataUrl = photo.local_data_url || photo.localDataUrl || null;
      delete photo.local_data_url;
      delete photo.localDataUrl;

      if (localDataUrl && !photo.data_url?.startsWith('storage://')) {
        const storagePath = `${tenantId}/${photo.response_id}/${photo.id}.jpg`;
        const upload = dataUrlToUpload(localDataUrl);
        const { error: uploadError } = await admin.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, upload.buffer, {
            cacheControl: '31536000',
            contentType: upload.contentType,
            upsert: true,
          });
        if (uploadError) throw new Error(`Falha no upload da foto ${photo.id}: ${uploadError.message}`);
        photo.data_url = `storage://${storagePath}`;
      }

      return photo;
    });

    for (const chunk of chunkArray(preparedPhotos, WRITE_CHUNK_SIZE)) {
      const { error } = await admin.from('photos').upsert(chunk);
      if (error) throw error;
    }

    for (const chunk of chunkArray(schedules, WRITE_CHUNK_SIZE)) {
      const invalidSchedule = chunk.find((schedule: any) => schedule.tenant_id !== tenantId);
      if (invalidSchedule) throw new Error('Agendamento com tenant_id divergente.');
      const { error } = await admin.from('schedules').upsert(chunk);
      if (error) throw error;
    }

    let reportVersionId: string | null = null;
    if (payload.finalizeReport) {
      const { data: latest, error: latestError } = await admin
        .from('inspection_report_versions')
        .select('version')
        .eq('inspection_id', inspectionId)
        .eq('tenant_id', tenantId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      const { data: version, error: versionError } = await admin
        .from('inspection_report_versions')
        .insert({
          tenant_id: tenantId,
          inspection_id: inspectionId,
          version: (latest?.version || 0) + 1,
          snapshot_json: payload,
          created_by: locked.created_by || null,
        })
        .select('id')
        .single();
      if (versionError) throw versionError;
      reportVersionId = version.id;
    }

    const finishedAt = new Date().toISOString();
    const result = {
      ok: true,
      jobId: locked.id,
      inspectionId,
      status: 'completed',
      serverUpdatedAt: finishedAt,
      reportVersionId,
      failedItems: [],
    };

    await admin
      .from('sync_jobs')
      .update({
        status: 'completed',
        error: null,
        result,
        updated_at: finishedAt,
        processed_at: finishedAt,
      })
      .eq('id', locked.id);

    return result;
  } catch (err: any) {
    const message = err?.message || 'Erro ao processar job de sincronizacao.';
    const failedAt = new Date().toISOString();
    await admin
      .from('sync_jobs')
      .update({
        status: 'failed',
        error: message,
        updated_at: failedAt,
        processed_at: failedAt,
      })
      .eq('id', locked.id);

    return {
      ok: false,
      jobId: locked.id,
      inspectionId,
      status: 'failed',
      failedItems: [{ table: 'inspections', id: inspectionId, error: message }],
      error: message,
    };
  }
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const auth = await authenticate(req);
    if (auth.error) return json(res, auth.error.status, { ok: false, error: auth.error.message });

    const jobId = req.body?.jobId || req.query?.jobId;
    if (!jobId) return json(res, 400, { ok: false, error: 'Missing jobId.' });

    const result = await processSyncJob(auth.admin, jobId, auth.user.id);
    return json(res, result.ok === false ? 500 : 200, result);
  } catch (err: any) {
    return json(res, err?.status || 500, {
      ok: false,
      error: err?.message || 'Erro ao processar job de sincronizacao.',
      failedItems: [],
    });
  }
}
