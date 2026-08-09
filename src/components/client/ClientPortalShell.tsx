import { Download, LogOut } from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { ClientPortalAuditEventType } from '../../types';
import type {
  ClientPortalActionItem,
  ClientPortalInvoice,
  ClientPortalOverview,
  ClientPortalServiceRequest,
  ClientPortalUnit,
} from '../../services/clientPortalService';
import { generateFranchisePdf } from '../../utils/franchiseReport';
import {
  PortalNextAction,
  type NextActionOverdueItem,
  type NextActionPaymentOverdue,
  type NextActionReturnedEvidence,
  type NextActionUpcomingAppointment,
} from './PortalNextAction';
import { PortalQuickActions } from './PortalQuickActions';
import { PortalUnitFilter } from './PortalUnitFilter';
import {
  PortalActionPlan,
  type DeclareStatusHandler,
  type SubmitEvidenceHandler,
} from './PortalActionPlan';
import {
  PortalServiceRequests,
  type CreateServiceRequestHandler,
  type ReplyServiceRequestHandler,
} from './PortalServiceRequests';
import { PortalAppointments, type PortalAppointmentVisit } from './PortalAppointments';
import { PortalDocuments } from './PortalDocuments';
import { PortalBilling } from './PortalBilling';
import { PortalCompliance } from './PortalCompliance';

interface ClientPortalShellProps {
  overview: ClientPortalOverview;
  invoices: ClientPortalInvoice[];
  invoicesError: boolean;
  actionItems: ClientPortalActionItem[];
  actionItemsError: boolean;
  serviceRequests: ClientPortalServiceRequest[];
  serviceRequestsError: boolean;
  selectedUnitId: string | null;
  onUnitFilterChange: (unitId: string | null) => void;
  filteredUnits: ClientPortalUnit[];
  filteredVisits: PortalAppointmentVisit[];
  nextActionPayment: NextActionPaymentOverdue | null;
  nextActionAppointment: NextActionUpcomingAppointment | null;
  nextActionReturnedEvidence: NextActionReturnedEvidence | null;
  nextActionOverdueItem: NextActionOverdueItem | null;
  blockedFeatures: string[];
  schedulingSuspended: boolean;
  totalVisits: number;
  audit: (eventType: ClientPortalAuditEventType, payload?: Record<string, unknown>) => void;
  onSubmitEvidence: SubmitEvidenceHandler;
  onDeclareStatus: DeclareStatusHandler;
  onCreateServiceRequest: CreateServiceRequestHandler;
  onReplyServiceRequest: ReplyServiceRequestHandler;
  paymentAckBusy: boolean;
  paymentAckSent: boolean;
  onAcknowledgePayment: () => void;
  onLogout: () => void;
  onRetryActionItems: () => void;
  onRetryServiceRequests: () => void;
  onRetryInvoices: () => void;
}

const emptyState = (message: string) => (
  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
    {message}
  </div>
);

export function ClientPortalShell({
  overview,
  invoices,
  invoicesError,
  actionItems,
  actionItemsError,
  serviceRequests,
  serviceRequestsError,
  selectedUnitId,
  onUnitFilterChange,
  filteredUnits,
  filteredVisits,
  nextActionPayment,
  nextActionAppointment,
  nextActionReturnedEvidence,
  nextActionOverdueItem,
  blockedFeatures,
  schedulingSuspended,
  totalVisits,
  audit,
  onSubmitEvidence,
  onDeclareStatus,
  onCreateServiceRequest,
  onReplyServiceRequest,
  paymentAckBusy,
  paymentAckSent,
  onAcknowledgePayment,
  onLogout,
  onRetryActionItems,
  onRetryServiceRequests,
  onRetryInvoices,
}: ClientPortalShellProps) {
  const hasScoredVisit = filteredVisits.some((v) => typeof v.compliance_score === 'number');
  const groupActionPlanByUnit = overview.units.length > 1 && !selectedUnitId;

  const tabs: { to: string; label: string; end?: boolean }[] = [
    { to: '/cliente', label: 'Visão geral', end: true },
    ...(overview.action_plan_enabled ? [{ to: '/cliente/plano-de-acao', label: 'Plano de ação' }] : []),
    ...(overview.service_requests_enabled ? [{ to: '/cliente/solicitacoes', label: 'Solicitações' }] : []),
    { to: '/cliente/documentos', label: 'Documentos' },
    { to: '/cliente/agenda', label: 'Agenda' },
    { to: '/cliente/financeiro', label: 'Financeiro' },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-950">{overview.account_name}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {overview.units.length} unidade{overview.units.length === 1 ? '' : 's'} ·{' '}
            {totalVisits} compromisso{totalVisits === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => generateFranchisePdf({ ...overview, units: filteredUnits })}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            <Download className="h-3.5 w-3.5" /> Resumo (PDF)
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>

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

      <PortalUnitFilter units={overview.units} selectedUnitId={selectedUnitId} onChange={onUnitFilterChange} />

      {blockedFeatures.length > 0 && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <span className="font-semibold text-gray-800">
            {blockedFeatures.join(', ')}{' '}
            {blockedFeatures.length === 1 ? 'está temporariamente indisponível' : 'estão temporariamente indisponíveis'}{' '}
            no seu portal.
          </span>{' '}
          Fale com a equipe da consultoria para liberar.
        </section>
      )}

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Seções do portal">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                isActive ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route
          index
          element={
            hasScoredVisit
              ? <PortalCompliance units={filteredUnits} />
              : emptyState('Ainda não há inspeções com nota de conformidade para mostrar aqui.')
          }
        />
        <Route
          path="plano-de-acao"
          element={
            overview.action_plan_enabled ? (
              <PortalActionPlan
                items={actionItems}
                error={actionItemsError}
                groupByUnit={groupActionPlanByUnit}
                onSelectUnit={onUnitFilterChange}
                onSubmitEvidence={onSubmitEvidence}
                onDeclareStatus={onDeclareStatus}
                onRetry={onRetryActionItems}
                alwaysShow
              />
            ) : (
              <Navigate to="/cliente" replace />
            )
          }
        />
        <Route
          path="solicitacoes"
          element={
            overview.service_requests_enabled ? (
              <PortalServiceRequests
                requests={serviceRequests}
                units={overview.units}
                error={serviceRequestsError}
                onCreate={onCreateServiceRequest}
                onReply={onReplyServiceRequest}
                onRetry={onRetryServiceRequests}
              />
            ) : (
              <Navigate to="/cliente" replace />
            )
          }
        />
        <Route path="documentos" element={<PortalDocuments visits={filteredVisits} />} />
        <Route
          path="agenda"
          element={
            filteredUnits.length === 0 ? (
              emptyState('Nenhuma unidade vinculada ao seu acesso ainda. Fale com a equipe da consultoria.')
            ) : (
              <>
                <PortalAppointments visits={filteredVisits} schedulingSuspended={schedulingSuspended} />
                <p className="mt-4 text-center text-xs text-gray-400">
                  Toque em um compromisso para ver seus detalhes e os materiais aplicáveis.
                </p>
              </>
            )
          }
        />
        <Route
          path="financeiro"
          element={
            <PortalBilling
              payment={overview.payment}
              invoices={invoices}
              invoicesError={invoicesError}
              paymentAckBusy={paymentAckBusy}
              paymentAckSent={paymentAckSent}
              onAcknowledgePayment={onAcknowledgePayment}
              onAudit={audit}
              onRetryInvoices={onRetryInvoices}
            />
          }
        />
        <Route path="*" element={<Navigate to="/cliente" replace />} />
      </Routes>
    </main>
  );
}
