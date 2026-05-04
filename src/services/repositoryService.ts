import { supabase } from '../lib/supabase';
import { db } from '../db/database';
import type { SyncStatus } from '../types';
import { withTimeout } from '../utils/network';
import { useAuthStore } from '../store/useAuthStore';
import { getLocalActor } from '../utils/localActor';
import { dataUrlToBlob } from '../utils/imageUtils';

/**
 * RepositoryService
 * Centralizes Hybrid-Cache and Sync Queue logic.
 */

const activePushes = new Set<string>();
const TENANT_SCOPED_TABLES = new Set(['clients', 'inspections', 'responses', 'photos', 'schedules']);
const UNSAFE_LOCAL_STATUSES: SyncStatus[] = ['pending', 'syncing', 'failed', 'conflict'];
const PHOTO_BUCKET = 'inspection-photos';

function syncKey(tableName: string, id: string) {
  return `${tableName}:${id}`;
}

function sameTimestamp(a?: Date | string, b?: Date | string) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function timestampOf(value?: Date | string) {
  return value ? new Date(value).getTime() : 0;
}

function currentActorId() {
  return getLocalActor().id;
}

function pushTimeoutMs(tableName: string) {
  if (tableName === 'photos') return 30000;
  if (tableName === 'responses') return 20000;
  return 30000;
}

function bulkChunkSize(tableName: string) {
  if (tableName === 'responses') return 1;
  if (tableName === 'inspections' || tableName === 'schedules') return 3;
  return 5;
}

function isInlineDataUrl(value?: string) {
  return Boolean(value?.startsWith('data:image/'));
}

async function uploadPhotoToStorage<T extends { id: string; responseId?: string; dataUrl?: string; storagePath?: string; tenantId?: string }>(
  record: T,
  dexieTable: any,
  tenantId?: string
): Promise<T> {
  if (!isInlineDataUrl(record.dataUrl)) return record;
  if (!tenantId || !record.responseId) return record;

  const storagePath = record.storagePath || `${tenantId}/${record.responseId}/${record.id}.jpg`;
  const blob = dataUrlToBlob(record.dataUrl!);

  const { error } = await withTimeout(
    supabase.storage.from(PHOTO_BUCKET).upload(storagePath, blob, {
      cacheControl: '31536000',
      contentType: 'image/jpeg',
      upsert: true,
    }),
    pushTimeoutMs('photos'),
    'StorageUpload_photos'
  );

  if (error) throw error;

  if (record.storagePath !== storagePath) {
    await dexieTable.update(record.id, { storagePath });
  }

  return { ...record, storagePath };
}

export const RepositoryService = {
  /**
   * withTimeout: Wraps a promise with a timeout
   */
  async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return withTimeout(promise, ms, label);
  },

  /**
   * Generic Upsert (Last Write Wins)
   */
  async upsert<T extends { id: string; updatedAt: Date; syncStatus: SyncStatus; tenantId?: string }>(
    tableName: string,
    record: T,
    dexieTable: any,
    mapToPostgres: (item: T) => any
  ): Promise<T> {
    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
    const now = new Date();
    
    const enriched: T = {
      ...record,
      tenantId: record.tenantId || tenantId,
      localActorId: (record as any).localActorId || currentActorId(),
      updatedAt: now,
      syncStatus: 'pending' as SyncStatus,
      syncAttempts: 0
    };

    // 1. Save locally immediately (Fire and Forget for Remote)
    await dexieTable.put(enriched);
 
    if (navigator.onLine) {
      // Background push - NO AWAIT
      RepositoryService.pushToRemote(tableName, enriched, dexieTable, mapToPostgres).catch(err => {
        console.warn(`[SyncBackground] Push failed for ${tableName}/${enriched.id}:`, err.message);
      });
    }
 
    return enriched;
  },

  async mergeRemoteRecord<T extends { id: string; updatedAt?: Date | string; createdAt?: Date | string; syncStatus?: SyncStatus }>(
    dexieTable: any,
    remote: T,
    options: { label?: string; preserveLocal?: boolean } = {}
  ): Promise<{ accepted: boolean; conflict: boolean; record: T }> {
    const local = await dexieTable.get(remote.id);
    const verifiedAt = new Date();

    if (!local) {
      const record = { ...remote, syncStatus: 'synced' as SyncStatus, dataVerifiedAt: verifiedAt } as T;
      await dexieTable.put(record);
      return { accepted: true, conflict: false, record };
    }

    const remoteUpdatedAt = timestampOf(remote.updatedAt || remote.createdAt);
    const localUpdatedAt = timestampOf(local.updatedAt || local.createdAt);

    if (UNSAFE_LOCAL_STATUSES.includes(local.syncStatus)) {
      const diverged = remoteUpdatedAt > 0 && !sameTimestamp(remote.updatedAt || remote.createdAt, local.updatedAt || local.createdAt);
      if (diverged && local.syncStatus !== 'conflict') {
        await dexieTable.update(local.id, {
          syncStatus: 'conflict',
          syncError: `Conflito preservado${options.label ? ` em ${options.label}` : ''}: remoto divergiu de alteracao local.`,
          conflictRemote: remote,
          conflictLocal: local
        });
      }
      return { accepted: false, conflict: diverged, record: local };
    }

    if (remoteUpdatedAt > localUpdatedAt + 1000 || options.preserveLocal === false) {
      const record = { ...local, ...remote, syncStatus: 'synced' as SyncStatus, dataVerifiedAt: verifiedAt, syncError: null, conflictRemote: undefined, conflictLocal: undefined } as T;
      await dexieTable.put(record);
      return { accepted: true, conflict: false, record };
    }

    if (!local.dataVerifiedAt) {
      await dexieTable.update(local.id, { dataVerifiedAt: verifiedAt });
    }

    return { accepted: false, conflict: false, record: local };
  },

  async pushToRemote<T extends { id: string; updatedAt: Date; syncStatus: SyncStatus; tenantId?: string; dataVerifiedAt?: Date; syncAttempts?: number }>(
    tableName: string,
    record: T,
    dexieTable: any,
    mapToPostgres: (item: T) => any
  ): Promise<boolean> {
    const key = syncKey(tableName, record.id);
    if (activePushes.has(key)) return false;
    activePushes.add(key);

    try {
      const tenantId = record.tenantId || useAuthStore.getState().tenantInfo?.tenantId;
      if (TENANT_SCOPED_TABLES.has(tableName) && !tenantId) {
        await dexieTable.update(record.id, {
          syncStatus: 'pending',
          syncError: 'Aguardando tenantId para sincronizar'
        });
        return false;
      }

      let recordToPush = { ...record, tenantId } as T;
      if (tenantId && tenantId !== record.tenantId) {
        await dexieTable.update(record.id, { tenantId });
      }

      await dexieTable.update(record.id, { syncStatus: 'syncing' });

      if (tableName === 'photos') {
        recordToPush = await uploadPhotoToStorage(recordToPush as any, dexieTable, tenantId) as T;
      }

      // Perform Push (Direct Upsert - Last Write Wins)
      const pgRecord = mapToPostgres(recordToPush);
      const { error: pushError } = await withTimeout(
        supabase.from(tableName).upsert(pgRecord),
        pushTimeoutMs(tableName),
        `Push_${tableName}`
      );

      if (pushError) throw pushError;

      const current = await dexieTable.get(record.id);
      if (current && sameTimestamp(current.updatedAt, recordToPush.updatedAt)) {
        await dexieTable.update(record.id, { 
          syncStatus: 'synced', 
          dataVerifiedAt: new Date(),
          syncError: null,
          syncAttempts: 0 
        });
      } else if (current) {
        await dexieTable.update(record.id, { syncStatus: 'pending' });
      }
      return true;

    } catch (err: any) {
      const attempts = (record.syncAttempts || 0) + 1;
      const shouldMarkFailed = attempts >= 3;
      
      console.error(`[SyncFailure] ❌ Error in ${tableName}/${record.id}:`, err.message);
      
      const current = await dexieTable.get(record.id);
      if (current && sameTimestamp(current.updatedAt, record.updatedAt)) {
        await dexieTable.update(record.id, { 
          syncStatus: shouldMarkFailed ? 'failed' : 'pending', 
          syncError: err.message,
          syncAttempts: attempts
        });
      }
      return false;
    } finally {
      activePushes.delete(key);
    }
  },

  /**
   * getAll: Returns local data immediately + triggers background refresh
   */
  async getAll<T extends { dataVerifiedAt?: Date }>(
    dexieTable: any,
    fetchRemote: () => Promise<T[]>,
    ttlMs: number
  ): Promise<T[]> {
    const local = await dexieTable.toArray();
    
    // Check if we should refresh based on TTL
    const verifiedTimes = local
      .map((item: T) => item.dataVerifiedAt?.getTime())
      .filter((t: any): t is number => !!t);

    const oldestVerified = verifiedTimes.length > 0 ? Math.min(...verifiedTimes) : 0;
    const isStale = local.length === 0 || Date.now() - oldestVerified > ttlMs;

    if (isStale && navigator.onLine) {
      fetchRemote().then(async (remoteData: T[]) => {
        for (const item of remoteData) {
          await RepositoryService.mergeRemoteRecord(dexieTable, item as any, { label: 'refresh remoto' });
        }
      }).catch(err => console.warn(`[Repository] Background fetch failed:`, err));
    }

    return local;
  },

  /**
   * processQueue: Processes items individually (sequential)
   * Best for large payloads like photos
   */
  async processQueue(tableName: string, dexieTable: any, mapToPostgres: (item: any) => any) {
    if (!navigator.onLine) return;
 
    const pending = await dexieTable.where('syncStatus').equals('pending').toArray();
    for (const item of pending) {
      await RepositoryService.pushToRemote(tableName, item as any, dexieTable, mapToPostgres);
    }
  },
 
  /**
   * processBulkQueue: Processes all items in a single network call (batch)
   * Best for light metadata (clients, inspections, responses, schedules)
   */
  async processBulkQueue(tableName: string, dexieTable: any, mapToPostgres: (item: any) => any) {
    if (!navigator.onLine) return;
 
    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
    const queuedItems = (await dexieTable
      .where('syncStatus')
      .equals('pending')
      .toArray())
      .filter((item: any) => !activePushes.has(syncKey(tableName, item.id)));

    const blockedItems = TENANT_SCOPED_TABLES.has(tableName)
      ? queuedItems.filter((item: any) => !item.tenantId && !tenantId)
      : [];

    for (const item of blockedItems) {
      await dexieTable.update(item.id, {
        syncStatus: 'pending',
        syncError: 'Aguardando tenantId para sincronizar'
      });
    }

    const items = queuedItems
      .filter((item: any) => !blockedItems.some((blocked: any) => blocked.id === item.id))
      .map((item: any) => (!item.tenantId && tenantId ? { ...item, tenantId } : item));

    for (const item of items) {
      const current = await dexieTable.get(item.id);
      if (item.tenantId && current?.tenantId !== item.tenantId) {
        await dexieTable.update(item.id, { tenantId: item.tenantId });
      }
    }
 
    if (items.length === 0) return;
 
    const ids = items.map((i: any) => i.id);
    console.log(`[Repository] 📦 Iniciando Chunked Bulk Upsert para ${tableName} (${items.length} itens total)...`);
 
    try {
      // 1. Mark as 'syncing' locally
      await dexieTable.where('id').anyOf(ids).modify({ syncStatus: 'syncing' });
 
      // 2. Prepare payload and Chunk it (max 5 items per request)
      const mappedArray = items.map(mapToPostgres);
      const CHUNK_SIZE = bulkChunkSize(tableName);
      const chunks = [];
      for (let i = 0; i < mappedArray.length; i += CHUNK_SIZE) {
        chunks.push(mappedArray.slice(i, i + CHUNK_SIZE));
      }
 
      // 3. Sequential Chunk Processing
      let processedCount = 0;
      for (const chunk of chunks) {
        processedCount += chunk.length;
        console.log(`[Repository] 🚀 Sending chunk of ${chunk.length} to ${tableName} (${processedCount}/${items.length})...`);
        
        const { error } = await withTimeout(
          supabase.from(tableName).upsert(chunk),
          pushTimeoutMs(tableName),
          `BulkPush_${tableName}`
        );
 
        if (error) throw error;
      }
 
      // 4. Success: Mark as synced only if no newer local edit happened
      // during the network request.
      const verifiedAt = new Date();
      for (const item of items) {
        const current = await dexieTable.get(item.id);
        if (current && sameTimestamp(current.updatedAt, item.updatedAt)) {
          await dexieTable.update(item.id, {
            syncStatus: 'synced',
            dataVerifiedAt: verifiedAt,
            syncError: null,
            syncAttempts: 0
          });
        } else if (current) {
          await dexieTable.update(item.id, { syncStatus: 'pending' });
        }
      }
 
      console.log(`[Repository] ✅ Bulk Upsert completo para ${tableName}.`);
    } catch (err: any) {
      console.error(`[Repository] ❌ Erro no Bulk Upsert para ${tableName}:`, err.message);
      
      // 5. Error handling per item (increment attempts)
      for (const item of items) {
        const attempts = (item.syncAttempts || 0) + 1;
        const shouldMarkFailed = attempts >= 3;
        const current = await dexieTable.get(item.id);
        if (current && sameTimestamp(current.updatedAt, item.updatedAt)) {
          await dexieTable.update(item.id, {
            syncStatus: shouldMarkFailed ? 'failed' : 'pending',
            syncError: err.message,
            syncAttempts: attempts
          });
        }
      }
    }
  }
};
