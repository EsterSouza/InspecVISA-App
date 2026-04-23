import { db } from '../db/database';

/**
 * syncService.ts - MODO ONLINE-DIRECT
 * 
 * Este arquivo foi simplificado. A sincronização complexa via Dexie (PUSH/PULL)
 * foi desativada em favor de chamadas diretas ao Supabase via Services.
 */

export async function logSync(level: 'info' | 'warn' | 'error', message: string, details?: any) {
  console[level](`[SyncLog] ${message}`, details || '');
  try {
    await db.sync_logs.add({
      timestamp: new Date(),
      level,
      message,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined
    });
  } catch (e) {
    console.error('Failed to write sync log', e);
  }
}

/**
 * Limpeza periódica de registros locais (Dexie).
 * Mantém o banco local leve removendo registros antigos já deletados.
 */
export async function cleanupOrphans() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    await db.clients.where('deletedAt').below(thirtyDaysAgo).delete();
    await db.inspections.where('deletedAt').below(thirtyDaysAgo).delete();
    await db.responses.where('deletedAt').below(thirtyDaysAgo).delete();
    await db.photos.where('deletedAt').below(thirtyDaysAgo).delete();
    await db.schedules.where('deletedAt').below(thirtyDaysAgo).delete();
    console.log('[Cleanup] Registros antigos removidos do Dexie.');
  } catch (err) {
    console.error('[Cleanup] Erro ao limpar Dexie:', err);
  }
}

// Funções legadas mantidas como placeholders vazios para evitar quebra de imports em outros arquivos
export async function syncData() { console.log('SyncData desativado (Modo Online-Direct)'); }
export async function syncClientsOnly() {}
export async function syncSchedulesOnly() {}
export async function syncInspectionsOnly() {}
export async function repairSyncStatus() { 
  alert('O modo Online-Direct não requer reparo de sincronização.');
}
