import React, { useEffect, useState } from 'react';
import { SyncQueueService } from '../../services/syncQueueService';
import { RefreshCw, CheckCircle, AlertTriangle, CloudOff, XCircle } from 'lucide-react';

export const SyncIndicator: React.FC = () => {
  const [summary, setSummary] = useState({
    pending: 0,
    syncing: 0,
    conflict: 0,
    failed: 0
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = async () => {
      const s = await SyncQueueService.getQueueSummary();
      setSummary(s);
    };

    const interval = setInterval(update, 5000);
    const handleStatusChange = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    update();

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full text-xs font-medium animate-pulse">
        <CloudOff size={14} />
        <span>Modo Offline</span>
      </div>
    );
  }

  if (summary.conflict > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
        <AlertTriangle size={14} />
        <span>{summary.conflict} Conflito{summary.conflict > 1 ? 's' : ''}</span>
      </div>
    );
  }

  if (summary.failed > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium border border-red-200">
        <XCircle size={14} />
        <span>{summary.failed} Erro{summary.failed > 1 ? 's' : ''} — tentativa manual necessária</span>
        <button 
          onClick={() => SyncQueueService.retryFailed()}
          className="ml-1 underline hover:text-red-900 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (summary.syncing > 0 || summary.pending > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium border border-blue-100">
        <RefreshCw size={14} className="animate-spin" />
        <span>Sincronizando {summary.pending + summary.syncing}...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium border border-emerald-100">
      <CheckCircle size={14} />
      <span>Nuvem atualizada</span>
    </div>
  );
};
