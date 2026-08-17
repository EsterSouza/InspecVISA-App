import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../db/database';
import { SyncQueueService } from '../services/syncQueueService';
import { InspectionService } from '../services/inspectionService';
import { exportDatabase } from '../utils/backup';
import { cn } from '../lib/utils';
import { toast } from '../store/useToastStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle,
  Download, Wifi, WifiOff, RotateCcw, Play, Trash2, Activity, Lock,
} from 'lucide-react';

/**
 * FE-18 — a fila que falhou nunca some sozinha (docs/HANDOFF-FRONTEND.md § FE-18).
 * A linha do tempo carrega o estado em três canais: cor de fundo da marca, forma do
 * traço que liga os eventos (tracejado só na fila) e a palavra escrita — nenhum deles
 * sozinho. Descartar um envio (hoje só fotos, o único caso sem ambiguidade sobre o que
 * se perde) abre o ConfirmDialog com a lista de consequências.
 */

type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
type TableName = 'clients' | 'inspections' | 'responses' | 'photos' | 'schedules';
type TimelineState = 'ok' | 'pendente' | 'atencao' | 'erro';

interface SyncItem {
  id: string;
  table: TableName;
  syncStatus: SyncStatus;
  syncAttempts: number;
  syncError?: string | null;
  label: string;
  sub?: string;
  hasStoragePath?: boolean;
  jobStatus?: 'queued' | 'processing';
  updatedAt: Date;
}

interface TableData {
  name: TableName;
  label: string;
  items: SyncItem[];
}

interface SyncSessionEvent {
  id: string;
  table: TableName;
  label: string;
  sub?: string;
  verifiedAt: Date;
}

interface TimelineEntry {
  id: string;
  state: TimelineState;
  when: Date;
  meta: string;
  title: string;
  detail?: string;
  item?: SyncItem;
}

const TABLE_LABELS: Record<TableName, [string, string]> = {
  clients: ['cliente', 'clientes'],
  inspections: ['inspeção', 'inspeções'],
  responses: ['resposta', 'respostas'],
  photos: ['foto', 'fotos'],
  schedules: ['agendamento', 'agendamentos'],
};

const STATE_WORD: Record<TimelineState, string> = {
  ok: 'Sincronizado',
  pendente: 'Na fila',
  atencao: 'Atenção',
  erro: 'Falhou',
};

const STATE_BADGE: Record<TimelineState, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ok: 'success',
  pendente: 'neutral',
  atencao: 'warning',
  erro: 'danger',
};

const STATE_MARK: Record<TimelineState, string> = {
  ok: 'border-green-200 bg-green-50 text-green-700',
  pendente: 'border-default bg-surface-sunken text-navy-3',
  atencao: 'border-amber-soft-border bg-amber-soft text-amber-soft-ink',
  erro: 'border-danger-soft-border bg-danger-soft text-danger-soft-ink',
};

const STATE_ICON: Record<TimelineState, React.FC<{ className?: string }>> = {
  ok: CheckCircle2,
  pendente: Clock,
  atencao: AlertTriangle,
  erro: XCircle,
};

const LEGEND_TEXT: Record<TimelineState, string> = {
  ok: 'está no servidor, marca sólida',
  pendente: 'traço tracejado até o próximo evento',
  atencao: 'foi, mas com ressalva',
  erro: 'exige decisão, nunca some sozinho',
};

function truncId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function jobStatusFromError(syncError?: string | null): SyncItem['jobStatus'] {
  if (!syncError?.startsWith('[sync-job:')) return undefined;
  return syncError.includes('processando') ? 'processing' : 'queued';
}

function countLabel(table: TableName, count: number) {
  const [singular, plural] = TABLE_LABELS[table];
  return `${count} ${count === 1 ? singular : plural}`;
}

function describeItem(item: SyncItem): string {
  switch (item.table) {
    case 'clients': return `o cliente ${item.label}`;
    case 'inspections': return `a inspeção de ${item.label}`;
    case 'responses': return `uma resposta da inspeção de ${item.label}`;
    case 'photos': return `uma foto da inspeção de ${item.label}`;
    case 'schedules': return `o agendamento de ${item.label}`;
  }
}

function batchTitle(table: TableName, label: string, count: number): string {
  switch (table) {
    case 'clients':
      return count === 1 ? `Cliente ${label} sincronizado` : `${count} clientes sincronizados`;
    case 'inspections':
      return count === 1 ? `Inspeção de ${label} sincronizada` : `${count} inspeções de ${label} sincronizadas`;
    case 'responses':
      return count === 1 ? `Resposta de ${label} enviada` : `${count} respostas de ${label} enviadas`;
    case 'photos':
      return count === 1 ? `Foto de ${label} enviada` : `${count} fotos de ${label} enviadas`;
    case 'schedules':
      return count === 1 ? `Agendamento de ${label} sincronizado` : `${count} agendamentos de ${label} sincronizados`;
  }
}

function photoDiscardConsequences(item: SyncItem): string[] {
  return [
    item.hasStoragePath
      ? `a foto${item.sub ? ` vinculada a ${item.sub}` : ''} — parte dela já chegou ao Storage; descartar propaga a remoção`
      : `a foto${item.sub ? ` vinculada a ${item.sub}` : ''}, que só existe neste aparelho`,
    'o vínculo dela com a resposta da inspeção',
    'se o relatório já foi publicado, ele passa a citar um arquivo ausente',
  ];
}

function timeHHMM(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(date: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function SyncCenter() {
  const [sessionStartedAt] = useState(() => new Date());
  const [tables, setTables] = useState<TableData[]>([]);
  const [summary, setSummary] = useState({ pending: 0, syncing: 0, failed: 0, conflict: 0 });
  const [sessionEvents, setSessionEvents] = useState<SyncSessionEvent[]>([]);
  const [indicators, setIndicators] = useState<{
    lastSyncedAt: Date | null;
    syncedTodayCount: number;
    syncedTodaySince: Date | null;
  }>({ lastSyncedAt: null, syncedTodayCount: 0, syncedTodaySince: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncLocked, setSyncLocked] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const FILTER = ['pending', 'syncing', 'failed', 'conflict'];

      const [rawClients, rawInspections, rawResponses, rawPhotos, rawSchedules] =
        await Promise.all([
          db.clients.where('syncStatus').anyOf(FILTER).toArray(),
          db.inspections.where('syncStatus').anyOf(FILTER).toArray(),
          db.responses.where('syncStatus').anyOf(FILTER).toArray(),
          db.photos.where('syncStatus').anyOf(FILTER).toArray(),
          db.schedules.where('syncStatus').anyOf(FILTER).toArray(),
        ]);

      const [allClients, allInspections, allResponses, allPhotos, allSchedules] = await Promise.all([
        db.clients.toArray(),
        db.inspections.toArray(),
        db.responses.toArray(),
        db.photos.toArray(),
        db.schedules.toArray(),
      ]);

      const clientName = new Map<string, string>(
        allClients.map(c => [c.id, (c as any).name ?? truncId(c.id)])
      );
      const inspClientName = new Map<string, string>(
        allInspections.map(i => [i.id, clientName.get((i as any).clientId) ?? truncId((i as any).clientId ?? i.id)])
      );
      const respInspId = new Map<string, string>(
        allResponses.map(r => [r.id, (r as any).inspectionId])
      );

      const mapItem = (
        raw: any,
        table: TableName,
        label: string,
        sub?: string,
        extra?: Partial<SyncItem>
      ): SyncItem => ({
        id: raw.id,
        table,
        syncStatus: raw.syncStatus,
        syncAttempts: raw.syncAttempts ?? 0,
        syncError: raw.syncError ?? null,
        jobStatus: jobStatusFromError(raw.syncError),
        label,
        sub,
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
        ...extra,
      });

      const clientItems = rawClients.map(c =>
        mapItem(c, 'clients', (c as any).name ?? truncId(c.id),
          [(c as any).city, (c as any).state].filter(Boolean).join(', ') || undefined)
      );

      const inspectionItems = rawInspections.map(i =>
        mapItem(i, 'inspections',
          clientName.get((i as any).clientId) ?? truncId((i as any).clientId ?? i.id),
          (i as any).inspectionDate
            ? new Date((i as any).inspectionDate).toLocaleDateString('pt-BR')
            : (i as any).status ?? undefined)
      );

      const responseItems = rawResponses.map(r =>
        mapItem(r, 'responses',
          inspClientName.get((r as any).inspectionId) ?? truncId((r as any).inspectionId ?? r.id),
          `Item: ${((r as any).itemId ?? '—').slice(0, 12)} | ${(r as any).result ?? '—'}`)
      );

      const photoItems = rawPhotos.map(p =>
        mapItem(p, 'photos',
          inspClientName.get(respInspId.get((p as any).responseId) ?? '') ?? '—',
          `Resp: ${truncId((p as any).responseId ?? '—')}`,
          { hasStoragePath: !!(p as any).storagePath })
      );

      const scheduleItems = rawSchedules.map(s =>
        mapItem(s, 'schedules',
          clientName.get((s as any).clientId) ?? truncId((s as any).clientId ?? s.id),
          (s as any).scheduledAt
            ? new Date((s as any).scheduledAt).toLocaleDateString('pt-BR')
            : (s as any).status ?? undefined)
      );

      const tableData: TableData[] = [
        { name: 'clients',     label: 'Clientes',     items: clientItems },
        { name: 'inspections', label: 'Inspeções',    items: inspectionItems },
        { name: 'responses',   label: 'Respostas',    items: responseItems },
        { name: 'photos',      label: 'Fotos',        items: photoItems },
        { name: 'schedules',   label: 'Agendamentos', items: scheduleItems },
      ];

      setTables(tableData);

      const total = { pending: 0, syncing: 0, failed: 0, conflict: 0 };
      tableData.forEach(t =>
        t.items.forEach(item => {
          if (item.syncStatus in total) total[item.syncStatus as keyof typeof total]++;
        })
      );
      setSummary(total);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      let lastSyncedAt: Date | null = null;
      let syncedTodayCount = 0;
      let syncedTodaySince: Date | null = null;
      [...allClients, ...allInspections, ...allResponses, ...allPhotos, ...allSchedules].forEach((raw: any) => {
        if (raw.syncStatus !== 'synced' || !raw.dataVerifiedAt) return;
        const verifiedAt = new Date(raw.dataVerifiedAt);
        if (Number.isNaN(verifiedAt.getTime())) return;
        if (!lastSyncedAt || verifiedAt > lastSyncedAt) lastSyncedAt = verifiedAt;
        if (verifiedAt >= startOfToday) {
          syncedTodayCount += 1;
          if (!syncedTodaySince || verifiedAt < syncedTodaySince) syncedTodaySince = verifiedAt;
        }
      });
      setIndicators({ lastSyncedAt, syncedTodayCount, syncedTodaySince });

      const eventFrom = (
        table: TableName,
        raw: any,
        label: string,
        sub?: string
      ): SyncSessionEvent | null => {
        if (!raw?.dataVerifiedAt || raw.syncStatus !== 'synced') return null;
        const verifiedAt = new Date(raw.dataVerifiedAt);
        if (Number.isNaN(verifiedAt.getTime()) || verifiedAt < sessionStartedAt) return null;
        return { id: `${table}-${raw.id}`, table, label, sub, verifiedAt };
      };

      const recentEvents = [
        ...allClients.map((c: any) => eventFrom(
          'clients',
          c,
          c.name ?? truncId(c.id),
          [c.city, c.state].filter(Boolean).join(', ') || undefined
        )),
        ...allInspections.map((i: any) => eventFrom(
          'inspections',
          i,
          clientName.get(i.clientId) ?? truncId(i.clientId ?? i.id),
          i.inspectionDate ? new Date(i.inspectionDate).toLocaleDateString('pt-BR') : i.status
        )),
        ...allResponses.map((r: any) => eventFrom(
          'responses',
          r,
          inspClientName.get(r.inspectionId) ?? truncId(r.inspectionId ?? r.id),
          `Item: ${String(r.itemId ?? '---').slice(0, 12)} | ${r.result ?? '---'}`
        )),
        ...allPhotos.map((p: any) => eventFrom(
          'photos',
          p,
          inspClientName.get(respInspId.get(p.responseId) ?? '') ?? 'Cliente',
          `Resp: ${truncId(p.responseId ?? '---')}`
        )),
        ...allSchedules.map((s: any) => eventFrom(
          'schedules',
          s,
          clientName.get(s.clientId) ?? truncId(s.clientId ?? s.id),
          s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString('pt-BR') : s.status
        )),
      ]
        .filter((event): event is SyncSessionEvent => Boolean(event))
        .sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime())
        .slice(0, 50);

      setSessionEvents(recentEvents);
    } catch (err) {
      console.error('[SyncCenter] loadData error:', err);
    } finally {
      setIsLoading(false);
      setSyncLocked(SyncQueueService.isLocked());
      setLastChecked(new Date());
    }
  }, [sessionStartedAt]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    const onOnline  = () => { setIsOnline(true);  loadData(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadData]);

  const runAction = async (key: string, fn: () => Promise<void>, successMsg: string) => {
    setActionLoading(key);
    try {
      await fn();
      toast.success(successMsg);
      await loadData();
    } catch (err) {
      toast.error('Não foi possível concluir', err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryAll = () =>
    runAction('retryAll', () => SyncQueueService.retryFailed(), 'Fila desbloqueada e sincronização iniciada.');

  const handleForceSync = () =>
    runAction('force', () => SyncQueueService.processAll(), 'Sincronização disparada.');

  const handleResetStuck = () =>
    runAction('reset', () => SyncQueueService.cleanupStuckSyncing(), 'Registros travados resetados para pendente.');

  const handleResetLock = () =>
    runAction('lock', async () => { SyncQueueService.resetLock(); }, 'Trava de sincronização liberada.');

  const handleExportBackup = () =>
    runAction('export', () => exportDatabase(), 'Backup exportado com sucesso.');

  const handleRetryItem = (item: SyncItem) =>
    runAction(`item-${item.id}`, async () => {
      if (item.table === 'inspections' || item.table === 'responses' || item.table === 'photos') {
        await SyncQueueService.retryItem(item.table, item.id);
      } else if (item.table === 'clients') {
        await db.clients.update(item.id, { syncStatus: 'pending', syncAttempts: 0, syncError: undefined });
        await SyncQueueService.processAll();
      } else if (item.table === 'schedules') {
        await db.schedules.update(item.id, { syncStatus: 'pending', syncAttempts: 0, syncError: undefined });
        await SyncQueueService.processAll();
      }
    }, 'Item reenviado.');

  const handleDiscardPhoto = async (item: SyncItem) => {
    const ok = await confirm({
      title: 'Descartar este envio?',
      description: 'Você perde:',
      consequences: photoDiscardConsequences(item),
      confirmLabel: 'Descartar envio',
      tone: 'danger',
    });
    if (!ok) return;

    const key = `discard-${item.id}`;
    setActionLoading(key);
    try {
      await InspectionService.deletePhoto(item.id);
      toast.warning('Envio descartado.');
      await loadData();
    } catch (err) {
      toast.error('Não foi possível descartar', err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const isBusy = !!actionLoading;
  const queueCount = summary.pending + summary.syncing;
  const failedCount = summary.failed + summary.conflict;

  const queueBreakdown = useMemo(() => {
    const counts: Partial<Record<TableName, number>> = {};
    let processing = 0;
    tables.forEach(t => t.items.forEach(item => {
      if (item.syncStatus === 'pending' || item.syncStatus === 'syncing') {
        counts[t.name] = (counts[t.name] ?? 0) + 1;
      }
      if (item.jobStatus === 'processing') processing += 1;
    }));
    const parts = (Object.entries(counts) as [TableName, number][])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([table, n]) => countLabel(table, n));
    if (processing > 0) parts.push(`${processing} em processamento no servidor`);
    return parts.join(' · ');
  }, [tables]);

  const failedBreakdown = useMemo(() => {
    const parts: string[] = [];
    if (summary.failed > 0) parts.push(`${summary.failed} erro${summary.failed > 1 ? 's' : ''}`);
    if (summary.conflict > 0) parts.push(`${summary.conflict} conflito${summary.conflict > 1 ? 's' : ''}`);
    return parts.join(' · ');
  }, [summary]);

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];

    tables.forEach(t => t.items.forEach(item => {
      if (item.syncStatus === 'failed') {
        entries.push({
          id: `failed-${item.id}`,
          state: 'erro',
          when: item.updatedAt,
          meta: `${timeHHMM(item.updatedAt)} · ${item.label}`,
          title: `Falhou ao enviar ${describeItem(item)}`,
          detail: item.syncError ?? undefined,
          item,
        });
      } else if (item.syncStatus === 'conflict') {
        entries.push({
          id: `conflict-${item.id}`,
          state: 'atencao',
          when: item.updatedAt,
          meta: `${timeHHMM(item.updatedAt)} · ${item.label}`,
          title: `Conflito de versão em ${describeItem(item)}`,
          detail: 'Uma versão diferente já está no servidor. Tentar novamente envia a versão deste aparelho por cima.',
          item,
        });
      }
    }));

    if (queueCount > 0) {
      const when = lastChecked ?? new Date();
      entries.push({
        id: 'queue',
        state: 'pendente',
        when,
        meta: `${timeHHMM(when)} · ${queueCount} ite${queueCount > 1 ? 'ns' : 'm'}`,
        title: isOnline ? 'Na fila, aguardando conexão estável' : 'Na fila — aparelho offline',
        detail: queueBreakdown || undefined,
      });
    }

    const batches = new Map<string, { table: TableName; label: string; when: Date; count: number }>();
    sessionEvents.forEach(ev => {
      const minuteKey = ev.verifiedAt.toISOString().slice(0, 16);
      const key = `${ev.table}|${ev.label}|${minuteKey}`;
      const existing = batches.get(key);
      if (existing) {
        existing.count += 1;
        if (ev.verifiedAt > existing.when) existing.when = ev.verifiedAt;
      } else {
        batches.set(key, { table: ev.table, label: ev.label, when: ev.verifiedAt, count: 1 });
      }
    });
    batches.forEach((batch, key) => {
      entries.push({
        id: `synced-${key}`,
        state: 'ok',
        when: batch.when,
        meta: `${timeHHMM(batch.when)} · ${countLabel(batch.table, batch.count)}`,
        title: batchTitle(batch.table, batch.label, batch.count),
      });
    });

    return entries.sort((a, b) => b.when.getTime() - a.when.getTime());
  }, [tables, sessionEvents, queueCount, queueBreakdown, lastChecked, isOnline]);

  return (
    <PageShell className="space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary-700" />
            Central de Sincronização
          </span>
        }
        description={
          lastChecked
            ? `Atualizado às ${timeHHMM(lastChecked)} — atualiza a cada 15s`
            : 'Carregando dados locais…'
        }
        actions={
          <>
            <span className={cn('flex items-center gap-1.5 text-sm font-medium', isOnline ? 'text-green-700' : 'text-danger')}>
              {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <Button onClick={handleForceSync} disabled={isBusy || !isOnline}>
              <RefreshCw className={cn('mr-1.5 h-4 w-4', actionLoading === 'force' && 'animate-spin')} />
              Sincronizar agora
            </Button>
          </>
        }
      />

      {syncLocked && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-soft-border bg-amber-soft px-4 py-3 text-sm text-amber-soft-ink">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            <strong>Sincronização travada</strong> — um ciclo anterior não terminou.
          </span>
          <Button variant="danger" size="sm" className="ml-auto" onClick={handleResetLock} disabled={isBusy}>
            <Lock className={cn('mr-1.5 h-3.5 w-3.5', actionLoading === 'lock' && 'animate-spin')} />
            Liberar trava
          </Button>
        </div>
      )}

      {/* Quatro indicadores */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-default bg-surface p-4">
          <p className="text-xs font-medium text-navy-3">Última sincronização</p>
          <p className="mt-1 text-xl font-bold text-navy">
            {indicators.lastSyncedAt ? timeHHMM(indicators.lastSyncedAt) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-navy-3">
            {indicators.lastSyncedAt ? timeAgo(indicators.lastSyncedAt) : 'ainda sem sincronização'}
          </p>
        </div>
        <div className="rounded-lg border border-default bg-surface p-4">
          <p className="text-xs font-medium text-navy-3">Na fila</p>
          <p className="mt-1 text-xl font-bold text-navy">{queueCount}</p>
          <p className="mt-0.5 text-xs text-navy-3">{queueBreakdown || 'fila vazia'}</p>
        </div>
        <div className={cn('rounded-lg border p-4', failedCount > 0 ? 'border-danger-soft-border bg-danger-soft' : 'border-default bg-surface')}>
          <p className={cn('text-xs font-medium', failedCount > 0 ? 'text-danger-soft-ink' : 'text-navy-3')}>Falharam</p>
          <p className={cn('mt-1 text-xl font-bold', failedCount > 0 ? 'text-danger-soft-ink' : 'text-navy')}>{failedCount}</p>
          <p className={cn('mt-0.5 text-xs', failedCount > 0 ? 'text-danger-soft-ink' : 'text-navy-3')}>
            {failedCount > 0 ? `${failedBreakdown} — precisa de decisão sua` : 'nenhuma pendência'}
          </p>
        </div>
        <div className="rounded-lg border border-default bg-surface p-4">
          <p className="text-xs font-medium text-navy-3">Enviados hoje</p>
          <p className="mt-1 text-xl font-bold text-navy">{indicators.syncedTodayCount}</p>
          <p className="mt-0.5 text-xs text-navy-3">
            {indicators.syncedTodayCount === 0
              ? 'nenhum envio hoje ainda'
              : failedCount === 0
                ? `sem erro desde ${indicators.syncedTodaySince ? timeHHMM(indicators.syncedTodaySince) : '—'}`
                : `${failedBreakdown} pendente de decisão`}
          </p>
        </div>
      </div>

      {/* Manutenção */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-default bg-surface-sunken px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-navy-3">Manutenção</span>
        <Button variant="outline" size="sm" onClick={handleRetryAll} disabled={isBusy || !isOnline}>
          <Play className={cn('mr-1.5 h-3.5 w-3.5', actionLoading === 'retryAll' && 'animate-pulse')} />
          Tentar tudo
        </Button>
        <Button variant="outline" size="sm" onClick={handleResetStuck} disabled={isBusy}>
          <RotateCcw className={cn('mr-1.5 h-3.5 w-3.5', actionLoading === 'reset' && 'animate-spin')} />
          Resetar travados
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportBackup} disabled={isBusy}>
          <Download className={cn('mr-1.5 h-3.5 w-3.5', actionLoading === 'export' && 'animate-pulse')} />
          Exportar backup
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Linha do tempo</CardTitle>
            <span className="text-xs text-navy-3">mais recente primeiro · nesta sessão</span>
          </CardHeader>
          <CardContent className="pt-0">
            {timeline.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8" />}
                title="Nada para mostrar ainda"
                description="Assim que algo for sincronizado, tentado ou falhar, aparece aqui."
              />
            ) : (
              <ol>
                {timeline.map((entry, idx) => {
                  const Icon = STATE_ICON[entry.state];
                  const isLast = idx === timeline.length - 1;
                  const retryKey = entry.item ? `item-${entry.item.id}` : undefined;
                  return (
                    <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute left-4 top-8 bottom-0 border-l-2',
                            entry.state === 'pendente' ? 'border-dashed border-control' : 'border-solid border-default'
                          )}
                        />
                      )}
                      <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border', STATE_MARK[entry.state])}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-xs text-navy-3 tabular-nums">{entry.meta}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                          {entry.title}
                          <Badge variant={STATE_BADGE[entry.state]}>{STATE_WORD[entry.state]}</Badge>
                        </p>
                        {entry.detail && <p className="mt-1 break-words text-xs text-navy-3">{entry.detail}</p>}
                        {!!entry.item?.syncAttempts && (
                          <p className="mt-0.5 text-xs text-navy-3">Tentativas: {entry.item.syncAttempts}</p>
                        )}
                        {(entry.state === 'erro' || entry.state === 'atencao') && entry.item && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryItem(entry.item!)}
                              disabled={isBusy || !isOnline}
                            >
                              <RotateCcw className={cn('mr-1.5 h-3.5 w-3.5', actionLoading === retryKey && 'animate-spin')} />
                              Tentar novamente
                            </Button>
                            {entry.state === 'erro' && entry.item.table === 'photos' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDiscardPhoto(entry.item!)}
                                disabled={isBusy}
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Descartar…
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Legenda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {(Object.keys(STATE_WORD) as TimelineState[]).map(state => {
              const Icon = STATE_ICON[state];
              return (
                <div key={state} className="flex items-start gap-2">
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', STATE_MARK[state])}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs text-navy-2">
                    <span className="font-semibold text-navy">{STATE_WORD[state]}</span> — {LEGEND_TEXT[state]}
                  </p>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-navy-3">
              Estado em três canais: cor de fundo, forma do traço e a palavra. Nenhum deles sozinho.
            </p>
          </CardContent>
        </Card>
      </div>

      {confirmDialog}
    </PageShell>
  );
}
