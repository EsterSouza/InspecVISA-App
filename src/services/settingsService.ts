import { supabase } from '../lib/supabase';
import type { ConsultantProfile, Settings } from '../store/useSettingsStore';

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

function getProfileSettings(value: unknown, profile: ConsultantProfile): Settings | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { byProfile?: Partial<Record<ConsultantProfile, unknown>> };
  const scoped = cleanSettings(raw.byProfile?.[profile]);
  if (scoped?.name) return scoped;

  const legacy = cleanSettings(value);
  if (!legacy?.name) return null;
  if (profile === 'ana' && (legacy.name === 'Ana Roberta Ribeiro' || legacy.consultantRole === 'nutricao')) {
    return legacy;
  }
  if (profile === 'ester' && (legacy.name === 'Ester Caiafa' || legacy.consultantRole === 'saude')) {
    return legacy;
  }
  return null;
}

export const SettingsService = {
  async load(profile?: ConsultantProfile | null): Promise<Settings | null> {
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
    return profile
      ? getProfileSettings(data?.consultant_settings, profile)
      : cleanSettings(data?.consultant_settings);
  },

  async save(settings: Settings, profile?: ConsultantProfile | null): Promise<void> {
    const { data: userData, error: userError } = await withTimeout(
      supabase.auth.getUser(),
      'UsuarioConfiguracoes'
    );
    if (userError) throw userError;
    if (!userData.user) throw new Error('Usuario nao autenticado.');

    let consultantSettings: unknown = settings;
    if (profile) {
      const { data, error: loadError } = await withTimeout(
        supabase
          .from('profiles')
          .select('consultant_settings')
          .eq('id', userData.user.id)
          .maybeSingle(),
        'CarregarConfiguracoes'
      );
      if (loadError) throw loadError;
      const current = data?.consultant_settings && typeof data.consultant_settings === 'object'
        ? data.consultant_settings as { byProfile?: Partial<Record<ConsultantProfile, unknown>> }
        : {};
      consultantSettings = {
        ...current,
        byProfile: {
          ...(current.byProfile || {}),
          [profile]: settings,
        },
        currentProfile: profile,
      };
    }

    const now = new Date().toISOString();
    const { error } = await withTimeout(
      supabase
        .from('profiles')
        .upsert({
          id: userData.user.id,
          full_name: settings.name || userData.user.email || 'Consultor',
          consultant_settings: consultantSettings,
          updated_at: now,
        }, { onConflict: 'id' }),
      'SalvarConfiguracoes'
    );
    if (error) throw error;
  },
};
