import { create } from 'zustand';
import type { Inspection, InspectionResponse } from '../types';
import { db } from '../db/database';

interface InspectionState {
  currentInspection: Inspection | null;
  responses: InspectionResponse[];
  setCurrentInspection: (inspection: Inspection) => void;
  setResponses: (responses: InspectionResponse[]) => void;
  updateResponse: (responseId: string, updates: Partial<InspectionResponse>) => Promise<boolean>;
  addResponse: (response: InspectionResponse) => Promise<boolean>;
  mergeResponses: (remoteResponses: InspectionResponse[]) => void;
  clearCurrentInspection: () => void;
}

export const useInspectionStore = create<InspectionState>((set) => ({
  currentInspection: null,
  responses: [],

  setCurrentInspection: (inspection) => set({ currentInspection: inspection }),

  setResponses: (responses) => set({ responses }),

  updateResponse: async (responseId, updates) => {
    try {
      const now = new Date();
      const existing = await db.responses.get(responseId);
      if (!existing) return false;

      const updatedRecord: InspectionResponse = {
        ...existing,
        ...updates,
        updatedAt: now,
        synced: 0 // Will be set to 1 by onlineUpsert if successful
      };

      // ✅ ONLINE-PRIMARY: Direct save to Cloud + Local Cache
      await db.onlineUpsert('responses', updatedRecord, db.responses);

      set((state) => ({
        responses: state.responses.map((r) =>
          r.id === responseId ? { ...r, ...updates, updatedAt: now, synced: 1 } : r
        ),
      }));

      return true;
    } catch (error) {
      console.error('Error saving response:', error);
      // We don't alert here because onlineUpsert already handles the "Cache-First" logic
      // and failure to cloud doesn't mean failure to save locally.
      return false;
    }
  },

  addResponse: async (response) => {
    try {
      await db.onlineUpsert('responses', response, db.responses);
      set((state) => ({
        responses: [...state.responses, { ...response, synced: 1 }]
      }));
      return true;
    } catch (error) {
      console.error('Error adding response:', error);
      return false;
    }
  },

  mergeResponses: (remoteResponses) => {
    set((state) => {
      const updated = [...state.responses];
      let hasChanges = false;

      for (const rr of remoteResponses) {
        const localIdx = updated.findIndex(r => r.id === rr.id);
        const local = updated[localIdx];
        
        // Safety check 1: Don't overwrite unsynced local changes
        if (local && local.synced === 0) continue;

        // Safety check 2: Compare timestamps robustly
        const serverUpdate = new Date(rr.updatedAt || rr.createdAt).getTime();
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;

        if (!local || serverUpdate > localUpdate + 1000) {
          if (localIdx >= 0) {
            updated[localIdx] = { ...updated[localIdx], ...rr, synced: 1 };
          } else {
            updated.push({ ...rr, synced: 1 });
          }
          hasChanges = true;
        }
      }

      return hasChanges ? { responses: updated } : state;
    });
  },

  clearCurrentInspection: () => set({ currentInspection: null, responses: [] }),
}));
