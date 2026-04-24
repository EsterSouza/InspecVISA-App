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
    dependencyLevel1: row.dependency_level1 || undefined,
    dependencyLevel2: row.dependency_level2 || undefined,
    dependencyLevel3: row.dependency_level3 || undefined,
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

  async getInspectionById(id: string): Promise<Inspection | null> {
    const local = await db.inspections.get(id);
    const isStale = !local || !local.dataVerifiedAt || (Date.now() - local.dataVerifiedAt.getTime() > 2 * 60 * 1000);

    if (isStale && navigator.onLine) {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (!error && data) {
        const remote = mapFromPostgres(data);
        await db.inspections.put(remote);
        return remote;
      }
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
    const updated = { ...local, deletedAt: new Date(), updatedAt: new Date(), syncStatus: 'pending' as const };
    await RepositoryService.upsert('inspections', updated, db.inspections, mapToPostgres);
  },

  async getResponsesByInspectionId(inspectionId: string): Promise<InspectionResponse[]> {
    const local = await db.responses
      .where('inspectionId')
      .equals(inspectionId)
      .filter(r => r.deletedAt === null)
      .toArray();
    
    // TTL: 2 minutes for responses refresh
    const lastCheck = local.length > 0 ? Math.min(...local.map(r => r.dataVerifiedAt?.getTime() || 0)) : 0;
    const isStale = Date.now() - lastCheck > 2 * 60 * 1000;

    if (isStale && navigator.onLine) {
      // Trigger background refresh for responses
      supabase.from('responses').select('*').eq('inspection_id', inspectionId).is('deleted_at', null)
        .then(({ data }) => {
          if (data) {
            data.forEach(async row => {
              const res = { 
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
                updatedAt: new Date(row.updated_at),
                tenantId: row.tenant_id,
                deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
                syncStatus: 'synced', 
                dataVerifiedAt: new Date() 
              };
              await db.responses.put(res as any);
            });
          }
        });
    }

    return local;
  },

  async upsertResponse(response: InspectionResponse): Promise<void> {
    await RepositoryService.upsert('responses', response, db.responses, mapResponseToPostgres);
  },

  async createInspection(inspection: Inspection): Promise<void> {
    await RepositoryService.upsert('inspections', inspection, db.inspections, mapToPostgres);
  },

  async getAllInspections(): Promise<Inspection[]> {
    return RepositoryService.getAll<Inspection>(
      db.inspections,
      async () => {
        const { data, error } = await supabase.from('inspections').select('*').is('deleted_at', null).order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapFromPostgres);
      },
      2 * 60 * 1000 // 2m TTL
    );
  }
};
