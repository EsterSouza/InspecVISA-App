import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Cloud, Eye, Image, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { SyncQueueService } from '../../services/syncQueueService';
import {
  getInspectionIntegrity,
  type InspectionIntegrityResult,
  type IntegrityIssue,
  type PhotoIntegrity
} from '../../utils/syncCheck';
import type { SyncStatus } from '../../types';

interface InspectionIntegrityPanelProps {
  inspectionId: string;
}

export function InspectionIntegrityPanel({ inspectionId }: InspectionIntegrityPanelProps) {
  const [integrity, setIntegrity] = useState<InspectionIntegrityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IntegrityIssue | null>(null);

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
    const ok = window.confirm('Manter todas as versoes locais em conflito e reenviar para a nuvem?');
    if (!ok) return;

    setRetrying(true);
    try {
      await SyncQueueService.keepLocalConflictsForInspection(inspectionId);
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  const keepLocalIssue = async (issue: IntegrityIssue) => {
    setRetrying(true);
    try {
      await SyncQueueService.keepLocalConflict(issue.table, issue.id);
      setSelectedIssue(null);
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  const applyRemoteIssue = async (issue: IntegrityIssue) => {
    const ok = window.confirm('Aplicar a versao remota neste item? A versao local atual ficara preservada como referencia tecnica local.');
    if (!ok) return;

    setRetrying(true);
    try {
      await SyncQueueService.applyRemoteConflict(issue.table, issue.id);
      setSelectedIssue(null);
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  const retryPhoto = async (photo: PhotoIntegrity) => {
    setRetrying(true);
    try {
      await SyncQueueService.retryItem('photos', photo.id);
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
            Integridade da inspecao
          </CardTitle>
          <p className="mt-1 text-xs text-gray-600">
            {integrity.lastSyncConfirmedAt
              ? `Ultimo sync confirmado: ${integrity.lastSyncConfirmedAt.toLocaleString('pt-BR')}`
              : 'Sem sync confirmado para todos os dados desta inspecao.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {integrity.conflictCount > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={keepLocalConflicts} disabled={retrying}>
              Manter locais
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
              <IssueRow key={`${issue.table}:${issue.id}`} issue={issue} onInspect={setSelectedIssue} />
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
            Respostas, fotos e dados gerais estao sincronizados.
          </div>
        )}

        {integrity.photos.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase text-gray-500">Fotos da inspecao</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {integrity.photos.map(photo => (
                <PhotoTile key={photo.id} photo={photo} retrying={retrying} onRetry={retryPhoto} />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Modal
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        title="Resolver conflito"
        className="max-w-3xl"
        footer={selectedIssue && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => keepLocalIssue(selectedIssue)} disabled={retrying}>
              Manter local
            </Button>
            <Button type="button" onClick={() => applyRemoteIssue(selectedIssue)} disabled={retrying || !selectedIssue.conflictRemote}>
              Aplicar remoto
            </Button>
          </div>
        )}
      >
        {selectedIssue && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-gray-900">{selectedIssue.label}</p>
              <p className="mt-1 text-xs text-gray-500">{selectedIssue.table} - {selectedIssue.updatedAt?.toLocaleString('pt-BR') || 'sem data local'}</p>
              {(selectedIssue.localActorId || selectedIssue.remoteActorId) && (
                <p className="mt-1 text-xs text-gray-500">
                  Local: {formatActor(selectedIssue.localActorId)} / Remoto: {formatActor(selectedIssue.remoteActorId)}
                </p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ConflictSnapshot title="Local preservado" value={selectedIssue.conflictLocal} fallback="Sem snapshot local detalhado." />
              <ConflictSnapshot title="Remoto recebido" value={selectedIssue.conflictRemote} fallback="Sem snapshot remoto detalhado." />
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function IssueRow({ issue, onInspect }: { issue: IntegrityIssue; onInspect: (issue: IntegrityIssue) => void }) {
  return (
    <div className="rounded-md border border-white/70 bg-white p-3 text-xs shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-800">{issue.label}</p>
          <p className="mt-0.5 text-gray-500">{issue.table} - {issue.updatedAt?.toLocaleString('pt-BR') || 'sem data'}</p>
          {issue.localActorId && <p className="mt-0.5 text-gray-500">Local: {formatActor(issue.localActorId)}</p>}
          {issue.remoteActorId && <p className="mt-0.5 text-gray-500">Remoto: {formatActor(issue.remoteActorId)}</p>}
          {issue.syncError && <p className="mt-1 text-red-600">{issue.syncError}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {issue.status === 'conflict' && (
            <button
              type="button"
              onClick={() => onInspect(issue)}
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              title="Ver conflito"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          <StatusBadge status={issue.status} hasRemoteConflict={issue.hasRemoteConflict} />
        </div>
      </div>
    </div>
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

function PhotoTile({ photo, retrying, onRetry }: { photo: PhotoIntegrity; retrying: boolean; onRetry: (photo: PhotoIntegrity) => void }) {
  return (
    <div className="overflow-hidden rounded-md border border-white/70 bg-white shadow-sm">
      <div className="relative aspect-square bg-gray-100">
        <img src={photo.dataUrl} alt="Evidencia" className="h-full w-full object-cover" />
        <div className="absolute left-1 top-1">
          <StatusBadge status={photo.status} />
        </div>
      </div>
      {photo.status !== 'synced' && (
        <button
          type="button"
          onClick={() => onRetry(photo)}
          disabled={retrying}
          className="flex w-full items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase text-primary-700 hover:bg-primary-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
          Retry
        </button>
      )}
    </div>
  );
}

function ConflictSnapshot({ title, value, fallback }: { title: string; value: any; fallback: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-xs font-bold uppercase text-gray-500">{title}</p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-3 text-[11px] leading-relaxed text-gray-700">
        {value ? formatConflictValue(value) : fallback}
      </pre>
    </div>
  );
}

function formatConflictValue(value: any) {
  const clone = { ...value };
  if (clone.dataUrl) clone.dataUrl = `[imagem base64: ${String(value.dataUrl).length} chars]`;
  if (clone.conflictRemote) clone.conflictRemote = '[snapshot remoto omitido]';
  if (clone.conflictLocal) clone.conflictLocal = '[snapshot local omitido]';
  return JSON.stringify(clone, null, 2);
}

function formatActor(actorId?: string) {
  if (!actorId) return 'desconhecido';
  return actorId.replace(/^profile:/, '').replace(/^auth:/, '');
}
