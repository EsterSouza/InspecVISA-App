import { db } from '../db/database';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { RepositoryService, type SyncableTable } from '../services/repositoryService';
import { ScheduleService } from '../services/scheduleService';

export async function forcePushFinalData() {
  console.log('Iniciando push final de dados locais...');

  const before = await countQueued();

  await RepositoryService.processBulkQueue('clients', db.clients, ClientService.mapToPostgres);
  await RepositoryService.processBulkQueue('inspections', db.inspections, InspectionService.mapToPostgres);
  await RepositoryService.processBulkQueue('responses', db.responses, InspectionService.mapResponseToPostgres);
  await RepositoryService.processBulkQueue('schedules', db.schedules, ScheduleService.mapToPostgres);
  await RepositoryService.processQueue('photos', db.photos, InspectionService.mapPhotoToPostgres);

  const after = await countQueued();
  const totalSynced = Math.max(before - after, 0);
  const errors = after;

  console.log(`Push final concluido. Sincronizados: ${totalSynced}, pendentes/falhas: ${errors}`);
  return { totalSynced, errors };
}

async function countQueued() {
  // Cada tabela do Dexie é tipada pela sua própria linha, e o tipo é invariante: a lista das
  // cinco não tem um tipo comum que ainda ofereça `.where`. `SyncableTable` é a visão estreita
  // de que este trecho precisa — só o índice `syncStatus`, que todas têm.
  const tables = [db.clients, db.inspections, db.responses, db.photos, db.schedules] as unknown as SyncableTable[];
  let total = 0;
  for (const table of tables) {
    total += await table.where('syncStatus').anyOf(['pending', 'failed']).count();
  }
  return total;
}
