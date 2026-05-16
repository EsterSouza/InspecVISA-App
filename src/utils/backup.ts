import { db } from '../db/database';
import { supabase } from '../lib/supabase';

const PRE_BUNDLE_BACKUP_FLAG = 'inspecvisa-pre-bundle-backup-created';
const BACKUP_CLOUD_SYNC_TIMEOUT_MS = 60000;
const BACKUP_AUTH_TIMEOUT_MS = 8000;
const DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'deletedAt',
  'dataVerifiedAt',
  'inspectionDate',
  'completedAt',
  'takenAt',
  'scheduledAt',
  'timestamp',
];

function reviveDate(value: unknown) {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}

function reviveDateFields<T extends Record<string, any>>(record: T): T {
  const revived: Record<string, any> = { ...record };
  for (const field of DATE_FIELDS) {
    if (field in revived) {
      revived[field] = reviveDate(revived[field]);
    }
  }
  return revived as T;
}

function reviveRecords<T extends Record<string, any>>(records: T[]) {
  return records.map(reviveDateFields);
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), timeoutMs);
    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new Error(`TIMEOUT: ${label}`)), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
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

async function getBackupAccessToken() {
  try {
    let { data, error } = await withTimeout(
      supabase.auth.getSession(),
      BACKUP_AUTH_TIMEOUT_MS,
      'BackupGetSession'
    );
    if (error) throw error;

    if (!data.session?.access_token) {
      const refreshed = await withTimeout(
        supabase.auth.refreshSession(),
        BACKUP_AUTH_TIMEOUT_MS,
        'BackupRefreshSession'
      );
      data = refreshed.data;
      if (refreshed.error) throw refreshed.error;
    }

    if (data.session?.access_token) return data.session.access_token;
  } catch (err) {
    console.warn('[Backup] Auth session lookup failed, trying stored token:', err);
  }

  const stored = getStoredAccessToken();
  if (stored) return stored;
  throw new Error('Sessao expirada. Entre novamente antes de importar ou sincronizar backup.');
}

async function markRecordsSynced(content: any) {
  const data = content?.data || {};
  const verifiedAt = new Date();
  const mark = { syncStatus: 'synced' as const, syncError: undefined, syncAttempts: 0, dataVerifiedAt: verifiedAt };

  if (Array.isArray(data.clients) && data.clients.length > 0) {
    await db.clients.where('id').anyOf(data.clients.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.inspections) && data.inspections.length > 0) {
    await db.inspections.where('id').anyOf(data.inspections.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.responses) && data.responses.length > 0) {
    await db.responses.where('id').anyOf(data.responses.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.photos) && data.photos.length > 0) {
    await db.photos.where('id').anyOf(data.photos.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.schedules) && data.schedules.length > 0) {
    await db.schedules.where('id').anyOf(data.schedules.map((item: any) => item.id)).modify(mark);
  }
}

async function syncBackupToCloud(content: any) {
  const token = await getBackupAccessToken();
  const body = JSON.stringify(content);

  const response = await fetchWithTimeout(
    '/api/sync-backup-import',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
    },
    BACKUP_CLOUD_SYNC_TIMEOUT_MS,
    'SyncBackupImport'
  );
  const raw = await response.text().catch(() => '');
  let result: any = {};
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    result = {};
  }
  if (!response.ok || !result?.ok) {
    const detail = result?.error || raw?.slice(0, 500);
    throw new Error(detail || `Resgate do backup falhou (${response.status}, payload ${Math.round(body.length / 1024)} KB).`);
  }

  await markRecordsSynced(content);
  return result.counts as Record<string, number>;
}

function emptyPayloadFrom(payload: any, reason: string) {
  return {
    ...payload,
    reason,
    timestamp: new Date().toISOString(),
    data: {
      ...payload.data,
      clients: [],
      inspections: [],
      responses: [],
      photos: [],
      schedules: [],
      templates: [],
      settings: null,
    },
  };
}

function splitQueuedPayload(payload: any) {
  const data = payload.data || {};
  const clients = Array.isArray(data.clients) ? data.clients : [];
  const inspections = Array.isArray(data.inspections) ? data.inspections : [];
  const responses = Array.isArray(data.responses) ? data.responses : [];
  const photos = Array.isArray(data.photos) ? data.photos : [];

  const clientsById = new Map(clients.map((client: any) => [client.id, client]));
  const inspectionsById = new Map(inspections.map((inspection: any) => [inspection.id, inspection]));
  const responsesById = new Map(responses.map((response: any) => [response.id, response]));

  const withoutPhotos = {
    ...payload,
    reason: `${payload.reason || 'manual-queued-sync'}:records`,
    data: {
      ...data,
      photos: [],
    },
  };

  const photoPayloads = photos.map((photo: any, index: number) => {
    const response = responsesById.get(photo.responseId || photo.response_id);
    const inspection = response ? inspectionsById.get((response as any).inspectionId || (response as any).inspection_id) : null;
    const client = inspection ? clientsById.get((inspection as any).clientId || (inspection as any).client_id) : null;
    const photoPayload = emptyPayloadFrom(payload, `${payload.reason || 'manual-queued-sync'}:photo:${index + 1}/${photos.length}`);
    photoPayload.data.clients = client ? [client] : clients;
    photoPayload.data.inspections = inspection ? [inspection] : inspections;
    photoPayload.data.responses = response ? [response] : responses;
    photoPayload.data.photos = [photo];
    return photoPayload;
  });

  return { withoutPhotos, photoPayloads };
}

async function buildQueuedBackupPayload(reason = 'manual-queued-sync') {
  const queuedStatuses = ['pending', 'failed', 'syncing'];
  const [queuedClients, queuedInspections, queuedResponses, queuedPhotos, queuedSchedules] = await Promise.all([
    db.clients.where('syncStatus').anyOf(queuedStatuses).toArray(),
    db.inspections.where('syncStatus').anyOf(queuedStatuses).toArray(),
    db.responses.where('syncStatus').anyOf(queuedStatuses).toArray(),
    db.photos.where('syncStatus').anyOf(queuedStatuses).toArray(),
    db.schedules.where('syncStatus').anyOf(queuedStatuses).toArray(),
  ]);

  const clientIds = new Set<string>(queuedClients.map((client: any) => client.id));
  const inspectionIds = new Set<string>(queuedInspections.map((inspection: any) => inspection.id));
  const responseIds = new Set<string>(queuedResponses.map((response: any) => response.id));

  queuedInspections.forEach((inspection: any) => {
    if (inspection.clientId) clientIds.add(inspection.clientId);
  });
  queuedSchedules.forEach((schedule: any) => {
    if (schedule.clientId) clientIds.add(schedule.clientId);
    if (schedule.inspectionId) inspectionIds.add(schedule.inspectionId);
  });
  queuedResponses.forEach((response: any) => {
    if (response.inspectionId) inspectionIds.add(response.inspectionId);
  });
  queuedPhotos.forEach((photo: any) => {
    if (photo.responseId) responseIds.add(photo.responseId);
  });

  if (responseIds.size > 0) {
    const relatedResponses = await db.responses.where('id').anyOf([...responseIds]).toArray();
    relatedResponses.forEach((response: any) => {
      if (response.inspectionId) inspectionIds.add(response.inspectionId);
    });
    queuedResponses.push(...relatedResponses.filter((response: any) => !queuedResponses.some((item: any) => item.id === response.id)));
  }

  if (inspectionIds.size > 0) {
    const relatedInspections = await db.inspections.where('id').anyOf([...inspectionIds]).toArray();
    relatedInspections.forEach((inspection: any) => {
      if (inspection.clientId) clientIds.add(inspection.clientId);
    });
    queuedInspections.push(...relatedInspections.filter((inspection: any) => !queuedInspections.some((item: any) => item.id === inspection.id)));
  }

  if (clientIds.size > 0) {
    const relatedClients = await db.clients.where('id').anyOf([...clientIds]).toArray();
    queuedClients.push(...relatedClients.filter((client: any) => !queuedClients.some((item: any) => item.id === client.id)));
  }

  const uniqueById = <T extends { id: string }>(items: T[]) =>
    [...new Map(items.filter(item => item?.id).map(item => [item.id, item])).values()];

  return {
    version: '2.0',
    reason,
    timestamp: new Date().toISOString(),
    data: {
      clients: uniqueById(queuedClients as any[]),
      inspections: uniqueById(queuedInspections as any[]),
      responses: uniqueById(queuedResponses as any[]),
      photos: uniqueById(queuedPhotos as any[]),
      schedules: uniqueById(queuedSchedules as any[]),
      templates: [],
      settings: null,
    },
  };
}

export async function syncQueuedDataToCloud() {
  const payload = await buildQueuedBackupPayload();
  const { withoutPhotos, photoPayloads } = splitQueuedPayload(payload);
  const totalCounts: Record<string, number> = {};
  const addCounts = (counts: Record<string, number>) => {
    for (const [key, value] of Object.entries(counts || {})) {
      totalCounts[key] = (totalCounts[key] || 0) + Number(value || 0);
    }
  };

  const hasRecords =
    withoutPhotos.data.clients.length > 0 ||
    withoutPhotos.data.inspections.length > 0 ||
    withoutPhotos.data.responses.length > 0 ||
    withoutPhotos.data.schedules.length > 0;

  if (hasRecords) {
    addCounts(await syncBackupToCloud(withoutPhotos));
  }

  for (const photoPayload of photoPayloads) {
    addCounts(await syncBackupToCloud(photoPayload));
  }

  return totalCounts;
}

async function buildDatabaseBackupPayload(reason = 'manual-export') {
  const clients = await db.clients.toArray();
  const inspections = await db.inspections.toArray();
  const responses = await db.responses.toArray();
  const photos = await db.photos.toArray();
  const schedules = await db.schedules.toArray();
  const templates = await db.templates.toArray();
  const settings = localStorage.getItem('inspec-visa-settings');

  return {
    version: '2.0',
    reason,
    timestamp: new Date().toISOString(),
    data: {
      clients,
      inspections,
      responses,
      photos,
      schedules,
      templates,
      settings: settings ? JSON.parse(settings) : null
    }
  };
}

export async function ensurePreBundleBackup(): Promise<string> {
  const existingId = localStorage.getItem(PRE_BUNDLE_BACKUP_FLAG);
  if (existingId) return existingId;

  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pre-bundle-${Date.now()}`;

  const payload = await buildDatabaseBackupPayload('pre-bundle-sync');
  await db.local_backups.put({
    id,
    createdAt: new Date(),
    reason: 'pre-bundle-sync',
    payload
  });

  localStorage.setItem(PRE_BUNDLE_BACKUP_FLAG, id);
  console.log(`[Backup] Pre-bundle local backup created: ${id}`);
  return id;
}

export async function exportDatabase() {
  const backup = await buildDatabaseBackupPayload();

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspec-visa-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportInternalBackups() {
  const backups = await db.local_backups.toArray();
  const payload = {
    version: 'internal-backups-1.0',
    timestamp: new Date().toISOString(),
    count: backups.length,
    backups,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspec-visa-backups-internos-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDatabase(jsonFile: File, options: { syncToCloud?: boolean } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (!content.data || !content.version) {
          throw new Error('Arquivo de backup inválido.');
        }

        const { clients, inspections, responses, photos, schedules, templates, settings } = content.data;

        // Transactional import
        await db.transaction('rw', [db.clients, db.inspections, db.responses, db.photos, db.schedules, db.templates], async () => {
          // We use put (upsert) to avoid duplicates if importing same data twice
          if (Array.isArray(clients)) await db.clients.bulkPut(reviveRecords(clients));
          if (Array.isArray(inspections)) await db.inspections.bulkPut(reviveRecords(inspections));
          if (Array.isArray(responses)) await db.responses.bulkPut(reviveRecords(responses));
          if (Array.isArray(photos)) await db.photos.bulkPut(reviveRecords(photos));
          if (Array.isArray(schedules)) await db.schedules.bulkPut(reviveRecords(schedules));
          if (Array.isArray(templates)) await db.templates.bulkPut(reviveRecords(templates));
        });

        if (settings) {
          localStorage.setItem('inspec-visa-settings', JSON.stringify(settings));
          // Note: Zustand state won't update automatically without a reload or manual trigger
        }

        if (options.syncToCloud) {
          const counts = await syncBackupToCloud(content);
          resolve(
            `Backup importado e enviado para a nuvem. ` +
            `Clientes: ${counts.clients || 0}, inspeções: ${counts.inspections || 0}, respostas: ${counts.responses || 0}, fotos: ${counts.photos || 0}, agendamentos: ${counts.schedules || 0}.`
          );
          return;
        }

        resolve('Importação concluída com sucesso! Recarregando aplicação...');
      } catch (err) {
        reject(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
      }
    };
    reader.onerror = () => reject('Erro ao ler arquivo.');
    reader.readAsText(jsonFile);
  });
}
