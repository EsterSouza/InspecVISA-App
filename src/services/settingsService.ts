import { supabase } from '../lib/supabase';
import type { Settings } from '../store/useSettingsStore';

const SETTINGS_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), SETTINGS_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function cleanSettings(value: unknown): Settings | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Settings>;
  return {
    name: raw.name || '',
    professionalId: raw.professionalId || '',
    professionalIdLabel: raw.professionalIdLabel || undefined,
    phone: raw.phone || '',
    consultantRole: raw.consultantRole || 'ambos',
    theme: raw.theme || 'light',
    logoDataUrl: raw.logoDataUrl || undefined,
    companyName: raw.companyName || undefined,
  };
}

export const SettingsService = {
  async load(): Promise<Settings | null> {
    const { data: userData, error: userError } = await withTimeout(
      supabase.auth.getUser(),
      'UsuarioConfiguracoes'
    );
    if (userError || !userData.user) return null;

    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('consultant_settings')
        .eq('id', userData.user.id)
        .maybeSingle(),
      'CarregarConfiguracoes'
    );
    if (error) throw error;
    return cleanSettings(data?.consultant_settings);
  },

  async save(settings: Settings): Promise<void> {
    const { data: userData, error: userError } = await withTimeout(
      supabase.auth.getUser(),
      'UsuarioConfiguracoes'
    );
    if (userError) throw userError;
    if (!userData.user) throw new Error('Usuario nao autenticado.');

    const now = new Date().toISOString();
    const { error } = await withTimeout(
      supabase
        .from('profiles')
        .upsert({
          id: userData.user.id,
          full_name: settings.name || userData.user.email || 'Consultor',
          consultant_settings: settings,
          updated_at: now,
        }, { onConflict: 'id' }),
      'SalvarConfiguracoes'
    );
    if (error) throw error;
  },
};
