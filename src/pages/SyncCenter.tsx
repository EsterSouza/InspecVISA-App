import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../db/database';
import { SyncQueueService } from '../services/syncQueueService';
import { exportDatabase } from '../utils/backup';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle,
  Download, Wifi, WifiOff, ChevronDown, ChevronRight,
  RotateCcw, Play, Image, Users, ClipboardCheck, FileText,
  Calendar, Activity,
} from 'lucide-react';

type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
type TableName = 'clients' | 'inspections' | 'responses' | 'photos' | 'schedules';

interface SyncItem {
  id: string;
  table: TableName;
  syncStatus: SyncStatus;
  syncAttempts: number;
  syncError?: string | null;
  label: string;
  sub?: string;
  hasDataUrl?: boolean;
  hasStoragePath?: boolean;
}

interface TableData {
  name: TableName;
  label: string;
  Icon: React.FC<{ className?: string }>;
  items: SyncItem[];
}

const STATUS_STYLE: Record<SyncStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pendente',     color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  syncing:  { label: 'Enviando',     color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  failed:   { label: 'Erro',         color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  conflict: { label: 'Conflito',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  synced:   { label: 'Sincronizado', color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
};

function StatusBadge({ status }: { status: SyncStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  );
}

function truncId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function SyncCenter() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [summary, setSummary] = useState({ pending: 0, syncing: 0, failed: 0, conflict: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

      // Build lookup maps from full tables (local only, very fast)
      const allClients = await db.clients.toArray();
      const allInspections = await db.inspections.toArray();
      const allResponses = await db.responses.toArray();

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
        label,
        sub,
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
          { hasDataUrl: !!(p as any).dataUrl, hasStoragePath: !!(p as any).storagePath })
      );

      const scheduleItems = rawSchedules.map(s =>
        mapItem(s, 'schedules',
          clientName.get((s as any).clientId) ?? truncId((s as any).clientId ?? s.id),
          (s as any).scheduledAt
            ? new Date((s as any).scheduledAt).toLocaleDateString('pt-BR')
            : (s as any).status ?? undefined)
      );

      const tableData: TableData[] = [
        { name: 'clients',     label: 'Clientes',     Icon: Users,          items: clientItems },
        { name: 'inspections', label: 'Inspeções',    Icon: ClipboardCheck, items: inspectionItems },
        { name: 'responses',   label: 'Respostas',    Icon: FileText,       items: responseItems },
        { name: 'photos',      label: 'Fotos',        Icon: Image,          items: photoItems },
        { name: 'schedules',   label: 'Agendamentos', Icon: Calendar,       items: scheduleItems },
      ];

      setTables(tableData);

      const total = { pending: 0, syncing: 0, failed: 0, conflict: 0 };
      tableData.forEach(t =>
        t.items.forEach(item => {
          if (item.syncStatus in total) total[item.syncStatus as keyof typeof total]++;
        })
      );
      setSummary(total);

      // Sync logs (best-effort)
      try {
        const syncLogs = await (db as any).sync_logs
          ?.orderBy('timestamp').reverse().limit(50).toArray();
        if (Array.isArray(syncLogs)) setLogs(syncLogs);
      } catch {
        // table may not exist
      }
    } catch (err) {
      console.error('[SyncCenter] loadData error:', err);
    } finally {
      setIsLoading(false);
      setLastChecked(new Date());
    }
  }, []);

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

  const withAction = async (key: string, msg: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    setActionMessage(null);
    try {
      await fn();
      setActionMessage(msg);
      setTimeout(() => setActionMessage(null), 3000);
      await loadData();
    } catch (err) {
      setActionMessage(`Erro: ${err}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryAll = () =>
    withAction('retryAll', 'Fila desbloqueada e sincronização iniciada.', async () => {
      await SyncQueueService.retryFailed();
    });

  const handleForceSync = () =>
    withAction('force', 'Sincronização disparada.', async () => {
      await SyncQueueService.processAll();
    });

  const handleResetStuck = () =>
    withAction('reset', 'Registros travados resetados para pendente.', async () => {
      await SyncQueueService.cleanupStuckSyncing();
    });

  const handleExportBackup = () =>
    withAction('export', 'Backup exportado com sucesso.', async () => {
      await exportDatabase();
    });

  const handleRetryItem = (item: SyncItem) =>
    withAction(`item-${item.id}`, 'Item reenviado.', async () => {
      if (item.table === 'inspections' || item.table === 'responses' || item.table === 'photos') {
        await SyncQueueService.retryItem(item.table, item.id);
      } else if (item.table === 'clients') {
        await db.clients.update(item.id, { syncStatus: 'pending', syncAttempts: 0, syncError: undefined });
        await SyncQueueService.processAll();
      } else if (item.table === 'schedules') {
        await db.schedules.update(item.id, { syncStatus: 'pending', syncAttempts: 0, syncError: undefined });
        await SyncQueueService.processAll();
      }
    });

  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const totalUnsynced = summary.pending + summary.syncing + summary.failed + summary.conflict;
  const isBusy = !!actionLoading;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary-600" />
            Central de Sincronização
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastChecked
              ? `Atualizado às ${lastChecked.toLocaleTimeString('pt-BR')} — atualiza a cada 15s`
              : 'Carregando dados locais…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-sm font-medium ${
            isOnline ? 'text-green-600' : 'text-red-500'
          }`}>
            {isOnline
              ? <Wifi className="h-4 w-4" />
              : <WifiOff className="h-4 w-4" />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ['pending',  'Pendente',  summary.pending,  'text-yellow-600 bg-yellow-50 border-yellow-200', Clock],
          ['syncing',  'Enviando',  summary.syncing,  'text-blue-600 bg-blue-50 border-blue-200',       RefreshCw],
          ['failed',   'Erros',     summary.failed,   'text-red-600 bg-red-50 border-red-200',           XCircle],
          ['conflict', 'Conflitos', summary.conflict, 'text-orange-600 bg-orange-50 border-orange-200',  AlertTriangle],
        ] as const).map(([, label, value, color, Icon]) => (
          <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${color}`}>
            <Icon className="h-6 w-6 shrink-0" />
            <div>
              <div className="text-2xl font-bold leading-none">{value}</div>
              <div className="text-xs font-medium opacity-80 mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleRetryAll}
              disabled={isBusy || !isOnline}
            >
              <Play className={`h-3.5 w-3.5 mr-1.5 ${actionLoading === 'retryAll' ? 'animate-pulse' : ''}`} />
              Tentar Tudo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleForceSync}
              disabled={isBusy || !isOnline}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${actionLoading === 'force' ? 'animate-spin' : ''}`} />
              Sincronizar Agora
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetStuck}
              disabled={isBusy}
            >
              <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${actionLoading === 'reset' ? 'animate-spin' : ''}`} />
              Resetar Travados
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBackup}
              disabled={isBusy}
            >
              <Download className={`h-3.5 w-3.5 mr-1.5 ${actionLoading === 'export' ? 'animate-pulse' : ''}`} />
              Exportar Backup
            </Button>
          </div>

          {actionMessage && (
            <p className="mt-3 text-sm text-green-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {actionMessage}
            </p>
          )}

          {totalUnsynced === 0 && !isLoading && (
            <p className="mt-3 text-sm text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Tudo sincronizado!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Per-table sections */}
      {tables.map(table => {
        const isOpen = !!expanded[table.name];
        const count = table.items.length;
        const Icon = table.Icon;

        const byStatus: Partial<Record<SyncStatus, number>> = {};
        table.items.forEach(item => {
          byStatus[item.syncStatus] = (byStatus[item.syncStatus] ?? 0) + 1;
        });

        return (
          <Card key={table.name}>
            <button
              className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t-lg"
              onClick={() => toggle(table.name)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-gray-500 shrink-0" />
                    <CardTitle className="text-sm truncate">{table.label}</CardTitle>
                    {count > 0 && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {Object.entries(byStatus).map(([st, n]) => (
                      <span key={st} className="hidden sm:inline">
                        <StatusBadge status={st as SyncStatus} />
                      </span>
                    ))}
                    {count === 0 && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> OK
                      </span>
                    )}
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>
              </CardHeader>
            </button>

            {isOpen && (
              <CardContent className="pt-0">
                {count === 0 ? (
                  <p className="text-sm text-gray-500 py-2">Nenhum item pendente nesta tabela.</p>
                ) : (
                  <div className="space-y-2">
                    {table.items.map(item => {
                      const itemStyle =
                        item.syncStatus === 'failed'   ? 'border-red-200 bg-red-50' :
                        item.syncStatus === 'conflict' ? 'border-orange-200 bg-orange-50' :
                        item.syncStatus === 'syncing'  ? 'border-blue-200 bg-blue-50' :
                                                         'border-gray-200 bg-gray-50';
                      return (
                        <div key={item.id} className={`rounded-lg border p-3 text-sm ${itemStyle}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <StatusBadge status={item.syncStatus} />
                                <span className="font-medium text-gray-900 truncate max-w-[200px]">
                                  {item.label}
                                </span>
                              </div>
                              {item.sub && (
                                <p className="text-xs text-gray-500">{item.sub}</p>
                              )}
                              <p className="text-xs text-gray-400 font-mono">
                                ID: {truncId(item.id)}
                              </p>
                              {item.syncAttempts > 0 && (
                                <p className="text-xs text-gray-500">
                                  Tentativas: {item.syncAttempts}
                                </p>
                              )}
                              {item.syncError && (
                                <p className="text-xs text-red-600 break-words max-w-prose">
                                  {item.syncError}
                                </p>
                              )}
                              {item.table === 'photos' && (
                                <div className="flex gap-4 mt-0.5">
                                  <span className={`text-xs font-medium ${
                                    item.hasDataUrl ? 'text-green-600' : 'text-gray-400'
                                  }`}>
                                    {item.hasDataUrl ? '✓ Dados locais' : '✗ Sem dados'}
                                  </span>
                                  <span className={`text-xs font-medium ${
                                    item.hasStoragePath ? 'text-green-600' : 'text-yellow-600'
                                  }`}>
                                    {item.hasStoragePath
                                      ? '✓ Storage OK'
                                      : '⏳ Aguardando upload'}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryItem(item)}
                              disabled={isBusy || !isOnline}
                              className="shrink-0 h-7 w-7 p-0"
                              title="Tentar novamente"
                            >
                              {actionLoading === `item-${item.id}` ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Sync Logs */}
      <Card>
        <button
          className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t-lg"
          onClick={() => toggle('logs')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Logs de Sincronização</CardTitle>
              <div className="flex items-center gap-2">
                {logs.length > 0 ? (
                  <span className="text-xs text-gray-500">{logs.length} entradas</span>
                ) : (
                  <span className="text-xs text-gray-400">sem registros</span>
                )}
                {expanded['logs']
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </div>
            </div>
          </CardHeader>
        </button>

        {expanded['logs'] && (
          <CardContent className="pt-0">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                Nenhum log registrado. Logs aparecem aqui durante a sincronização.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-1 font-mono text-xs rounded border border-gray-100 p-2 bg-gray-50">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded ${
                      log.level === 'error' ? 'bg-red-50 text-red-700' :
                      log.level === 'warn'  ? 'bg-yellow-50 text-yellow-700' :
                                              'text-gray-600'
                    }`}
                  >
                    <span className="text-gray-400 select-none">
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleTimeString('pt-BR')
                        : '—'}{' '}
                    </span>
                    {log.message ?? log.details ?? JSON.stringify(log)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

    </div>
  );
}
