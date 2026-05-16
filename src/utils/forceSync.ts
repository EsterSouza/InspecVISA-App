import { db } from '../db/database';
import { syncQueuedDataToCloud } from './backup';

export async function forcePushFinalData() {
  console.log('Iniciando push final de dados locais...');

  const before = await countQueued();
  if (before === 0) {
    return { totalSynced: 0, errors: 0 };
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
