import { Download, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClientPortalActionItem, ClientPortalOverview } from '../../services/clientPortalService';
import type { PortalAppointmentVisit } from './PortalAppointments';
import { computeUnitActionStats, formatDateBR, sortUnitStatsByAttention, unitShareUrl } from '../../utils/clientPortalFormat';
import {
  PortalNextAction,
  type NextActionOverdueItem,
  type NextActionPaymentOverdue,
  type NextActionReturnedEvidence,
  type NextActionUpcomingAppointment,
} from './PortalNextAction';
import { PortalQuickActions } from './PortalQuickActions';
import { PortalCompliance } from './PortalCompliance';
import { UnitCompletionList } from './UnitCompletionList';
import type { ClientPortalAuditEventType } from '../../types';

const ACTIVE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled', 'completed']);

interface PortalOverviewProps {
  overview: ClientPortalOverview;
  actionItems: ClientPortalActionItem[];
  allVisits: PortalAppointmentVisit[];
  schedulingSuspended: boolean;
  nextActionPayment: NextActionPaymentOverdue | null;
  nextActionAppointment: NextActionUpcomingAppointment | null;
  nextActionReturnedEvidence: NextActionReturnedEvidence | null;
  nextActionOverdueItem: NextActionOverdueItem | null;
  audit: (eventType: ClientPortalAuditEventType, payload?: Record<string, unknown>) => void;
  /** Vai pro plano de ação já filtrado nesta unidade — clique no nome em "Cumprimento por unidade". */
  onSelectUnit: (clientId: string) => void;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function StatCard({ label, value, foot, tone }: { label: string; value: number; foot: string; tone?: 'attention' }) {
  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        tone === 'attention' ? 'border-amber-soft-border bg-amber-soft' : 'border-default bg-surface'
      }`}
    >
      <p className={`text-xs font-semibold ${tone === 'attention' ? 'text-amber-soft-ink' : 'text-navy-2'}`}>{label}</p>
      <p className={`mt-1 font-title text-3xl font-semibold tabular-nums ${tone === 'attention' ? 'text-amber-soft-ink' : 'text-navy'}`}>
        {value}
      </p>
      <p className={`mt-2 text-xs ${tone === 'attention' ? 'text-amber-soft-ink' : 'text-navy-2'}`}>{foot}</p>
    </div>
  );
}

export function PortalOverview({
  overview,
  actionItems,
  allVisits,
  schedulingSuspended,
  nextActionPayment,
  nextActionAppointment,
  nextActionReturnedEvidence,
  nextActionOverdueItem,
  audit,
  onSelectUnit,
}: PortalOverviewProps) {
  const isMulti = overview.units.length > 1;
  const stats = computeUnitActionStats(actionItems);
  const shareUrlByUnit = Object.fromEntries(overview.units.map((u) => [u.client_id, unitShareUrl(u)]));
  const openCount = stats.reduce((sum, s) => sum + s.open, 0);
  const overdueCount = stats.reduce((sum, s) => sum + s.overdue, 0);
  const resolvedCount = stats.reduce((sum, s) => sum + s.resolved, 0);
  const unitsWithOverdue = stats.filter((s) => s.overdue > 0).length;
  const sortedStats = sortUnitStatsByAttention(stats.filter((s) => s.total > 0));

  const subtitle = isMulti
    ? `Sua rede tem ${plural(overview.units.length, 'unidade', 'unidades')}. ${
        unitsWithOverdue > 0
          ? `${plural(unitsWithOverdue, 'unidade concentra', 'unidades concentram')} tudo que está vencido.`
          : 'Nenhuma unidade tem pendência vencida agora.'
      }`
    : overdueCount > 0
      ? `${plural(openCount, 'pendência continua', 'pendências continuam')} aberta${openCount === 1 ? '' : 's'}, ${plural(overdueCount, 'delas', 'delas')} com prazo vencido.`
      : `${plural(openCount, 'pendência em aberto', 'pendências em aberto')} no momento.`;

  const nextActionHeadline =
    overdueCount > 0
      ? `Responder ${plural(overdueCount, 'pendência com prazo vencido', 'pendências com prazo vencido')}`
      : `Responder ${plural(openCount, 'pendência em aberto', 'pendências em aberto')}`;

  const lastReport = allVisits
    .filter((v) => (v.report_count || 0) > 0)
    .sort((a, b) => `${b.requested_date || ''}`.localeCompare(`${a.requested_date || ''}`))[0];

  const todayKey = new Date().toISOString().slice(0, 10);
  const nextVisit = allVisits
    .filter((v) => v.requested_date && v.requested_date >= todayKey && ACTIVE_VISIT_STATUSES.has(v.status))
    .sort((a, b) => `${a.requested_date}${a.requested_time || ''}`.localeCompare(`${b.requested_date}${b.requested_time || ''}`))[0];

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-title text-2xl font-semibold text-navy">Olá! Aqui está o que está pendente.</h1>
        <p className="mt-1 max-w-[72ch] text-sm text-navy-2">{subtitle}</p>
      </div>

      {openCount > 0 && (
        <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-800">Sua próxima ação</p>
          <h2 className="mt-2 font-title text-lg font-semibold text-navy">{nextActionHeadline}</h2>
          <p className="mt-2 text-sm text-navy-2">
            Basta dizer em que pé está cada uma. Se já corrigiu, pode anexar a foto ou o documento — e
            se ainda não deu, contar o motivo já ajuda a consultoria a planejar a próxima visita.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/cliente/plano-de-acao"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary-700 px-4 py-2.5 text-sm font-semibold text-on-accent shadow-sm hover:bg-primary-800"
            >
              Abrir o plano de ação
            </Link>
            <Link
              to="/cliente/agenda"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary-200 bg-surface px-4 py-2.5 text-sm font-semibold text-primary-800 hover:bg-primary-100"
            >
              Ver a próxima visita
            </Link>
          </div>
        </div>
      )}

      <PortalNextAction
        paymentOverdue={nextActionPayment}
        upcomingAppointment={nextActionAppointment}
        returnedEvidence={overview.action_plan_enabled ? nextActionReturnedEvidence : null}
        overdueItem={overview.action_plan_enabled ? nextActionOverdueItem : null}
        onAudit={audit}
      />

      <PortalQuickActions
        enabled={overview.quick_access_enabled}
        mainDriveFolderUrl={overview.main_drive_folder_url}
        tutorialPdfUrl={overview.tutorial_pdf_url}
        supportWhatsapp={overview.support_whatsapp}
        schedulingSuspended={schedulingSuspended}
        units={overview.units}
        onAudit={audit}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pendências em aberto" value={openCount} foot={`em ${plural(overview.units.length, 'unidade', 'unidades')}`} />
        <StatCard label="Com prazo vencido" value={overdueCount} foot={`em ${plural(unitsWithOverdue, 'unidade', 'unidades')}`} tone={overdueCount > 0 ? 'attention' : undefined} />
        <StatCard label="Concluídas neste contrato" value={resolvedCount} foot="itens do plano de ação já corrigidos" />
      </div>

      {isMulti && sortedStats.length > 0 && (
        <div className="mb-6 rounded-lg border border-default bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-default px-4 py-3">
            <h2 className="font-title text-base font-semibold text-navy">Cumprimento por unidade</h2>
            <Link to="/cliente/plano-de-acao" className="text-xs font-semibold text-primary-700 hover:text-primary-900">
              Ver pendências
            </Link>
          </div>
          <div className="p-4">
            <p className="mb-3 text-xs text-navy-2">
              Percentual de pendências já concluídas em cada unidade. Quem está embaixo da lista
              precisa de você primeiro.
            </p>
            <UnitCompletionList stats={sortedStats} onSelect={onSelectUnit} shareUrlByUnit={shareUrlByUnit} />
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-default bg-surface shadow-sm">
          <div className="border-b border-default px-4 py-3">
            <h2 className="font-title text-base font-semibold text-navy">Última entrega</h2>
          </div>
          <div className="p-4">
            {lastReport ? (
              <>
                <p className="text-sm font-semibold text-navy">Relatório de inspeção · {lastReport.unitName}</p>
                <p className="mt-1 text-xs text-navy-2">{formatDateBR(lastReport.requested_date)}</p>
                <Link
                  to={`/cliente/visita/${lastReport.public_token}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-control px-3 py-2 text-xs font-semibold text-navy hover:bg-surface-hover"
                >
                  <Download className="h-3.5 w-3.5" /> Ver relatório
                </Link>
              </>
            ) : (
              <p className="text-sm text-navy-2">Nenhum relatório entregue ainda.</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-default bg-surface shadow-sm">
          <div className="border-b border-default px-4 py-3">
            <h2 className="font-title text-base font-semibold text-navy">Próxima visita</h2>
          </div>
          <div className="p-4">
            {nextVisit ? (
              <>
                <p className="text-sm font-semibold text-navy">Inspeção · {nextVisit.unitName}</p>
                <p className="mt-1 text-xs text-navy-2">
                  {formatDateBR(nextVisit.requested_date)}
                  {nextVisit.requested_time ? ` às ${nextVisit.requested_time}` : ''}
                </p>
                <Link
                  to="/cliente/agenda"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-control px-3 py-2 text-xs font-semibold text-navy hover:bg-surface-hover"
                >
                  <FileText className="h-3.5 w-3.5" /> Ver agenda
                </Link>
              </>
            ) : (
              <p className="text-sm text-navy-2">Nenhuma visita marcada no momento.</p>
            )}
          </div>
        </div>
      </div>

      <PortalCompliance units={overview.units} />
    </div>
  );
}
