import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'danger' | 'warning';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION = 4000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

function push(title: string, description: string | undefined, variant: ToastVariant, duration: number) {
  const id = crypto.randomUUID();
  useToastStore.setState((state) => ({
    toasts: [...state.toasts, { id, title, description, variant, duration }],
  }));
  return id;
}

export const toast = Object.assign(
  (title: string, description?: string) => push(title, description, 'default', DEFAULT_DURATION),
  {
    success: (title: string, description?: string) => push(title, description, 'success', DEFAULT_DURATION),
    error: (title: string, description?: string) => push(title, description, 'danger', DEFAULT_DURATION),
    warning: (title: string, description?: string) => push(title, description, 'warning', DEFAULT_DURATION),
    dismiss: (id: string) => useToastStore.getState().dismiss(id),
  }
);
