import { db } from '../db/database';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { RepositoryService } from '../services/repositoryService';
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
  const tables = [db.clients, db.inspections, db.responses, db.photos, db.schedules];
  let total = 0;
  for (const table of tables) {
    total += await (table as any).where('syncStatus').anyOf(['pending', 'failed']).count();
  }
  return total;
}
