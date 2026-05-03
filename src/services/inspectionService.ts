import { supabase } from '../lib/supabase';
import type { Inspection, InspectionResponse, InspectionPhoto } from '../types';
import { db } from '../db/database';
import { RepositoryService } from './repositoryService';

/**
 * Mappers
 */
export function mapFromPostgres(row: any): Inspection {
  return {
    id: row.id,
    clientId: row.client_id,
    templateId: row.template_id,
    consultantName: row.consultant_name,
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
    accompanistName: row.accompanist_name || undefined,
    accompanistRole: row.accompanist_role || undefined,
    signatureDataUrl: row.signature_data_url || undefined,
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
    accompanist_name: inspection.accompanistName || null,
    accompanist_role: inspection.accompanistRole || null,
    signature_data_url: inspection.signatureDataUrl || null,
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
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at || row.created_at),
    tenantId: row.tenant_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    syncStatus: 'synced',
    dataVerifiedAt: new Date()
  };
}

export function mapPhotoToPostgres(photo: InspectionPhoto): any {
  return {
    id: photo.id,
    response_id: photo.responseId,
    data_url: photo.dataUrl,
    caption: photo.caption || null,
    taken_at: photo.takenAt.toISOString(),
    updated_at: photo.updatedAt.toISOString(),
    deleted_at: photo.deletedAt ? photo.deletedAt.toISOString() : null,
    tenant_id: photo.tenantId
  };
}

export const InspectionService = {
  mapToPostgres,
  mapResponseToPostgres,
  mapPhotoToPostgres,
  mapResponseFromPostgres,

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
          const result = await Promise.race([
            supabase.from('inspections').select('*').eq('id', id).is('deleted_at', null).single(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT: getInspectionById')), 25000))
          ]);
          const { data, error } = result as any;

          // If server says record not found (404/PGRST116), stamp dataVerifiedAt
          // so we stop retrying on every load — avoids infinite loop for ID mismatches
          if (error?.code === 'PGRST116') {
            console.warn('[InspectionService] Record not found on server, stopping retry for:', id);
            if (local) await db.inspections.update(id, { dataVerifiedAt: new Date() });
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

    return local || null;
  },

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<void> {
    const local = await db.inspections.get(id);
    if (!local) throw new Error('Inspeção não encontrada localmente.');

    const updated = { ...local, ...updates, updatedAt: new Date(), syncStatus: 'pending' as const };
    await RepositoryService.upsert('inspections', updated, db.inspections, mapToPostgres);
  },

  async deleteInspection(id: string): Promise<void> {
    const local = await db.inspections.get(id);
    if (!local) return;

    const now = new Date();

    // 1. Soft-delete the inspection in Dexie immediately (so UI updates before network)
    const updated = { ...local, deletedAt: now, updatedAt: now, syncStatus: 'pending' as const };
    await db.inspections.put(updated);

    // 2. Cascade soft-delete related responses in Dexie
    const responses = await db.responses.where('inspectionId').equals(id).toArray();
    for (const r of responses) {
      await db.responses.put({ ...r, deletedAt: now, updatedAt: now, syncStatus: 'pending' as const });
    }

    // 3. Push deletion to Supabase in the background
    if (navigator.onLine) {
      RepositoryService.pushToRemote('inspections', updated, db.inspections, mapToPostgres).catch(err =>
        console.warn('[InspectionService] Failed to sync deletion:', err)
      );
    }
  },

  async getResponsesByInspectionId(inspectionId: string, forceRefresh = false): Promise<InspectionResponse[]> {
    const local = await db.responses
      .where('inspectionId')
      .equals(inspectionId)
      .filter(r => r.deletedAt === null)
      .toArray();
    
    // TTL: 2 minutes for responses refresh
    const lastCheck = local.length > 0 ? Math.min(...local.map(r => r.dataVerifiedAt?.getTime() || 0)) : 0;
    const isStale = (Date.now() - lastCheck > 2 * 60 * 1000) || forceRefresh;

    if (isStale && navigator.onLine) {
      // Trigger background refresh for responses
      // Safety: Only update Dexie if we have a successful, non-masked result.
      supabase.from('responses').select('*').eq('inspection_id', inspectionId).is('deleted_at', null)
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


        });
    }

    return local;
  },

  async upsertResponse(response: InspectionResponse): Promise<void> {
    await RepositoryService.upsert('responses', response, db.responses, mapResponseToPostgres);
  },

  async upsertPhoto(photo: InspectionPhoto): Promise<void> {
    await RepositoryService.upsert('photos', photo, db.photos, mapPhotoToPostgres);
  },

  async deletePhoto(id: string): Promise<void> {
    const local = await db.photos.get(id);
    if (!local) return;
    const updated = { ...local, deletedAt: new Date(), syncStatus: 'pending' as const };
    await RepositoryService.upsert('photos', updated, db.photos, mapPhotoToPostgres);
  },

  async createInspection(inspection: Inspection): Promise<void> {
    await RepositoryService.upsert('inspections', inspection, db.inspections, mapToPostgres);
  },

  async getAllInspections(): Promise<Inspection[]> {
    // Always filter out soft-deleted records from Dexie immediately
    const local = await db.inspections
      .filter(i => !i.deletedAt)
      .reverse()
      .sortBy('createdAt');

    // Background refresh from Supabase if online
    if (navigator.onLine) {
      void (async () => {
        try {
          // LOCK: Ensure session is consolidated before background network calls
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { data, error } = await supabase
            .from('inspections')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
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
    const local = await db.inspections
      .where('clientId')
      .equals(clientId)
      .filter(i => i.status === 'completed' && !i.deletedAt)
      .toArray();

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
