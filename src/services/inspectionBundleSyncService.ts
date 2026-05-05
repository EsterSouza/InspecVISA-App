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
import { RepositoryService } from './repositoryService';
import { InspectionService } from './inspectionService';

const BUNDLE_RPC_TIMEOUT_MS = 180000;
const BUNDLE_API_TIMEOUT_MS = 60000;
const BUNDLE_ERROR_UNAVAILABLE = 'RPC sync_inspection_bundle indisponivel. Migration 006 precisa estar aplicada no Supabase.';
const QUEUED_STATUSES: SyncStatus[] = ['pending'];
const UNSAFE_STATUSES: SyncStatus[] = ['pending', 'syncing', 'failed'];

function sameTimestamp(a?: Date | string, b?: Date | string) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function timestampsClose(a?: Date | string, b?: Date | string) {
  if (!a || !b) return false;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 2000;
}

function isTimeoutError(err: any) {
  return err?.message?.startsWith('TIMEOUT');
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
    syncBatchId: data?.syncBatchId || data?.sync_batch_id,
    serverUpdatedAt: data?.serverUpdatedAt || data?.server_updated_at,
    reportVersionId: data?.reportVersionId || data?.report_version_id || null,
    failedItems: Array.isArray(data?.failedItems) ? data.failedItems : [],
    error: data?.error,
  };
}

function bundleErrorMessage(err: any) {
  const message = err?.message || String(err);
  if (err?.code === '42883' || message.includes('sync_inspection_bundle')) {
    return BUNDLE_ERROR_UNAVAILABLE;
  }
  return message;
}

async function sendBundleThroughApi(payload: InspectionBundlePayload): Promise<InspectionBundleResult> {
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

async function sendBundleThroughRpc(payload: InspectionBundlePayload, inspectionId: string): Promise<InspectionBundleResult> {
  const { data, error } = await withTimeout(
    supabase.rpc('sync_inspection_bundle', { p_payload: payload }),
    BUNDLE_RPC_TIMEOUT_MS,
    `InspectionBundle_${inspectionId}`
  );

  if (error) throw error;

  const result = normalizeRpcResult(data, inspectionId);
  if (!result.ok) {
    throw new Error(result.error || 'Bundle rejeitado pelo servidor.');
  }

  return result;
}

async function verifyBundlePersisted(
  inspection: Inspection,
  responses: InspectionResponse[]
): Promise<boolean> {
  try {
    const { data: remoteInspection, error: inspectionError } = await withTimeout(
      supabase
        .from('inspections')
        .select('id, updated_at')
        .eq('id', inspection.id)
        .maybeSingle(),
      20000,
      `VerifyBundleInspection_${inspection.id}`
    );

    if (inspectionError || !remoteInspection?.updated_at) return false;
    if (!timestampsClose(remoteInspection.updated_at, inspection.updatedAt)) return false;

    if (responses.length === 0) return true;

    const responseIds = responses.map(response => response.id);
    const { data: remoteResponses, error: responsesError } = await withTimeout(
      supabase
        .from('responses')
        .select('id, updated_at')
        .in('id', responseIds),
      30000,
      `VerifyBundleResponses_${inspection.id}`
    );

    if (responsesError || !Array.isArray(remoteResponses)) return false;
    if (remoteResponses.length !== responseIds.length) return false;

    const remoteById = new Map(remoteResponses.map((row: any) => [row.id, row.updated_at]));
    return responses.every(response => timestampsClose(remoteById.get(response.id), response.updatedAt));
  } catch (err) {
    console.warn(`[BundleSync] Verification after timeout failed for ${inspection.id}:`, err);
    return false;
  }
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

async function preparePhotos(photos: InspectionPhoto[], tenantId: string) {
  const prepared: InspectionPhoto[] = [];
  for (const photo of photos) {
    const uploaded = await RepositoryService.preparePhotoForRemote(photo, db.photos, tenantId);
    prepared.push(uploaded as InspectionPhoto);
  }
  return prepared;
}

function buildPayload(
  inspection: Inspection,
  responses: InspectionResponse[],
  photos: InspectionPhoto[],
  finalizeReport: boolean
): InspectionBundlePayload {
  return {
    inspection: InspectionService.mapToPostgres(inspection),
    responses: responses.map(InspectionService.mapResponseToPostgres),
    photos: photos.map(InspectionService.mapPhotoToPostgres),
    clientSyncId: `${inspection.id}:${Date.now()}`,
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
    let preparedPhotos: InspectionPhoto[] = bundle.photos;

    try {
      preparedPhotos = await preparePhotos(bundle.photos, bundle.inspection.tenantId!);
      const payload = buildPayload(bundle.inspection, bundle.responses, preparedPhotos, Boolean(options.finalizeReport));
      let result: InspectionBundleResult;
      try {
        result = await sendBundleThroughApi(payload);
      } catch (apiErr: any) {
        const message = apiErr?.message || String(apiErr);
        if (!message.includes('404') && !message.includes('Supabase server environment variables')) {
          throw apiErr;
        }
        console.warn('[BundleSync] Backend API unavailable, falling back to Supabase RPC:', message);
        result = await sendBundleThroughRpc(payload, inspectionId);
      }

      await markBundleSuccess(bundle.inspection, bundle.responses, preparedPhotos);
      return result;
    } catch (err) {
      if (isTimeoutError(err)) {
        const persisted = await verifyBundlePersisted(bundle.inspection, bundle.responses);
        if (persisted) {
          console.log(`[BundleSync] Bundle ${inspectionId} confirmed on server after slow response.`);
          await markBundleSuccess(bundle.inspection, bundle.responses, preparedPhotos);
          return {
            ok: true,
            inspectionId,
            serverUpdatedAt: new Date().toISOString(),
            reportVersionId: null,
            failedItems: [],
          };
        }
      }

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

    const pendingResponses = await db.responses
      .where('syncStatus')
      .anyOf(QUEUED_STATUSES)
      .toArray();
    pendingResponses.forEach(response => inspectionIds.add(response.inspectionId));

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
