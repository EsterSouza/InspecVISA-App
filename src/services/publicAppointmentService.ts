import { supabase } from '../lib/supabase';
import type {
  AppointmentSlot,
  PublicAppointmentPayload,
  PublicAppointmentStatusResult,
  AppointmentAttachment,
  PublicAvailableTime,
  PublicCalendarDay,
  PublicClientSuggestion,
} from '../types';

const DEFAULT_TENANT_ID = import.meta.env.VITE_DEFAULT_TENANT_ID as string;
const REQUEST_TIMEOUT_MS = 15000;

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
  async listCalendarDays(startDate?: string): Promise<PublicCalendarDay[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_list_calendar_days', {
        p_tenant_id: DEFAULT_TENANT_ID,
        p_start_date: startDate || new Date().toISOString().split('T')[0],
        p_days: 45,
      }),
      'CalendarioPublico'
    );
    if (error) throw error;
    return (data ?? []) as PublicCalendarDay[];
  },

  async listAvailableTimes(day: string): Promise<PublicAvailableTime[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_list_available_times', {
        p_tenant_id: DEFAULT_TENANT_ID,
        p_day: day,
      }),
      'HorariosPublicos'
    );
    if (error) throw error;
    return (data ?? []) as PublicAvailableTime[];
  },

  async searchClients(query: string): Promise<PublicClientSuggestion[]> {
    if (query.trim().length < 2) return [];
    const { data, error } = await withTimeout(
      supabase.rpc('public_search_clients', {
        p_tenant_id: DEFAULT_TENANT_ID,
        p_query: query,
      }),
      'BuscaClientes'
    );
    if (error) throw error;
    return (data ?? []) as PublicClientSuggestion[];
  },

  async listAvailableSlots(): Promise<AppointmentSlot[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_list_available_slots', {
        p_tenant_id: DEFAULT_TENANT_ID,
      }),
      'SlotsPublicos'
    );
    if (error) throw error;
    return (data ?? []) as AppointmentSlot[];
  },

  async createAppointmentRequest(
    payload: Omit<PublicAppointmentPayload, 'tenant_id'>
  ): Promise<{ public_token: string }> {
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

  async getAppointmentStatus(token: string): Promise<PublicAppointmentStatusResult> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_get_appointment_status', {
        p_token: token,
      }),
      'StatusAgendamento'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as PublicAppointmentStatusResult;
  },

  async getAppointmentAssets(token: string): Promise<AppointmentAttachment[]> {
    const { data, error } = await withTimeout(
      supabase.rpc('public_get_appointment_assets', {
        p_token: token,
      }),
      'AssetsAgendamento'
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    // Gerar signed URLs para cada asset
    const assets = (data?.assets ?? []) as AppointmentAttachment[];
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        try {
          const { data: urlData } = await supabase.storage
            .from(asset.storage_bucket)
            .createSignedUrl(asset.storage_path, 3600);
          return {
            ...asset,
            signed_url: urlData?.signedUrl ?? undefined,
            storage_path: '[redacted]', // nunca expor o path bruto na UI
          };
        } catch {
          return { ...asset, signed_url: undefined, storage_path: '[redacted]' };
        }
      })
    );

    return assetsWithUrls;
  },
};
