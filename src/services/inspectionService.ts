import { supabase } from '../lib/supabase';
import type { Inspection, InspectionScore, InspectionResponse } from '../types';
import { useAuthStore } from '../store/useAuthStore';


/**
 * Helper to map Postgres row to Inspection type.
 */
function mapFromPostgres(row: any): Inspection {
  return {
    id: row.id,
    clientId: row.client_id,
    templateId: row.template_id,
    consultantName: row.consultant_name,
    inspectionDate: new Date(row.inspection_date),
    status: row.status,
    observations: row.observations || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
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
    synced: 1
  };
}

/**
 * Helper to map local Inspection to Postgres row.
 */
function mapToPostgres(inspection: Inspection): any {
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
    // tenant_id and user_id will be added in the service method
  };
}

/**
 * Helper to map local Response to Postgres row.
 */
function mapResponseToPostgres(response: InspectionResponse): any {
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
  };
}

export const InspectionService = {
  async getInspectionById(id: string): Promise<Inspection | null> {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching inspection:', error);
      throw new Error('Falha ao carregar inspeção do servidor.');
    }

    return mapFromPostgres(data);
  },

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<void> {
    const pgData: any = {};
    if (updates.status) pgData.status = updates.status;
    if (updates.observations !== undefined) pgData.observations = updates.observations;
    if (updates.completedAt) pgData.completed_at = updates.completedAt.toISOString();
    if (updates.accompanistName !== undefined) pgData.accompanist_name = updates.accompanistName;
    if (updates.accompanistRole !== undefined) pgData.accompanist_role = updates.accompanistRole;
    if (updates.ilpiCapacity !== undefined) pgData.ilpi_capacity = updates.ilpiCapacity;
    if (updates.residentsTotal !== undefined) pgData.residents_total = updates.residentsTotal;
    if (updates.dependencyLevel1 !== undefined) pgData.dependency_level1 = updates.dependencyLevel1;
    if (updates.dependencyLevel2 !== undefined) pgData.dependency_level2 = updates.dependencyLevel2;
    if (updates.dependencyLevel3 !== undefined) pgData.dependency_level3 = updates.dependencyLevel3;
    if (updates.signatureDataUrl !== undefined) pgData.signature_data_url = updates.signatureDataUrl;
    
    pgData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('inspections')
      .update(pgData)
      .eq('id', id);

    if (error) {
      console.error('Error updating inspection:', error);
      throw new Error('Falha ao atualizar inspeção no servidor.');
    }
  },

  async getResponsesByInspectionId(inspectionId: string): Promise<InspectionResponse[]> {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('inspection_id', inspectionId)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching responses:', error);
      throw new Error('Falha ao carregar respostas do servidor.');
    }

    return (data || []).map(row => ({
      id: row.id,
      inspectionId: row.inspection_id,
      itemId: row.item_id,
      result: row.result,
      situationDescription: row.situation_description || undefined,
      correctiveAction: row.corrective_action || undefined,
      customDescription: row.custom_description || undefined,
      responsible: row.responsible || undefined,
      deadline: row.deadline || undefined,
      photos: [], 
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at),
      tenantId: row.tenant_id,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      synced: 1
    }));
  },

  async upsertResponse(response: InspectionResponse): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Usuário não autenticado.');

    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;

    const pgData = mapResponseToPostgres(response);
    pgData.user_id = userData.user.id;
    if (tenantId) {
      pgData.tenant_id = tenantId;
    }
    
    pgData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('responses')
      .upsert(pgData);

    if (error) {
      console.error('Error upserting response:', error);
      throw new Error('Falha ao salvar resposta no servidor.');
    }
  },

  async createInspection(inspection: Inspection): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Usuário não autenticado.');

    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;

    const pgData = mapToPostgres(inspection);
    pgData.user_id = userData.user.id;
    if (tenantId) {
      pgData.tenant_id = tenantId;
    }
    
    const { error } = await supabase
      .from('inspections')
      .insert(pgData);

    if (error) {
      console.error('Error creating inspection:', error);
      throw new Error(`Falha ao criar inspeção: ${error.message}`);
    }
  },

  async getAllInspections(): Promise<Inspection[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all inspections:', error);
      throw new Error('Falha ao carregar lista de inspeções do servidor.');
    }

    return (data || []).map(mapFromPostgres);
  },

  async getInspectionsByClient(clientId: string): Promise<Inspection[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inspections:', error);
      throw new Error('Falha ao carregar inspeções do servidor.');
    }

    return (data || []).map(mapFromPostgres);
  },


  async getResponsesByInspections(inspectionIds: string[]): Promise<InspectionResponse[]> {
    if (inspectionIds.length === 0) return [];

    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .in('inspection_id', inspectionIds)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching responses:', error);
      throw new Error('Falha ao carregar respostas do servidor.');
    }

    return (data || []).map(row => ({
      id: row.id,
      inspectionId: row.inspection_id,
      itemId: row.item_id,
      result: row.result,
      situationDescription: row.situation_description || undefined,
      correctiveAction: row.corrective_action || undefined,
      customDescription: row.custom_description || undefined,
      responsible: row.responsible || undefined,
      deadline: row.deadline || undefined,
      photos: [], // Requires a separate fetch if photos are needed
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at),
      tenantId: row.tenant_id,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      synced: 1
    }));
  },

  async deleteInspection(id: string): Promise<void> {
    const { error } = await supabase
      .from('inspections')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting inspection:', error);
      throw new Error('Falha ao excluir inspeção no servidor.');
    }
  }
};
