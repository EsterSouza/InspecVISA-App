import { supabase } from '../lib/supabase';
import { formatAppointmentLeadTimeMessage, isAppointmentAtLeast24hAhead } from '../utils/appointmentLeadTime';
import type { AppointmentAttachment, ClientPortalAuditEventType, PublicAppointmentStatusResult } from '../types';

const TIMEOUT_MS = 30000;

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
  requested_date: string | null;
  requested_time: string | null;
  report_due_at: string | null;
  compliance_score?: number | null;
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

export interface ClientPortalOverview {
  account_name: string;
  payment?: ClientPortalPayment;
  units: ClientPortalUnit[];
}

export interface ClientAppointmentDetails {
  status: PublicAppointmentStatusResult;
  assets: AppointmentAttachment[];
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
    return data as ClientPortalOverview;
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
    return data as ClientAppointmentDetails;
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
    } catch (err) {
      console.warn('[ClientPortal] Falha ao registrar auditoria:', err);
    }
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
