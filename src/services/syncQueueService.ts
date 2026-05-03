import { supabase } from '../lib/supabase';
import { db } from '../db/database';
import { RepositoryService } from './repositoryService';
import { ClientService } from './clientService';
import { InspectionService } from './inspectionService';
import { ScheduleService } from './scheduleService';
import { useAuthStore } from '../store/useAuthStore';

/**
 * SyncQueueService
 * Manages the background processing of the synchronization queue.
 */

let isProcessing = false;
let syncInterval: number | null = null;
let lastSummary = { pending: 0, syncing: 0, conflict: 0, failed: 0 };
type ConflictTable = 'inspections' | 'responses' | 'photos';

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
      const stuck = await (table as any).where('syncStatus').equals('syncing').count();
      if (stuck > 0) {
        await (table as any).where('syncStatus').equals('syncing').modify({ syncStatus: 'pending', syncAttempts: 0 });
        count += stuck;
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

  async processAll() {
    if (isProcessing || !navigator.onLine) {
      this.getQueueSummary();
      return;
    }

    // LOCK: Ensure session is consolidated before background network calls
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const summary = await this.getQueueSummary();
      console.log(`[SyncQueue] Processing background sync (Pending: ${summary.pending}, Syncing: ${summary.syncing}, Failed: ${summary.failed})...`);

      isProcessing = true;

      // Process in order of dependency using Bulk strategy for light data
      await RepositoryService.processBulkQueue('clients', db.clients, ClientService.mapToPostgres);
      await RepositoryService.processBulkQueue('inspections', db.inspections, InspectionService.mapToPostgres);
      await RepositoryService.processBulkQueue('responses', db.responses, InspectionService.mapResponseToPostgres);
      await RepositoryService.processBulkQueue('schedules', db.schedules, ScheduleService.mapToPostgres);
      
      // Photos remain sequential due to payload size
      await RepositoryService.processQueue('photos', db.photos, InspectionService.mapPhotoToPostgres);

      console.log('[SyncQueue] Sync completed.');
    } catch (err) {
      console.error('[SyncQueue] Error during background sync:', err);
    } finally {
      isProcessing = false;
      this.getQueueSummary(); // Refresh cache after processing
    }
  },

  async retryFailed() {
    console.log('[SyncQueue] ⚠️ Iniciando reprocessamento forçado da fila...');
    const tables = [db.clients, db.inspections, db.responses, db.schedules, db.photos];
    for (const table of tables) {
      // Libera itens travados em 'syncing' (fila fantasma) e itens com erro 'failed'
      await (table as any)
        .where('syncStatus')
        .anyOf(['failed', 'syncing'])
        .modify({ syncStatus: 'pending', syncAttempts: 0 });
    }
    console.log('[SyncQueue] ✅ Fila desbloqueada. Iniciando sincronização...');
    this.processAll();
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

    await table.update(id, {
      syncStatus: 'pending',
      syncAttempts: 0,
      syncError: null
    });

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
  }
};
