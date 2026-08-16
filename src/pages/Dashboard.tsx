import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import type { Inspection, InspectionResponse, Schedule } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageShell } from '../components/ui/PageShell';
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
  Users,
} from 'lucide-react';
import { formatDateTime } from '../utils/imageUtils';
import { getTemplates } from '../data/templates';
import { db } from '../db/database';
import { nutritionItemIds, type ConsultantArea } from '../utils/scoring';

const TEAM_FILTER = '__all__';

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
  id: string;
  description: string;
  count: number;
};

type RawData = {
  inspections: Inspection[];
  schedules: (Schedule & { clientName?: string })[];
  clientsById: Map<string, string>;
  responsesByInspection: Map<string, InspectionResponse[]>;
  syncQueueCount: number;
  /** itemIds das seções de nutrição (atribuídas à nutricionista). */
  nutritionItemIds: Set<string>;
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

/** Consultoras responsáveis pela inspeção (conjunto). Usa consultantNames
 * quando presente (co-responsabilidade); senão cai no consultantName único. */
function consultantsOf(inspection: Inspection): string[] {
  const names = (inspection.consultantNames && inspection.consultantNames.length > 0)
    ? inspection.consultantNames
    : [inspection.consultantName];
  return names.map((name) => (name || '').trim()).filter(Boolean);
}

/**
 * Score template-agnóstico: pega a resposta mais recente por item e calcula
 * complies / (complies + not_complies). Funciona para roteiros estáticos E
 * customizados (UUID), ao contrário do recálculo via template estático.
 * Retorna null quando a inspeção não tem item avaliável (não entra na média).
 */
function latestByItem(responses: InspectionResponse[]): InspectionResponse[] {
  const map = new Map<string, InspectionResponse>();
  for (const response of responses) {
    if (response.deletedAt) continue;
    const prev = map.get(response.itemId);
    if (!prev || new Date(response.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
      map.set(response.itemId, response);
    }
  }
  return Array.from(map.values());
}

function pctOf(items: InspectionResponse[]): number | null {
  let complies = 0;
  let evaluated = 0;
  for (const response of items) {
    if (response.result === 'complies') { complies += 1; evaluated += 1; }
    else if (response.result === 'not_complies') { evaluated += 1; }
  }
  return evaluated > 0 ? (complies / evaluated) * 100 : null;
}

function inspectionScore(responses: InspectionResponse[]): number | null {
  return pctOf(latestByItem(responses));
}

/**
 * Score da ÁREA de uma consultora numa inspeção. Quando a inspeção tem as DUAS
 * áreas avaliadas (ILPI: sanitária + nutrição), restringe aos itens da área da
 * consultora — assim o % da Ana reflete só a nutrição e o da Ester só o
 * sanitário. Em inspeções de área única (Estética/Alimentos), usa a inspeção
 * inteira, pois a consultora é responsável por tudo.
 */
function consultantAreaScore(
  responses: InspectionResponse[],
  nutritionIds: Set<string>,
  area: ConsultantArea,
): number | null {
  const latest = latestByItem(responses);
  const hasNutrition = latest.some((r) => nutritionIds.has(r.itemId));
  const hasSanitary = latest.some((r) => !nutritionIds.has(r.itemId));
  if (!(hasNutrition && hasSanitary)) return pctOf(latest);
  const filtered = latest.filter((r) =>
    area === 'nutrition' ? nutritionIds.has(r.itemId) : !nutritionIds.has(r.itemId)
  );
  return pctOf(filtered);
}

/** Remove o sufixo "(transf.)" de dados antigos. */
function cleanAuthor(name?: string): string {
  return (name || '').replace(/\s*\(transf\.\)\s*/i, '').trim();
}

export function Dashboard() {
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const [raw, setRaw] = useState<RawData | null>(null);
  const [consultantFilter, setConsultantFilter] = useState<string>(TEAM_FILTER);
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
        const { SyncQueueService } = await import('../services/syncQueueService');

        const [allSchedules, clients, allInspections] = await Promise.all([
          ScheduleService.getSchedules(),
          ClientService.getClients(),
          InspectionService.getAllInspections(),
        ]);

        const clientsById = new Map(clients.map((client) => [client.id, client.name]));

        // Garante que as respostas (inclusive de inspeções feitas em outro
        // dispositivo) estejam no cache local antes de calcular os agregados.
        await InspectionService.hydrateTenantResponses();

        const completed = allInspections.filter((inspection) => inspection.status === 'completed');
        const responsesByInspection = new Map<string, InspectionResponse[]>();
        await Promise.all(
          completed.map(async (inspection) => {
            const responses = await InspectionService.getResponsesByInspectionId(inspection.id);
            responsesByInspection.set(inspection.id, responses);
          })
        );

        const queue = await SyncQueueService.getQueueSummary();

        // Conjunto de itens de nutrição a partir de TODOS os roteiros locais
        // (o roteiro ILPI ativo usa ids UUID, então vem do Dexie, não do estático).
        const localTemplates = await db.templates.toArray().catch(() => []);
        const nutritionIds = nutritionItemIds(
          localTemplates
            .filter((template) => template.category === 'ilpi')
            .flatMap((template) => template.sections || [])
        );

        const schedules = allSchedules.map((schedule) => ({
          ...schedule,
          clientName: (schedule.clientId ? clientsById.get(schedule.clientId) : undefined) || schedule.clientName || 'Cliente',
        }));

        setRaw({
          inspections: allInspections,
          schedules,
          clientsById,
          responsesByInspection,
          syncQueueCount: queue.pending + queue.syncing + queue.failed + queue.conflict,
          nutritionItemIds: nutritionIds,
        });

        // Default: foca na consultora do perfil ativo, se houver trabalho dela.
        const activeFirst = (settings.name || '').trim().split(/\s+/)[0].toLowerCase();
        const names = Array.from(new Set(completed.flatMap(consultantsOf)));
        const ownName = names.find((name) => name.toLowerCase().split(/\s+/)[0] === activeFirst);
        setConsultantFilter(ownName || TEAM_FILTER);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Não foi possível carregar o painel agora.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [settings.name]);

  // Consultoras disponíveis para o filtro (a partir de TODAS as inspeções).
  const consultants = useMemo(() => {
    if (!raw) return [] as string[];
    return Array.from(new Set(raw.inspections.flatMap(consultantsOf))).sort();
  }, [raw]);

  const matchesFilter = useMemo(() => {
    return (inspection: Inspection) =>
      consultantFilter === TEAM_FILTER || consultantsOf(inspection).includes(consultantFilter);
  }, [consultantFilter]);

  // Área de responsabilidade de cada consultora (sanitária x nutrição), derivada
  // de quem mais preencheu cada tipo de item (lastEditedBy). Ana → nutrição,
  // Ester → sanitária, sem hardcode de nomes.
  const consultantArea = useMemo(() => {
    const tally = new Map<string, { nut: number; san: number }>();
    if (raw) {
      for (const responses of raw.responsesByInspection.values()) {
        for (const response of responses) {
          if (response.deletedAt) continue;
          const name = cleanAuthor(response.lastEditedBy);
          if (!name) continue;
          const bucket = tally.get(name) || { nut: 0, san: 0 };
          if (raw.nutritionItemIds.has(response.itemId)) bucket.nut += 1;
          else bucket.san += 1;
          tally.set(name, bucket);
        }
      }
    }
    const out = new Map<string, ConsultantArea>();
    for (const [name, b] of tally) {
      out.set(name, b.nut > b.san ? 'nutrition' : 'sanitary');
    }
    return out;
  }, [raw]);

  const stats: DashboardStats = useMemo(() => {
    if (!raw) return { totalActive: 0, totalCompleted: 0, avgScore: 0 };
    const inspections = raw.inspections.filter(matchesFilter);
    const active = inspections.filter((i) => i.status === 'in_progress').length;
    const completed = inspections.filter((i) => i.status === 'completed');

    // Filtrando por consultora conhecida, o % considera só a área dela; na visão
    // de equipe (ou consultora sem área identificada), considera a inspeção toda.
    const area = consultantFilter === TEAM_FILTER ? undefined : consultantArea.get(consultantFilter);

    let total = 0;
    let scored = 0;
    for (const inspection of completed) {
      const responses = raw.responsesByInspection.get(inspection.id) || [];
      const pct = area
        ? consultantAreaScore(responses, raw.nutritionItemIds, area)
        : inspectionScore(responses);
      if (pct !== null) { total += pct; scored += 1; }
    }

    return {
      totalActive: active,
      totalCompleted: completed.length,
      avgScore: scored > 0 ? Math.round(total / scored) : 0,
    };
  }, [raw, matchesFilter, consultantFilter, consultantArea]);

  const recentInspections = useMemo(() => {
    if (!raw) return [] as Inspection[];
    return [...raw.inspections]
      .filter(matchesFilter)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((inspection) => ({
        ...inspection,
        clientName: raw.clientsById.get(inspection.clientId) || inspection.clientName || 'Cliente',
      }));
  }, [raw, matchesFilter]);

  const recurringIssues: RecurringIssue[] = useMemo(() => {
    if (!raw) return [];
    const staticItems = new Map(
      getTemplates()
        .flatMap((template) => template.sections.flatMap((section) => section.items))
        .map((item) => [item.id, item.description])
    );
    const counts = new Map<string, number>();
    const descriptions = new Map<string, string>();

    for (const inspection of raw.inspections.filter(matchesFilter)) {
      if (inspection.status !== 'completed') continue;
      const latestByItem = new Map<string, InspectionResponse>();
      for (const response of raw.responsesByInspection.get(inspection.id) || []) {
        if (response.deletedAt) continue;
        const prev = latestByItem.get(response.itemId);
        if (!prev || new Date(response.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
          latestByItem.set(response.itemId, response);
        }
      }
      for (const response of latestByItem.values()) {
        if (response.result !== 'not_complies') continue;
        counts.set(response.itemId, (counts.get(response.itemId) || 0) + 1);
        if (!descriptions.has(response.itemId)) {
          descriptions.set(
            response.itemId,
            staticItems.get(response.itemId)
              || response.customDescription
              || response.situationDescription
              || 'Item avaliado'
          );
        }
      }
    }

    return Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id, count]) => ({ id, description: descriptions.get(id) || 'Item avaliado', count }));
  }, [raw, matchesFilter]);

  const attention: AttentionStats = useMemo(() => {
    if (!raw) return { dueToday: 0, upcoming: 0, inProgress: 0, syncQueue: 0 };
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const nextSevenDays = new Date(todayEnd);
    nextSevenDays.setDate(nextSevenDays.getDate() + 7);

    const pendingSchedules = raw.schedules.filter((schedule) => schedule.status === 'pending');

    return {
      dueToday: pendingSchedules.filter((s) => s.scheduledAt >= todayStart && s.scheduledAt <= todayEnd).length,
      upcoming: pendingSchedules.filter((s) => s.scheduledAt > todayEnd && s.scheduledAt <= nextSevenDays).length,
      inProgress: stats.totalActive,
      syncQueue: raw.syncQueueCount,
    };
  }, [raw, stats.totalActive]);

  const nextSchedules = useMemo(() => {
    if (!raw) return [] as (Schedule & { clientName?: string })[];
    return [...raw.schedules]
      .filter((schedule) => schedule.status === 'pending')
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .slice(0, 4);
  }, [raw]);

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

  const filterLabel = consultantFilter === TEAM_FILTER ? 'Toda a equipe' : consultantFilter;

  return (
    <PageShell>
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

      {/* Filtro por consultora — separa o trabalho de cada uma */}
      {consultants.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Users className="h-4 w-4" />
            Consultora
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setConsultantFilter(TEAM_FILTER)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                consultantFilter === TEAM_FILTER
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Toda a equipe
            </button>
            {consultants.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setConsultantFilter(name)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  consultantFilter === name
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Média de conformidade
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center text-lg font-semibold text-gray-900">
              <Calendar className="mr-2 h-5 w-5 text-primary-600" />
              Agenda da equipe
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
            <h2 className="text-lg font-semibold text-gray-900">
              Visitas Recentes
              {consultantFilter !== TEAM_FILTER && (
                <span className="ml-2 text-sm font-normal text-gray-500">· {filterLabel}</span>
              )}
            </h2>
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
                        {consultantFilter === TEAM_FILTER && consultantsOf(inspection).length > 0 && (
                          <span className="text-gray-400">· {consultantsOf(inspection).join(', ')}</span>
                        )}
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
              {recurringIssues.map((issue) => (
                <Card key={issue.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <p className="line-clamp-2 text-sm font-medium text-gray-700">{issue.description}</p>
                    <div className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      {issue.count}x
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
