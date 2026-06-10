import { supabase } from '../lib/supabase';
import type {
  AppointmentAttachment,
  AppointmentRequest,
  AppointmentSlot,
  AttachmentKind,
  SlotPeriod,
} from '../types';
import { getActiveTenantId } from '../utils/localScope';

const PORTAL_BUCKET = 'client-portal-files';
const INSPECTION_PHOTO_BUCKET = 'inspection-photos';

export interface InspectionPhotoOption {
  photoId: string;
  storagePath: string;
  caption: string | null;
  previewUrl?: string;
}

export interface InspectionOption {
  id: string;
  inspectionDate: string;
  status: string;
  consultantName: string | null;
}

function requireTenantId(): string {
  const tenantId = getActiveTenantId();
  if (!tenantId) {
    throw new Error('Tenant ativo não identificado. Faça login novamente.');
  }
  return tenantId;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Operações internas (autenticadas) do portal público de agendamento.
 * Usa o client supabase com a sessão do consultor — as RPCs públicas
 * são exclusivas das telas sem login.
 */
export const AppointmentAdminService = {

  // ─── Solicitações ──────────────────────────────────────────

  async listRequests(): Promise<AppointmentRequest[]> {
    const { data, error } = await supabase
      .from('appointment_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AppointmentRequest[];
  },

  async updateRequest(id: string, updates: Partial<AppointmentRequest>): Promise<void> {
    const { error } = await supabase
      .from('appointment_requests')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async confirmRequest(
    id: string,
    params: {
      confirmedDate: string;
      clientId: string;
      scheduleId: string;
      manualDueDate?: string;
    }
  ): Promise<void> {
    const updates: Partial<AppointmentRequest> = {
      status: 'confirmed',
      client_id: params.clientId,
      schedule_id: params.scheduleId,
      requested_date: params.confirmedDate,
    };
    if (params.manualDueDate) {
      updates.report_due_at = params.manualDueDate;
      updates.report_due_source = 'manual';
    }
    await this.updateRequest(id, updates);
  },

  async rescheduleRequest(id: string, suggestedDate?: string): Promise<void> {
    const updates: Partial<AppointmentRequest> = { status: 'rescheduled' };
    if (suggestedDate) updates.requested_date = suggestedDate;
    await this.updateRequest(id, updates);
  },

  async cancelRequest(id: string): Promise<void> {
    await this.updateRequest(id, { status: 'cancelled' });
  },

  async setManualDueDate(id: string, dueDate: string): Promise<void> {
    await this.updateRequest(id, {
      report_due_at: dueDate,
      report_due_source: 'manual',
    });
  },

  // ─── Publicação de arquivos no portal ──────────────────────

  async publishReport(request: AppointmentRequest, file: File): Promise<void> {
    const tenantId = requireTenantId();
    const path = `${tenantId}/${request.id}/report-${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(PORTAL_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from('appointment_attachments').insert({
      tenant_id: tenantId,
      appointment_request_id: request.id,
      inspection_id: request.inspection_id,
      kind: 'report_pdf' satisfies AttachmentKind,
      storage_bucket: PORTAL_BUCKET,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || 'application/pdf',
    });
    if (insertError) throw insertError;

    await this.updateRequest(request.id, {
      status: 'report_available',
      report_pdf_path: path,
    });
  },

  async addAttachment(request: AppointmentRequest, file: File): Promise<void> {
    const tenantId = requireTenantId();
    const path = `${tenantId}/${request.id}/attachment-${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(PORTAL_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from('appointment_attachments').insert({
      tenant_id: tenantId,
      appointment_request_id: request.id,
      inspection_id: request.inspection_id,
      kind: 'attachment' satisfies AttachmentKind,
      storage_bucket: PORTAL_BUCKET,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
    });
    if (insertError) throw insertError;
  },

  async listAttachments(requestId: string): Promise<AppointmentAttachment[]> {
    const { data, error } = await supabase
      .from('appointment_attachments')
      .select('*')
      .eq('appointment_request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AppointmentAttachment[];
  },

  // ─── Fotos de inspeções vinculadas ─────────────────────────

  async listCompletedInspectionsForClient(clientId: string): Promise<InspectionOption[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select('id, inspection_date, status, consultant_name')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('inspection_date', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      inspectionDate: row.inspection_date,
      status: row.status,
      consultantName: row.consultant_name ?? null,
    }));
  },

  async listInspectionPhotoOptions(inspectionId: string): Promise<InspectionPhotoOption[]> {
    const { data: responses, error: respError } = await supabase
      .from('responses')
      .select('id')
      .eq('inspection_id', inspectionId)
      .is('deleted_at', null);
    if (respError) throw respError;

    const responseIds = (responses ?? []).map((r) => r.id);
    if (responseIds.length === 0) return [];

    const { data: photos, error: photoError } = await supabase
      .from('photos')
      .select('id, data_url, caption')
      .in('response_id', responseIds)
      .is('deleted_at', null);
    if (photoError) throw photoError;

    const options: InspectionPhotoOption[] = [];
    for (const row of photos ?? []) {
      const dataUrl: string = row.data_url || '';
      if (!dataUrl.startsWith('storage://')) continue; // apenas fotos já no Storage podem ir ao portal
      options.push({
        photoId: row.id,
        storagePath: dataUrl.slice('storage://'.length),
        caption: row.caption ?? null,
      });
    }

    // Previews internos via signed URL (sessão autenticada)
    await Promise.all(
      options.map(async (option) => {
        try {
          const { data: urlData } = await supabase.storage
            .from(INSPECTION_PHOTO_BUCKET)
            .createSignedUrl(option.storagePath, 3600);
          option.previewUrl = urlData?.signedUrl;
        } catch { /* preview indisponível — segue sem */ }
      })
    );

    return options;
  },

  async addPhotosToPortal(
    request: AppointmentRequest,
    inspectionId: string,
    photos: InspectionPhotoOption[]
  ): Promise<void> {
    if (photos.length === 0) return;
    const tenantId = requireTenantId();

    const { error } = await supabase.from('appointment_attachments').insert(
      photos.map((photo) => ({
        tenant_id: tenantId,
        appointment_request_id: request.id,
        inspection_id: inspectionId,
        kind: 'photo' satisfies AttachmentKind,
        storage_bucket: INSPECTION_PHOTO_BUCKET,
        storage_path: photo.storagePath,
        file_name: null,
        mime_type: 'image/jpeg',
        caption: photo.caption,
      }))
    );
    if (error) throw error;

    if (request.inspection_id !== inspectionId) {
      await this.updateRequest(request.id, { inspection_id: inspectionId });
    }
  },

  // ─── Disponibilidade pública (slots) ───────────────────────

  async listSlots(): Promise<AppointmentSlot[]> {
    const { data, error } = await supabase
      .from('appointment_slots')
      .select('*')
      .order('starts_at', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as AppointmentSlot[];
  },

  async createSlot(params: {
    date: string;
    period: SlotPeriod;
    capacity: number;
    isPublic: boolean;
  }): Promise<void> {
    const tenantId = requireTenantId();

    const periodTimes: Record<SlotPeriod, [string, string]> = {
      manha: ['08:00:00', '12:00:00'],
      tarde: ['13:00:00', '17:00:00'],
      noite: ['18:00:00', '21:00:00'],
      integral: ['08:00:00', '17:00:00'],
    };
    const [startTime, endTime] = periodTimes[params.period];

    const { error } = await supabase.from('appointment_slots').insert({
      tenant_id: tenantId,
      starts_at: new Date(`${params.date}T${startTime}`).toISOString(),
      ends_at: new Date(`${params.date}T${endTime}`).toISOString(),
      period: params.period,
      capacity: params.capacity,
      booked_count: 0,
      is_public: params.isPublic,
      status: 'available',
    });
    if (error) throw error;
  },

  async setSlotPublic(id: string, isPublic: boolean): Promise<void> {
    const { error } = await supabase
      .from('appointment_slots')
      .update({ is_public: isPublic, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async cancelSlot(id: string): Promise<void> {
    const { error } = await supabase
      .from('appointment_slots')
      .update({ status: 'cancelled', is_public: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
