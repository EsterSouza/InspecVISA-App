import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import type { ChecklistItem, Inspection, Schedule } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { formatDateTime } from '../utils/imageUtils';
import { calculateScore } from '../utils/scoring';
import { getTemplates } from '../data/templates';

type DashboardStats = {
  totalActive: number;
  totalCompleted: number;
  avgScore: number;
};

type AttentionStats = {
  dueToday: number;
  upcoming: number;
  inProgress: number;
  syncQueue: number;
};

type RecurringIssue = {
  item: ChecklistItem;
  count: number;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getScheduleTiming(schedule: Schedule, now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (schedule.scheduledAt < todayStart) {
    return { label: 'Reagendar', variant: 'danger' as const, tone: 'text-red-600' };
  }

  if (schedule.scheduledAt <= todayEnd) {
    return { label: 'Hoje', variant: 'warning' as const, tone: 'text-amber-600' };
  }

  return { label: 'Próximo', variant: 'default' as const, tone: 'text-primary-600' };
}

function getInspectionTarget(inspection: Inspection) {
  return inspection.status === 'in_progress' ? '/execute' : '/summary';
}

export function Dashboard() {
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const [recentInspections, setRecentInspections] = useState<Inspection[]>([]);
  const [nextSchedules, setNextSchedules] = useState<Schedule[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalActive: 0, totalCompleted: 0, avgScore: 0 });
  const [attention, setAttention] = useState<AttentionStats>({ dueToday: 0, upcoming: 0, inProgress: 0, syncQueue: 0 });
  const [recurringIssues, setRecurringIssues] = useState<RecurringIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firstName = useMemo(() => {
    const name = settings.name?.trim();
    return name ? name.split(/\s+/)[0] : 'Consultora';
  }, [settings.name]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { ScheduleService } = await import('../services/scheduleService');
        const { ClientService } = await import('../services/clientService');
        const { InspectionService } = await import('../services/inspectionService');

        const [allSchedules, clients, allInspections] = await Promise.all([
          ScheduleService.getSchedules(),
          ClientService.getClients(),
          InspectionService.getAllInspections(),
        ]);

        const clientsById = new Map(clients.map((client) => [client.id, client.name]));
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const nextSevenDays = new Date(todayEnd);
        nextSevenDays.setDate(nextSevenDays.getDate() + 7);

        const pendingSchedules = allSchedules
          .filter((schedule) => schedule.status === 'pending')
          .map((schedule) => ({
            ...schedule,
            clientName: clientsById.get(schedule.clientId) || schedule.clientName || 'Cliente',
          }));

        const prioritySchedules = [...pendingSchedules]
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
          .slice(0, 4);

        setNextSchedules(prioritySchedules);

        const recent = [...allInspections]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5)
          .map((inspection) => ({
            ...inspection,
            clientName: clientsById.get(inspection.clientId) || inspection.clientName || 'Cliente',
          }));

        setRecentInspections(recent);

        const active = allInspections.filter((inspection) => inspection.status === 'in_progress').length;
        const completedList = allInspections.filter((inspection) => inspection.status === 'completed');
        const completedForAnalytics = [...completedList]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 12);
        const allTemplates = getTemplates();

        let totalPct = 0;
        const itemCounts: Record<string, number> = {};

        // Garante que as respostas de inspeções antigas (possivelmente feitas em
        // outro dispositivo) estejam no cache local antes de calcular os agregados.
        await InspectionService.hydrateTenantResponses();

        for (const inspection of completedForAnalytics) {
          const responses = await InspectionService.getResponsesByInspectionId(inspection.id);
          const template = allTemplates.find((item) => item.id === inspection.templateId);

          if (template) {
            const score = calculateScore(responses, template.sections);
            totalPct += score.scorePercentage;
          }

          responses
            .filter((response) => response.result === 'not_complies')
            .forEach((response) => {
              itemCounts[response.itemId] = (itemCounts[response.itemId] || 0) + 1;
            });
        }

        const allChecklistItems = allTemplates.flatMap((template) =>
          template.sections.flatMap((section) => section.items)
        );

        const issues = Object.entries(itemCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .flatMap(([id, count]) => {
            const item = allChecklistItems.find((checklistItem) => checklistItem.id === id);
            return item ? [{ item, count }] : [];
          });

        setStats({
          totalActive: active,
          totalCompleted: completedList.length,
          avgScore: completedForAnalytics.length > 0 ? Math.round(totalPct / completedForAnalytics.length) : 0,
        });

        const { SyncQueueService } = await import('../services/syncQueueService');
        const queue = await SyncQueueService.getQueueSummary();

        setAttention({
          dueToday: pendingSchedules.filter(
            (schedule) => schedule.scheduledAt >= todayStart && schedule.scheduledAt <= todayEnd
          ).length,
          upcoming: pendingSchedules.filter(
            (schedule) => schedule.scheduledAt > todayEnd && schedule.scheduledAt <= nextSevenDays
          ).length,
          inProgress: active,
          syncQueue: queue.pending + queue.syncing + queue.failed + queue.conflict,
        });

        setRecurringIssues(issues);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Não foi possível carregar o painel agora.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const attentionCards = [
    {
      label: 'Hoje',
      value: attention.dueToday,
      detail: 'agendamentos para executar',
      icon: Calendar,
      className: 'border-l-4 border-l-primary-500 bg-primary-50/70',
      iconClassName: 'bg-primary-100 text-primary-700',
      onClick: () => navigate('/schedules'),
    },
    {
      label: 'Próximas',
      value: attention.upcoming,
      detail: 'visitas nos próximos 7 dias',
      icon: Clock,
      className: 'border-l-4 border-l-emerald-500 bg-emerald-50/70',
      iconClassName: 'bg-emerald-100 text-emerald-700',
      onClick: () => navigate('/schedules'),
    },
    {
      label: 'Em andamento',
      value: attention.inProgress,
      detail: 'inspeções abertas',
      icon: ClipboardCheck,
      className: 'border-l-4 border-l-sky-500 bg-sky-50/70',
      iconClassName: 'bg-sky-100 text-sky-700',
      onClick: () => navigate('/inspections'),
    },
    {
      label: 'Fila de sync',
      value: attention.syncQueue,
      detail: 'itens aguardando nuvem',
      icon: RefreshCw,
      className: 'border-l-4 border-l-amber-500 bg-amber-50/70',
      iconClassName: 'bg-amber-100 text-amber-700',
      onClick: () => navigate('/sync'),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Olá, {firstName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
            Seu painel de trabalho para priorizar visitas, continuar inspeções e revisar pontos críticos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/schedules')} className="h-11">
            <Calendar className="mr-2 h-4 w-4" />
            Agenda
          </Button>
          <Button size="lg" className="h-11 px-5 text-sm" onClick={() => navigate('/new')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Inspeção
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {attentionCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={`${card.className} cursor-pointer transition-shadow hover:shadow-md`}
              onClick={card.onClick}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${card.iconClassName}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold leading-tight text-gray-950">{card.value}</div>
                  <div className="text-sm font-semibold text-gray-800">{card.label}</div>
                  <div className="truncate text-xs text-gray-500">{card.detail}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-sky-100 text-sky-700">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-950">{stats.totalActive}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ativas</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-950">{stats.totalCompleted}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Concluídas</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-violet-100 text-violet-700">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-950">{stats.avgScore}%</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Média recente</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center text-lg font-semibold text-gray-900">
              <Calendar className="mr-2 h-5 w-5 text-primary-600" />
              Agenda Prioritária
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/schedules')}>
              Ver agenda
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <Card className="border-dashed bg-gray-50">
              <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando agenda
              </CardContent>
            </Card>
          ) : nextSchedules.length === 0 ? (
            <Card className="border-dashed bg-gray-50">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Calendar className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Nenhuma visita pendente na agenda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {nextSchedules.map((schedule) => {
                const timing = getScheduleTiming(schedule);
                return (
                  <Card
                    key={schedule.id}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => navigate('/schedules')}
                  >
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Badge variant={timing.variant}>{timing.label}</Badge>
                        <span className={`text-xs font-semibold ${timing.tone}`}>
                          {schedule.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="mb-1 truncate text-sm font-bold text-gray-950">{schedule.clientName || 'Cliente'}</h3>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="mr-1 h-3.5 w-3.5" />
                        {schedule.scheduledAt.toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Gestão e Biblioteca</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Card
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/templates')}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900">Roteiros Digitais</h3>
                  <p className="truncate text-xs text-gray-500">Criar, editar e reutilizar roteiros.</p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-gray-300 group-hover:text-primary-500" />
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/legislations')}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900">Biblioteca de Leis</h3>
                  <p className="truncate text-xs text-gray-500">Consultar e gerenciar legislações.</p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-gray-300 group-hover:text-emerald-500" />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Visitas Recentes</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inspections')}>
              Ver todas
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <Card className="border-dashed bg-gray-50">
              <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando inspeções
              </CardContent>
            </Card>
          ) : recentInspections.length === 0 ? (
            <Card className="border-dashed bg-gray-50">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <ClipboardCheck className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Nenhuma inspeção registrada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentInspections.map((inspection) => (
                <Card
                  key={inspection.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => navigate(getInspectionTarget(inspection), { state: { inspectionId: inspection.id } })}
                >
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-sm font-semibold text-gray-900">
                        {inspection.clientName || 'Cliente'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{formatDateTime(inspection.createdAt)}</span>
                        <Badge
                          variant={inspection.status === 'completed' ? 'success' : 'warning'}
                          className="px-2 py-0 text-[10px]"
                        >
                          {inspection.status === 'completed' ? 'Finalizada' : 'Em andamento'}
                        </Badge>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center text-lg font-semibold text-gray-900">
            <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
            Problemas Recorrentes
          </h2>

          {isLoading ? (
            <Card className="border-dashed bg-gray-50">
              <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando histórico
              </CardContent>
            </Card>
          ) : recurringIssues.length === 0 ? (
            <Card className="border-dashed bg-gray-50">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-400" />
                <p className="text-sm font-medium text-gray-600">Nenhuma não conformidade frequente detectada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recurringIssues.map(({ item, count }) => (
                <Card key={item.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <p className="line-clamp-2 text-sm font-medium text-gray-700">{item.description}</p>
                    <div className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      {count}x
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
