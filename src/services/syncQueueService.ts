import { db } from '../db/database';
import { RepositoryService } from './repositoryService';
import { ClientService } from './clientService';
import { ScheduleService } from './scheduleService';
import { InspectionBundleSyncService } from './inspectionBundleSyncService';
import { useAuthStore } from '../store/useAuthStore';

/**
 * SyncQueueService
 * Manages the background processing of the synchronization queue.
 */

let isProcessing = false;
let processingStartedAt: number | null = null;
let syncInterval: number | null = null;
let lastSummary = { pending: 0, syncing: 0, conflict: 0, failed: 0 };
type ConflictTable = 'inspections' | 'responses' | 'photos';
type ProcessOptions = { force?: boolean };
const STALE_PROCESSING_LOCK_MS = 5 * 60 * 1000;
const JOB_ERROR_PREFIX = '[sync-job:';

function tableForConflict(tableName: ConflictTable) {
  if (tableName === 'inspections') return db.inspections;
  if (tableName === 'responses') return db.responses;
  return db.photos;
}

export const SyncQueueService = {
  start() {
    if (syncInterval) return;

    // Fix records stuck in 'syncing' from a previous unclean shutdown
    this.cleanupStuckSyncing().then(() => {
      console.log('[SyncQueue] 🚀 Serviço de sincronização inicializado. Limpeza concluída.');
      // Initial process & summary refresh
      this.getQueueSummary().then(() => {
        this.processAll();
      });
    });

    // Process every 60 seconds (reduced from 30 to lower background noise)
    syncInterval = window.setInterval(() => this.processAll(), 60000);

    // Also process when coming back online
    window.addEventListener('online', () => {
      console.log('[SyncQueue] Back online, triggering sync...');
      this.processAll();
    });
  },

  async cleanupStuckSyncing() {
    // Any record left in 'syncing' means the app was closed mid-sync; reset to 'pending'
    const tables = [db.clients, db.inspections, db.responses, db.schedules, db.photos];
    let count = 0;
    for (const table of tables) {
      const stuck = await (table as any).where('syncStatus').equals('syncing').toArray();
      const localOnlyStuck = stuck.filter((item: any) => !item.syncError?.startsWith(JOB_ERROR_PREFIX));
      if (localOnlyStuck.length > 0) {
        await (table as any)
          .where('id')
          .anyOf(localOnlyStuck.map((item: any) => item.id))
          .modify({ syncStatus: 'pending', syncAttempts: 0 });
        count += localOnlyStuck.length;
      }
    }
    if (count > 0) console.log(`[SyncQueue] Reset ${count} records stuck in 'syncing' state.`);
  },

  stop() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  },

  async processAll(options: ProcessOptions = {}) {
    if (isProcessing && !options.force) {
      console.warn('[SyncQueue] Sync already running; skipping overlapping cycle.');
      this.getQueueSummary();
      return;
    }

    if (!navigator.onLine) {
      console.warn('[SyncQueue] Offline; sync postponed.');
      this.getQueueSummary();
      return;
    }

    if (isProcessing && options.force) {
      const isStale = processingStartedAt && Date.now() - processingStartedAt > STALE_PROCESSING_LOCK_MS;
      if (!isStale) {
        console.warn('[SyncQueue] Sync already running; force retry postponed until current cycle finishes.');
        this.getQueueSummary();
        return;
      }

      console.warn('[SyncQueue] Force sync requested; releasing stale processing lock.');
      isProcessing = false;
      processingStartedAt = null;
    }

    isProcessing = true;
    processingStartedAt = Date.now();

    try {
      await this.cleanupStuckSyncing();
      const summary = await this.getQueueSummary();
      console.log(`[SyncQueue] Processing background sync (Pending: ${summary.pending}, Syncing: ${summary.syncing}, Failed: ${summary.failed})...`);

      // Process in order of dependency using Bulk strategy for light data
      await RepositoryService.processBulkQueue('clients', db.clients, ClientService.mapToPostgres);
      const bundleCount = await InspectionBundleSyncService.syncPendingInspectionBundles();
      console.log(`[SyncQueue] Inspection bundle cycles completed: ${bundleCount}.`);
      await RepositoryService.processBulkQueue('schedules', db.schedules, ScheduleService.mapToPostgres);

      console.log('[SyncQueue] Sync completed.');
    } catch (err) {
      console.error('[SyncQueue] Error during background sync:', err);
    } finally {
      isProcessing = false;
      processingStartedAt = null;
      this.getQueueSummary(); // Refresh cache after processing
    }
  },

  async retryFailed() {
    if (isProcessing) {
      const isStale = processingStartedAt && Date.now() - processingStartedAt > STALE_PROCESSING_LOCK_MS;
      if (!isStale) {
        console.warn('[SyncQueue] Retry requested while sync is active; waiting for current cycle.');
        await this.getQueueSummary();
        return;
      }

      console.warn('[SyncQueue] Releasing stale processing lock before forced retry.');
      isProcessing = false;
      processingStartedAt = null;
    }
    console.log('[SyncQueue] ⚠️ Iniciando reprocessamento forçado da fila...');
    const tables = [db.clients, db.inspections, db.responses, db.schedules, db.photos];
    for (const table of tables) {
      // Libera itens travados em 'syncing' (fila fantasma) e itens com erro 'failed'
      await (table as any)
        .where('syncStatus')
        .equals('failed')
        .modify({ syncStatus: 'pending', syncAttempts: 0 });
      const syncing = await (table as any).where('syncStatus').equals('syncing').toArray();
      const localOnlyStuck = syncing.filter((item: any) => !item.syncError?.startsWith(JOB_ERROR_PREFIX));
      if (localOnlyStuck.length > 0) {
        await (table as any)
          .where('id')
          .anyOf(localOnlyStuck.map((item: any) => item.id))
          .modify({ syncStatus: 'pending', syncAttempts: 0 });
      }
    }
    console.log('[SyncQueue] ✅ Fila desbloqueada. Iniciando sincronização...');
    await this.processAll({ force: true });
  },

  async keepLocalConflictsForInspection(inspectionId: string) {
    const inspection = await db.inspections.get(inspectionId);
    if (inspection?.syncStatus === 'conflict') {
      await db.inspections.update(inspection.id, {
        syncStatus: 'pending',
        syncError: 'Conflito resolvido: mantendo versao local para reenvio.'
      });
    }

    const responses = await db.responses.where('inspectionId').equals(inspectionId).toArray();
    for (const response of responses) {
      if (response.syncStatus === 'conflict') {
        await db.responses.update(response.id, {
          syncStatus: 'pending',
          syncError: 'Conflito resolvido: mantendo versao local para reenvio.'
        });
      }
    }

    const responseIds = responses.map(r => r.id);
    if (responseIds.length > 0) {
      const photos = await db.photos.where('responseId').anyOf(responseIds).toArray();
      for (const photo of photos) {
        if (photo.syncStatus === 'conflict') {
          await db.photos.update(photo.id, {
            syncStatus: 'pending',
            syncError: 'Conflito resolvido: mantendo versao local para reenvio.'
          });
        }
      }
    }

    await this.processAll();
  },

  async keepLocalConflict(tableName: ConflictTable, id: string) {
    const table = tableForConflict(tableName) as any;
    const item = await table.get(id);
    if (!item || item.syncStatus !== 'conflict') return;

    await table.update(id, {
      syncStatus: 'pending',
      syncError: 'Conflito resolvido: mantendo versao local para reenvio.'
    });

    await this.processAll();
  },

  async retryItem(tableName: ConflictTable, id: string) {
    const table = tableForConflict(tableName) as any;
    const item = await table.get(id);
    if (!item || item.syncStatus === 'synced') return;
    if (item.syncStatus === 'syncing' && item.syncError?.startsWith(JOB_ERROR_PREFIX)) {
      await this.processAll();
      return;
    }

    await table.update(id, {
      syncStatus: 'pending',
      syncAttempts: 0,
      syncError: null
    });

    await this.processAll();
  },

  async retryInspectionTree(inspectionId: string, reason = 'Reenfileirado para recuperar inspecao ausente no servidor.') {
    const inspection = await db.inspections.get(inspectionId);
    if (inspection && inspection.syncStatus !== 'conflict') {
      await db.inspections.update(inspectionId, {
        syncStatus: 'pending',
        syncAttempts: 0,
        syncError: reason
      });
    }

    const responses = await db.responses.where('inspectionId').equals(inspectionId).toArray();
    for (const response of responses) {
      if (response.syncStatus !== 'conflict') {
        await db.responses.update(response.id, {
          syncStatus: 'pending',
          syncAttempts: 0,
          syncError: reason
        });
      }
    }

    const responseIds = responses.map(response => response.id);
    if (responseIds.length > 0) {
      const photos = await db.photos.where('responseId').anyOf(responseIds).toArray();
      for (const photo of photos) {
        if (photo.syncStatus !== 'conflict') {
          await db.photos.update(photo.id, {
            syncStatus: 'pending',
            syncAttempts: 0,
            syncError: reason
          });
        }
      }
    }

    await this.processAll();
  },

  async applyRemoteConflict(tableName: ConflictTable, id: string) {
    const table = tableForConflict(tableName) as any;
    const item = await table.get(id);
    if (!item?.conflictRemote) return;

    await table.put({
      ...item,
      ...item.conflictRemote,
      conflictLocal: item.conflictLocal || item,
      conflictRemote: undefined,
      syncStatus: 'synced',
      syncError: null,
      dataVerifiedAt: new Date()
    });

    await this.getQueueSummary();
  },

  async getQueueSummary() {
    const counts = {
      pending: 0,
      syncing: 0,
      conflict: 0,
      failed: 0
    };

    const tables = [db.clients, db.inspections, db.responses, db.schedules, db.photos];
    
    for (const table of tables) {
      counts.pending += await (table as any).where('syncStatus').equals('pending').count();
      counts.syncing += await (table as any).where('syncStatus').equals('syncing').count();
      counts.conflict += await (table as any).where('syncStatus').equals('conflict').count();
      counts.failed += await (table as any).where('syncStatus').equals('failed').count();
    }

    lastSummary = counts;
    return counts;
  },

  hasPending() {
    return lastSummary.pending > 0 || lastSummary.syncing > 0;
  },

  isLocked() {
    return Boolean(isProcessing && processingStartedAt && Date.now() - processingStartedAt > STALE_PROCESSING_LOCK_MS);
  },

  resetLock() {
    const isStale = processingStartedAt && Date.now() - processingStartedAt > STALE_PROCESSING_LOCK_MS;
    if (isProcessing && isStale) {
      console.warn('[SyncQueue] Manually resetting stale isProcessing lock');
      isProcessing = false;
      processingStartedAt = null;
    } else if (isProcessing) {
      console.warn('[SyncQueue] Sync is active, not stale; lock reset ignored.');
    }
  }
};
