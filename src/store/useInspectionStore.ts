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
      
      // 1. OPTIMISTIC UPDATE: Update Zustand state IMMEDIATELY
      set((state) => ({
        responses: state.responses.map((r) =>
          r.id === responseId ? { ...r, ...updates, updatedAt: now, synced: 0 } : r
        ),
      }));

      // 2. BACKGROUND SAVE: Persist to DB/Cloud without blocking UI
      const existing = await db.responses.get(responseId);
      if (existing) {
        const updatedRecord: InspectionResponse = {
          ...existing,
          ...updates,
          updatedAt: now,
          synced: 0
        };
        
        db.onlineUpsert('responses', updatedRecord, db.responses).then((res) => {
          if (res.synced === 1) {
             set((state) => ({
               responses: state.responses.map(r => r.id === responseId ? { ...r, synced: 1 } : r)
             }));
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Error in optimistic update:', error);
      return false;
    }
  },

  addResponse: async (response) => {
    try {
      // 1. OPTIMISTIC UPDATE: Update UI first
      set((state) => ({
        responses: [...state.responses, { ...response, synced: 0 }]
      }));

      // 2. BACKGROUND SAVE
      db.onlineUpsert('responses', response, db.responses).then((res) => {
        if (res.synced === 1) {
          set((state) => ({
            responses: state.responses.map(r => r.id === response.id ? { ...r, synced: 1 } : r)
          }));
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error in optimistic add:', error);
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
