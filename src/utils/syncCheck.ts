import { db } from '../db/database';
import { supabase } from '../lib/supabase';
import { InspectionService } from '../services/inspectionService';

/**
 * ReportReadinessCheck
 * Ensures data integrity before generating a PDF report.
 */

export interface ReadinessResult {
  isReady: boolean;
  isStale: boolean;
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
  lastVerified?: Date;
  message?: string;
}

export async function checkReportReadiness(inspectionId: string): Promise<ReadinessResult> {
  const inspection = await db.inspections.get(inspectionId);
  if (!inspection) throw new Error('Inspeção não encontrada.');

  const responses = await db.responses.where('inspectionId').equals(inspectionId).toArray();
  const responseIds = responses.map(r => r.id);
  const photos = responseIds.length > 0
    ? await db.photos.where('responseId').anyOf(responseIds).toArray()
    : [];
  
  // 1. Check for non-synced items
  const allItems = [inspection, ...responses, ...photos];
  const pending = allItems.filter(i => i.syncStatus === 'pending' || i.syncStatus === 'syncing').length;
  const conflict = allItems.filter(i => i.syncStatus === 'conflict').length;
  const failed = allItems.filter(i => i.syncStatus === 'failed').length;

  // 2. Check for staleness (TTL 5 minutes for report generation)
  const verifiedTimes = allItems
    .map(i => i.dataVerifiedAt?.getTime())
    .filter((t): t is number => !!t);
  
  const oldestVerified = verifiedTimes.length > 0 ? Math.min(...verifiedTimes) : 0;
  const lastVerified = oldestVerified ? new Date(oldestVerified) : undefined;
  const isStale = !lastVerified || (Date.now() - lastVerified.getTime() > 5 * 60 * 1000);

  // 3. Try a quick direct fetch to verify if online (Header only)
  if (isStale && navigator.onLine) {
    try {
      const { data, error } = await supabase.from('inspections').select('updated_at').eq('id', inspectionId).single();
      if (!error && data) {
         const remoteUpdate = new Date(data.updated_at);
         if (remoteUpdate > inspection.updatedAt) {
           return {
             isReady: false,
             isStale: true,
             pendingCount: pending,
             conflictCount: conflict + 1,
             failedCount: failed,
             lastVerified,
             message: 'Versão no servidor é mais recente. Sincronize antes de gerar o relatório.'
           };
         }
      }
    } catch (e) {
      console.warn('[SyncCheck] Failed to verify with server:', e);
    }
  }

  const isReady = pending === 0 && conflict === 0 && failed === 0;

  return {
    isReady,
    isStale,
    pendingCount: pending,
    conflictCount: conflict,
    failedCount: failed,
    lastVerified,
    message: isReady ? 'Tudo pronto!' : 'Existem itens pendentes ou erros de sincronização.'
  };
}
