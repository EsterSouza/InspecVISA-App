import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Cloud, Image, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { SyncQueueService } from '../../services/syncQueueService';
import { getInspectionIntegrity, type InspectionIntegrityResult } from '../../utils/syncCheck';
import type { SyncStatus } from '../../types';

interface InspectionIntegrityPanelProps {
  inspectionId: string;
}

export function InspectionIntegrityPanel({ inspectionId }: InspectionIntegrityPanelProps) {
  const [integrity, setIntegrity] = useState<InspectionIntegrityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const refresh = async () => {
    try {
      const result = await getInspectionIntegrity(inspectionId);
      setIntegrity(result);
    } catch (err) {
      console.warn('[IntegrityPanel] Failed to load inspection integrity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [inspectionId]);

  const retry = async () => {
    setRetrying(true);
    try {
      await SyncQueueService.retryFailed();
      await SyncQueueService.processAll();
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  const keepLocalConflicts = async () => {
    const ok = window.confirm('Manter a versão local e reenviar para a nuvem? A versão remota conflitante continuará registrada localmente como referência técnica.');
    if (!ok) return;

    setRetrying(true);
    try {
      await SyncQueueService.keepLocalConflictsForInspection(inspectionId);
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  if (loading && !integrity) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Verificando integridade...
        </CardContent>
      </Card>
    );
  }

  if (!integrity) return null;

  const totalOpen = integrity.pendingCount + integrity.failedCount + integrity.conflictCount;
  const statusTone = integrity.conflictCount > 0
    ? 'border-amber-200 bg-amber-50'
    : totalOpen > 0
      ? 'border-blue-100 bg-blue-50'
      : 'border-emerald-100 bg-emerald-50';

  return (
    <Card className={statusTone}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 p-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            {totalOpen === 0 ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            Integridade da inspeção
          </CardTitle>
          <p className="mt-1 text-xs text-gray-600">
            {integrity.lastSyncConfirmedAt
              ? `Ultimo sync confirmado: ${integrity.lastSyncConfirmedAt.toLocaleString('pt-BR')}`
              : 'Sem sync confirmado para todos os dados desta inspeção.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {integrity.conflictCount > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={keepLocalConflicts} disabled={retrying}>
              Manter local
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={retry} disabled={retrying}>
            <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
            Tentar sync
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="Pendentes" value={integrity.pendingCount} tone="blue" />
          <Metric label="Falhas" value={integrity.failedCount} tone="red" />
          <Metric label="Conflitos" value={integrity.conflictCount} tone="amber" />
          <Metric label="Fotos" value={integrity.photoCount} tone="gray" icon={<Image className="h-3.5 w-3.5" />} />
          <Metric label="Fotos pend." value={integrity.pendingPhotoCount} tone="blue" />
        </div>

        {integrity.issues.length > 0 ? (
          <div className="space-y-2">
            {integrity.issues.slice(0, 6).map(issue => (
              <div key={`${issue.table}:${issue.id}`} className="rounded-md border border-white/70 bg-white p-3 text-xs shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">{issue.label}</p>
                    <p className="mt-0.5 text-gray-500">{issue.table} • {issue.updatedAt?.toLocaleString('pt-BR') || 'sem data'}</p>
                    {issue.syncError && <p className="mt-1 text-red-600">{issue.syncError}</p>}
                  </div>
                  <StatusBadge status={issue.status} hasRemoteConflict={issue.hasRemoteConflict} />
                </div>
              </div>
            ))}
            {integrity.issues.length > 6 && (
              <p className="text-xs font-medium text-gray-500">
                +{integrity.issues.length - 6} item(ns) com status aberto.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-white p-3 text-xs text-emerald-700">
            <Cloud className="h-4 w-4" />
            Respostas, fotos e dados gerais estão sincronizados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone, icon }: { label: string; value: number; tone: 'blue' | 'red' | 'amber' | 'gray'; icon?: React.ReactNode }) {
  const toneClass = {
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    gray: 'bg-gray-100 text-gray-800'
  }[tone];

  return (
    <div className={`rounded-md px-3 py-2 ${toneClass}`}>
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-black leading-none">{value}</div>
    </div>
  );
}

function StatusBadge({ status, hasRemoteConflict }: { status: SyncStatus; hasRemoteConflict?: boolean }) {
  if (status === 'conflict') {
    return <Badge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" />Conflito</Badge>;
  }

  if (status === 'failed') {
    return <Badge variant="danger"><XCircle className="mr-1 h-3 w-3" />Falha</Badge>;
  }

  if (status === 'syncing') {
    return <Badge variant="default"><RefreshCw className="mr-1 h-3 w-3 animate-spin" />Sync</Badge>;
  }

  return <Badge variant={hasRemoteConflict ? 'warning' : 'outline'}>{status}</Badge>;
}
