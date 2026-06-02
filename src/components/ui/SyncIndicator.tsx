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
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-500">
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{compact ? 'Offline' : 'Modo offline'}</span>
      </div>
    );
  }

  if (summary.conflict > 0) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{summary.conflict} conflito{summary.conflict > 1 ? 's' : ''}</span>
      </div>
    );
  }

  if (summary.failed > 0) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{summary.failed} erro{summary.failed > 1 ? 's' : ''}</span>
        {!compact && (
          <button type="button" onClick={retryFailed} className="ml-1 underline underline-offset-2 hover:text-red-900">
            tentar
          </button>
        )}
      </div>
    );
  }

  if (summary.syncing > 0 || summary.pending > 0) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span className="truncate">Sync {summary.pending + summary.syncing}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{compact ? 'OK' : 'Nuvem OK'}</span>
    </div>
  );
}
