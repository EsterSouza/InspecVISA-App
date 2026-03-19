import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConsultantSettings } from '../types';

interface SettingsState {
  settings: ConsultantSettings;
  updateSettings: (newSettings: Partial<ConsultantSettings>) => void;
  clearData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        name: '',
        theme: 'light',
        consultantRole: 'ambos',
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      clearData: async () => {
        // Clear all indexeddb data in a real app this would call db.delete() + re-init
        set({ settings: { name: '', theme: 'light', consultantRole: 'ambos' } });
      },
    }),
    {
      name: 'inspecvisa-settings',
    }
  )
);
