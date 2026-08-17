import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastItem } from '../../store/useToastStore';
import { cn } from '../../lib/utils';

const VARIANT_STYLES: Record<ToastItem['variant'], string> = {
  default: 'border-default bg-surface text-navy',
  success: 'border-success-soft-border bg-success-soft text-success-soft-ink',
  danger: 'border-danger-soft-border bg-danger-soft text-danger-soft-ink',
  warning: 'border-amber-soft-border bg-amber-soft text-amber-soft-ink',
};

const VARIANT_ICONS: Record<ToastItem['variant'], React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  danger: XCircle,
  warning: AlertTriangle,
};

function Toast({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = VARIANT_ICONS[toast.variant];

  useEffect(() => {
    if (toast.duration === null) return; // erro: só fecha no clique.
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
        VARIANT_STYLES[toast.variant]
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm opacity-90">{toast.description}</p>}
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        className="shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}
