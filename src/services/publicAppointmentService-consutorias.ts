import { supabase } from '../lib/supabase';
import type {
  AppointmentType,
  PublicAppointmentPayload,
  PublicAvailableTime,
  PublicCalendarDay,
} from '../types';
import { formatAppointmentLeadTimeMessage, isAppointmentAtLeast24hAhead } from '../utils/appointmentLeadTime';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanTenantId(value: unknown): string {
  const cleaned = String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^['"]|['"]$/g, '');

  if (!UUID_RE.test(cleaned)) {
    console.warn('[PublicAppointment] VITE_DEFAULT_TENANT_ID invalido ou ausente.');
  }

  return cleaned;
}

const DEFAULT_TENANT_ID = cleanTenantId(import.meta.env.VITE_DEFAULT_TENANT_ID);
const REQUEST_TIMEOUT_MS = 45000;

function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export const publicAppointmentService = {
  async listCalendarDays(
    startDate?: string,
    days = 45,
    appointmentType: AppointmentType = 'inspection',
    durationMinutes?: number
  ): Promise<PublicCalendarDay[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_list_calendar_days', {
        p_tenant_id: DEFAULT_TENANT_ID,
        p_start_date: startDate || new Date().toISOString().split('T')[0],
        p_days: days,
        p_appointment_type: appointmentType,
        p_duration_minutes: durationMinutes ?? null,
      }),
      'CalendarioPublico'
    );
    if (error) throw error;
    return (data ?? []) as PublicCalendarDay[];
  },

  async listAvailableTimes(
    day: string,
    appointmentType: AppointmentType = 'inspection',
    durationMinutes?: number
  ): Promise<PublicAvailableTime[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_list_available_times', {
        p_tenant_id: DEFAULT_TENANT_ID,
        p_day: day,
        p_appointment_type: appointmentType,
        p_duration_minutes: durationMinutes ?? null,
      }),
      'HorariosPublicos'
    );
    if (error) throw error;
    return (data ?? []) as PublicAvailableTime[];
  },

  async createAppointmentRequest(
    payload: Omit<PublicAppointmentPayload, 'tenant_id'>
  ): Promise<{ public_token: string }> {
    if (!payload.requested_starts_at || !isAppointmentAtLeast24hAhead(payload.requested_starts_at)) {
      throw new Error(formatAppointmentLeadTimeMessage());
    }
    const { data, error } = await withTimeout(
      supabase.rpc('public_create_calendar_appointment_request', {
        p_payload: { ...payload, tenant_id: DEFAULT_TENANT_ID },
      }),
      'CriarAgendamento'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { public_token: string };
  },

};
