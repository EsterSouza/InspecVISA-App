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
          set({
            settings: {
              name: 'Ana Carolina',
              professionalId: 'CRN/RJ 10324',
              phone: '(62) 99999-9999',
              consultantRole: 'nutricao',
              theme: 'light',
            },
          });
        } else if (consultant === 'ester') {
          set({
            settings: {
              name: 'Ester Souza',
              professionalId: 'COREN/RJ 5784',
              phone: '(62) 99999-9999',
              consultantRole: 'saude',
              theme: 'light',
            },
          });
        }
      },
    }),
    {
      name: 'inspec-visa-settings',
    }
  )
);
