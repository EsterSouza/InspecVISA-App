import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
export const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const WRITE_CHUNK_SIZE = 100;
const PROCESSING_STALE_MS = 5 * 60 * 1000;

export function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function bearerToken(req: any) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : '';
}

export function tenantIdFromPayload(payload: any) {
  return payload?.inspection?.tenant_id || payload?.inspection?.tenantId || null;
}

export function inspectionIdFromPayload(payload: any) {
  return payload?.inspection?.id || null;
}

export function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(token: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(req: any) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      error: { status: 500, message: 'Supabase server environment variables are not configured.' },
    };
  }

  const token = bearerToken(req);
  if (!token) {
    return { error: { status: 401, message: 'Missing bearer token.' } };
  }

  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { error: { status: 401, message: 'Sessao invalida ou expirada.' } };
  }

  return { token, user: data.user, admin: adminClient() };
}

export async function assertTenantAccess(admin: any, tenantId: string, userId: string) {
  const { data: membership, error } = await admin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();

  if (error) {
    return { error: { status: 500, message: error.message } };
  }
  if (!membership) {
    return { error: { status: 403, message: 'Usuario sem permissao para sincronizar este tenant.' } };
  }
  return { role: membership.role };
}

function isProcessingStale(job: any) {
  if (job.status !== 'processing') return false;
  const base = job.locked_at || job.updated_at;
  return base ? Date.now() - new Date(base).getTime() > PROCESSING_STALE_MS : true;
}

export async function processSyncJob(admin: any, jobId: string, userId?: string) {
  const startedAt = new Date().toISOString();
  const { data: job, error: jobError } = await admin
    .from('sync_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) throw new Error('Job de sincronizacao nao encontrado.');

  if (userId) {
    const access = await assertTenantAccess(admin, job.tenant_id, userId);
    if (access.error) {
      const err = new Error(access.error.message) as any;
      err.status = access.error.status;
      throw err;
    }
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
  const inspection = payload.inspection;
  const responses = Array.isArray(payload.responses) ? payload.responses : [];
  const photos = Array.isArray(payload.photos) ? payload.photos : [];
  const tenantId = locked.tenant_id;
  const inspectionId = locked.inspection_id;

  try {
    const { error: inspectionError } = await admin
      .from('inspections')
      .upsert(inspection);
    if (inspectionError) throw inspectionError;

    for (const chunk of chunkArray(responses, WRITE_CHUNK_SIZE)) {
      const { error } = await admin.from('responses').upsert(chunk);
      if (error) throw error;
    }

    for (const chunk of chunkArray(photos, WRITE_CHUNK_SIZE)) {
      const { error } = await admin.from('photos').upsert(chunk);
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
