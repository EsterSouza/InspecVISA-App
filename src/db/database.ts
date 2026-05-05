import Dexie, { type Table } from 'dexie';
import type {
  Client,
  ChecklistTemplate,
  Inspection,
  InspectionResponse,
  InspectionPhoto,
  LocalBackupRecord,
  Schedule,
  SyncLog,
} from '../types';

// Memory fallback for Incognito/Unsupported environments
async function setupDexie() {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB undefined');
    // Security check: attempt to open a dummy database
    const req = indexedDB.open('InspecVISACheck');
    req.onerror = () => useMemoryFallback();
    req.onsuccess = (e) => {
      const dbInstance = (e.target as any).result;
      dbInstance.close();
      indexedDB.deleteDatabase('InspecVISACheck');
    };
  } catch (e) {
    console.warn('[DB] IndexedDB error/blocked, falling back to memory', e);
    await useMemoryFallback();
  }
}

async function useMemoryFallback() {
  try {
    const { default: FDB } = await import('fake-indexeddb');
    // @ts-ignore
    const { default: FKR } = await import('fake-indexeddb/lib/FDBKeyRange').catch(() => ({ default: null }));
    Dexie.dependencies.indexedDB = FDB;
    if (FKR) Dexie.dependencies.IDBKeyRange = FKR;
  } catch (e) {
    console.error('[DB] Failed to load memory fallback', e);
  }
}

setupDexie();

export interface DeletionSync {
  id?: number;
  table: string;
  recordId: string;
  timestamp: Date;
}

export class InspectionDatabase extends Dexie {
  clients!: Table<Client>;
  templates!: Table<ChecklistTemplate>;
  inspections!: Table<Inspection>;
  responses!: Table<InspectionResponse>;
  photos!: Table<InspectionPhoto>;
  schedules!: Table<Schedule>;
  sync_logs!: Table<SyncLog>;
  deletions_sync!: Table<DeletionSync>;
  local_backups!: Table<LocalBackupRecord>;

  constructor() {
    super('InspectionDB');
    this.version(13).stores({
      clients: 'id, category, name, city, state, tenantId, deletedAt, createdAt, updatedAt, syncStatus, dataVerifiedAt',
      templates: 'id, category',
      inspections: 'id, clientId, templateId, status, tenantId, deletedAt, [clientId+status], inspectionDate, completedAt, createdAt, updatedAt, syncStatus, dataVerifiedAt',
      responses: 'id, inspectionId, itemId, result, tenantId, deletedAt, updatedAt, syncStatus, dataVerifiedAt, [inspectionId+itemId]',
      photos: 'id, responseId, tenantId, deletedAt, syncStatus, updatedAt',
      schedules: 'id, clientId, scheduledAt, status, tenantId, deletedAt, updatedAt, syncStatus, dataVerifiedAt',
      sync_logs: '++id, timestamp, level',
      deletions_sync: '++id, table, recordId'
    });
    this.version(14).stores({
      clients: 'id, category, name, city, state, tenantId, deletedAt, createdAt, updatedAt, syncStatus, dataVerifiedAt',
      templates: 'id, category',
      inspections: 'id, clientId, templateId, status, tenantId, deletedAt, [clientId+status], inspectionDate, completedAt, createdAt, updatedAt, syncStatus, dataVerifiedAt',
      responses: 'id, inspectionId, itemId, result, tenantId, deletedAt, updatedAt, syncStatus, dataVerifiedAt, [inspectionId+itemId]',
      photos: 'id, responseId, tenantId, deletedAt, syncStatus, updatedAt',
      schedules: 'id, clientId, scheduledAt, status, tenantId, deletedAt, updatedAt, syncStatus, dataVerifiedAt',
      sync_logs: '++id, timestamp, level',
      deletions_sync: '++id, table, recordId',
      local_backups: 'id, createdAt, reason'
    });
  }

}

export const db = new InspectionDatabase();

/**
 * Initializes the local Dexie template cache.
 * Remote templates (from Supabase) take priority over static built-in ones.
 * Deduplication is done by NAME to prevent duplicates when seeds and statics overlap.
 */
export async function initializeDatabase(templates: ChecklistTemplate[]) {
  if (!templates || !Array.isArray(templates)) {
    console.warn('[DB] initializeDatabase called with invalid templates array');
    return;
  }

  const existingTemplates = await db.templates.toArray().catch(() => [] as ChecklistTemplate[]);
  const existingRemoteTemplates = existingTemplates.filter(t => !t.id.startsWith('tpl-'));

  // Separate remote (have Supabase UUIDs) from static (have tpl-* IDs)
  const incomingRemoteTemplates = templates.filter(t => !t.id.startsWith('tpl-'));
  const staticTemplates = templates.filter(t => t.id.startsWith('tpl-'));

  const remoteById = new Map<string, ChecklistTemplate>();
  for (const template of existingRemoteTemplates) remoteById.set(template.id, template);
  for (const template of incomingRemoteTemplates) remoteById.set(template.id, template);
  const remoteTemplates = Array.from(remoteById.values());

  // Build a set of names already covered by remote templates
  const remoteNames = new Set(remoteTemplates.map(t => t.name));

  // Only include static templates whose name is NOT already in remote
  const uniqueStatics = staticTemplates.filter(t => !remoteNames.has(t.name));

  // Merge: remote first, then non-duplicate statics
  const deduped = [...remoteTemplates, ...uniqueStatics];

  // Never drop cached remote templates just because the network refresh timed out.
  // Inspections created from dynamic templates depend on those UUIDs to reopen offline.
  await db.templates.clear();
  await db.templates.bulkPut(deduped);
}
