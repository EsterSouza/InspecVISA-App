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

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const auth = await authenticate(req);
    if (auth.error) return json(res, auth.error.status, { ok: false, error: auth.error.message });

    const jobId = req.query?.jobId;
    if (!jobId) return json(res, 400, { ok: false, error: 'Missing jobId.' });

    const { data: job, error } = await auth.admin
      .from('sync_jobs')
      .select('id, tenant_id, inspection_id, status, attempts, error, result, updated_at, processed_at')
      .eq('id', jobId)
      .maybeSingle();

    if (error) return json(res, 500, { ok: false, error: error.message });
    if (!job) return json(res, 404, { ok: false, error: 'Job de sincronizacao nao encontrado.' });

    const access = await assertTenantAccess(auth.admin, job.tenant_id, auth.user.id);
    if (access.error) return json(res, access.error.status, { ok: false, error: access.error.message });

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
  } catch (err: any) {
    return json(res, 500, { ok: false, error: err?.message || 'Erro inesperado ao consultar job.' });
  }
}
