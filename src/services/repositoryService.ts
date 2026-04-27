import { supabase } from '../lib/supabase';
import { db } from '../db/database';
import type { SyncStatus } from '../types';
import { withTimeout } from '../utils/network';
import { useAuthStore } from '../store/useAuthStore';

/**
 * RepositoryService
 * Centralizes Hybrid-Cache and Sync Queue logic.
 */

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

  async pushToRemote<T extends { id: string; updatedAt: Date; syncStatus: SyncStatus; tenantId?: string; dataVerifiedAt?: Date; syncAttempts?: number }>(
    tableName: string,
    record: T,
    dexieTable: any,
    mapToPostgres: (item: T) => any
  ): Promise<boolean> {
    try {
      await dexieTable.update(record.id, { syncStatus: 'syncing' });

      // Perform Push (Direct Upsert - Last Write Wins)
      const pgRecord = mapToPostgres(record);
      const { error: pushError } = await withTimeout(
        supabase.from(tableName).upsert(pgRecord),
        120000,
        `Push_${tableName}`
      );

      if (pushError) throw pushError;

      // Success
      await dexieTable.update(record.id, { 
        syncStatus: 'synced', 
        dataVerifiedAt: new Date(),
        syncError: null,
        syncAttempts: 0 
      });
      return true;

    } catch (err: any) {
      const attempts = (record.syncAttempts || 0) + 1;
      const shouldMarkFailed = attempts >= 3;
      
      console.error(`[SyncFailure] ❌ Error in ${tableName}/${record.id}:`, err.message);
      
      await dexieTable.update(record.id, { 
        syncStatus: shouldMarkFailed ? 'failed' : 'pending', 
        syncError: err.message,
        syncAttempts: attempts
      });
      return false;
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
          const localItem = await dexieTable.get((item as any).id);
          // Only update if local is not pending/conflict
          if (!localItem || localItem.syncStatus === 'synced' || localItem.syncStatus === 'failed') {
             await dexieTable.put({ ...item, syncStatus: 'synced' as SyncStatus, dataVerifiedAt: new Date() });
          }
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
 
    const items = await dexieTable
      .where('syncStatus')
      .anyOf(['pending', 'failed'])
      .toArray();
 
    if (items.length === 0) return;
 
    const ids = items.map((i: any) => i.id);
    console.log(`[Repository] 📦 Iniciando Chunked Bulk Upsert para ${tableName} (${items.length} itens total)...`);
 
    try {
      // 1. Mark as 'syncing' locally
      await dexieTable.where('id').anyOf(ids).modify({ syncStatus: 'syncing' });
 
      // 2. Prepare payload and Chunk it (max 5 items per request)
      const mappedArray = items.map(mapToPostgres);
      const CHUNK_SIZE = 5;
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
          120000, // Extended timeout for heavy payloads (120s)
          `BulkPush_${tableName}`
        );
 
        if (error) throw error;
      }
 
      // 4. Success: Mark as 'synced'
      await dexieTable.where('id').anyOf(ids).modify({ 
        syncStatus: 'synced', 
        dataVerifiedAt: new Date(),
        syncError: null,
        syncAttempts: 0 
      });
 
      console.log(`[Repository] ✅ Bulk Upsert completo para ${tableName}.`);
    } catch (err: any) {
      console.error(`[Repository] ❌ Erro no Bulk Upsert para ${tableName}:`, err.message);
      
      // 5. Error handling per item (increment attempts)
      for (const item of items) {
        const attempts = (item.syncAttempts || 0) + 1;
        const shouldMarkFailed = attempts >= 3;
        await dexieTable.update(item.id, {
          syncStatus: shouldMarkFailed ? 'failed' : 'pending',
          syncError: err.message,
          syncAttempts: attempts
        });
      }
    }
  }
};
