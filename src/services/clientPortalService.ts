import { supabase } from '../lib/supabase';
import { formatAppointmentLeadTimeMessage, isAppointmentAtLeast24hAhead } from '../utils/appointmentLeadTime';
import type {
  AppointmentType,
  AppointmentAttachment,
  ClientActionItemPriority,
  ClientPortalAuditEventType,
  ClientPortalSettings,
  PublicAppointmentStatusResult,
} from '../types';
import { isInspectionAppointment, normalizeAppointmentType } from '../utils/appointmentType';
import { PUBLIC_APPOINTMENT_DRAFT_KEY } from '../utils/publicAppointmentForm';

const TIMEOUT_MS = 30000;

export interface ClientPortalAuditHealth {
  ok: number;
  failed: number;
  lastError: string | null;
  lastEventType: ClientPortalAuditEventType | null;
  lastFailureAt: string | null;
}

const auditHealth: ClientPortalAuditHealth = {
  ok: 0,
  failed: 0,
  lastError: null,
  lastEventType: null,
  lastFailureAt: null,
};

function recordAuditFailure(eventType: ClientPortalAuditEventType, err: unknown): void {
  auditHealth.failed += 1;
  auditHealth.lastError = err instanceof Error ? err.message : String(err);
  auditHealth.lastEventType = eventType;
  auditHealth.lastFailureAt = new Date().toISOString();
  console.error(
    `[ClientPortal] Auditoria falhou em "${eventType}" (${auditHealth.failed} desde que a pagina abriu):`,
    err
  );
}

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface ClientPortalVisit {
  public_token: string;
  unit_name: string;
  status: string;
  appointment_type: AppointmentType;
  subject?: string | null;
  duration_minutes?: number | null;
  consultant_names?: string[] | null;
  meeting_url?: string | null;
  participant_names?: string[] | null;
  cancellation_reason?: string | null;
  requested_date: string | null;
  requested_time: string | null;
  report_due_at: string | null;
  compliance_score?: number | null;
  sanitary_score?: number | null;
  nutrition_score?: number | null;
  critical_nc_count?: number | null;
  important_nc_count?: number | null;
  total_nc_count?: number | null;
  recurring_nc_count?: number | null;
  immediate_nc_count?: number | null;
  nc_items?: { id: string; d: string; c: boolean }[];
  report_count?: number;
  photo_count?: number;
  attachment_count?: number;
  created_at: string;
}

export interface ClientPortalUnit {
  client_id: string;
  client_name: string;
  city: string | null;
  state: string | null;
  has_personalized_sanitary_folder?: boolean;
  personalized_sanitary_folder_url?: string | null;
  has_audit_service?: boolean;
  has_online_followup?: boolean;
  visits: ClientPortalVisit[];
}

export interface ClientPortalAppointmentPayload {
  client_id: string;
  attendance_mode: 'presencial' | 'online';
  municipality?: string;
  district?: string;
  responsible_name?: string;
  phone?: string;
  email?: string;
  requested_starts_at: string;
  requested_ends_at: string;
  appointment_type?: AppointmentType;
  duration_minutes?: number;
  subject?: string;
  participant_names?: string[];
  notes?: string;
}

export interface ClientPortalPayment {
  type: 'monthly' | 'one_time' | null;
  status: 'pending' | 'paid';
  link: string | null;
  links?: { label?: string; url: string }[];
  due_date?: string | null;
  updated_at: string | null;
}

export interface ClientPortalOverview extends Omit<ClientPortalSettings, 'tenant_id'> {
  account_name: string;
  main_drive_folder_url: string | null;
  scheduling_suspended?: boolean;
  payment?: ClientPortalPayment;
  units: ClientPortalUnit[];
}

export interface ClientAppointmentDetails {
  status: PublicAppointmentStatusResult;
  assets: AppointmentAttachment[];
}

export interface ClientPortalInvoice {
  id: string;
  competence_month: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
  signed_url?: string;
}

/**
 * Item do plano de ação como o CLIENTE o recebe (P360-010). É de propósito menor que a linha
 * de `client_action_items`: sem `source_item_id`, sem `inspection_id`, sem nada da estrutura
 * do checklist. `visit_token` é o mesmo token público que o portal já usa nos compromissos.
 */
export interface ClientPortalActionItem {
  id: string;
  client_id: string;
  unit_name: string;
  title: string;
  situation: string;
  recommended_action: string;
  priority: ClientActionItemPriority;
  responsible: string | null;
  due_date: string | null;
  status: 'published' | 'resolved';
  is_overdue: boolean;
  occurrence_count: number;
  first_detected_on: string | null;
  last_detected_on: string | null;
  resolved_at: string | null;
  visit_token: string | null;
}

const TOKEN_KEY = 'inspecvisa-client-portal-token';

export const clientPortalService = {
  getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  storeToken(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch { /* armazenamento indisponível */ }
  },

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(PUBLIC_APPOINTMENT_DRAFT_KEY);
    } catch { /* armazenamento indisponível */ }
  },

  async login(identifier: string, password: string): Promise<{ portal_token: string; account_name: string }> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_login', { p_email: identifier, p_code: password }),
      'LoginPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error('E-mail/usuario ou senha invalidos.');
    const result = data as { portal_token: string; account_name: string };
    void this.audit(result.portal_token, 'login', { identifier });
    return result;
  },

  async overview(token: string): Promise<ClientPortalOverview> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_overview', { p_token: token }),
      'PainelPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error('acesso invalido');
    const overview = data as ClientPortalOverview;
    return {
      ...overview,
      units: overview.units.map((unit) => ({
        ...unit,
        visits: unit.visits.map((visit) => ({
          ...visit,
          appointment_type: normalizeAppointmentType(visit.appointment_type),
        })),
      })),
    };
  },

  async actionItems(token: string, clientId?: string | null): Promise<ClientPortalActionItem[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_action_items', {
        p_token: token,
        p_client_id: clientId || null,
      }),
      'PlanoDeAcaoPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.items ?? []) as ClientPortalActionItem[];
  },

  async createAppointment(
    token: string,
    payload: ClientPortalAppointmentPayload
  ): Promise<{ public_token: string }> {
    if (!isAppointmentAtLeast24hAhead(payload.requested_starts_at)) {
      throw new Error(formatAppointmentLeadTimeMessage());
    }
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_create_appointment', {
        p_payload: { ...payload, portal_token: token },
      }),
      'AgendarPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { public_token: string };
  },

  async appointmentDetails(accountToken: string, appointmentToken: string): Promise<ClientAppointmentDetails> {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('client-appointment-assets', {
        body: { accountToken, appointmentToken },
      }),
      'ArquivosPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const details = data as ClientAppointmentDetails;
    const appointmentType = normalizeAppointmentType(details.status.appointment_type);
    return {
      ...details,
      status: { ...details.status, appointment_type: appointmentType },
      assets: isInspectionAppointment(appointmentType)
        ? details.assets
        : details.assets.filter((asset) => asset.kind === 'attachment'),
    };
  },

  async audit(
    token: string,
    eventType: ClientPortalAuditEventType,
    payload: Record<string, unknown> = {},
    options: { appointmentToken?: string; attachmentId?: string } = {}
  ): Promise<void> {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('client_portal_audit_event', {
          p_token: token,
          p_event_type: eventType,
          p_payload: payload,
          p_appointment_token: options.appointmentToken || null,
          p_attachment_id: options.attachmentId || null,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
        'AuditoriaPortalCliente'
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      auditHealth.ok += 1;
    } catch (err) {
      // Registrar auditoria nunca pode derrubar o portal do cliente, mas falhar em silencio ja
      // custou meses: a funcao nao existia em producao e ninguem percebeu. Fica barulhento.
      recordAuditFailure(eventType, err);
    }
  },

  auditHealth(): ClientPortalAuditHealth {
    return { ...auditHealth };
  },

  async invoices(accountToken: string): Promise<ClientPortalInvoice[]> {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('client-portal-invoices', {
        body: { accountToken },
      }),
      'NotasFiscaisPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.invoices ?? []) as ClientPortalInvoice[];
  },

  async acknowledgePayment(token: string, note?: string): Promise<void> {
    const { data, error } = await withTimeout(
      supabase.rpc('client_portal_payment_acknowledge', {
        p_token: token,
        p_note: note || null,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      'ConfirmarPagamentoPortalCliente'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },
};
