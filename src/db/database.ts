import Dexie, { type Table } from 'dexie';
import type {
  Client,
  ChecklistTemplate,
  Inspection,
  InspectionResponse,
  InspectionPhoto,
  Schedule,
  SyncLog,
} from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

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

  constructor() {
    super('InspectionDB');
    this.version(9).stores({ // Bumped version from 8 to 9
      clients:     'id, category, name, city, state, tenantId, createdAt, updatedAt, synced',
      templates:   'id, category',
      inspections: 'id, clientId, templateId, status, tenantId, [clientId+status], inspectionDate, completedAt, createdAt, updatedAt, synced',
      responses:   'id, inspectionId, itemId, result, tenantId, updatedAt, synced',
      photos:      'id, responseId, tenantId, synced',
      schedules:   'id, clientId, scheduledAt, status, tenantId, updatedAt, synced',
      sync_logs:   '++id, timestamp, level',
      deletions_sync: '++id, table, recordId'
    });

    // Auto-manage sync metadata via hooks
    const tablesToHook = [this.clients, this.inspections, this.responses, this.schedules, this.photos];
    tablesToHook.forEach(table => {
      table.hook('creating', (primaryKey, obj) => {
        obj.synced = 0; // 0 = pending
        obj.updatedAt = new Date();
        // Set tenantId automatically from store
        const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
        if (tenantId) obj.tenantId = tenantId;
      });
      table.hook('updating', (mods, primKey, obj) => {
        // If the update itself is setting synced=1 (from syncService), don't revert it
        if (mods.hasOwnProperty('synced')) return;
        
        return {
          ...mods,
          synced: 0, // 0 = pending
          updatedAt: new Date()
        };
      });
    });
  }
}

export const db = new InspectionDatabase();

// Initialize templates seed on first load
export async function initializeDatabase(templates: ChecklistTemplate[]) {
  // Use bulkPut to avoid BulkError if IDs already exist
  await db.templates.bulkPut(templates);
}

// Helper to track deletions for sync
async function trackDeletion(tableName: string, recordId: string) {
  try {
    await db.deletions_sync.add({
      table: tableName,
      recordId,
      timestamp: new Date()
    });
  } catch (err) {
    console.warn('Failed to track deletion', err);
  }
}

// Recursive deletion of a client and all associated data
export async function deleteClient(clientId: string) {
  await db.transaction('rw', [db.clients, db.inspections, db.responses, db.photos, db.schedules, db.deletions_sync], async () => {
    // 1. Track client for remote deletion
    await trackDeletion('clients', clientId);

    // 2. Get and track all inspections
    const clientInspections = await db.inspections.where('clientId').equals(clientId).toArray();
    for (const inspec of clientInspections) {
      await trackDeletion('inspections', inspec.id);
      
      // 3. Get and track all responses
      const responses = await db.responses.where('inspectionId').equals(inspec.id).toArray();
      for (const res of responses) {
        await trackDeletion('responses', res.id);
        // Photos are tracked via response or handled by cascade in PG
      }
      
      await db.responses.where('inspectionId').equals(inspec.id).delete();
    }
    
    await db.inspections.where('clientId').equals(clientId).delete();
    await db.schedules.where('clientId').equals(clientId).delete();
    await db.clients.delete(clientId);
  });

  // Opportunistic remote delete
  try {
    await supabase.from('clients').delete().eq('id', clientId);
  } catch (err) {}
}

export async function deleteInspection(inspectionId: string) {
  await db.transaction('rw', [db.inspections, db.responses, db.photos, db.deletions_sync], async () => {
    await trackDeletion('inspections', inspectionId);
    
    const responses = await db.responses.where('inspectionId').equals(inspectionId).toArray();
    for (const res of responses) {
      await trackDeletion('responses', res.id);
    }
    
    await db.responses.where('inspectionId').equals(inspectionId).delete();
    await db.inspections.delete(inspectionId);
  });

  try {
    await supabase.from('inspections').delete().eq('id', inspectionId);
  } catch (err) {}
}

export async function deleteSchedule(scheduleId: string) {
  await trackDeletion('schedules', scheduleId);
  await db.schedules.delete(scheduleId);

  try {
    await supabase.from('schedules').delete().eq('id', scheduleId);
  } catch (err) {}
}

