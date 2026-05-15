import { db } from '../db/database';
import { supabase } from '../lib/supabase';

const QUEUED_STATUSES = ['pending', 'syncing', 'failed'] as const;
const TABLES = [
  { name: 'clients', dbTable: db.clients },
  { name: 'inspections', dbTable: db.inspections },
  { name: 'responses', dbTable: db.responses },
  { name: 'photos', dbTable: db.photos },
  { name: 'schedules', dbTable: db.schedules },
] as const;

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function remoteIdsFor(tableName: string, ids: string[]) {
  const found = new Set<string>();
  for (const chunk of chunks(ids, 100)) {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .in('id', chunk);
    if (error) throw new Error(`${tableName}: ${error.message}`);
    for (const row of data || []) found.add(row.id);
  }
  return found;
}

export async function reconcileCloudSyncedItems() {
  const verifiedAt = new Date();
  const totals: Record<string, number> = {};

  for (const { name, dbTable } of TABLES) {
    const localItems = await (dbTable as any)
      .where('syncStatus')
      .anyOf([...QUEUED_STATUSES])
      .toArray();
    const ids = localItems
      .filter((item: any) => item.id && item.syncStatus !== 'conflict')
      .map((item: any) => item.id);

    if (ids.length === 0) {
      totals[name] = 0;
      continue;
    }

    const remoteIds = await remoteIdsFor(name, ids);
    const syncedIds = ids.filter((id: string) => remoteIds.has(id));
    totals[name] = syncedIds.length;

    if (syncedIds.length > 0) {
      await (dbTable as any).where('id').anyOf(syncedIds).modify({
        syncStatus: 'synced',
        syncError: undefined,
        syncAttempts: 0,
        dataVerifiedAt: verifiedAt,
      });
    }
  }

  return totals;
}
