import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const WRITE_CHUNK_SIZE = 100;

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

export default async function handler(req: any, res: any) {
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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userResult?.user) {
    return json(res, 401, { ok: false, error: 'Sessao invalida ou expirada.' });
  }

  const { data: membership, error: membershipError } = await adminClient
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

  const { data: syncBatch, error: batchError } = await adminClient
    .from('sync_batches')
    .insert({
      tenant_id: tenantId,
      inspection_id: inspectionId,
      client_sync_id: payload.clientSyncId || null,
      status: 'syncing',
      payload: {
        clientSyncId: payload.clientSyncId || null,
        finalizeReport: Boolean(payload.finalizeReport),
        inspectionId,
        responsesCount: responses.length,
        photosCount: photos.length,
      },
      updated_at: serverUpdatedAt,
    })
    .select('id')
    .single();

  if (batchError) {
    return json(res, 500, { ok: false, error: batchError.message });
  }

  try {
    const { error: inspectionError } = await adminClient
      .from('inspections')
      .upsert(inspection);
    if (inspectionError) throw inspectionError;

    for (const chunk of chunkArray(responses, WRITE_CHUNK_SIZE)) {
      const { error } = await adminClient.from('responses').upsert(chunk);
      if (error) throw error;
    }

    for (const chunk of chunkArray(photos, WRITE_CHUNK_SIZE)) {
      const { error } = await adminClient.from('photos').upsert(chunk);
      if (error) throw error;
    }

    let reportVersionId: string | null = null;
    if (payload.finalizeReport) {
      const { data: latest, error: latestError } = await adminClient
        .from('inspection_report_versions')
        .select('version')
        .eq('inspection_id', inspectionId)
        .eq('tenant_id', tenantId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      const { data: version, error: versionError } = await adminClient
        .from('inspection_report_versions')
        .insert({
          tenant_id: tenantId,
          inspection_id: inspectionId,
          version: (latest?.version || 0) + 1,
          snapshot_json: payload,
          created_by: userResult.user.id,
        })
        .select('id')
        .single();
      if (versionError) throw versionError;
      reportVersionId = version.id;
    }

    const result = {
      ok: true,
      inspectionId,
      syncBatchId: syncBatch.id,
      serverUpdatedAt,
      reportVersionId,
      failedItems: [],
    };

    await adminClient
      .from('sync_batches')
      .update({
        status: 'synced',
        error: null,
        result,
        updated_at: serverUpdatedAt,
      })
      .eq('id', syncBatch.id);

    return json(res, 200, result);
  } catch (err: any) {
    const message = err?.message || 'Erro ao sincronizar bundle no servidor.';
    await adminClient
      .from('sync_batches')
      .update({
        status: 'failed',
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', syncBatch.id);

    return json(res, 500, {
      ok: false,
      inspectionId,
      syncBatchId: syncBatch.id,
      failedItems: [{ table: 'inspections', id: inspectionId, error: message }],
      error: message,
    });
  }
}
