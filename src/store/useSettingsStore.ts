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

interface SettingsState {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  setConsultant: (consultant: 'ana' | 'ester') => void;
  clearData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        name: '',
        professionalId: '',
        phone: '',
        consultantRole: 'nutricao',
        theme: 'light',
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      clearData: async () => {
        set({ settings: { name: '', theme: 'light', consultantRole: 'ambos', professionalId: '', phone: '' } });
      },
      setConsultant: (consultant) => {
        if (consultant === 'ana') {
          // Merge into existing settings to preserve logoDataUrl, companyName, etc.
          set((state) => ({
            settings: {
              ...state.settings,
              name: 'Ana Roberta Ribeiro',
              professionalIdLabel: 'CRN/RJ',
              professionalId: '10324',
              phone: '(21) 99031-3823',
              consultantRole: 'nutricao' as const,
            },
          }));
        } else if (consultant === 'ester') {
          set((state) => ({
            settings: {
              ...state.settings,
              name: 'Ester Caiafa',
              professionalIdLabel: 'COREN/RJ',
              professionalId: '759.561',
              phone: '(21) 99339-7315',
              consultantRole: 'saude' as const,
            },
          }));
        }
      },
    }),
    {
      name: 'inspec-visa-settings',
      version: 2,
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
        return persistedState as any;
      },
    }
  )
);
