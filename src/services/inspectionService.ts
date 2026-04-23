import { supabase } from '../lib/supabase';
import type { Inspection, InspectionScore, InspectionResponse } from '../types';

export const InspectionService = {
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

    return (data || []).map(row => ({
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
    }));
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
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      tenantId: row.tenant_id,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      synced: 1
    }));
  }
};
