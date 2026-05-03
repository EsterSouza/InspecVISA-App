import { db } from '../db/database';
import { supabase } from '../lib/supabase';
import type { SyncStatus } from '../types';

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

export interface IntegrityIssue {
  id: string;
  table: 'inspections' | 'responses' | 'photos';
  label: string;
  status: SyncStatus;
  updatedAt?: Date;
  syncError?: string;
  hasRemoteConflict?: boolean;
}

export interface InspectionIntegrityResult extends ReadinessResult {
  issues: IntegrityIssue[];
  responseCount: number;
  photoCount: number;
  pendingPhotoCount: number;
  lastSyncConfirmedAt?: Date;
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

export async function getInspectionIntegrity(inspectionId: string): Promise<InspectionIntegrityResult> {
  const readiness = await checkReportReadiness(inspectionId);
  const inspection = await db.inspections.get(inspectionId);
  if (!inspection) throw new Error('Inspecao nao encontrada.');

  const responses = await db.responses
    .where('inspectionId')
    .equals(inspectionId)
    .filter(r => !r.deletedAt)
    .toArray();

  const responseIds = responses.map(r => r.id);
  const photos = responseIds.length > 0
    ? await db.photos.where('responseId').anyOf(responseIds).filter(p => !p.deletedAt).toArray()
    : [];

  const issues: IntegrityIssue[] = [];
  const addIssue = (
    table: IntegrityIssue['table'],
    item: any,
    label: string
  ) => {
    if (item.syncStatus === 'synced') return;
    issues.push({
      id: item.id,
      table,
      label,
      status: item.syncStatus,
      updatedAt: item.updatedAt,
      syncError: item.syncError,
      hasRemoteConflict: Boolean(item.conflictRemote)
    });
  };

  addIssue('inspections', inspection, 'Dados gerais da inspecao');

  for (const response of responses) {
    addIssue('responses', response, response.customDescription || `Resposta ${response.itemId}`);
  }

  for (const photo of photos) {
    addIssue('photos', photo, `Foto da resposta ${photo.responseId}`);
  }

  const verifiedTimes = [inspection, ...responses, ...photos]
    .map(item => item.dataVerifiedAt?.getTime())
    .filter((time): time is number => Boolean(time));

  return {
    ...readiness,
    issues: issues.sort((a, b) => statusWeight(a.status) - statusWeight(b.status)),
    responseCount: responses.length,
    photoCount: photos.length,
    pendingPhotoCount: photos.filter(p => p.syncStatus !== 'synced').length,
    lastSyncConfirmedAt: verifiedTimes.length > 0 ? new Date(Math.min(...verifiedTimes)) : undefined
  };
}

function statusWeight(status: SyncStatus) {
  switch (status) {
    case 'conflict': return 0;
    case 'failed': return 1;
    case 'pending': return 2;
    case 'syncing': return 3;
    case 'synced': return 4;
  }
}
