import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConsultantRole = 'nutricao' | 'assistencia_social' | 'ambos' | 'saude';

export interface Settings {
  name: string;
  professionalId: string;
  professionalIdLabel?: string;
  phone: string;
  consultantRole: ConsultantRole;
  theme?: 'light' | 'dark';
  logoDataUrl?: string;
  companyName?: string;
}

export type ConsultantProfile = 'ana' | 'ester';

interface SettingsState {
  settings: Settings;
  currentProfile: ConsultantProfile | null;
  profileSettings: Partial<Record<ConsultantProfile, Settings>>;
  updateSettings: (settings: Partial<Settings>) => void;
  replaceSettings: (settings: Settings) => void;
  replaceProfileSettings: (profile: ConsultantProfile, settings: Settings) => void;
  setConsultant: (consultant: 'ana' | 'ester') => void;
  clearData: () => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  name: '',
  professionalId: '',
  phone: '',
  consultantRole: 'nutricao',
  theme: 'light',
};

const CONSULTANT_DEFAULTS: Record<ConsultantProfile, Settings> = {
  ana: {
    ...DEFAULT_SETTINGS,
    name: 'Ana Roberta Ribeiro',
    professionalIdLabel: 'CRN/RJ',
    professionalId: '10324',
    phone: '(21) 99031-3823',
    consultantRole: 'nutricao',
  },
  ester: {
    ...DEFAULT_SETTINGS,
    name: 'Ester Caiafa',
    professionalIdLabel: 'COREN/RJ',
    professionalId: '759.561',
    phone: '(21) 99339-7315',
    consultantRole: 'saude',
  },
};

function detectProfile(settings?: Partial<Settings> | null): ConsultantProfile | null {
  if (!settings?.name) return null;
  if (settings.name === CONSULTANT_DEFAULTS.ana.name) return 'ana';
  if (settings.name === CONSULTANT_DEFAULTS.ester.name) return 'ester';
  if (settings.consultantRole === 'nutricao') return 'ana';
  if (settings.consultantRole === 'saude' || settings.consultantRole === 'assistencia_social') return 'ester';
  return null;
}

function normalizeSettings(settings: Partial<Settings> | undefined, profile?: ConsultantProfile | null): Settings {
  const defaults = profile ? CONSULTANT_DEFAULTS[profile] : DEFAULT_SETTINGS;
  return {
    ...defaults,
    ...settings,
    consultantRole: settings?.consultantRole || defaults.consultantRole,
    theme: settings?.theme || 'light',
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      currentProfile: null,
      profileSettings: {},
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
          profileSettings: state.currentProfile
            ? {
                ...state.profileSettings,
                [state.currentProfile]: { ...state.settings, ...newSettings },
              }
            : state.profileSettings,
        })),
      replaceSettings: (settings) => set((state) => {
        const profile = state.currentProfile || detectProfile(settings);
        const nextSettings = normalizeSettings(settings, profile);
        return {
          settings: nextSettings,
          currentProfile: profile,
          profileSettings: profile
            ? { ...state.profileSettings, [profile]: nextSettings }
            : state.profileSettings,
        };
      }),
      replaceProfileSettings: (profile, settings) => set((state) => {
        const nextSettings = normalizeSettings(settings, profile);
        return {
          settings: state.currentProfile === profile ? nextSettings : state.settings,
          profileSettings: { ...state.profileSettings, [profile]: nextSettings },
        };
      }),
      clearData: async () => {
        set({ settings: { ...DEFAULT_SETTINGS, consultantRole: 'ambos' }, currentProfile: null, profileSettings: {} });
      },
      setConsultant: (consultant) => {
        set((state) => {
          const previousProfile = state.currentProfile;
          const profileSettings = previousProfile
            ? { ...state.profileSettings, [previousProfile]: state.settings }
            : state.profileSettings;
          const savedSettings = profileSettings[consultant];
          const nextSettings = normalizeSettings(savedSettings, consultant);
          return {
            settings: nextSettings,
            currentProfile: consultant,
            profileSettings: { ...profileSettings, [consultant]: nextSettings },
          };
        });
      },
    }),
    {
      name: 'inspec-visa-settings',
      version: 3,
      // Auto-migrate legacy stored data: split "COREN/RJ 759.561" into label + number
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          const s = (persistedState as any)?.settings;
          if (s?.professionalId && !s.professionalIdLabel) {
            // Pattern: "LABEL NUMBER" e.g. "COREN/RJ 759.561" or "CRN/RJ 10324"
            const match = s.professionalId.match(/^([A-Z]+\/[A-Z]+)\s+(.+)$/);
            if (match) {
              s.professionalIdLabel = match[1]; // "COREN/RJ"
              s.professionalId = match[2];      // "759.561"
            }
          }
        }
        if (version < 3) {
          const state = persistedState as Partial<SettingsState>;
          const profile = detectProfile(state?.settings);
          return {
            ...state,
            currentProfile: profile,
            profileSettings: profile ? { [profile]: normalizeSettings(state?.settings, profile) } : {},
          };
        }
        return persistedState as any;
      },
    }
  )
);
