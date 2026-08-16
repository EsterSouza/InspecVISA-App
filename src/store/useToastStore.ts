import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'danger' | 'warning';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** `null` = não some sozinho (erro — decisão 6 do FE-01/HANDOFF-FRONTEND.md). */
  duration: number | null;
}

interface ToastState {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

const SUCCESS_DURATION = 4000;
const WARNING_DURATION = 6000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

function push(title: string, description: string | undefined, variant: ToastVariant, duration: number | null) {
  const id = crypto.randomUUID();
  useToastStore.setState((state) => ({
    toasts: [...state.toasts, { id, title, description, variant, duration }],
  }));
  return id;
}

export const toast = Object.assign(
  (title: string, description?: string) => push(title, description, 'default', SUCCESS_DURATION),
  {
    success: (title: string, description?: string) => push(title, description, 'success', SUCCESS_DURATION),
    // Erro não some sozinho — só some quando a consultora clica em fechar.
    error: (title: string, description?: string) => push(title, description, 'danger', null),
    warning: (title: string, description?: string) => push(title, description, 'warning', WARNING_DURATION),
    dismiss: (id: string) => useToastStore.getState().dismiss(id),
  }
);
