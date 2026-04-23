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
    set((state) => ({
      responses: state.responses.map((r) =>
        r.id === responseId ? { ...r, ...updates, updatedAt: new Date() } : r
      ),
    }));
    return true;
  },

  addResponse: async (response) => {
    set((state) => ({
      responses: [...state.responses, { ...response, updatedAt: new Date() }]
    }));
    return true;
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

        // Safety check 2: Compare timestamps
        const serverUpdate = new Date(rr.updatedAt || rr.createdAt).getTime();
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;

        if (!local || serverUpdate > localUpdate + 1000) {
          if (localIdx >= 0) {
            // CRITICAL PROTECTION: Only merge fields that are safe
            // We keep the local text if it exists and only overwrite if the server version is newer 
            // AND the local version is empty, OR if we are doing a manual sync (not handled here).
            // Actually, per user request, we STOP automatic text sync for fields with content.
            
            const mergedItem = { ...updated[localIdx] };
            
            // 1. Always sync the Result (the choice: complies/not_complies)
            mergedItem.result = rr.result;
            
            // 2. Sync text fields ONLY IF they are empty locally (prevent erasing)
            if (!mergedItem.situationDescription) mergedItem.situationDescription = rr.situationDescription;
            if (!mergedItem.correctiveAction) mergedItem.correctiveAction = rr.correctiveAction;
            if (!mergedItem.responsible) mergedItem.responsible = rr.responsible;
            if (!mergedItem.deadline) mergedItem.deadline = rr.deadline;

            // 3. PROTECT PHOTOS: Do not let an empty server array wipe local photos
            if ((!mergedItem.photos || mergedItem.photos.length === 0) && rr.photos && rr.photos.length > 0) {
              mergedItem.photos = rr.photos;
            }
            // If the incoming rr.photos is empty (placeholder from sync), KEEP the local photos
            if (rr.photos && rr.photos.length === 0 && mergedItem.photos && mergedItem.photos.length > 0) {
              // Do nothing, preserve mergedItem.photos
            }
            
            // 3. Update internal metadata
            mergedItem.updatedAt = new Date(serverUpdate);
            mergedItem.synced = 1;
            
            updated[localIdx] = mergedItem;
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
