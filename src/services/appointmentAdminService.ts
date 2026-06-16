import { supabase } from '../lib/supabase';
import type {
  AppointmentAttachment,
  AppointmentRequest,
  AppointmentSlot,
  AttachmentKind,
  ClientPortalAuditEvent,
  SlotPeriod,
} from '../types';
import { getActiveTenantId } from '../utils/localScope';

const PORTAL_BUCKET = 'client-portal-files';
const INSPECTION_PHOTO_BUCKET = 'inspection-photos';
const ADMIN_TIMEOUT_MS = 45000;

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
}

export interface PaymentLinkOption {
  label?: string;
  url: string;
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
    return (data ?? []) as AppointmentRequest[];
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
    return (data ?? null) as AppointmentRequest | null;
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
    return (data ?? null) as AppointmentRequest | null;
  },

  async confirmRequest(
    id: string,
    params: {
      confirmedDate: string;
      confirmedTime: string;
      clientId: string;
      scheduleId: string;
      manualDueDate?: string;
    }
  ): Promise<void> {
    // Mantém data, hora e janela de bloqueio do calendário público
    // consistentes com o horário realmente confirmado.
    // A equipe (consultoras) pode agendar a qualquer momento — a antecedência
    // mínima de 24h vale apenas para o cliente (portal público e portal do cliente).
    const startsAt = new Date(`${params.confirmedDate}T${params.confirmedTime || '09:00'}`);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const updates: Partial<AppointmentRequest> = {
      status: 'confirmed',
      client_id: params.clientId,
      schedule_id: params.scheduleId,
      requested_date: params.confirmedDate,
      requested_time: params.confirmedTime || '09:00',
      requested_period: startsAt.getHours() < 12 ? 'manha' : 'tarde',
      requested_starts_at: startsAt.toISOString(),
      requested_ends_at: endsAt.toISOString(),
    };
    if (params.manualDueDate) {
      updates.report_due_at = params.manualDueDate;
      updates.report_due_source = 'manual';
    }
    await this.updateRequest(id, updates);
  },

  async markInProgress(id: string): Promise<void> {
    await this.updateRequest(id, { status: 'in_progress' });
  },

  async setComplianceScore(id: string, score: number | null): Promise<void> {
    await this.updateRequest(id, { compliance_score: score });
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
      status: 'confirmed',
    });
    if (error) throw error;
  },

  async rescheduleRequest(
    request: AppointmentRequest,
    suggestedDate?: string,
    suggestedTime?: string
  ): Promise<void> {
    const updates: Partial<AppointmentRequest> = { status: 'rescheduled' };
    let startsAt: Date | null = null;
    if (suggestedDate) {
      const time = suggestedTime || request.requested_time || '09:00';
      startsAt = new Date(`${suggestedDate}T${time}`);
      updates.requested_date = suggestedDate;
      updates.requested_time = time;
      updates.requested_period = startsAt.getHours() < 12 ? 'manha' : 'tarde';
      updates.requested_starts_at = startsAt.toISOString();
      updates.requested_ends_at = new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString();
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
  },

  async cancelRequest(request: AppointmentRequest): Promise<void> {
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

  async setManualDueDate(id: string, dueDate: string): Promise<void> {
    await this.updateRequest(id, {
      report_due_at: dueDate,
      report_due_source: 'manual',
    });
  },

  // ─── Publicação de arquivos no portal ──────────────────────

  async publishReport(
    request: AppointmentRequest,
    file: File
  ): Promise<{ emailSent: boolean; whatsappLink?: string }> {
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
        .select('id, name, email, username, portal_token, access_code_plain, is_active, created_at, payment_type, payment_status, payment_link, payment_links, payment_due_date, scheduling_suspended, client_portal_account_clients(client_id)')
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
    }));
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

  async setSchedulingSuspended(accountId: string, suspended: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_portal_scheduling_suspended', {
      p_account_id: accountId,
      p_suspended: suspended,
    });
    if (error) throw error;
  },

  async setReportHidden(requestId: string, hidden: boolean): Promise<void> {
    await this.updateRequest(requestId, { report_hidden: hidden } as Partial<AppointmentRequest>);
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

  async updatePortalAccount(accountId: string, params: { email: string; username?: string | null }): Promise<void> {
    const { error } = await supabase.rpc('admin_update_client_portal_account', {
      p_account_id: accountId,
      p_email: params.email,
      p_username: params.username?.trim() || null,
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
