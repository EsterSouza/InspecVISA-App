import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import type { Client, Inspection, InspectionResponse, Schedule } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { OperationalQueues } from '../components/dashboard/OperationalQueues';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PlusCircle,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatDateTime } from '../utils/imageUtils';
import { getTemplates } from '../data/templates';
import { db } from '../db/database';
import { nutritionItemIds, type ConsultantArea } from '../utils/scoring';

const TEAM_FILTER = '__all__';

const DAYS_AHEAD_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
];

type DashboardStats = {
  totalActive: number;
  totalCompleted: number;
  avgScore: number;
};

type RecurringIssue = {
  id: string;
  description: string;
  count: number;
};

type RawData = {
  inspections: Inspection[];
  schedules: (Schedule & { clientName?: string })[];
  clients: Client[];
  clientsById: Map<string, string>;
  responsesByInspection: Map<string, InspectionResponse[]>;
  /** itemIds das seções de nutrição (atribuídas à nutricionista). */
  nutritionItemIds: Set<string>;
};

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
  const [clientId, setClientId] = useState('');
  const [daysAhead, setDaysAhead] = useState(14);
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
          clients,
          clientsById,
          responsesByInspection,
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

  const filterLabel = consultantFilter === TEAM_FILTER ? 'Toda a equipe' : consultantFilter;
  const clients = raw?.clients ?? [];

  return (
    <PageShell>
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Seu painel de trabalho para priorizar visitas, continuar inspeções e revisar pontos críticos."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/schedules')} className="h-11">
              <Calendar className="mr-2 h-4 w-4" />
              Agenda
            </Button>
            <Button size="lg" className="h-11 px-5 text-sm" onClick={() => navigate('/new')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Inspeção
            </Button>
          </>
        }
      />

      {/* Filtros no topo: consultora, unidade e janela de dias — controlam a fila de trabalho abaixo. */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {consultants.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-3">
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
                    : 'border border-default bg-surface text-navy-2 hover:bg-surface-hover'
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
                      : 'border border-default bg-surface text-navy-2 hover:bg-surface-hover'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Select
            size="sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            aria-label="Filtrar por unidade"
            className="w-auto"
          >
            <option value="">Todas as unidades</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
          <Select
            size="sm"
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value))}
            aria-label="Janela de compromissos próximos"
            className="w-auto"
          >
            {DAYS_AHEAD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>Próximos {option.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-danger-soft-border bg-danger-soft">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-danger-soft-ink">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <OperationalQueues
        consultantName={consultantFilter === TEAM_FILTER ? null : consultantFilter}
        clientId={clientId || null}
        daysAhead={daysAhead}
      />

      <details className="mt-8 rounded-xl border border-default bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold uppercase tracking-wide text-navy-3 hover:text-navy-2">
          Desempenho
        </summary>
        <div className="space-y-8 border-t border-default px-5 pb-6 pt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-100 text-accent-ink">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-navy">{stats.totalActive}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-navy-3">Ativas</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success-soft text-success-soft-ink">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-navy">{stats.totalCompleted}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-navy-3">Concluídas</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-100 text-accent-ink">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-navy">{stats.avgScore}%</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-navy-3">
                    Média de conformidade
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy">
                  Visitas Recentes
                  {consultantFilter !== TEAM_FILTER && (
                    <span className="ml-2 text-sm font-normal text-navy-3">· {filterLabel}</span>
                  )}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/inspections')}>
                  Ver todas
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              {isLoading ? (
                <Card className="border-dashed bg-surface-sunken">
                  <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-navy-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando inspeções
                  </CardContent>
                </Card>
              ) : recentInspections.length === 0 ? (
                <Card className="border-dashed bg-surface-sunken">
                  <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                    <ClipboardCheck className="mb-3 h-10 w-10 text-navy-3" />
                    <p className="text-sm font-medium text-navy-2">Nenhuma inspeção registrada.</p>
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
                          <h3 className="truncate text-sm font-semibold text-navy">
                            {inspection.clientName || 'Cliente'}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-navy-3">
                            <span>{formatDateTime(inspection.createdAt)}</span>
                            <Badge
                              variant={inspection.status === 'completed' ? 'success' : 'warning'}
                              className="px-2 py-0 text-[10px]"
                            >
                              {inspection.status === 'completed' ? 'Finalizada' : 'Em andamento'}
                            </Badge>
                            {consultantFilter === TEAM_FILTER && consultantsOf(inspection).length > 0 && (
                              <span className="text-navy-3">· {consultantsOf(inspection).join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-navy-3" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="flex items-center text-lg font-semibold text-navy">
                <AlertTriangle className="mr-2 h-5 w-5 text-amber-strong" />
                Problemas Recorrentes
              </h2>

              {isLoading ? (
                <Card className="border-dashed bg-surface-sunken">
                  <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-navy-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando histórico
                  </CardContent>
                </Card>
              ) : recurringIssues.length === 0 ? (
                <Card className="border-dashed bg-surface-sunken">
                  <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                    <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
                    <p className="text-sm font-medium text-navy-2">Nenhuma não conformidade frequente detectada.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {recurringIssues.map((issue) => (
                    <Card key={issue.id} className="border-l-4 border-l-amber">
                      <CardContent className="flex items-start justify-between gap-4 p-4">
                        <p className="line-clamp-2 text-sm font-medium text-navy-2">{issue.description}</p>
                        <div className="shrink-0 rounded-full bg-amber-soft px-2 py-1 text-xs font-bold text-amber-soft-ink">
                          {issue.count}x
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </details>
    </PageShell>
  );
}
