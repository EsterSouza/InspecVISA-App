import { supabase } from '../lib/supabase';
import type {
  AppointmentAttachment,
  AppointmentBlock,
  AppointmentBlockRecurrence,
  AppointmentRequest,
  AppointmentSlot,
  AttachmentKind,
  ClientActionEvidence,
  ClientActionEvidenceStatus,
  ClientActionItem,
  ClientActionItemStatus,
  ClientPortalFeature,
  ClientPortalFeatureRow,
  SchedulingSuspensionMode,
  ClientPortalAuditEvent,
  ClientPortalSettings,
  SlotPeriod,
} from '../types';
import type { ClientActionItemPayload } from '../utils/clientActionPlan';
import { getActiveTenantId } from '../utils/localScope';
import { getLocalActor } from '../utils/localActor';
import { assertInspectionAppointment, normalizeAppointmentType, type AppointmentType } from '../utils/appointmentType';

const PORTAL_BUCKET = 'client-portal-files';
const INSPECTION_PHOTO_BUCKET = 'inspection-photos';
const ADMIN_TIMEOUT_MS = 45000;

export function normalizeOptionalHttpsUrl(value: string | null | undefined, label: string): string | null {
  const normalized = value?.trim() || null;
  if (!normalized) return null;
  try {
    if (new URL(normalized).protocol !== 'https:') throw new Error();
  } catch {
    throw new Error(`${label} deve usar uma URL HTTPS válida.`);
  }
  return normalized;
}

export interface InspectionPhotoOption {
  photoId: string;
  storagePath: string;
  caption: string | null;
  previewUrl?: string;
}

export interface ClientPortalAccountRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  portal_token: string;
  access_code_plain: string | null;
  is_active: boolean;
  created_at: string;
  client_ids: string[];
  payment_type: 'monthly' | 'one_time' | null;
  payment_status: 'pending' | 'paid';
  payment_link: string | null;
  payment_links: PaymentLinkOption[];
  payment_due_date: string | null;
  scheduling_suspended: boolean;
  scheduling_suspension_mode: SchedulingSuspensionMode;
  main_drive_folder_url: string | null;
  /** Tutorial desta conta. Nulo faz o portal cair no padrão do tenant. */
  tutorial_pdf_url: string | null;
}

export interface PaymentLinkOption {
  label?: string;
  url: string;
}

export interface ClientPortalInvoiceRow {
  id: string;
  competence_month: string;
  file_name: string;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
  signed_url?: string;
}

export interface ClientPortalAccessEmailPayload {
  email: string;
  accountName: string;
  code: string;
  portalUrl: string;
  unitCount: number;
}

export interface PaymentLinkEmailPayload {
  email: string;
  accountName: string;
  paymentLink: string;
  paymentType: 'monthly' | 'one_time' | null;
  dueDate?: string | null;
}

export interface PaymentOverdueEmailPayload {
  email: string;
  accountName: string;
  dueDate?: string | null;
  paymentLink?: string | null;
}

export interface ReportAvailableNotificationPayload {
  email?: string;
  phone?: string;
  unitName: string;
  portalUrl: string;
  reportName: string;
}

export interface ReportAvailableNotificationResult {
  ok: boolean;
  emailSent: boolean;
  emailError?: string;
  whatsappSent: boolean;
  whatsappError?: string;
  whatsappLink?: string | null;
}

export type AppointmentEventType = 'confirmed' | 'rescheduled' | 'cancelled';

export type AppointmentDeliveryStatus =
  | 'sent'
  | 'already_sent'
  | 'missing_client_email'
  | 'failed'
  | 'in_progress';

export interface AppointmentEventNotificationResult {
  ok: boolean;
  deliveryStatus: AppointmentDeliveryStatus;
  emailSent: boolean;
  recipientMasked?: string;
  emailErrorCode?: string;
  whatsappSent: boolean;
  whatsappLink?: string | null;
}

export interface BlockedDateRow {
  id: string;
  day: string;
  reason: string | null;
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

function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = ADMIN_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function mapAppointmentRequest(row: Record<string, unknown>): AppointmentRequest {
  return {
    ...row,
    appointment_type: normalizeAppointmentType(row.appointment_type),
  } as unknown as AppointmentRequest;
}

function assertInspectionRequest(request: Pick<AppointmentRequest, 'appointment_type'>, action: string): void {
  assertInspectionAppointment(request.appointment_type, action);
}

/**
 * Operações internas (autenticadas) do portal público de agendamento.
 * Usa o client supabase com a sessão do consultor — as RPCs públicas
 * são exclusivas das telas sem login.
 */
export const AppointmentAdminService = {

  // ─── Solicitações ──────────────────────────────────────────

  async listRequests(): Promise<AppointmentRequest[]> {
    const tenantId = requireTenantId();
    const { data, error } = await withTimeout(
      supabase
        .from('appointment_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      'Solicitacoes'
    );
    if (error) throw error;
    return (data ?? []).map((row) => mapAppointmentRequest(row));
  },

  async updateRequest(id: string, updates: Partial<AppointmentRequest>): Promise<void> {
    const tenantId = requireTenantId();
    const { error } = await supabase
      .from('appointment_requests')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },

  async setMeetingUrl(request: AppointmentRequest, value: string): Promise<void> {
    const meetingUrl = normalizeOptionalHttpsUrl(value, 'O link da videoconferência');
    await this.updateRequest(request.id, { meeting_url: meetingUrl });

    if (!request.schedule_id) return;
    try {
      const [{ ScheduleService }, { db }] = await Promise.all([
        import('./scheduleService'),
        import('../db/database'),
      ]);
      const schedule = await db.schedules.get(request.schedule_id);
      if (schedule) {
        await ScheduleService.saveSchedule({
          ...schedule,
          meetingUrl: meetingUrl || undefined,
          updatedAt: new Date(),
          syncStatus: 'pending',
        });
      }
    } catch (err) {
      console.warn('[AppointmentAdmin] Link salvo no portal, mas a agenda local não foi atualizada:', err);
    }
  },

  async getRequestByInspectionId(inspectionId: string): Promise<AppointmentRequest | null> {
    const tenantId = requireTenantId();
    const { data, error } = await withTimeout(
      supabase
        .from('appointment_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'SolicitacaoPorInspecao'
    );
    if (error) throw error;
    return data ? mapAppointmentRequest(data) : null;
  },

  async getRequestByScheduleId(scheduleId: string): Promise<AppointmentRequest | null> {
    const tenantId = requireTenantId();
    const { data, error } = await withTimeout(
      supabase
        .from('appointment_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('schedule_id', scheduleId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'SolicitacaoPorAgenda'
    );
    if (error) throw error;
    return data ? mapAppointmentRequest(data) : null;
  },

  async confirmRequest(
    request: AppointmentRequest,
    params: {
      confirmedDate: string;
      confirmedTime: string;
      clientId: string;
      scheduleId: string;
      consultantNames?: string[];
      manualDueDate?: string;
      appointmentType?: AppointmentType;
      durationMinutes?: number;
      meetingUrl?: string;
    }
  ): Promise<AppointmentEventNotificationResult | null> {
    // Mantém data, hora e janela de bloqueio do calendário público
    // consistentes com o horário realmente confirmado.
    // A equipe (consultoras) pode agendar a qualquer momento — a antecedência
    // mínima de 24h vale apenas para o cliente (portal público e portal do cliente).
    const startsAt = new Date(`${params.confirmedDate}T${params.confirmedTime || '09:00'}`);
    const durationMinutes = params.durationMinutes ?? request.duration_minutes ?? 60;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    const updates: Partial<AppointmentRequest> = {
      status: 'confirmed',
      client_id: params.clientId,
      schedule_id: params.scheduleId,
      requested_date: params.confirmedDate,
      requested_time: params.confirmedTime || '09:00',
      requested_period: startsAt.getHours() < 12 ? 'manha' : 'tarde',
      requested_starts_at: startsAt.toISOString(),
      requested_ends_at: endsAt.toISOString(),
      duration_minutes: durationMinutes,
      consultant_names: params.consultantNames?.length ? params.consultantNames : null,
      meeting_url: request.attendance_mode === 'online'
        ? normalizeOptionalHttpsUrl(params.meetingUrl ?? request.meeting_url ?? '', 'O link da videoconferência')
        : null,
    };
    // Admin pode reclassificar o tipo (ex.: cliente pediu "reunião" mas é uma inspeção).
    const effectiveType = params.appointmentType ?? request.appointment_type;
    if (params.appointmentType && params.appointmentType !== request.appointment_type) {
      updates.appointment_type = params.appointmentType;
    }
    if (params.manualDueDate) {
      assertInspectionRequest({ appointment_type: effectiveType }, 'definir prazo de relatório');
      updates.report_due_at = params.manualDueDate;
      updates.report_due_source = 'manual';
    }
    await this.updateRequest(request.id, updates);
    return this.notifyAppointmentEvent(request.id, 'confirmed');
  },

  async markInProgress(request: AppointmentRequest): Promise<void> {
    assertInspectionRequest(request, 'iniciar uma inspeção');
    await this.updateRequest(request.id, { status: 'in_progress' });
  },

  async setComplianceScore(request: AppointmentRequest, score: number | null): Promise<void> {
    assertInspectionRequest(request, 'registrar conformidade sanitária');
    await this.updateRequest(request.id, { compliance_score: score });
  },

  // Score por área da ILPI exibido no portal (sanitária x nutrição). null limpa o campo.
  async setAreaScores(request: AppointmentRequest, sanitary: number | null, nutrition: number | null): Promise<void> {
    assertInspectionRequest(request, 'registrar conformidade sanitária por área');
    await this.updateRequest(request.id, { sanitary_score: sanitary, nutrition_score: nutrition });
  },

  // Estatísticas de NC (críticas/importantes/imediatas/reincidentes + lista compacta dos
  // itens) para o resumo executivo do portal do cliente. Gravado junto com a publicação
  // do relatório final. Ver franchiseReport.ts.
  async setInspectionStats(request: AppointmentRequest, stats: {
    criticalNcCount: number;
    importantNcCount: number;
    totalNcCount: number;
    recurringNcCount: number;
    immediateNcCount: number;
    ncItems: { id: string; d: string; c: boolean }[];
  }): Promise<void> {
    assertInspectionRequest(request, 'registrar estatísticas sanitárias');
    await this.updateRequest(request.id, {
      critical_nc_count: stats.criticalNcCount,
      important_nc_count: stats.importantNcCount,
      total_nc_count: stats.totalNcCount,
      recurring_nc_count: stats.recurringNcCount,
      immediate_nc_count: stats.immediateNcCount,
      nc_items: stats.ncItems,
    });
  },

  // Cria uma visita direto pela equipe, já confirmada e vinculada ao cliente,
  // para aparecer no portal do cliente com rastreio completo (timeline/relatório/fotos).
  async insertConfirmedRequest(params: {
    clientId: string;
    unitName: string;
    scheduleId: string;
    date: string;
    time: string;
    attendanceMode: 'presencial' | 'online';
    municipality?: string;
    district?: string;
    responsibleName?: string;
    phone?: string;
    email?: string;
    consultantNames?: string[];
    meetingUrl?: string;
  }): Promise<void> {
    const tenantId = requireTenantId();
    // Admin agenda a qualquer momento (sem a trava de 24h, que é só do cliente).
    const startsAt = new Date(`${params.date}T${params.time || '09:00'}`);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const { error } = await supabase.from('appointment_requests').insert({
      tenant_id: tenantId,
      client_id: params.clientId,
      schedule_id: params.scheduleId,
      unit_name: params.unitName,
      district: params.attendanceMode === 'presencial' ? params.district || '' : 'Online',
      municipality: params.attendanceMode === 'presencial' ? params.municipality || null : null,
      attendance_mode: params.attendanceMode,
      responsible_name: params.responsibleName || null,
      phone: params.phone || null,
      email: params.email || null,
      requested_date: params.date,
      requested_time: params.time || '09:00',
      requested_period: startsAt.getHours() < 12 ? 'manha' : 'tarde',
      requested_starts_at: startsAt.toISOString(),
      requested_ends_at: endsAt.toISOString(),
      appointment_type: 'inspection',
      duration_minutes: 60,
      consultant_names: params.consultantNames?.length ? params.consultantNames : null,
      meeting_url: params.attendanceMode === 'online'
        ? normalizeOptionalHttpsUrl(params.meetingUrl ?? '', 'O link da videoconferência')
        : null,
      status: 'confirmed',
    });
    if (error) throw error;
  },

  async rescheduleRequest(
    request: AppointmentRequest,
    suggestedDate?: string,
    suggestedTime?: string
  ): Promise<AppointmentEventNotificationResult | null> {
    const updates: Partial<AppointmentRequest> = { status: 'rescheduled' };
    let startsAt: Date | null = null;
    if (suggestedDate) {
      const time = suggestedTime || request.requested_time || '09:00';
      startsAt = new Date(`${suggestedDate}T${time}`);
      updates.requested_date = suggestedDate;
      updates.requested_time = time;
      updates.requested_period = startsAt.getHours() < 12 ? 'manha' : 'tarde';
      updates.requested_starts_at = startsAt.toISOString();
      updates.requested_ends_at = new Date(startsAt.getTime() + (request.duration_minutes ?? 60) * 60 * 1000).toISOString();
    }
    await this.updateRequest(request.id, updates);

    // Move o Schedule interno vinculado junto, para a agenda e o bloqueio
    // do calendário público acompanharem a nova data.
    if (startsAt && request.schedule_id) {
      try {
        const [{ ScheduleService }, { db }] = await Promise.all([
          import('./scheduleService'),
          import('../db/database'),
        ]);
        const local = await db.schedules.get(request.schedule_id);
        if (local) {
          await ScheduleService.saveSchedule({
            ...local,
            scheduledAt: startsAt,
            updatedAt: new Date(),
            syncStatus: 'pending',
          });
        }
      } catch (err) {
        console.warn('[AppointmentAdmin] Falha ao mover o agendamento interno vinculado:', err);
      }
    }
    return this.notifyAppointmentEvent(request.id, 'rescheduled');
  },

  async cancelRequest(request: AppointmentRequest): Promise<AppointmentEventNotificationResult | null> {
    await this.updateRequest(request.id, { status: 'cancelled' });
    // Libera a agenda interna: o Schedule criado na confirmação deixa de bloquear o calendário.
    if (request.schedule_id) {
      try {
        const { ScheduleService } = await import('./scheduleService');
        await ScheduleService.deleteSchedule(request.schedule_id);
      } catch (err) {
        console.warn('[AppointmentAdmin] Falha ao remover o agendamento interno vinculado:', err);
      }
    }
    return this.notifyAppointmentEvent(request.id, 'cancelled');
  },

  async markCompleted(id: string): Promise<void> {
    await this.updateRequest(id, { status: 'completed' });
  },

  async markNotCompleted(id: string, reason: string): Promise<void> {
    await this.updateRequest(id, {
      status: 'rescheduled',
      notes: reason.trim() || null,
    });
  },

  async deleteRequest(request: AppointmentRequest): Promise<void> {
    const tenantId = requireTenantId();
    if (request.schedule_id) {
      try {
        const { ScheduleService } = await import('./scheduleService');
        await ScheduleService.deleteSchedule(request.schedule_id);
      } catch (err) {
        console.warn('[AppointmentAdmin] Falha ao remover o agendamento interno vinculado antes da exclusao:', err);
      }
    }

    const { data: attachments, error: listAttachmentsError } = await supabase
      .from('appointment_attachments')
      .select('storage_bucket, storage_path')
      .eq('tenant_id', tenantId)
      .eq('appointment_request_id', request.id);
    if (listAttachmentsError) throw listAttachmentsError;

    const pathsByBucket = (attachments || []).reduce<Record<string, string[]>>((acc, attachment) => {
      if (!attachment.storage_bucket || !attachment.storage_path) return acc;
      acc[attachment.storage_bucket] = acc[attachment.storage_bucket] || [];
      acc[attachment.storage_bucket].push(attachment.storage_path);
      return acc;
    }, {});

    for (const [bucket, paths] of Object.entries(pathsByBucket)) {
      const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
      if (storageError) {
        console.warn('[AppointmentAdmin] Falha ao remover arquivos da solicitacao antes da exclusao:', storageError);
      }
    }

    const { error: deleteAttachmentsError } = await supabase
      .from('appointment_attachments')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('appointment_request_id', request.id);
    if (deleteAttachmentsError) throw deleteAttachmentsError;

    const { error } = await supabase
      .from('appointment_requests')
      .delete()
      .eq('id', request.id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },

  async setManualDueDate(request: AppointmentRequest, dueDate: string): Promise<void> {
    assertInspectionRequest(request, 'definir prazo de relatório');
    await this.updateRequest(request.id, {
      report_due_at: dueDate,
      report_due_source: 'manual',
    });
  },

  // ─── Publicação de arquivos no portal ──────────────────────

  async publishReport(
    request: AppointmentRequest,
    file: File
  ): Promise<{ emailSent: boolean; whatsappLink?: string }> {
    assertInspectionRequest(request, 'publicar relatório');
    const tenantId = requireTenantId();
    const path = `${tenantId}/${request.id}/report-${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(PORTAL_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    const { error: deletePreviousError } = await supabase
      .from('appointment_attachments')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('appointment_request_id', request.id)
      .eq('kind', 'report_pdf');
    if (deletePreviousError) throw deletePreviousError;

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
      report_delivered_at: new Date().toISOString(),
    });

    try {
      let email = request.email || undefined;
      let phone = request.phone || undefined;
      let unitName = request.unit_name;

      if (request.client_id && (!email || !phone)) {
        const { data: client } = await supabase
          .from('clients')
          .select('name, email, phone')
          .eq('id', request.client_id)
          .maybeSingle();
        email = email || client?.email || undefined;
        phone = phone || client?.phone || undefined;
        unitName = client?.name || unitName;
      }

      const result = await this.notifyReportAvailable({
        email,
        phone,
        unitName,
        portalUrl: `${window.location.origin}/cliente/visita/${request.public_token}`,
        reportName: file.name,
      });
      return { emailSent: !!result?.emailSent, whatsappLink: result?.whatsappLink ?? undefined };
    } catch (err) {
      console.warn('[AppointmentAdmin] Relatorio publicado, mas a notificacao ao cliente falhou:', err);
      return { emailSent: false };
    }
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
    const tenantId = requireTenantId();
    const { data, error } = await supabase
      .from('appointment_attachments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('appointment_request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as AppointmentAttachment[];
    await Promise.all(
      rows.map(async (attachment) => {
        try {
          const { data: urlData } = await supabase.storage
            .from(attachment.storage_bucket)
            .createSignedUrl(attachment.storage_path, 3600);
          attachment.signed_url = urlData?.signedUrl;
        } catch {
          // Mantem o anexo listado mesmo se o link temporario falhar.
        }
      })
    );
    return rows;
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
    assertInspectionRequest(request, 'publicar fotos de inspeção');
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

  async listPublishedPhotos(requestId: string): Promise<{ id: string; caption: string | null; previewUrl?: string }[]> {
    const tenantId = requireTenantId();
    const { data, error } = await supabase
      .from('appointment_attachments')
      .select('id, storage_bucket, storage_path, caption')
      .eq('tenant_id', tenantId)
      .eq('appointment_request_id', requestId)
      .eq('kind', 'photo')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as any[];
    await Promise.all(
      rows.map(async (r) => {
        try {
          const { data: u } = await supabase.storage.from(r.storage_bucket).createSignedUrl(r.storage_path, 3600);
          r.previewUrl = u?.signedUrl;
        } catch { /* sem preview */ }
      })
    );
    return rows.map((r) => ({ id: r.id, caption: r.caption ?? null, previewUrl: r.previewUrl }));
  },

  async removePublishedAttachment(attachmentId: string): Promise<void> {
    // Despublica do portal (remove o vínculo). Não apaga a foto original do Storage,
    // que pertence à inspeção e é compartilhada.
    const tenantId = requireTenantId();
    const { error } = await supabase
      .from('appointment_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },

  // ─── Acessos do Portal do Cliente ──────────────────────────

  async listPortalAccounts(): Promise<ClientPortalAccountRow[]> {
    const tenantId = requireTenantId();
    let { data, error }: { data: any[] | null; error: any } = await withTimeout(
      supabase
        .from('client_portal_accounts')
        .select('id, name, email, username, portal_token, access_code_plain, is_active, created_at, payment_type, payment_status, payment_link, payment_links, payment_due_date, scheduling_suspended, scheduling_suspension_mode, main_drive_folder_url, tutorial_pdf_url, client_portal_account_clients(client_id)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      'AcessosPortal'
    );
    if (error) {
      const missingColumn =
        error.code === '42703' ||
        error.message?.includes('username') ||
        error.message?.includes('access_code_plain') ||
        error.message?.includes('payment_') ||
        error.message?.includes('main_drive_folder_url') ||
        error.message?.includes('tutorial_pdf_url') ||
        error.message?.includes('scheduling_suspension_mode') ||
        error.message?.includes('portal_token');
      if (!missingColumn) throw error;
      const fallback: { data: any[] | null; error: any } = await withTimeout(
        supabase
          .from('client_portal_accounts')
          .select('id, name, email, is_active, created_at, client_portal_account_clients(client_id)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        'AcessosPortalLegado'
      );
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      username: row.username ?? null,
      portal_token: row.portal_token ?? '',
      access_code_plain: row.access_code_plain ?? null,
      is_active: row.is_active,
      created_at: row.created_at,
      client_ids: (row.client_portal_account_clients ?? []).map((c: any) => c.client_id),
      payment_type: row.payment_type ?? null,
      payment_status: row.payment_status ?? 'pending',
      payment_link: row.payment_link ?? null,
      payment_links: Array.isArray(row.payment_links) ? row.payment_links : [],
      payment_due_date: row.payment_due_date ?? null,
      scheduling_suspended: row.scheduling_suspended ?? false,
      scheduling_suspension_mode: (row.scheduling_suspension_mode ?? 'auto') as SchedulingSuspensionMode,
      main_drive_folder_url: row.main_drive_folder_url ?? null,
      tutorial_pdf_url: row.tutorial_pdf_url ?? null,
    }));
  },

  async getPortalSettings(): Promise<ClientPortalSettings> {
    const tenantId = requireTenantId();
    const { data, error } = await supabase
      .from('client_portal_settings')
      .select('tenant_id, tutorial_pdf_url, support_whatsapp, quick_access_enabled, multi_purpose_schedule, action_plan_enabled, service_requests_enabled, overdue_grace_days, service_request_sla')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data as ClientPortalSettings || {
      tenant_id: tenantId,
      tutorial_pdf_url: null,
      support_whatsapp: null,
      quick_access_enabled: true,
      multi_purpose_schedule: false,
      action_plan_enabled: false,
      service_requests_enabled: false,
      overdue_grace_days: 5,
      service_request_sla: {},
    };
  },

  async savePortalSettings(settings: Omit<ClientPortalSettings, 'tenant_id'>): Promise<void> {
    const tenantId = requireTenantId();
    const { error } = await supabase.rpc('admin_save_client_portal_settings', {
      p_tenant_id: tenantId,
      p_tutorial_pdf_url: normalizeOptionalHttpsUrl(settings.tutorial_pdf_url, 'O tutorial'),
      p_support_whatsapp: settings.support_whatsapp?.trim() || null,
      p_quick_access_enabled: settings.quick_access_enabled,
      p_multi_purpose_schedule: settings.multi_purpose_schedule,
      p_action_plan_enabled: settings.action_plan_enabled,
      p_service_requests_enabled: settings.service_requests_enabled,
    });
    if (error) throw error;

    // Tolerância vive numa RPC própria: acrescentar parâmetro à de cima criaria sobrecarga
    // ambígua com a assinatura que já está em produção.
    if (settings.overdue_grace_days != null) {
      const { data, error: graceError } = await supabase.rpc('admin_set_portal_overdue_grace_days', {
        p_tenant_id: tenantId,
        p_days: settings.overdue_grace_days,
      });
      if (graceError) throw graceError;
      if (data?.error) throw new Error(data.error);
    }
  },

  async listPortalAuditEvents(filters: {
    accountId?: string;
    clientId?: string;
    appointmentRequestId?: string;
    limit?: number;
  } = {}): Promise<ClientPortalAuditEvent[]> {
    const tenantId = requireTenantId();
    let query = supabase
      .from('client_portal_audit_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(filters.limit || 50);

    if (filters.accountId) query = query.eq('account_id', filters.accountId);
    if (filters.clientId) query = query.eq('client_id', filters.clientId);
    if (filters.appointmentRequestId) query = query.eq('appointment_request_id', filters.appointmentRequestId);

    const { data, error } = await withTimeout(query, 'AuditoriaPortal');
    if (error) throw error;
    return (data ?? []) as ClientPortalAuditEvent[];
  },

  async setPortalPayment(
    accountId: string,
    params: { type: 'monthly' | 'one_time' | null; status: 'pending' | 'paid'; link: string; dueDate?: string | null; links?: PaymentLinkOption[] }
  ): Promise<void> {
    const { error } = await supabase.rpc('admin_set_portal_payment', {
      p_account_id: accountId,
      p_type: params.type,
      p_status: params.status,
      p_link: params.link,
      p_due_date: params.dueDate || null,
      p_links: params.links || [],
    });
    if (error) throw error;
  },

  // ─── Notas fiscais do Portal do Cliente ────────────────────

  async listInvoices(accountId: string): Promise<ClientPortalInvoiceRow[]> {
    const tenantId = requireTenantId();
    const { data, error } = await supabase
      .from('client_portal_invoices')
      .select('id, competence_month, file_name, mime_type, storage_bucket, storage_path, created_at')
      .eq('tenant_id', tenantId)
      .eq('account_id', accountId)
      .order('competence_month', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as ClientPortalInvoiceRow[];
    await Promise.all(
      rows.map(async (row) => {
        try {
          const { data: urlData } = await supabase.storage
            .from(row.storage_bucket)
            .createSignedUrl(row.storage_path, 3600);
          row.signed_url = urlData?.signedUrl;
        } catch {
          // Mantem a nota listada mesmo se o link temporario falhar.
        }
      })
    );
    return rows;
  },

  async uploadInvoice(accountId: string, competenceMonth: string, file: File): Promise<void> {
    const tenantId = requireTenantId();
    const path = `${tenantId}/portal-invoices/${accountId}/${competenceMonth}-${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(PORTAL_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from('client_portal_invoices').insert({
      tenant_id: tenantId,
      account_id: accountId,
      competence_month: `${competenceMonth}-01`,
      storage_bucket: PORTAL_BUCKET,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || 'application/pdf',
    });
    if (insertError) throw insertError;
  },

  async deleteInvoice(invoice: Pick<ClientPortalInvoiceRow, 'id' | 'storage_bucket' | 'storage_path'>): Promise<void> {
    const { error: storageError } = await supabase.storage.from(invoice.storage_bucket).remove([invoice.storage_path]);
    if (storageError) {
      console.warn('[AppointmentAdmin] Falha ao remover nota fiscal do storage:', storageError);
    }
    const { error } = await supabase.from('client_portal_invoices').delete().eq('id', invoice.id);
    if (error) throw error;
  },

  async setSchedulingSuspended(accountId: string, suspended: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_portal_scheduling_suspended', {
      p_account_id: accountId,
      p_suspended: suspended,
    });
    if (error) throw error;
  },

  // ─── Plano de ação projetado para o cliente (P360-010) ─────

  /**
   * Publica a projeção das NCs do relatório. Idempotente: republicar o mesmo relatório
   * atualiza as mesmas linhas, e item já resolvido nunca é sobrescrito. Nada aqui toca em
   * `responses` — a projeção é uma cópia à parte.
   */
  async publishActionItems(
    request: AppointmentRequest,
    items: ClientActionItemPayload[]
  ): Promise<{ created: number; updated: number }> {
    assertInspectionRequest(request, 'publicar o plano de ação');
    const { data, error } = await supabase.rpc('admin_publish_client_action_items', {
      p_appointment_request_id: request.id,
      p_items: items,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { created: data?.created ?? 0, updated: data?.updated ?? 0 };
  },

  async listActionItems(requestId: string): Promise<ClientActionItem[]> {
    const { data, error } = await supabase
      .from('client_action_items')
      .select('*')
      .eq('appointment_request_id', requestId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data || []) as ClientActionItem[];
  },

  async setActionItemStatus(itemId: string, status: ClientActionItemStatus): Promise<void> {
    const { data, error } = await supabase.rpc('admin_set_client_action_item_status', {
      p_id: itemId,
      p_status: status,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  // ─── Evidência do cliente (P360-011) ───────────────────────

  async listActionItemEvidence(itemIds: string[]): Promise<ClientActionEvidence[]> {
    if (itemIds.length === 0) return [];
    const { data, error } = await supabase
      .from('client_action_evidence')
      .select('*')
      .in('action_item_id', itemIds)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ClientActionEvidence[];
  },

  /**
   * URL temporária para a consultora abrir o arquivo. É assinada na hora, a cada clique: se
   * expirar, basta clicar de novo. A policy de Storage restringe a assinatura ao staff do
   * tenant dono do caminho — o arquivo nunca fica público.
   */
  async evidenceSignedUrl(
    evidence: Pick<ClientActionEvidence, 'storage_bucket' | 'storage_path'>
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(evidence.storage_bucket)
      .createSignedUrl(evidence.storage_path, 3600);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('Nao foi possivel abrir o arquivo agora.');
    return data.signedUrl;
  },

  /**
   * Aprovar ou devolver. `resolveItem` é o único caminho para a pendência fechar a partir daqui:
   * aprovar o arquivo e dar a pendência por resolvida são decisões separadas, e a segunda é
   * sempre explícita da consultora.
   */
  async reviewEvidence(
    evidenceId: string,
    params: { status: Exclude<ClientActionEvidenceStatus, 'pending'>; note?: string; resolveItem?: boolean }
  ): Promise<{ itemResolved: boolean }> {
    const { data, error } = await supabase.rpc('admin_review_client_action_evidence', {
      p_evidence_id: evidenceId,
      p_status: params.status,
      p_note: params.note?.trim() || null,
      p_resolve_item: !!params.resolveItem,
      p_reviewed_by: getLocalActor().name || null,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { itemResolved: !!data?.item_resolved };
  },

  /** Avisa o cliente do resultado da revisão. Falhar aqui não desfaz a revisão. */
  async notifyEvidenceReviewed(evidenceId: string): Promise<{ whatsappLink?: string } | null> {
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('notify-evidence-reviewed', {
          body: { evidenceId, portalUrl: `${window.location.origin}/cliente` },
        }),
        'NotificarRevisaoEvidencia',
        30000
      );
      if (error) throw error;
      return data as { whatsappLink?: string };
    } catch (err) {
      console.warn('[AppointmentAdmin] Falha ao notificar a revisao da evidencia:', err);
      return null;
    }
  },

  // ─── Travas do portal por conta (PORT-01) ──────────────────

  async listPortalFeatures(accountId: string): Promise<ClientPortalFeatureRow[]> {
    const { data, error } = await supabase
      .from('client_portal_account_features')
      .select('*')
      .eq('account_id', accountId);
    if (error) throw error;
    return (data || []) as ClientPortalFeatureRow[];
  },

  async setPortalFeature(
    accountId: string,
    feature: ClientPortalFeature,
    params: {
      state: ClientPortalFeatureRow['state'];
      releaseAt?: string | null;
      hideAt?: string | null;
      lockWhenOverdue?: boolean;
    }
  ): Promise<void> {
    const { data, error } = await supabase.rpc('admin_set_portal_feature', {
      p_account_id: accountId,
      p_feature: feature,
      p_state: params.state,
      p_release_at: params.releaseAt || null,
      p_hide_at: params.hideAt || null,
      p_lock_when_overdue: !!params.lockWhenOverdue,
      p_updated_by: getLocalActor().name || null,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  async setSchedulingMode(accountId: string, mode: SchedulingSuspensionMode): Promise<void> {
    const { data, error } = await supabase.rpc('admin_set_portal_scheduling_mode', {
      p_account_id: accountId,
      p_mode: mode,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  async setReportHidden(request: AppointmentRequest, hidden: boolean): Promise<void> {
    assertInspectionRequest(request, 'alterar a publicação do relatório');
    await this.updateRequest(request.id, { report_hidden: hidden } as Partial<AppointmentRequest>);
  },

  async sendPaymentOverdueEmail(payload: PaymentOverdueEmailPayload): Promise<void> {
    const { error } = await withTimeout(
      supabase.functions.invoke('notify-payment-overdue', {
        body: payload,
      }),
      'EmailCobrancaAtraso',
      30000
    );
    if (error) throw error;
  },

  async updatePortalAccount(
    accountId: string,
    params: {
      email: string;
      username?: string | null;
      mainDriveFolderUrl?: string | null;
      tutorialPdfUrl?: string | null;
    }
  ): Promise<void> {
    const { error } = await supabase.rpc('admin_update_client_portal_account_configuration', {
      p_account_id: accountId,
      p_email: params.email,
      p_username: params.username?.trim() || null,
      p_main_drive_folder_url: normalizeOptionalHttpsUrl(params.mainDriveFolderUrl, 'A Pasta Principal Completa'),
      p_tutorial_pdf_url: normalizeOptionalHttpsUrl(params.tutorialPdfUrl, 'O tutorial do portal'),
    });
    if (error) throw error;
  },

  async createPortalAccount(params: {
    name: string;
    email: string;
    username?: string;
    code: string;
    clientIds: string[];
  }): Promise<void> {
    const tenantId = requireTenantId();
    const { data, error } = await supabase.rpc('admin_create_client_portal_account', {
      p_tenant_id: tenantId,
      p_name: params.name,
      p_email: params.email,
      p_username: params.username?.trim() || null,
      p_code: params.code,
      p_client_ids: params.clientIds,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  async setPortalAccessCode(accountId: string, code: string): Promise<void> {
    const { error } = await supabase.rpc('admin_set_portal_access_code', {
      p_account_id: accountId,
      p_code: code,
    });
    if (error) throw error;
  },

  async regeneratePortalToken(accountId: string): Promise<{ portal_token: string }> {
    const { data, error } = await supabase.rpc('admin_regenerate_client_portal_token', {
      p_account_id: accountId,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { portal_token: string };
  },

  async sendPortalAccessEmail(payload: ClientPortalAccessEmailPayload): Promise<void> {
    const { error } = await withTimeout(
      supabase.functions.invoke('notify-client-portal-access', {
        body: payload,
      }),
      'EmailPortalCliente',
      30000
    );
    if (error) throw error;
  },

  async sendPaymentLinkEmail(payload: PaymentLinkEmailPayload): Promise<void> {
    const { error } = await withTimeout(
      supabase.functions.invoke('notify-payment-link', {
        body: payload,
      }),
      'EmailLinkPagamento',
      30000
    );
    if (error) throw error;
  },

  async notifyReportAvailable(
    payload: ReportAvailableNotificationPayload
  ): Promise<ReportAvailableNotificationResult> {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('notify-report-available', {
        body: payload,
      }),
      'NotificarRelatorioCliente',
      30000
    );
    if (error) throw error;
    return data as ReportAvailableNotificationResult;
  },

  // Confirmação/remarcação/cancelamento: e-mail deduplicado (idempotente por evento) + link de
  // WhatsApp pronto para a consultora encaminhar. Notificação nunca derruba a ação principal —
  // uma falha aqui não pode impedir a solicitação de ser confirmada/remarcada/cancelada.
  async notifyAppointmentEvent(
    appointmentRequestId: string,
    eventType: AppointmentEventType
  ): Promise<AppointmentEventNotificationResult | null> {
    try {
      const tenantId = requireTenantId();
      const { data, error } = await withTimeout(
        supabase.functions.invoke('notify-appointment-event', {
          body: { appointmentRequestId, tenantId, eventType },
        }),
        'NotificarCompromissoCliente',
        30000
      );
      if (error) throw error;
      return data as AppointmentEventNotificationResult;
    } catch (err) {
      console.warn('[AppointmentAdmin] Falha ao notificar compromisso:', err);
      return null;
    }
  },

  async retryAppointmentConfirmation(request: AppointmentRequest): Promise<AppointmentEventNotificationResult | null> {
    const eventType: AppointmentEventType = request.status === 'rescheduled' ? 'rescheduled' : 'confirmed';
    return this.notifyAppointmentEvent(request.id, eventType);
  },

  async setPortalAccountClients(accountId: string, clientIds: string[]): Promise<void> {
    // Substitui o conjunto de unidades vinculadas (RLS restringe ao staff do tenant).
    const { error: delError } = await supabase
      .from('client_portal_account_clients')
      .delete()
      .eq('account_id', accountId);
    if (delError) throw delError;

    if (clientIds.length > 0) {
      const { error: insError } = await supabase
        .from('client_portal_account_clients')
        .insert(clientIds.map((client_id) => ({ account_id: accountId, client_id })));
      if (insError) throw insError;
    }
  },

  async deletePortalAccount(accountId: string): Promise<void> {
    const { error } = await supabase.from('client_portal_accounts').delete().eq('id', accountId);
    if (error) throw error;
  },

  // ─── Datas bloqueadas (feriados/férias) ────────────────────

  async listBlockedDates(): Promise<BlockedDateRow[]> {
    const tenantId = requireTenantId();
    const { data, error } = await withTimeout(
      supabase
        .from('appointment_blocked_dates')
        .select('id, day, reason')
        .eq('tenant_id', tenantId)
        .gte('day', new Date().toISOString().split('T')[0])
        .order('day', { ascending: true }),
      'DatasBloqueadas'
    );
    if (error) throw error;
    return (data ?? []) as BlockedDateRow[];
  },

  async addBlockedDate(day: string, reason: string): Promise<void> {
    const tenantId = requireTenantId();
    const { error } = await supabase.from('appointment_blocked_dates').insert({
      tenant_id: tenantId,
      day,
      reason: reason.trim() || null,
    });
    if (error) throw error;
  },

  async removeBlockedDate(id: string): Promise<void> {
    const { error } = await supabase.from('appointment_blocked_dates').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Bloqueios parciais/recorrentes da equipe ──────────────

  async listAvailabilityBlocks(): Promise<AppointmentBlock[]> {
    const tenantId = requireTenantId();
    const { data, error } = await withTimeout(
      supabase
        .from('appointment_blocks')
        .select('id, tenant_id, starts_at, ends_at, reason, recurrence_group_id, recurrence, occurrence_index, occurrence_count, cancelled_at, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .is('cancelled_at', null)
        .gte('ends_at', new Date().toISOString())
        .order('starts_at', { ascending: true }),
      'BloqueiosParciais'
    );
    if (error) throw error;
    return (data ?? []) as AppointmentBlock[];
  },

  async createAvailabilityBlocks(params: {
    startsAt: string;
    durationMinutes: number;
    reason?: string;
    recurrence?: AppointmentBlockRecurrence;
    occurrences?: number;
  }): Promise<AppointmentBlock[]> {
    const tenantId = requireTenantId();
    const { data, error } = await withTimeout(
      supabase.rpc('admin_create_appointment_blocks', {
        p_tenant_id: tenantId,
        p_starts_at: params.startsAt,
        p_duration_minutes: params.durationMinutes,
        p_reason: params.reason?.trim() || null,
        p_recurrence: params.recurrence ?? 'none',
        p_occurrences: params.occurrences ?? 1,
      }),
      'CriarBloqueiosParciais'
    );
    if (error) throw error;
    return (data ?? []) as AppointmentBlock[];
  },

  async cancelAvailabilityBlock(id: string): Promise<void> {
    const tenantId = requireTenantId();
    const { error } = await supabase
      .from('appointment_blocks')
      .update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },

  // ─── Disponibilidade pública (slots) ───────────────────────

  async listSlots(): Promise<AppointmentSlot[]> {
    const tenantId = requireTenantId();
    const { data, error } = await withTimeout(
      supabase
        .from('appointment_slots')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('starts_at', { ascending: true, nullsFirst: false }),
      'DisponibilidadePublica'
    );
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
      manha: ['09:30:00', '12:00:00'],
      tarde: ['13:00:00', '16:00:00'],
      integral: ['09:30:00', '16:00:00'],
      noite: ['09:30:00', '16:00:00'],
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
