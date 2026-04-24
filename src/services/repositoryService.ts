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
   * Generic Upsert with Conflict Detection (Last Write Wins with Server Check)
   */
  async upsert<T extends { id: string; updatedAt: Date; syncStatus: SyncStatus; tenantId?: string }>(
    tableName: string,
    record: T,
    dexieTable: any,
    mapToPostgres: (item: T) => any
  ): Promise<T> {
    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
    const now = new Date();
    
    // Fetch local version to preserve the "base" updatedAt for conflict detection
    const localBase = await dexieTable.get(record.id);
    const baseUpdatedAt = localBase?.updatedAt || record.updatedAt;

    const enriched: T = {
      ...record,
      tenantId: record.tenantId || tenantId,
      updatedAt: now,
      syncStatus: 'pending' as SyncStatus,
      syncAttempts: 0
    };

    // 1. Save locally immediately
    await dexieTable.put(enriched);

    // 2. Try push to Supabase (passing the base version for conflict check)
    if (navigator.onLine) {
      RepositoryService.pushToRemote(tableName, enriched, dexieTable, mapToPostgres, baseUpdatedAt).catch(err => {
        console.warn(`[Repository] Async push failed for ${tableName}/${enriched.id}:`, err);
      });
    }

    return enriched;
  },

  /**
   * pushToRemote: Handles the actual Supabase communication and conflict check
   */
  async pushToRemote<T extends { id: string; updatedAt: Date; syncStatus: SyncStatus; tenantId?: string; dataVerifiedAt?: Date; syncAttempts?: number }>(
    tableName: string,
    record: T,
    dexieTable: any,
    mapToPostgres: (item: T) => any,
    baseUpdatedAt?: Date
  ): Promise<boolean> {
    try {
      await dexieTable.update(record.id, { syncStatus: 'syncing' });

      // Check for remote version first (Conflict detection)
      const { data: remote, error: fetchError } = await supabase
        .from(tableName)
        .select('updated_at')
        .eq('id', record.id)
        .single();

      if (!fetchError && remote) {
        const remoteUpdate = new Date(remote.updated_at);
        const compareTo = baseUpdatedAt || record.updatedAt;
        
        // If remote is strictly newer than our base version
        if (remoteUpdate > compareTo) {
          console.warn(`[Repository] Conflict detected for ${tableName}/${record.id}. Remote: ${remoteUpdate}, BaseLocal: ${compareTo}`);
          await dexieTable.update(record.id, { syncStatus: 'conflict' });
          return false;
        }
      }

      // Perform Push
      const pgRecord = mapToPostgres(record);
      const { error: pushError } = await withTimeout(
        supabase.from(tableName).upsert(pgRecord),
        10000,
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
      const attempts = (record as any).syncAttempts || 0;
      const newStatus = attempts >= 2 ? 'failed' : 'pending';
      
      await dexieTable.update(record.id, { 
        syncStatus: newStatus, 
        syncError: err.message,
        syncAttempts: attempts + 1
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
   * processQueue: Processes all items with 'pending' status
   */
  async processQueue(tableName: string, dexieTable: any, mapToPostgres: (item: any) => any) {
    if (!navigator.onLine) return;

    const pending = await dexieTable.where('syncStatus').equals('pending').toArray();
    for (const item of pending) {
      await RepositoryService.pushToRemote(tableName, item as any, dexieTable, mapToPostgres);
    }
  }
};
