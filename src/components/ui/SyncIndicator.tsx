import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, CloudOff, RefreshCw, XCircle } from 'lucide-react';

type SyncSummary = {
  pending: number;
  syncing: number;
  conflict: number;
  failed: number;
};

type SyncIndicatorProps = {
  compact?: boolean;
};

const emptySummary: SyncSummary = {
  pending: 0,
  syncing: 0,
  conflict: 0,
  failed: 0,
};

async function loadSyncQueueService() {
  return import('../../services/syncQueueService').then((module) => module.SyncQueueService);
}

export function SyncIndicator({ compact = false }: SyncIndicatorProps) {
  const [summary, setSummary] = useState<SyncSummary>(emptySummary);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const refresh = async () => {
      if (!navigator.onLine) return;
      try {
        const service = await loadSyncQueueService();
        if (!isMounted) return;
        setSummary(service.getCachedSummary());
        unsubscribe ??= service.subscribeSummary((next) => {
          if (isMounted) setSummary(next);
        });
        const latest = await service.getQueueSummary();
        if (isMounted) setSummary(latest);
      } catch (err) {
        console.warn('[SyncIndicator] Summary refresh failed:', err);
      }
    };

    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) void refresh();
    };

    const interval = window.setInterval(refresh, 15000);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    void refresh();

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      unsubscribe?.();
    };
  }, []);

  const retryFailed = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const service = await loadSyncQueueService();
    await service.retryFailed();
  };

  if (!isOnline) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-default bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-navy-3">
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{compact ? 'Offline' : 'Modo offline'}</span>
      </div>
    );
  }

  if (summary.conflict > 0) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-amber-soft-border bg-amber-soft px-2 py-1 text-[11px] font-semibold text-amber-soft-ink">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{summary.conflict} conflito{summary.conflict > 1 ? 's' : ''}</span>
      </div>
    );
  }

  if (summary.failed > 0) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-danger-soft-border bg-danger-soft px-2 py-1 text-[11px] font-semibold text-danger-soft-ink">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{summary.failed} erro{summary.failed > 1 ? 's' : ''}</span>
        {!compact && (
          <button type="button" onClick={retryFailed} className="ml-1 underline underline-offset-2 hover:text-danger-soft-ink">
            tentar
          </button>
        )}
      </div>
    );
  }

  if (summary.syncing > 0 || summary.pending > 0) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-secondary-200 bg-secondary-50 px-2 py-1 text-[11px] font-semibold text-secondary-700">
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span className="truncate">Sync {summary.pending + summary.syncing}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-success-soft-border bg-success-soft px-2 py-1 text-[11px] font-semibold text-success-soft-ink">
      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{compact ? 'OK' : 'Nuvem OK'}</span>
    </div>
  );
}
