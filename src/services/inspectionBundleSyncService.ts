import { supabase } from '../lib/supabase';
import { db } from '../db/database';
import type {
  Inspection,
  InspectionBundlePayload,
  InspectionBundleResult,
  InspectionPhoto,
  InspectionResponse,
  SyncStatus,
} from '../types';
import { ensurePreBundleBackup } from '../utils/backup';
import { withTimeout } from '../utils/network';
import { useAuthStore } from '../store/useAuthStore';
import { InspectionService } from './inspectionService';

const BUNDLE_API_TIMEOUT_MS = 70000;
const JOB_STATUS_TIMEOUT_MS = 15000;
const JOB_POLL_INTERVAL_MS = 2500;
const JOB_POLL_TIMEOUT_MS = 75000;
const JOB_ERROR_UNAVAILABLE = 'Fila de sincronizacao indisponivel. Migration 010 precisa estar aplicada no Supabase.';
const QUEUED_STATUSES: SyncStatus[] = ['pending'];
const UNSAFE_STATUSES: SyncStatus[] = ['pending', 'syncing', 'failed'];
const JOB_ERROR_PREFIX = '[sync-job:';

function sameTimestamp(a?: Date | string, b?: Date | string) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function getStoredAccessToken(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
      if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    }
  } catch {
    return null;
  }
  return null;
}

async function getAccessToken(): Promise<string> {
  const stored = getStoredAccessToken();
  if (stored) return stored;

  const { data } = await withTimeout(
    supabase.auth.getSession(),
    10000,
    'BundleSync_getSession'
  );
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessao expirada. Entre novamente para sincronizar.');
  return token;
}

function normalizeRpcResult(data: any, inspectionId: string): InspectionBundleResult {
  return {
    ok: Boolean(data?.ok),
    inspectionId: data?.inspectionId || data?.inspection_id || inspectionId,
    jobId: data?.jobId || data?.job_id,
    status: data?.status,
    syncBatchId: data?.syncBatchId || data?.sync_batch_id,
    serverUpdatedAt: data?.serverUpdatedAt || data?.server_updated_at,
    reportVersionId: data?.reportVersionId || data?.report_version_id || null,
    failedItems: Array.isArray(data?.failedItems) ? data.failedItems : [],
    error: data?.error,
  };
}

function bundleErrorMessage(err: any) {
  const message = err?.message || String(err);
  if (message.includes('sync_jobs') || message.includes('/api/sync-inspection-bundle')) {
    return JOB_ERROR_UNAVAILABLE;
  }
  return message;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jobSyncError(jobId: string, status = 'queued') {
  const label = status === 'processing' ? 'processando' : 'na fila';
  return `${JOB_ERROR_PREFIX}${jobId}] Job de sincronizacao ${label} no servidor.`;
}

function parseJobId(syncError?: string | null) {
  if (!syncError?.startsWith(JOB_ERROR_PREFIX)) return null;
  const end = syncError.indexOf(']');
  return end > JOB_ERROR_PREFIX.length ? syncError.slice(JOB_ERROR_PREFIX.length, end) : null;
}

function isJobStillRunning(result: InspectionBundleResult) {
  return result.ok && (result.status === 'queued' || result.status === 'processing');
}

async function enqueueBundleThroughApi(payload: InspectionBundlePayload): Promise<InspectionBundleResult> {
  const token = await getAccessToken();
  const response = await withTimeout(
    fetch('/api/sync-inspection-bundle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }),
    BUNDLE_API_TIMEOUT_MS,
    `InspectionBundleApi_${payload.inspection?.id || 'unknown'}`
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Backend bundle sync failed (${response.status})`);
  }

  return normalizeRpcResult(data, payload.inspection?.id);
}

async function processJobThroughApi(jobId: string): Promise<InspectionBundleResult> {
  const token = await getAccessToken();
  const response = await withTimeout(
    fetch('/api/process-sync-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobId }),
    }),
    BUNDLE_API_TIMEOUT_MS,
    `ProcessSyncJob_${jobId}`
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Backend job processing failed (${response.status})`);
  }

  return normalizeRpcResult(data, data?.inspectionId || '');
}

async function getJobStatus(jobId: string): Promise<InspectionBundleResult> {
  const token = await getAccessToken();
  const response = await withTimeout(
    fetch(`/api/sync-job-status?jobId=${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    JOB_STATUS_TIMEOUT_MS,
    `SyncJobStatus_${jobId}`
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Backend job status failed (${response.status})`);
  }

  const result = normalizeRpcResult(data.result || data, data.inspectionId || '');
  return {
    ...result,
    jobId,
    status: data.status || result.status,
    error: data.error || result.error,
    failedItems: data.failedItems || result.failedItems || [],
  };
}

async function waitForJob(jobId: string, timeoutMs = JOB_POLL_TIMEOUT_MS): Promise<InspectionBundleResult> {
  const deadline = Date.now() + timeoutMs;
  let last = await getJobStatus(jobId);

  while (Date.now() < deadline && isJobStillRunning(last)) {
    await processJobThroughApi(jobId).catch(err => {
      console.warn(`[BundleSync] Process kick for job ${jobId} failed:`, err?.message || err);
    });
    await sleep(JOB_POLL_INTERVAL_MS);
    last = await getJobStatus(jobId);
  }

  return last;
}

async function markBundleStatus(
  inspection: Inspection,
  responses: InspectionResponse[],
  photos: InspectionPhoto[],
  status: SyncStatus,
  syncError?: string | null
) {
  const responseIds = responses
    .filter(response => UNSAFE_STATUSES.includes(response.syncStatus))
    .map(response => response.id);
  const photoIds = photos
    .filter(photo => UNSAFE_STATUSES.includes(photo.syncStatus))
    .map(photo => photo.id);

  if (inspection.syncStatus !== 'conflict' && UNSAFE_STATUSES.includes(inspection.syncStatus)) {
    await db.inspections.update(inspection.id, { syncStatus: status, syncError: syncError || undefined });
  }

  if (responseIds.length > 0) {
    await db.responses.where('id').anyOf(responseIds).modify((response: InspectionResponse) => {
      if (response.syncStatus !== 'conflict') {
        response.syncStatus = status;
        response.syncError = syncError || undefined;
      }
    });
  }

  if (photoIds.length > 0) {
    await db.photos.where('id').anyOf(photoIds).modify((photo: InspectionPhoto) => {
      if (photo.syncStatus !== 'conflict') {
        photo.syncStatus = status;
        photo.syncError = syncError || undefined;
      }
    });
  }
}

async function markBundleSuccess(
  inspection: Inspection,
  responses: InspectionResponse[],
  photos: InspectionPhoto[]
) {
  const verifiedAt = new Date();
  const currentInspection = await db.inspections.get(inspection.id);

  if (
    currentInspection &&
    UNSAFE_STATUSES.includes(inspection.syncStatus) &&
    sameTimestamp(currentInspection.updatedAt, inspection.updatedAt)
  ) {
    await db.inspections.update(inspection.id, {
      syncStatus: 'synced',
      syncError: undefined,
      syncAttempts: 0,
      dataVerifiedAt: verifiedAt,
    });
  } else if (currentInspection) {
    await db.inspections.update(inspection.id, { syncStatus: 'pending' });
  }

  for (const response of responses) {
    if (!UNSAFE_STATUSES.includes(response.syncStatus)) continue;
    const current = await db.responses.get(response.id);
    if (current && sameTimestamp(current.updatedAt, response.updatedAt)) {
      await db.responses.update(response.id, {
        syncStatus: 'synced',
        syncError: undefined,
        syncAttempts: 0,
        dataVerifiedAt: verifiedAt,
      });
    } else if (current) {
      await db.responses.update(response.id, { syncStatus: 'pending' });
    }
  }

  for (const photo of photos) {
    if (!UNSAFE_STATUSES.includes(photo.syncStatus)) continue;
    const current = await db.photos.get(photo.id);
    if (current && sameTimestamp(current.updatedAt, photo.updatedAt)) {
      await db.photos.update(photo.id, {
        syncStatus: 'synced',
        syncError: undefined,
        syncAttempts: 0,
        dataVerifiedAt: verifiedAt,
      });
    } else if (current) {
      await db.photos.update(photo.id, { syncStatus: 'pending' });
    }
  }
}

async function markBundleFailure(
  inspection: Inspection,
  responses: InspectionResponse[],
  photos: InspectionPhoto[],
  err: any
) {
  const message = bundleErrorMessage(err);
  const nextStatus: SyncStatus = (inspection.syncAttempts || 0) + 1 >= 3 ? 'failed' : 'pending';
  const attempts = (inspection.syncAttempts || 0) + 1;

  if (UNSAFE_STATUSES.includes(inspection.syncStatus)) {
    await db.inspections.update(inspection.id, {
      syncStatus: nextStatus,
      syncError: message,
      syncAttempts: attempts,
    });
  }

  for (const response of responses) {
    if (!UNSAFE_STATUSES.includes(response.syncStatus)) continue;
    const current = await db.responses.get(response.id);
    if (!current || current.syncStatus === 'conflict') continue;
    const responseAttempts = (current.syncAttempts || 0) + 1;
    await db.responses.update(response.id, {
      syncStatus: responseAttempts >= 3 ? 'failed' : 'pending',
      syncError: message,
      syncAttempts: responseAttempts,
    });
  }

  for (const photo of photos) {
    if (!UNSAFE_STATUSES.includes(photo.syncStatus)) continue;
    const current = await db.photos.get(photo.id);
    if (!current || current.syncStatus === 'conflict') continue;
    const photoAttempts = (current.syncAttempts || 0) + 1;
    await db.photos.update(photo.id, {
      syncStatus: photoAttempts >= 3 ? 'failed' : 'pending',
      syncError: message,
      syncAttempts: photoAttempts,
    });
  }
}

async function getInspectionBundle(inspectionId: string, inspectionOverride?: Inspection) {
  const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
  const localInspection = inspectionOverride || await db.inspections.get(inspectionId);
  if (!localInspection) throw new Error('Inspecao local nao encontrada para sincronizacao.');
  if (localInspection.syncStatus === 'conflict') {
    throw new Error('Inspecao em conflito precisa ser resolvida antes da sincronizacao.');
  }

  const inspection: Inspection = {
    ...localInspection,
    tenantId: localInspection.tenantId || tenantId,
  };

  if (!inspection.tenantId) {
    throw new Error('Aguardando tenantId para sincronizar bundle.');
  }

  const responses = (await db.responses.where('inspectionId').equals(inspection.id).toArray())
    .filter(response => response.syncStatus !== 'conflict')
    .map(response => ({ ...response, tenantId: response.tenantId || inspection.tenantId }));

  const responseIds = responses.map(response => response.id);
  const photos = responseIds.length > 0
    ? (await db.photos.where('responseId').anyOf(responseIds).toArray())
      .filter(photo => photo.syncStatus !== 'conflict')
      .map(photo => ({ ...photo, tenantId: photo.tenantId || inspection.tenantId }))
    : [];

  return { inspection, responses, photos };
}

function buildPayload(
  inspection: Inspection,
  responses: InspectionResponse[],
  photos: InspectionPhoto[],
  finalizeReport: boolean
): InspectionBundlePayload {
  const updatedTimes = [
    inspection.updatedAt,
    ...responses.map(response => response.updatedAt),
    ...photos.map(photo => photo.updatedAt),
  ].map(value => new Date(value).getTime());
  const changeStamp = Math.max(...updatedTimes);

  return {
    inspection: InspectionService.mapToPostgres(inspection),
    responses: responses.map(InspectionService.mapResponseToPostgres),
    photos: photos.map(photo => ({
      ...InspectionService.mapPhotoToPostgres(photo),
      local_data_url: photo.storagePath ? null : photo.dataUrl,
    })),
    clientSyncId: [
      inspection.id,
      changeStamp,
      responses.length,
      photos.length,
      finalizeReport ? 'final' : 'draft',
    ].join(':'),
    finalizeReport,
    reportSnapshot: finalizeReport
      ? {
        generatedAt: new Date().toISOString(),
        inspection,
        responses,
        photos,
      }
      : undefined,
  };
}

async function resumeServerJobForBundle(
  inspection: Inspection,
  responses: InspectionResponse[],
  photos: InspectionPhoto[],
  jobId: string
): Promise<'completed' | 'running' | 'failed'> {
  try {
    let result = await getJobStatus(jobId);
    if (isJobStillRunning(result)) {
      result = await waitForJob(jobId, 30000);
    }

    if (result.status === 'completed') {
      await markBundleSuccess(inspection, responses, photos);
      return 'completed';
    }

    if (result.status === 'failed') {
      await markBundleFailure(inspection, responses, photos, new Error(result.error || 'Job de sincronizacao falhou no servidor.'));
      return 'failed';
    }

    await markBundleStatus(inspection, responses, photos, 'syncing', jobSyncError(jobId, result.status));
    return 'running';
  } catch (err: any) {
    console.warn(`[BundleSync] Could not refresh server job ${jobId}:`, err?.message || err);
    await markBundleStatus(inspection, responses, photos, 'syncing', jobSyncError(jobId, 'processing'));
    return 'running';
  }
}

export const InspectionBundleSyncService = {
  async syncInspectionBundle(
    inspectionId: string,
    options: { finalizeReport?: boolean; inspectionOverride?: Inspection } = {}
  ): Promise<InspectionBundleResult> {
    if (!navigator.onLine) {
      throw new Error('Rascunho local aguardando conexao para sincronizar.');
    }

    await ensurePreBundleBackup();

    const bundle = await getInspectionBundle(inspectionId, options.inspectionOverride);
    await markBundleStatus(bundle.inspection, bundle.responses, bundle.photos, 'syncing', null);

    try {
      const payload = buildPayload(bundle.inspection, bundle.responses, bundle.photos, Boolean(options.finalizeReport));
      let result = await enqueueBundleThroughApi(payload);

      if (result.jobId) {
        await markBundleStatus(
          bundle.inspection,
          bundle.responses,
          bundle.photos,
          'syncing',
          jobSyncError(result.jobId, result.status)
        );
        if (isJobStillRunning(result)) {
          try {
            result = await waitForJob(result.jobId, options.finalizeReport ? 120000 : JOB_POLL_TIMEOUT_MS);
          } catch (pollErr: any) {
            console.warn(`[BundleSync] Job ${result.jobId} still pending after poll error:`, pollErr?.message || pollErr);
            return result;
          }
        }
      }

      if (isJobStillRunning(result)) {
        return result;
      }

      if (!result.ok || result.status === 'failed') {
        throw new Error(result.error || 'Job de sincronizacao falhou no servidor.');
      }

      await markBundleSuccess(bundle.inspection, bundle.responses, bundle.photos);
      return result;
    } catch (err) {
      await markBundleFailure(bundle.inspection, bundle.responses, bundle.photos, err);
      throw err;
    }
  },

  async syncPendingInspectionBundles(): Promise<number> {
    if (!navigator.onLine) return 0;

    const inspectionIds = new Set<string>();

    const pendingInspections = await db.inspections
      .where('syncStatus')
      .anyOf(QUEUED_STATUSES)
      .toArray();
    pendingInspections.forEach(inspection => inspectionIds.add(inspection.id));

    const syncingInspections = await db.inspections
      .where('syncStatus')
      .equals('syncing')
      .toArray();
    syncingInspections.forEach(inspection => {
      if (parseJobId(inspection.syncError)) {
        inspectionIds.add(inspection.id);
      }
    });

    const pendingResponses = await db.responses
      .where('syncStatus')
      .anyOf(QUEUED_STATUSES)
      .toArray();
    pendingResponses.forEach(response => inspectionIds.add(response.inspectionId));

    const syncingResponses = await db.responses
      .where('syncStatus')
      .equals('syncing')
      .toArray();
    syncingResponses.forEach(response => {
      if (parseJobId(response.syncError)) {
        inspectionIds.add(response.inspectionId);
      }
    });

    const pendingPhotos = await db.photos
      .where('syncStatus')
      .anyOf(QUEUED_STATUSES)
      .toArray();
    const responseIds = [...new Set(pendingPhotos.map(photo => photo.responseId))];
    if (responseIds.length > 0) {
      const responses = await db.responses.where('id').anyOf(responseIds).toArray();
      responses.forEach(response => inspectionIds.add(response.inspectionId));
    }

    console.log(`[BundleSync] Candidate inspection bundles: ${inspectionIds.size}.`);

    let synced = 0;
    for (const inspectionId of inspectionIds) {
      const inspection = await db.inspections.get(inspectionId);
      if (!inspection) {
        console.warn(`[BundleSync] Skipping bundle ${inspectionId}: local inspection not found.`);
        continue;
      }
      if (inspection.syncStatus === 'conflict') {
        console.warn(`[BundleSync] Skipping bundle ${inspectionId}: inspection is in conflict.`);
        continue;
      }
      const jobId = parseJobId(inspection.syncError)
        || parseJobId((await db.responses.where('inspectionId').equals(inspectionId).filter(response => response.syncStatus === 'syncing').first())?.syncError);
      if (jobId) {
        const bundle = await getInspectionBundle(inspectionId, inspection);
        const outcome = await resumeServerJobForBundle(bundle.inspection, bundle.responses, bundle.photos, jobId);
        if (outcome === 'completed') synced += 1;
        if (outcome !== 'failed') continue;
      }
      const hasQueuedRoot = UNSAFE_STATUSES.includes(inspection.syncStatus);
      const queuedResponses = await db.responses
        .where('inspectionId')
        .equals(inspectionId)
        .filter(response => QUEUED_STATUSES.includes(response.syncStatus))
        .count();
      const responseIdsForInspection = (await db.responses.where('inspectionId').equals(inspectionId).toArray())
        .map(response => response.id);
      const queuedPhotos = responseIdsForInspection.length > 0
        ? await db.photos
          .where('responseId')
          .anyOf(responseIdsForInspection)
          .filter(photo => QUEUED_STATUSES.includes(photo.syncStatus))
          .count()
        : 0;

      if (!hasQueuedRoot && queuedResponses === 0 && queuedPhotos === 0) {
        console.log(`[BundleSync] Skipping bundle ${inspectionId}: no queued local changes.`);
        continue;
      }

      try {
        console.log(`[BundleSync] Sending inspection bundle ${inspectionId} (responses: ${queuedResponses}, photos: ${queuedPhotos}).`);
        await this.syncInspectionBundle(inspectionId);
        synced += 1;
      } catch (err) {
        console.warn(`[BundleSync] Falha ao sincronizar bundle ${inspectionId}:`, bundleErrorMessage(err));
      }
    }

    return synced;
  },

  async getLatestReportVersion(inspectionId: string) {
    const { data, error } = await supabase
      .from('inspection_report_versions')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },
};
