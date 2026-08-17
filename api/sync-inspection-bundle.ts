import { createClient } from '@supabase/supabase-js';

/**
 * Os tipos de requisição e resposta são declarados aqui, e não num módulo comum de `api/`:
 * estes endpoints são autossuficientes de propósito (commit "Make sync worker endpoints self
 * contained" — a Vercel tropeçava ao carregar módulo compartilhado). O projeto também não tem
 * `@vercel/node`, então este é o recorte que o handler de fato usa. O `req` é iterável porque
 * `readBody` lê o corpo em pedaços quando a Vercel não o entrega pronto.
 */
type RequisicaoHttp = AsyncIterable<Uint8Array> & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type RespostaHttp = {
  statusCode: number;
  setHeader: (nome: string, valor: string) => void;
  end: (corpo: string) => void;
};

/** Uma linha do Postgres como o app a enviou: a coluna que se confere, mais o resto. */
type LinhaDoBundle = { tenant_id?: string; id?: string; [coluna: string]: unknown };

/** O bundle que o app manda: linhas cruas, não as entidades locais. */
type CargaDoBundle = {
  client?: LinhaDoBundle | null;
  inspection?: LinhaDoBundle;
  responses?: unknown;
  photos?: unknown;
  schedules?: unknown;
  clientSyncId?: string;
};

/** Mensagem de um erro qualquer — os do PostgREST não são `Error`, mas têm `.message`. */
function mensagemDoErro(err: unknown): string | undefined {
  if (err instanceof Error) return err.message || undefined;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message || undefined;
  }
  return undefined;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function json(res: RespostaHttp, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function bearerToken(req: RequisicaoHttp) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : '';
}

function tenantIdFromPayload(payload: CargaDoBundle) {
  return payload?.inspection?.tenant_id || payload?.inspection?.tenantId || null;
}

function inspectionIdFromPayload(payload: CargaDoBundle) {
  return payload?.inspection?.id || null;
}

async function readBody(req: RequisicaoHttp): Promise<CargaDoBundle> {
  if (req.body && typeof req.body === 'object') return req.body as CargaDoBundle;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: RequisicaoHttp, res: RespostaHttp) {
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
    const client = payload.client || null;
    const inspection = payload.inspection;
    const responses: LinhaDoBundle[] = Array.isArray(payload.responses) ? payload.responses : [];
    const photos: LinhaDoBundle[] = Array.isArray(payload.photos) ? payload.photos : [];
    const schedules: LinhaDoBundle[] = Array.isArray(payload.schedules) ? payload.schedules : [];
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

    if (client && client.tenant_id !== tenantId) {
      return json(res, 400, { ok: false, error: 'Cliente com tenant_id divergente.' });
    }

    const invalidResponse = responses.find((response: LinhaDoBundle) => response.tenant_id !== tenantId);
    if (invalidResponse) {
      return json(res, 400, { ok: false, error: 'Resposta com tenant_id divergente.' });
    }

    const invalidPhoto = photos.find((photo: LinhaDoBundle) => photo.tenant_id !== tenantId);
    if (invalidPhoto) {
      return json(res, 400, { ok: false, error: 'Foto com tenant_id divergente.' });
    }

    const invalidSchedule = schedules.find((schedule: LinhaDoBundle) => schedule.tenant_id !== tenantId);
    if (invalidSchedule) {
      return json(res, 400, { ok: false, error: 'Agendamento com tenant_id divergente.' });
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
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: mensagemDoErro(err) || 'Erro inesperado ao enfileirar sincronizacao.',
    });
  }
}
