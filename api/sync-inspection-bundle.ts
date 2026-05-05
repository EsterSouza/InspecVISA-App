import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function bearerToken(req: any) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : '';
}

function tenantIdFromPayload(payload: any) {
  return payload?.inspection?.tenant_id || payload?.inspection?.tenantId || null;
}

function inspectionIdFromPayload(payload: any) {
  return payload?.inspection?.id || null;
}

async function readBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(res, 500, {
        ok: false,
        error: 'Supabase server environment variables are not configured.',
      });
    }

    const token = bearerToken(req);
    if (!token) {
      return json(res, 401, { ok: false, error: 'Missing bearer token.' });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userResult, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userResult?.user) {
      return json(res, 401, { ok: false, error: 'Sessao invalida ou expirada.' });
    }

    const payload = await readBody(req);
    const inspection = payload.inspection;
    const responses = Array.isArray(payload.responses) ? payload.responses : [];
    const photos = Array.isArray(payload.photos) ? payload.photos : [];
    const tenantId = tenantIdFromPayload(payload);
    const inspectionId = inspectionIdFromPayload(payload);
    const serverUpdatedAt = new Date().toISOString();

    if (!inspection || !tenantId || !inspectionId) {
      return json(res, 400, { ok: false, error: 'Payload sem inspection, tenant_id ou inspection.id.' });
    }

    const { data: membership, error: membershipError } = await admin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userResult.user.id)
      .in('role', ['admin', 'consultant'])
      .maybeSingle();

    if (membershipError) {
      return json(res, 500, { ok: false, error: membershipError.message });
    }
    if (!membership) {
      return json(res, 403, { ok: false, error: 'Usuario sem permissao para sincronizar este tenant.' });
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
    const { data: existingJob, error: existingError } = await admin
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

    const { data: job, error: jobError } = await admin
      .from('sync_jobs')
      .upsert({
        tenant_id: tenantId,
        inspection_id: inspectionId,
        client_sync_id: clientSyncId,
        status: 'queued',
        error: null,
        payload: { ...payload, clientSyncId },
        result: null,
        created_by: userResult.user.id,
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
  } catch (err: any) {
    return json(res, 500, {
      ok: false,
      error: err?.message || 'Erro inesperado ao enfileirar sincronizacao.',
    });
  }
}
