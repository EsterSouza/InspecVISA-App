import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Os tipos de requisição e resposta são declarados aqui, e não num módulo comum de `api/`:
 * estes endpoints são autossuficientes de propósito (commit "Make sync worker endpoints self
 * contained" — a Vercel tropeçava ao carregar módulo compartilhado). O projeto também não tem
 * `@vercel/node`, então este é o recorte que o handler de fato usa.
 */
type RequisicaoHttp = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type RespostaHttp = {
  statusCode: number;
  setHeader: (nome: string, valor: string) => void;
  end: (corpo: string) => void;
};

/** Uma linha do Postgres como o app a enviou: a coluna que se confere, mais o resto. */
type LinhaDoBundle = { tenant_id?: string; id?: string; [coluna: string]: unknown };

/** O bundle que ficou guardado no job, como o app o enfileirou. */
type CargaDoBundle = {
  client?: LinhaDoBundle | null;
  inspection?: LinhaDoBundle;
  responses?: unknown;
  photos?: unknown;
  schedules?: unknown;
  finalizeReport?: boolean;
};

/**
 * Erro que já sabe com que código HTTP deve sair. Antes disso o campo era enxertado num
 * `Error` via `as any`, e só o `err?.status` do handler lá embaixo revelava a intenção.
 */
class ErroHttp extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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
const PHOTO_BUCKET = 'inspection-photos';
const WRITE_CHUNK_SIZE = 100;
const PHOTO_UPLOAD_CONCURRENCY = 3;
const PROCESSING_STALE_MS = 5 * 60 * 1000;

function json(res: RespostaHttp, status: number, body: unknown) {
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

function bearerToken(req: RequisicaoHttp) {
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

async function authenticate(req: RequisicaoHttp) {
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

async function assertTenantAccess(admin: SupabaseClient, tenantId: string, userId: string) {
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

function isProcessingStale(job: { status?: string; locked_at?: string | null; updated_at?: string | null }) {
  if (job.status !== 'processing') return false;
  const base = job.locked_at || job.updated_at;
  return base ? Date.now() - new Date(base).getTime() > PROCESSING_STALE_MS : true;
}

async function processSyncJob(admin: SupabaseClient, jobId: string, userId: string) {
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
    throw new ErroHttp(access.error.message, access.error.status);
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

  const payload: CargaDoBundle = locked.payload || {};
  const client = payload.client || null;
  const inspection = payload.inspection;
  const responses: LinhaDoBundle[] = Array.isArray(payload.responses) ? payload.responses : [];
  const photos: LinhaDoBundle[] = Array.isArray(payload.photos) ? payload.photos : [];
  const schedules: LinhaDoBundle[] = Array.isArray(payload.schedules) ? payload.schedules : [];
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

    // O endpoint que enfileira recusa payload sem `inspection` (400); aqui isso nunca foi
    // conferido, e o `any` deixava `undefined` seguir para o upsert. Falha com mensagem, que
    // o catch abaixo grava no job.
    if (!inspection) throw new Error('Job de sincronizacao sem inspection no payload.');

    const { error: inspectionError } = await admin.from('inspections').upsert(inspection);
    if (inspectionError) throw inspectionError;

    for (const chunk of chunkArray(responses, WRITE_CHUNK_SIZE)) {
      const { error } = await admin.from('responses').upsert(chunk);
      if (error) throw error;
    }

    const preparedPhotos = await runLimited(photos, PHOTO_UPLOAD_CONCURRENCY, async (rawPhoto) => {
      const photo = { ...(rawPhoto as Record<string, unknown>) };
      // O payload vem do cliente, então os bytes chegam como `unknown`: sem estreitar para
      // string, `dataUrlToUpload` recebia o que viesse e quebrava com TypeError lá dentro.
      const rawLocalDataUrl = photo.local_data_url || photo.localDataUrl || null;
      if (rawLocalDataUrl !== null && typeof rawLocalDataUrl !== 'string') {
        throw new Error('Formato de foto local invalido para upload.');
      }
      const localDataUrl = rawLocalDataUrl;
      delete photo.local_data_url;
      delete photo.localDataUrl;

      // Auto-cura: se o cliente enviou os bytes (base64), SEMPRE (re)sobe — mesmo que
      // data_url já seja storage://. Isso repara "fotos fantasma" (linha aponta pro
      // Storage mas o arquivo nunca subiu). Reaproveita o caminho existente quando houver.
      if (localDataUrl) {
        const claimsStorage = typeof photo.data_url === 'string' && photo.data_url.startsWith('storage://');
        const storagePath = claimsStorage
          ? (photo.data_url as string).slice('storage://'.length)
          : `${tenantId}/${photo.response_id}/${photo.id}.jpg`;
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
      const invalidSchedule = chunk.find((schedule) => schedule.tenant_id !== tenantId);
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
  } catch (err) {
    const message = mensagemDoErro(err) || 'Erro ao processar job de sincronizacao.';
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

export default async function handler(req: RequisicaoHttp, res: RespostaHttp) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const auth = await authenticate(req);
    if (auth.error) return json(res, auth.error.status, { ok: false, error: auth.error.message });

    const corpo = req.body && typeof req.body === 'object' ? (req.body as { jobId?: unknown }) : {};
    const jobIdBruto = corpo.jobId || req.query?.jobId;
    const jobId = Array.isArray(jobIdBruto) ? jobIdBruto[0] : jobIdBruto;
    if (typeof jobId !== 'string' || !jobId) return json(res, 400, { ok: false, error: 'Missing jobId.' });

    const result = await processSyncJob(auth.admin, jobId, auth.user.id);
    return json(res, result.ok === false ? 500 : 200, result);
  } catch (err) {
    return json(res, err instanceof ErroHttp ? err.status : 500, {
      ok: false,
      error: mensagemDoErro(err) || 'Erro ao processar job de sincronizacao.',
      failedItems: [],
    });
  }
}
