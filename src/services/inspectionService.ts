import { supabase } from '../lib/supabase';
import type { Inspection, InspectionResponse, InspectionPhoto } from '../types';
import { db } from '../db/database';
import { RepositoryService } from './repositoryService';
import { withLocalActor } from '../utils/localActor';
import { belongsToActiveTenant, filterByActiveTenant, getActiveTenantId } from '../utils/localScope';
import { withTimeout } from '../utils/network';

const PHOTO_BUCKET = 'inspection-photos';
const PHOTO_DOWNLOAD_TIMEOUT_MS = 20000;
const PHOTO_DOWNLOAD_CONCURRENCY = 2;

// Caminhos de Storage que retornaram "Object not found" nesta sessão. Evita
// re-baixar (e floodar o console com 400) a mesma foto fantasma a cada render.
const missingStoragePaths = new Set<string>();

// Hidratação completa das respostas do tenant — garante que TODA inspeção
// (inclusive as feitas em outro dispositivo) tenha suas respostas no Dexie local.
// Sem isso, telas que leem só o local (ex.: Dashboard) subcontavam inspeções antigas.
let hydratedResponsesTenantId: string | null = null;
let responsesHydrationInFlight: Promise<number> | null = null;

export interface PhotoHydrationProgress {
  total: number;
  completed: number;
  failed: number;
  currentPhotoId?: string;
}

export interface PhotoHydrationResult {
  photos: InspectionPhoto[];
  total: number;
  completed: number;
  failed: number;
}

export interface RemoteInspectionSnapshot {
  responses: InspectionResponse[];
  photos: InspectionPhoto[];
  fetchedAt: Date;
}

function isInlineDataUrl(value?: string | null): value is string {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value || '');
}

function storagePathFromDataUrl(value?: string | null) {
  return value?.startsWith('storage://') ? value.slice('storage://'.length) : undefined;
}

function canHydratePhoto(photo: InspectionPhoto) {
  return Boolean(!isInlineDataUrl(photo.dataUrl) && (photo.storagePath || storagePathFromDataUrl(photo.dataUrl)));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler foto baixada.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Mappers
 */
export function mapFromPostgres(row: any): Inspection {
  return {
    id: row.id,
    clientId: row.client_id,
    templateId: row.template_id,
    consultantName: row.consultant_name,
    consultantNames: Array.isArray(row.consultant_names) && row.consultant_names.length > 0
      ? row.consultant_names
      : undefined,
    inspectionDate: new Date(row.inspection_date),
    status: row.status,
    observations: row.observations || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at || row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    ilpiCapacity: row.ilpi_capacity || undefined,
    residentsTotal: row.residents_total || undefined,
    residentsMale: row.residents_male || undefined,
    residentsFemale: row.residents_female || undefined,
    dependencyLevel1: row.dependency_level1 ?? row.dependency_level_1 ?? undefined,
    dependencyLevel2: row.dependency_level2 ?? row.dependency_level_2 ?? undefined,
    dependencyLevel3: row.dependency_level3 ?? row.dependency_level_3 ?? undefined,
    observedStaff: row.observed_staff ?? undefined,
    observedNursingTechs: row.observed_nursing_techs ?? undefined,
    usableAreaM2: row.usable_area_m2 ?? undefined,
    observedCleaningStaff: row.observed_cleaning_staff ?? undefined,
    accompanistName: row.accompanist_name || undefined,
    accompanistRole: row.accompanist_role || undefined,
    signatureDataUrl: row.signature_data_url || undefined,
    lastEditedBy: row.last_edited_by || undefined,
    finalizedBy: Array.isArray(row.finalized_by) ? row.finalized_by : undefined,
    tenantId: row.tenant_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    syncStatus: 'synced',
    dataVerifiedAt: new Date()
  };
}

export function mapToPostgres(inspection: Inspection): any {
  return {
    id: inspection.id,
    client_id: inspection.clientId,
    template_id: inspection.templateId,
    consultant_name: inspection.consultantName,
    consultant_names: inspection.consultantNames && inspection.consultantNames.length > 0
      ? inspection.consultantNames
      : null,
    inspection_date: inspection.inspectionDate.toISOString(),
    status: inspection.status,
    observations: inspection.observations || null,
    ilpi_capacity: inspection.ilpiCapacity || null,
    residents_total: inspection.residentsTotal || null,
    residents_male: inspection.residentsMale || null,
    residents_female: inspection.residentsFemale || null,
    dependency_level1: inspection.dependencyLevel1 || null,
    dependency_level2: inspection.dependencyLevel2 || null,
    dependency_level3: inspection.dependencyLevel3 || null,
    dependency_level_1: inspection.dependencyLevel1 || null,
    dependency_level_2: inspection.dependencyLevel2 || null,
    dependency_level_3: inspection.dependencyLevel3 || null,
    observed_staff: inspection.observedStaff || null,
    observed_nursing_techs: inspection.observedNursingTechs || null,
    usable_area_m2: inspection.usableAreaM2 || null,
    observed_cleaning_staff: inspection.observedCleaningStaff || null,
    accompanist_name: inspection.accompanistName || null,
    accompanist_role: inspection.accompanistRole || null,
    signature_data_url: inspection.signatureDataUrl || null,
    last_edited_by: inspection.lastEditedBy || null,
    finalized_by: inspection.finalizedBy && inspection.finalizedBy.length > 0 ? inspection.finalizedBy : [],
    deleted_at: inspection.deletedAt ? inspection.deletedAt.toISOString() : null,
    updated_at: inspection.updatedAt.toISOString(),
    created_at: inspection.createdAt.toISOString(),
    tenant_id: inspection.tenantId
  };
}

export function mapResponseToPostgres(response: InspectionResponse): any {
  return {
    id: response.id,
    inspection_id: response.inspectionId,
    item_id: response.itemId,
    result: response.result,
    situation_description: response.situationDescription || null,
    corrective_action: response.correctiveAction || null,
    responsible: response.responsible || null,
    deadline: response.deadline || null,
    custom_description: response.customDescription || null,
    last_edited_by: response.lastEditedBy || null,
    deleted_at: response.deletedAt ? response.deletedAt.toISOString() : null,
    updated_at: response.updatedAt.toISOString(),
    created_at: response.createdAt.toISOString(),
    tenant_id: response.tenantId
  };
}

export function mapResponseFromPostgres(row: any): InspectionResponse {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    itemId: row.item_id,
    result: row.result,
    situationDescription: row.situation_description,
    correctiveAction: row.corrective_action,
    responsible: row.responsible,
    deadline: row.deadline,
    customDescription: row.custom_description,
    lastEditedBy: row.last_edited_by || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at || row.created_at),
    tenantId: row.tenant_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    syncStatus: 'synced',
    dataVerifiedAt: new Date()
  };
}

export function mapPhotoToPostgres(photo: InspectionPhoto): any {
  // Never send base64 dataUrl to the Postgres column — image binaries belong in Supabase Storage.
  // data_url is null until the Storage upload confirms a storagePath.
  return {
    id: photo.id,
    response_id: photo.responseId,
    data_url: photo.storagePath ? `storage://${photo.storagePath}` : null,
    caption: photo.caption || null,
    taken_at: photo.takenAt.toISOString(),
    updated_at: photo.updatedAt.toISOString(),
    deleted_at: photo.deletedAt ? photo.deletedAt.toISOString() : null,
    tenant_id: photo.tenantId
  };
}

export function mapPhotoFromPostgres(row: any): InspectionPhoto {
  const dataUrl = row.data_url || '';
  const storagePath = row.storage_path || storagePathFromDataUrl(dataUrl);

  return {
    id: row.id,
    responseId: row.response_id,
    dataUrl,
    storagePath,
    caption: row.caption || undefined,
    takenAt: new Date(row.taken_at || row.created_at || row.updated_at),
    updatedAt: new Date(row.updated_at || row.taken_at || row.created_at),
    tenantId: row.tenant_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    syncStatus: 'synced',
    dataVerifiedAt: new Date()
  };
}

async function hydrateStoragePhoto(photo: InspectionPhoto, timeoutMs = PHOTO_DOWNLOAD_TIMEOUT_MS): Promise<InspectionPhoto> {
  if (isInlineDataUrl(photo.dataUrl)) return photo;

  const storagePath = photo.storagePath || storagePathFromDataUrl(photo.dataUrl);
  if (!storagePath) return photo;
  if (missingStoragePaths.has(storagePath)) return photo; // já constatamos que não existe

  const { data, error } = await withTimeout(
    supabase.storage.from(PHOTO_BUCKET).download(storagePath),
    timeoutMs,
    `PhotoDownload_${photo.id}`
  );

  if (error || !data) {
    const message = error?.message || 'Falha ao baixar foto do Storage.';
    if (/not.?found/i.test(message)) missingStoragePaths.add(storagePath);
    console.warn(`[PhotoHydrate] Failed to download ${storagePath}:`, message);
    await db.photos.update(photo.id, {
      syncError: `Foto sincronizada, mas ainda nao baixou neste dispositivo: ${message}`,
      dataVerifiedAt: new Date(),
    });
    return photo;
  }

  const dataUrl = await blobToDataUrl(data);
  if (!isInlineDataUrl(dataUrl)) return photo;

  const hydrated = {
    ...photo,
    dataUrl,
    storagePath,
    syncStatus: 'synced' as const,
    syncError: undefined,
    dataVerifiedAt: new Date()
  };

  await db.photos.put(hydrated);
  return hydrated;
}

async function downloadStoragePhotoForView(photo: InspectionPhoto, timeoutMs = PHOTO_DOWNLOAD_TIMEOUT_MS): Promise<InspectionPhoto> {
  if (isInlineDataUrl(photo.dataUrl)) return photo;

  const storagePath = photo.storagePath || storagePathFromDataUrl(photo.dataUrl);
  if (!storagePath) return photo;
  if (missingStoragePaths.has(storagePath)) return photo; // já constatamos que não existe

  const { data, error } = await withTimeout(
    supabase.storage.from(PHOTO_BUCKET).download(storagePath),
    timeoutMs,
    `PhotoPreview_${photo.id}`
  );

  if (error || !data) {
    if (/not.?found/i.test(error?.message || '')) missingStoragePaths.add(storagePath);
    return photo;
  }

  const dataUrl = await blobToDataUrl(data);
  if (!isInlineDataUrl(dataUrl)) return photo;

  return { ...photo, dataUrl, storagePath, dataVerifiedAt: new Date() };
}

async function mergeRemotePhoto(remote: InspectionPhoto): Promise<InspectionPhoto> {
  const local = await db.photos.get(remote.id);
  const remoteWithLocalImage = local && isInlineDataUrl(local.dataUrl) && !isInlineDataUrl(remote.dataUrl)
    ? { ...remote, dataUrl: local.dataUrl, storagePath: remote.storagePath || local.storagePath }
    : remote;

  const result = await RepositoryService.mergeRemoteRecord(db.photos, remoteWithLocalImage, { label: 'fotos' });
  return result.record;
}

async function runLimited<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

async function recoverMissingRemoteInspection(local: Inspection): Promise<void> {
  const reason = 'Servidor nao encontrou a inspecao; reenfileirando dados locais para sincronizacao.';

  const recoveredInspection = {
    ...local,
    syncStatus: 'pending' as const,
    syncAttempts: 0,
    syncError: reason,
  };

  await db.inspections.put(recoveredInspection);

  const responses = await db.responses.where('inspectionId').equals(local.id).toArray();
  for (const response of responses) {
    if (response.syncStatus !== 'conflict') {
      await db.responses.update(response.id, {
        syncStatus: 'pending',
        syncAttempts: 0,
        syncError: reason,
      });
    }
  }

  const responseIds = responses.map(response => response.id);
  if (responseIds.length > 0) {
    const photos = await db.photos.where('responseId').anyOf(responseIds).toArray();
    for (const photo of photos) {
      if (photo.syncStatus !== 'conflict') {
        await db.photos.update(photo.id, {
          syncStatus: 'pending',
          syncAttempts: 0,
          syncError: reason,
        });
      }
    }
  }

  if (!navigator.onLine) return;

  const { InspectionBundleSyncService } = await import('./inspectionBundleSyncService');
  await InspectionBundleSyncService.syncInspectionBundle(local.id, {
    inspectionOverride: recoveredInspection,
  });
}

export const InspectionService = {
  mapToPostgres,
  mapResponseToPostgres,
  mapPhotoToPostgres,
  mapResponseFromPostgres,
  mapPhotoFromPostgres,

  async mergeRemoteResponses(remoteResponses: InspectionResponse[]): Promise<InspectionResponse[]> {
    const accepted: InspectionResponse[] = [];

    for (const remote of remoteResponses) {
      const result = await RepositoryService.mergeRemoteRecord(db.responses, remote, { label: 'respostas' });
      if (result.accepted) {
        accepted.push(result.record);
      }
    }

    return accepted;
  },

  async getInspectionById(id: string): Promise<Inspection | null> {
    // 1. Always return local data first (< 1ms)
    const local = await db.inspections.get(id);

    // 2. Background refresh from Supabase — never blocks the caller
    // TTL: 5 minutes to avoid hammering the server on every navigation
    const isStale = !local?.dataVerifiedAt || (Date.now() - local.dataVerifiedAt.getTime() > 5 * 60 * 1000);
    if (isStale && navigator.onLine) {
      void (async () => {
        try {
          const { data, error } = await RepositoryService.withTimeout(
            supabase.from('inspections').select('*').eq('id', id).is('deleted_at', null).single(),
            25000,
            `InspectionById_${id}`
          ) as any;

          // If the server cannot see a local inspection, preserve the local tree
          // and enqueue it again. Otherwise responses can remain orphaned in Dexie.
          if (error?.code === 'PGRST116') {
            console.warn('[InspectionService] Record not found on server, recovering local inspection:', id);
            if (local && !local.deletedAt) {
              await recoverMissingRemoteInspection(local);
            }
            return;
          }

          if (!error && data) {
            const remote = mapFromPostgres(data);
            await RepositoryService.mergeRemoteRecord(db.inspections, remote, { label: 'inspecao' });
          }
        } catch (err: any) {
          // Silence timeout warnings in production-like environments to avoid console noise
          if (!err?.message?.includes('TIMEOUT')) {
            console.warn('[InspectionService] Background refresh for', id, 'failed:', err);
          }
          
          // On timeout/error, stamp a short-circuit TTL (2 min) to avoid hammering
          if (local) {
            const shortCircuit = new Date(Date.now() - 3 * 60 * 1000);
            await db.inspections.update(id, { dataVerifiedAt: shortCircuit });
          }
        }
      })();
    }

    return belongsToActiveTenant(local) ? local : null;
  },

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<void> {
    const local = await db.inspections.get(id);
    if (!belongsToActiveTenant(local)) throw new Error('Inspecao nao encontrada neste tenant.');
    if (!local) throw new Error('Inspeção não encontrada localmente.');

    const updated = { ...local, ...updates, updatedAt: new Date(), syncStatus: 'pending' as const };
    await RepositoryService.upsert('inspections', updated, db.inspections, mapToPostgres);
  },

  async deleteInspection(id: string): Promise<void> {
    const local = await db.inspections.get(id);
    if (!belongsToActiveTenant(local)) return;

    const now = new Date();

    // A deletion started on another device must still include the whole remote tree.
    if (navigator.onLine) {
      const { data: remoteResponseRows, error: responseReadError } = await supabase
        .from('responses')
        .select('*')
        .eq('inspection_id', id)
        .is('deleted_at', null);
      if (responseReadError) throw responseReadError;

      for (const row of remoteResponseRows || []) {
        if (!(await db.responses.get(row.id))) {
          await db.responses.put(mapResponseFromPostgres(row));
        }
      }

      const remoteResponseIds = (remoteResponseRows || []).map(row => row.id);
      if (remoteResponseIds.length > 0) {
        const { data: remotePhotoRows, error: photoReadError } = await supabase
          .from('photos')
          .select('*')
          .in('response_id', remoteResponseIds)
          .is('deleted_at', null);
        if (photoReadError) throw photoReadError;
        for (const row of remotePhotoRows || []) {
          if (!(await db.photos.get(row.id))) {
            await db.photos.put(mapPhotoFromPostgres(row));
          }
        }
      }
    }

    // 1. Soft-delete the inspection in Dexie immediately (so UI updates before network)
    const updated = { ...local, deletedAt: now, updatedAt: now, syncStatus: 'pending' as const };
    await db.inspections.put(updated);

    // 2. Cascade soft-delete related responses in Dexie
    const responses = await db.responses.where('inspectionId').equals(id).toArray();
    for (const r of responses) {
      await db.responses.put({ ...r, deletedAt: now, updatedAt: now, syncStatus: 'pending' as const });
    }

    // 3. Cascade soft-delete related photos so no attachment remains visible remotely.
    const responseIds = responses.map(response => response.id);
    if (responseIds.length > 0) {
      const photos = await db.photos.where('responseId').anyOf(responseIds).toArray();
      for (const photo of photos) {
        await db.photos.put({ ...photo, deletedAt: now, updatedAt: now, syncStatus: 'pending' as const });
      }
    }

    // 4. Prefer immediate bundle sync; if it fails, pending records remain retryable.
    if (navigator.onLine) {
      const { InspectionBundleSyncService } = await import('./inspectionBundleSyncService');
      await InspectionBundleSyncService.syncInspectionBundle(id, { inspectionOverride: updated });
    }
  },

  async getDeletedInspections(): Promise<Inspection[]> {
    return filterByActiveTenant(await db.inspections
      .filter(i => Boolean(i.deletedAt))
      .toArray())
      .sort((a, b) => (b.deletedAt?.getTime() || 0) - (a.deletedAt?.getTime() || 0));
  },

  async refreshDeletedInspectionsFromRemote(): Promise<Inspection[]> {
    if (!navigator.onLine) return this.getDeletedInspections();

    try {
      const { data, error } = await RepositoryService.withTimeout(
        supabase
          .from('inspections')
          .select('*')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false }),
        25000,
        'TrashRefresh'
      ) as any;

      if (error) throw error;
      for (const row of data || []) {
        await RepositoryService.mergeRemoteRecord(db.inspections, mapFromPostgres(row), { label: 'lixeira', preserveLocal: false });
      }
    } catch (err) {
      console.warn('[InspectionService] Remote trash refresh failed; using local records:', err);
    }

    return this.getDeletedInspections();
  },

  async restoreInspection(id: string): Promise<void> {
    let local = await db.inspections.get(id);
    if (!local && navigator.onLine) {
      const { data, error } = await supabase.from('inspections').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data) {
        local = mapFromPostgres(data);
        await db.inspections.put(local);
      }
    }
    if (!belongsToActiveTenant(local)) throw new Error('Inspecao nao encontrada neste tenant.');
    if (!local) throw new Error('Inspecao nao encontrada localmente.');

    if (navigator.onLine) {
      const { data: responseRows, error: responseError } = await supabase
        .from('responses')
        .select('*')
        .eq('inspection_id', id);
      if (responseError) throw responseError;
      for (const row of responseRows || []) {
        await db.responses.put(mapResponseFromPostgres(row));
      }

      const remoteResponseIds = (responseRows || []).map(row => row.id);
      if (remoteResponseIds.length > 0) {
        const { data: photoRows, error: photoError } = await supabase
          .from('photos')
          .select('*')
          .in('response_id', remoteResponseIds);
        if (photoError) throw photoError;
        for (const row of photoRows || []) {
          await db.photos.put(mapPhotoFromPostgres(row));
        }
      }
    }

    const now = new Date();
    const restoredInspection = {
      ...local,
      deletedAt: null,
      updatedAt: now,
      syncStatus: 'pending' as const,
      syncError: undefined,
    };
    await db.inspections.put(restoredInspection);

    const responses = await db.responses.where('inspectionId').equals(id).toArray();
    for (const response of responses) {
      await db.responses.put({
        ...response,
        deletedAt: null,
        updatedAt: now,
        syncStatus: 'pending',
        syncError: undefined,
      });
    }

    const responseIds = responses.map(response => response.id);
    if (responseIds.length > 0) {
      const photos = await db.photos.where('responseId').anyOf(responseIds).toArray();
      for (const photo of photos) {
        await db.photos.put({
          ...photo,
          deletedAt: null,
          updatedAt: now,
          syncStatus: 'pending',
          syncError: undefined,
        });
      }
    }

    if (navigator.onLine) {
      const { InspectionBundleSyncService } = await import('./inspectionBundleSyncService');
      await InspectionBundleSyncService.syncInspectionBundle(id, { inspectionOverride: restoredInspection });
    }
  },

  async permanentlyDeleteInspection(id: string): Promise<void> {
    const inspection = await db.inspections.get(id);
    if (!belongsToActiveTenant(inspection)) throw new Error('Inspecao nao encontrada neste tenant.');
    if (!inspection?.deletedAt) throw new Error('Somente itens da lixeira podem ser excluidos definitivamente.');
    if (!navigator.onLine) throw new Error('Conecte-se a internet para excluir definitivamente.');

    const { data: responseRows, error: responseError } = await supabase
      .from('responses')
      .select('id')
      .eq('inspection_id', id);
    if (responseError) throw responseError;

    const responseIds = (responseRows || []).map(row => row.id);
    let remotePhotos: any[] = [];
    if (responseIds.length > 0) {
      const { data: photoRows, error: photoReadError } = await supabase
        .from('photos')
        .select('*')
        .in('response_id', responseIds);
      if (photoReadError) throw photoReadError;
      remotePhotos = photoRows || [];

      const storagePaths = remotePhotos
        .map(row => row.storage_path || storagePathFromDataUrl(row.data_url))
        .filter(Boolean);
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove(storagePaths);
        if (storageError) throw storageError;
      }

      const { error: photoDeleteError } = await supabase.from('photos').delete().in('response_id', responseIds);
      if (photoDeleteError) throw photoDeleteError;
      const { error: responsesDeleteError } = await supabase.from('responses').delete().eq('inspection_id', id);
      if (responsesDeleteError) throw responsesDeleteError;
    }

    const { error: inspectionDeleteError } = await supabase.from('inspections').delete().eq('id', id);
    if (inspectionDeleteError) throw inspectionDeleteError;

    const localResponses = await db.responses.where('inspectionId').equals(id).toArray();
    const allResponseIds = [...new Set([
      ...responseIds,
      ...localResponses.map(response => response.id),
    ])];
    if (allResponseIds.length > 0) {
      await db.photos.where('responseId').anyOf(allResponseIds).delete();
    }
    await db.responses.where('inspectionId').equals(id).delete();
    await db.inspections.delete(id);
  },

  async getResponsesByInspectionId(inspectionId: string, forceRefresh = false): Promise<InspectionResponse[]> {
    const local = filterByActiveTenant(await db.responses
      .where('inspectionId')
      .equals(inspectionId)
      .filter(r => !r.deletedAt)
      .toArray());
    
    // TTL: 2 minutes for responses refresh
    const lastCheck = local.length > 0 ? Math.min(...local.map(r => r.dataVerifiedAt?.getTime() || 0)) : 0;
    const isStale = (Date.now() - lastCheck > 2 * 60 * 1000) || forceRefresh;

    if (forceRefresh && isStale && navigator.onLine) {
      try {
        const { data, error } = await RepositoryService.withTimeout(
          supabase.from('responses').select('*').eq('inspection_id', inspectionId).is('deleted_at', null),
          25000,
          `ResponsesRefresh_${inspectionId}`
        ) as any;

        if (error || !data || (data.length === 0 && local.length > 0)) {
          console.warn(`[SafetyGate] Blocked forced remote overwrite for ${inspectionId}. Error: ${error?.message || 'Empty result'}. Local records preserved: ${local.length}`);
          return local;
        }

        await InspectionService.mergeRemoteResponses(data.map(mapResponseFromPostgres));
        const reconciled = filterByActiveTenant(await db.responses
          .where('inspectionId')
          .equals(inspectionId)
          .filter(r => !r.deletedAt)
          .toArray());
        console.log(`[InspectionService] Forced refresh reconciled ${reconciled.length} responses from remote.`);
        return reconciled;
      } catch (err: any) {
        console.warn(`[InspectionService] Forced responses refresh failed for ${inspectionId}:`, err?.message || err);
        return local;
      }
    }

    if (isStale && navigator.onLine) {
      // Trigger background refresh for responses
      // Safety: Only update Dexie if we have a successful, non-masked result.
      RepositoryService.withTimeout(
        supabase.from('responses').select('*').eq('inspection_id', inspectionId).is('deleted_at', null),
        10000,
        `ResponsesBackground_${inspectionId}`
      )
        .then(async ({ data, error }) => {
          // STRICT SAFETY GATE: 
          // If fetch fails, returns an error, or returns an empty array while local has data:
          // WE REFUSE TO OVERWRITE/DELETE LOCAL DATA.
          if (error || !data || (data.length === 0 && local.length > 0)) {
            console.warn(`[SafetyGate] 🛡️ Blocked remote overwrite for ${inspectionId}. Error: ${error?.message || 'Empty result'}. Local records preserved: ${local.length}`);
            return;
          }

          const merged = await InspectionService.mergeRemoteResponses(data.map(mapResponseFromPostgres));
          console.log(`[InspectionService] Updated ${merged.length} safe local responses from remote.`);
        }).catch(err => {
          console.warn(`[InspectionService] Background responses refresh timed out for ${inspectionId}:`, err?.message || err);
        });
    }

    return local;
  },

  async getRemoteInspectionSnapshot(inspectionId: string): Promise<RemoteInspectionSnapshot> {
    if (!navigator.onLine) {
      throw new Error('Conecte-se à internet para consultar o preenchimento sincronizado.');
    }

    const { data: responseRows, error: responseError } = await RepositoryService.withTimeout(
      supabase.from('responses').select('*').eq('inspection_id', inspectionId).is('deleted_at', null),
      25000,
      `RemoteViewerResponses_${inspectionId}`
    ) as any;

    if (responseError) {
      throw new Error(responseError.message || 'Falha ao consultar respostas sincronizadas.');
    }

    const responses: InspectionResponse[] = (responseRows || []).map(mapResponseFromPostgres);
    if (responses.length === 0) {
      return { responses: [], photos: [], fetchedAt: new Date() };
    }

    const { data: photoRows, error: photoError } = await RepositoryService.withTimeout(
      supabase.from('photos').select('*').in('response_id', responses.map(response => response.id)).is('deleted_at', null),
      25000,
      `RemoteViewerPhotos_${inspectionId}`
    ) as any;

    if (photoError) {
      throw new Error(photoError.message || 'Falha ao consultar fotos sincronizadas.');
    }

    const photos = await runLimited<InspectionPhoto, InspectionPhoto>(
      (photoRows || []).map(mapPhotoFromPostgres) as InspectionPhoto[],
      PHOTO_DOWNLOAD_CONCURRENCY,
      photo => downloadStoragePhotoForView(photo)
    );
    const photosByResponse = new Map<string, InspectionPhoto[]>();
    for (const photo of photos) {
      const current = photosByResponse.get(photo.responseId) || [];
      current.push(photo);
      photosByResponse.set(photo.responseId, current);
    }

    return {
      responses: responses.map(response => ({
        ...response,
        photos: photosByResponse.get(response.id) || [],
      })),
      photos,
      fetchedAt: new Date(),
    };
  },

  async upsertResponse(response: InspectionResponse): Promise<void> {
    await RepositoryService.upsert('responses', withLocalActor(response), db.responses, mapResponseToPostgres);
  },

  async upsertPhoto(photo: InspectionPhoto): Promise<void> {
    await RepositoryService.upsert('photos', withLocalActor(photo), db.photos, mapPhotoToPostgres);
  },

  async getPhotosByResponseIds(
    responseIds: string[],
    forceRefresh = false,
    options: { remote?: boolean } = {}
  ): Promise<InspectionPhoto[]> {
    if (responseIds.length === 0) return [];

    const local = filterByActiveTenant(await db.photos
      .where('responseId')
      .anyOf(responseIds)
      .filter(p => !p.deletedAt)
      .toArray());

    const lastCheck = local.length > 0 ? Math.min(...local.map(photo => photo.dataVerifiedAt?.getTime() || 0)) : 0;
    const isStale = (Date.now() - lastCheck > 2 * 60 * 1000) || forceRefresh;

    let photos = local;

    const allowRemote = options.remote ?? true;

    if (allowRemote && isStale && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .in('response_id', responseIds)
          .is('deleted_at', null);

        if (!error && data) {
          const remotePhotos = data.map(mapPhotoFromPostgres);
          for (const remote of remotePhotos) {
            await mergeRemotePhoto(remote);
          }
          const merged = filterByActiveTenant(await db.photos
            .where('responseId')
            .anyOf(responseIds)
            .filter(p => !p.deletedAt)
            .toArray());
          photos = merged;
        } else if (error) {
          console.warn('[InspectionService] Remote photos fetch failed:', error.message);
        }
      } catch (err) {
        console.warn('[InspectionService] Remote photos fetch failed:', err);
      }
    }

    return filterByActiveTenant(photos).filter(photo => !photo.deletedAt);
  },

  async hydratePhotosByResponseIds(
    responseIds: string[],
    options: {
      forceRefresh?: boolean;
      timeoutMs?: number;
      concurrency?: number;
      onProgress?: (progress: PhotoHydrationProgress, photo?: InspectionPhoto) => void;
    } = {}
  ): Promise<PhotoHydrationResult> {
    if (responseIds.length === 0) {
      return { photos: [], total: 0, completed: 0, failed: 0 };
    }

    const photos = await this.getPhotosByResponseIds(responseIds, Boolean(options.forceRefresh));
    const pending = photos.filter(canHydratePhoto);
    const total = pending.length;
    let completed = 0;
    let failed = 0;

    if (!navigator.onLine || total === 0) {
      return { photos, total, completed, failed };
    }

    const hydratedById = new Map(photos.map(photo => [photo.id, photo]));
    options.onProgress?.({ total, completed, failed });

    await runLimited(
      pending,
      Math.max(1, options.concurrency || PHOTO_DOWNLOAD_CONCURRENCY),
      async (photo) => {
        try {
          const hydrated = await hydrateStoragePhoto(photo, options.timeoutMs || PHOTO_DOWNLOAD_TIMEOUT_MS);
          if (isInlineDataUrl(hydrated.dataUrl)) {
            completed += 1;
          } else {
            failed += 1;
          }
          hydratedById.set(hydrated.id, hydrated);
          options.onProgress?.({ total, completed, failed, currentPhotoId: hydrated.id }, hydrated);
        } catch (err: any) {
          failed += 1;
          const message = err?.message || 'Falha ao baixar foto do Storage.';
          await db.photos.update(photo.id, {
            syncError: `Foto sincronizada, mas ainda nao baixou neste dispositivo: ${message}`,
            dataVerifiedAt: new Date(),
          });
          const current = await db.photos.get(photo.id);
          if (current) hydratedById.set(photo.id, current);
          options.onProgress?.({ total, completed, failed, currentPhotoId: photo.id }, current || photo);
        }
      }
    );

    return {
      photos: Array.from(hydratedById.values()).filter(photo => !photo.deletedAt),
      total,
      completed,
      failed,
    };
  },

  async deletePhoto(id: string): Promise<void> {
    const local = await db.photos.get(id);
    if (!local) return;
    const updated = { ...local, deletedAt: new Date(), syncStatus: 'pending' as const };
    await RepositoryService.upsert('photos', updated, db.photos, mapPhotoToPostgres);
  },

  async createInspection(inspection: Inspection): Promise<void> {
    await RepositoryService.upsert('inspections', withLocalActor(inspection), db.inspections, mapToPostgres);
  },

  async getAllInspections(): Promise<Inspection[]> {
    // Always filter out soft-deleted records from Dexie immediately
    const local = filterByActiveTenant(await db.inspections
      .filter(i => !i.deletedAt)
      .reverse()
      .sortBy('createdAt'));

    // Background refresh from Supabase if online
    if (navigator.onLine) {
      void (async () => {
        try {
          // LOCK: Ensure session is consolidated before background network calls
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { data, error } = await RepositoryService.withTimeout(
            supabase
              .from('inspections')
              .select('*')
              .is('deleted_at', null)
              .order('created_at', { ascending: false }),
            10000,
            'InspectionsBackgroundRefresh'
          ) as any;
          if (error || !data) return;


          // ONLY upsert records from Supabase — never delete local records
          // (local records may be pending sync or belong to other sessions)
          for (const row of data) {
            await RepositoryService.mergeRemoteRecord(db.inspections, mapFromPostgres(row), { label: 'inspecoes' });
          }
        } catch (err) {
          console.warn('[InspectionService] Background refresh failed:', err);
        }
      })();
    }

    return local.reverse(); // createdAt descending
  },

  async getLastCompletedInspectionId(clientId: string): Promise<string | undefined> {
    const local = filterByActiveTenant(await db.inspections
      .where('clientId')
      .equals(clientId)
      .filter(i => i.status === 'completed' && !i.deletedAt)
      .toArray());

    const latestLocal = local
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!navigator.onLine) return latestLocal?.id;

    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return latestLocal?.id;

      const remote = mapFromPostgres(data);
      await RepositoryService.mergeRemoteRecord(db.inspections, remote, { label: 'ultima inspecao concluida' });
      return remote.id;
    } catch {
      return latestLocal?.id;
    }
  },

  async getRecentInspectionCandidates(clientId: string, referenceDate: Date, windowDays = 31): Promise<Inspection[]> {
    const rangeStart = new Date(referenceDate);
    rangeStart.setDate(rangeStart.getDate() - windowDays);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(referenceDate);
    rangeEnd.setDate(rangeEnd.getDate() + windowDays);
    rangeEnd.setHours(23, 59, 59, 999);
    const isWithinSingleInspectionWindow = (inspection: Inspection) =>
      Math.abs(inspection.inspectionDate.getTime() - referenceDate.getTime()) < windowDays * 24 * 60 * 60 * 1000;

    const localCandidates = filterByActiveTenant(await db.inspections
      .where('clientId')
      .equals(clientId)
      .filter(inspection =>
        !inspection.deletedAt &&
        (inspection.status === 'in_progress' || inspection.status === 'completed') &&
        isWithinSingleInspectionWindow(inspection)
      )
      .toArray());

    let remoteCandidates: Inspection[] | null = null;
    if (navigator.onLine) {
      try {
        const { data, error } = await RepositoryService.withTimeout(
          supabase
            .from('inspections')
            .select('*')
            .eq('client_id', clientId)
            .is('deleted_at', null)
            .in('status', ['in_progress', 'completed'])
            .gte('inspection_date', rangeStart.toISOString())
            .lte('inspection_date', rangeEnd.toISOString())
            .order('inspection_date', { ascending: false })
            .limit(10),
          10000,
          `InspectionCandidates_${clientId}`
        ) as any;

        if (!error && data) {
          const fetchedCandidates = data
            .map(mapFromPostgres)
            .filter(isWithinSingleInspectionWindow);
          remoteCandidates = fetchedCandidates;
          for (const remote of fetchedCandidates) {
            await RepositoryService.mergeRemoteRecord(
              db.inspections,
              remote,
              { label: 'inspecoes candidatas' }
            );
          }
        }
      } catch (err) {
        console.warn('[InspectionService] Candidate lookup failed; using local records:', err);
      }
    }

    const refreshed = filterByActiveTenant(await db.inspections
      .where('clientId')
      .equals(clientId)
      .filter(inspection =>
        !inspection.deletedAt &&
        (inspection.status === 'in_progress' || inspection.status === 'completed') &&
        isWithinSingleInspectionWindow(inspection)
      )
      .toArray());

    const candidates = remoteCandidates ?? (refreshed.length > 0 ? refreshed : localCandidates);
    return candidates.sort(
      (a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime() ||
        b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  },

  /**
   * Hidrata no Dexie TODAS as respostas do tenant ativo (não deletadas),
   * mesclando com segurança (nunca sobrescreve edições locais pendentes).
   * Roda uma vez por tenant/sessão — chamadas concorrentes compartilham a mesma promise.
   * Resolve o sintoma de "respostas das inspeções antigas não aparecem" em telas
   * que leem apenas o cache local (Dashboard, listas e agregados).
   */
  async hydrateTenantResponses(force = false): Promise<number> {
    if (!navigator.onLine) return 0;
    const tenantId = getActiveTenantId() || null;
    if (!force && hydratedResponsesTenantId === tenantId) return 0;
    if (responsesHydrationInFlight) return responsesHydrationInFlight;

    responsesHydrationInFlight = (async () => {
      try {
        const { data, error } = await RepositoryService.withTimeout(
          supabase.from('responses').select('*').is('deleted_at', null),
          30000,
          'TenantResponsesHydration'
        ) as any;

        if (error || !data) {
          console.warn('[InspectionService] Hidratacao de respostas: sem dados', error?.message || '');
          return 0;
        }

        let merged = 0;
        for (const row of data) {
          const result = await RepositoryService.mergeRemoteRecord(
            db.responses,
            mapResponseFromPostgres(row),
            { label: 'hidratacao respostas' }
          );
          if (result.accepted) merged += 1;
        }

        hydratedResponsesTenantId = tenantId;
        console.log(`[InspectionService] Hidratacao de respostas do tenant: ${merged} mescladas de ${data.length} remotas.`);
        return merged;
      } catch (err: any) {
        console.warn('[InspectionService] Hidratacao de respostas falhou:', err?.message || err);
        return 0;
      } finally {
        responsesHydrationInFlight = null;
      }
    })();

    return responsesHydrationInFlight;
  },

  async importMissingRemoteInspections(): Promise<void> {
    const { data: remoteInspections, error } = await supabase
      .from('inspections')
      .select('*')
      .is('deleted_at', null)
      .in('status', ['in_progress', 'completed']);

    if (error || !remoteInspections?.length) return;

    for (const row of remoteInspections) {
      await RepositoryService.mergeRemoteRecord(db.inspections, mapFromPostgres(row), { label: 'reconciliacao' });
    }
  },

  subscribeToInspectionChanges(onChange: () => void): () => void {
    const channel = supabase
      .channel('inspections_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections' }, () => {
        void this.getAllInspections().finally(onChange);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToResponseChanges(inspectionId: string, onAccepted: (responses: InspectionResponse[]) => void): () => void {
    const channel = supabase
      .channel(`inspection-responses:${inspectionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'responses',
          filter: `inspection_id=eq.${inspectionId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const accepted = await this.mergeRemoteResponses([mapResponseFromPostgres(payload.new as any)]);
            if (accepted.length > 0) onAccepted(accepted);
          }
        }
      )
      .subscribe();

    const interval = window.setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const { data: remoteResps, error } = await supabase
          .from('responses')
          .select('*')
          .eq('inspection_id', inspectionId)
          .is('deleted_at', null);
        if (error || !remoteResps) return;
        const accepted = await this.mergeRemoteResponses(remoteResps.map(mapResponseFromPostgres));
        if (accepted.length > 0) onAccepted(accepted);
      } catch (err) {
        console.warn('[InspectionService] Response fallback pull failed:', err);
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }
};
