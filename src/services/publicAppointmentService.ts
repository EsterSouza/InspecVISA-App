import { supabase } from '../lib/supabase';
import type {
  AppointmentSlot,
  PublicAppointmentPayload,
  PublicAppointmentStatusResult,
  AppointmentAttachment,
} from '../types';

const DEFAULT_TENANT_ID = import.meta.env.VITE_DEFAULT_TENANT_ID as string;

export const publicAppointmentService = {

  async listAvailableSlots(): Promise<AppointmentSlot[]> {
    const { data, error } = await supabase.rpc('public_list_available_slots', {
      p_tenant_id: DEFAULT_TENANT_ID,
    });
    if (error) throw error;
    return (data ?? []) as AppointmentSlot[];
  },

  async createAppointmentRequest(
    payload: Omit<PublicAppointmentPayload, 'tenant_id'>
  ): Promise<{ public_token: string }> {
    const { data, error } = await supabase.rpc('public_create_appointment_request', {
      p_payload: { ...payload, tenant_id: DEFAULT_TENANT_ID },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { public_token: string };
  },

  async getAppointmentStatus(token: string): Promise<PublicAppointmentStatusResult> {
    const { data, error } = await supabase.rpc('public_get_appointment_status', {
      p_token: token,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as PublicAppointmentStatusResult;
  },

  async getAppointmentAssets(token: string): Promise<AppointmentAttachment[]> {
    const { data, error } = await supabase.rpc('public_get_appointment_assets', {
      p_token: token,
    });
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
