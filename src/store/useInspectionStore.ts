import { create } from 'zustand';
import type { Inspection, InspectionResponse } from '../types';

interface InspectionState {
  currentInspection: Inspection | null;
  responses: InspectionResponse[];
  setCurrentInspection: (inspection: Inspection) => void;
  setResponses: (responses: InspectionResponse[]) => void;
  updateResponse: (responseId: string, updates: Partial<InspectionResponse>) => void;
  clearCurrentInspection: () => void;
}

export const useInspectionStore = create<InspectionState>((set) => ({
  currentInspection: null,
  responses: [],
  
  setCurrentInspection: (inspection) => set({ currentInspection: inspection }),
  
  setResponses: (responses) => set({ responses }),
  
  updateResponse: (responseId, updates) =>
    set((state) => ({
      responses: state.responses.map((r) =>
        r.id === responseId ? { ...r, ...updates, updatedAt: new Date() } : r
      ),
    })),
    
  clearCurrentInspection: () => set({ currentInspection: null, responses: [] }),
}));
