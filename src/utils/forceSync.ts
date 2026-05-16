import { db } from '../db/database';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { RepositoryService } from '../services/repositoryService';
import { ScheduleService } from '../services/scheduleService';
import { useAuthStore } from '../store/useAuthStore';
import { getBackupAccessToken, syncQueuedDataToCloud } from './backup';

const DIRECT_PUSH_TIMEOUT_MS = 30000;
const DIRECT_CHUNK_SIZE = 5;

function restUrl(table: string) {
  const base = import.meta.env.VITE_SUPABASE_URL || '';
  return `${base.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=id`;
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

async function directUpsert(table: string, rows: any[], token: string) {
  if (rows.length === 0) return;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY ausente no app.');

  for (let i = 0; i < rows.length; i += DIRECT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + DIRECT_CHUNK_SIZE);
    const response = await fetchWithTimeout(
      restUrl(table),
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(chunk),
      },
      DIRECT_PUSH_TIMEOUT_MS,
      `DirectPush_${table}_${i / DIRECT_CHUNK_SIZE + 1}`
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`${table}: ${text || response.statusText || response.status}`);
    }
  }
}

async function directPushQueuedData() {
  const token = await getBackupAccessToken();
  const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
  const queuedStatuses = ['pending', 'failed', 'syncing'];
  const verifiedAt = new Date();
  const mark = { syncStatus: 'synced' as const, syncError: undefined, syncAttempts: 0, dataVerifiedAt: verifiedAt };

  const clients = await db.clients.where('syncStatus').anyOf(queuedStatuses).toArray();
  const inspections = await db.inspections.where('syncStatus').anyOf(queuedStatuses).toArray();
  const responses = await db.responses.where('syncStatus').anyOf(queuedStatuses).toArray();
  const schedules = await db.schedules.where('syncStatus').anyOf(queuedStatuses).toArray();
  const photos = await db.photos.where('syncStatus').anyOf(queuedStatuses).toArray();

  const clientIds = new Set<string>(clients.map((client: any) => client.id));
  inspections.forEach((inspection: any) => inspection.clientId && clientIds.add(inspection.clientId));
  schedules.forEach((schedule: any) => schedule.clientId && clientIds.add(schedule.clientId));

  const relatedClients = clientIds.size > 0
    ? await db.clients.where('id').anyOf([...clientIds]).toArray()
    : [];
  const clientsById = new Map([...clients, ...relatedClients].map((client: any) => [client.id, client]));

  await directUpsert('clients', [...clientsById.values()].map((client: any) =>
    ClientService.mapToPostgres(!client.tenantId && tenantId ? { ...client, tenantId } : client)
  ), token);

  await directUpsert('inspections', inspections.map((inspection: any) =>
    InspectionService.mapToPostgres(!inspection.tenantId && tenantId ? { ...inspection, tenantId } : inspection)
  ), token);

  await directUpsert('responses', responses.map((response: any) =>
    InspectionService.mapResponseToPostgres(!response.tenantId && tenantId ? { ...response, tenantId } : response)
  ), token);

  await directUpsert('schedules', schedules.map((schedule: any) =>
    ScheduleService.mapToPostgres(!schedule.tenantId && tenantId ? { ...schedule, tenantId } : schedule)
  ), token);

  for (const photo of photos) {
    const prepared = await RepositoryService.preparePhotoForRemote(
      !photo.tenantId && tenantId ? { ...photo, tenantId } : photo,
      db.photos,
      photo.tenantId || tenantId
    );
    if (!(prepared as any).storagePath && String((prepared as any).dataUrl || '').startsWith('data:image/')) {
      throw new Error(`Foto ${photo.id}: upload para Storage nao concluiu.`);
    }
    await directUpsert('photos', [InspectionService.mapPhotoToPostgres(prepared as any)], token);
    await db.photos.update(photo.id, mark);
  }

  if (clients.length > 0) await db.clients.where('id').anyOf(clients.map((item: any) => item.id)).modify(mark);
  if (inspections.length > 0) await db.inspections.where('id').anyOf(inspections.map((item: any) => item.id)).modify(mark);
  if (responses.length > 0) await db.responses.where('id').anyOf(responses.map((item: any) => item.id)).modify(mark);
  if (schedules.length > 0) await db.schedules.where('id').anyOf(schedules.map((item: any) => item.id)).modify(mark);
}

export async function forcePushFinalData() {
  console.log('Iniciando push final de dados locais...');

  const before = await countQueued();
  if (before === 0) {
    return { totalSynced: 0, errors: 0 };
  }

  try {
    await directPushQueuedData();
    const afterDirect = await countQueued();
    const totalSynced = Math.max(before - afterDirect, 0);
    const errors = afterDirect;
    console.log('[ForceSync] Push direto via REST concluido:', { totalSynced, errors });
    if (errors === 0) return { totalSynced, errors };
  } catch (directErr) {
    console.warn('[ForceSync] Push direto via REST falhou; tentando resgate via backend:', directErr);
  }

  try {
    const counts = await syncQueuedDataToCloud();
    const afterBackend = await countQueued();
    const totalSynced = Math.max(before - afterBackend, 0);
    const errors = afterBackend;
    console.log('[ForceSync] Push via backend concluido:', counts, { totalSynced, errors });
    if (errors === 0) return { totalSynced, errors };
  } catch (err) {
    console.error('[ForceSync] Push via backend falhou:', err);
    throw err;
  }

  const after = await countQueued();
  const totalSynced = Math.max(before - after, 0);
  const errors = after;

  console.log(`Push final concluido. Sincronizados: ${totalSynced}, pendentes/falhas: ${errors}`);
  return { totalSynced, errors };
}

async function countQueued() {
  const tables = [db.clients, db.inspections, db.responses, db.photos, db.schedules];
  let total = 0;
  for (const table of tables) {
    total += await (table as any).where('syncStatus').anyOf(['pending', 'failed']).count();
  }
  return total;
}
