import { Download, LogOut } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { ClientPortalAuditEventType } from '../../types';
import type {
  ClientPortalActionItem,
  ClientPortalInvoice,
  ClientPortalOverview,
  ClientPortalServiceRequest,
} from '../../services/clientPortalService';
import { generateFranchisePdf } from '../../utils/franchiseReport';
import { computeUnitActionStats } from '../../utils/clientPortalFormat';
import { Badge } from '../ui/Badge';
import {
  PortalNextAction,
  type NextActionOverdueItem,
  type NextActionPaymentOverdue,
  type NextActionReturnedEvidence,
  type NextActionUpcomingAppointment,
} from './PortalNextAction';
import { PortalOverview } from './PortalOverview';
import { PortalActionPlanPage } from './PortalActionPlanPage';
import { type DeclareStatusHandler, type SubmitEvidenceHandler } from './PortalActionPlan';
import {
  PortalServiceRequests,
  type CreateServiceRequestHandler,
  type ReplyServiceRequestHandler,
} from './PortalServiceRequests';
import { PortalAppointments, type PortalAppointmentVisit } from './PortalAppointments';
import { PortalDocuments } from './PortalDocuments';
import { PortalFolders } from './PortalFolders';
import { PortalBilling } from './PortalBilling';

interface ClientPortalShellProps {
  overview: ClientPortalOverview;
  invoices: ClientPortalInvoice[];
  invoicesError: boolean;
  actionItems: ClientPortalActionItem[];
  actionItemsError: boolean;
  unitActionItems: ClientPortalActionItem[];
  unitActionItemsLoading: boolean;
  serviceRequests: ClientPortalServiceRequest[];
  serviceRequestsError: boolean;
  selectedUnitId: string | null;
  onUnitFilterChange: (unitId: string | null) => void;
  allVisits: PortalAppointmentVisit[];
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
  <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-navy-2">
    {message}
  </div>
);

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return letters || '?';
}

export function ClientPortalShell({
  overview,
  invoices,
  invoicesError,
  actionItems,
  actionItemsError,
  unitActionItems,
  unitActionItemsLoading,
  serviceRequests,
  serviceRequestsError,
  selectedUnitId,
  onUnitFilterChange,
  allVisits,
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
  const navigate = useNavigate();
  const overdueCount = computeUnitActionStats(actionItems).reduce((sum, s) => sum + s.overdue, 0);

  // Clique no nome da unidade em "Cumprimento por unidade", na Visão geral: filtra o plano de
  // ação nela E navega pra lá — a página só existe se `action_plan_enabled`.
  const handleSelectUnitFromOverview = (clientId: string) => {
    onUnitFilterChange(clientId);
    if (overview.action_plan_enabled) navigate('plano-de-acao');
  };

  const tabs: { to: string; label: string; end?: boolean; pill?: number }[] = [
    { to: '/cliente', label: 'Visão geral', end: true },
    ...(overview.action_plan_enabled
      ? [{ to: '/cliente/plano-de-acao', label: 'Plano de ação', pill: overdueCount }]
      : []),
    ...(overview.service_requests_enabled ? [{ to: '/cliente/solicitacoes', label: 'Solicitações' }] : []),
    { to: '/cliente/documentos', label: 'Documentos' },
    { to: '/cliente/agenda', label: 'Agenda' },
    { to: '/cliente/financeiro', label: 'Financeiro' },
  ];

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-primary-700 font-title text-sm font-semibold text-white"
              >
                {initials(overview.account_name)}
              </span>
              <div>
                <p className="font-title text-lg font-semibold leading-tight text-navy">{overview.account_name}</p>
                <p className="text-xs text-navy-2">
                  Portal do Cliente · {overview.units.length} unidade{overview.units.length === 1 ? '' : 's'} ·{' '}
                  {totalVisits} compromisso{totalVisits === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Contrato ativo</Badge>
              <button
                type="button"
                onClick={() => generateFranchisePdf(overview)}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
              >
                <Download className="h-3.5 w-3.5" /> Resumo (PDF)
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-navy-2 hover:bg-gray-50"
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </div>
          </div>

          <nav className="mt-5 flex gap-0 overflow-x-auto" aria-label="Seções do portal">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className="relative shrink-0">
                {({ isActive }) => (
                  <span
                    className={`flex h-[46px] items-center gap-2 whitespace-nowrap px-4 text-sm font-semibold transition-colors ${
                      isActive ? 'text-primary-800' : 'text-navy-2 hover:text-navy'
                    }`}
                  >
                    {tab.label}
                    {!!tab.pill && (
                      <span className="rounded-sm border border-amber-soft-border bg-amber-soft px-1.5 text-[11px] font-bold leading-5 text-amber-soft-ink">
                        {tab.pill}
                      </span>
                    )}
                    <span
                      className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary-700 transition-transform ${
                        isActive ? 'scale-x-100' : 'scale-x-0'
                      }`}
                    />
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
        {blockedFeatures.length > 0 && (
          <section className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-navy-2">
            <span className="font-semibold text-navy">
              {blockedFeatures.join(', ')}{' '}
              {blockedFeatures.length === 1 ? 'está temporariamente indisponível' : 'estão temporariamente indisponíveis'}{' '}
              no seu portal.
            </span>{' '}
            Fale com a equipe da consultoria para liberar.
          </section>
        )}

        <Routes>
          <Route
            index
            element={
              <PortalOverview
                overview={overview}
                actionItems={actionItems}
                allVisits={allVisits}
                schedulingSuspended={schedulingSuspended}
                nextActionPayment={nextActionPayment}
                nextActionAppointment={nextActionAppointment}
                nextActionReturnedEvidence={nextActionReturnedEvidence}
                nextActionOverdueItem={nextActionOverdueItem}
                audit={audit}
                onSelectUnit={handleSelectUnitFromOverview}
              />
            }
          />
          <Route
            path="plano-de-acao"
            element={
              overview.action_plan_enabled ? (
                <PortalActionPlanPage
                  overview={overview}
                  actionItems={actionItems}
                  actionItemsError={actionItemsError}
                  unitActionItems={unitActionItems}
                  unitActionItemsLoading={unitActionItemsLoading}
                  selectedUnitId={selectedUnitId}
                  onUnitFilterChange={onUnitFilterChange}
                  onSubmitEvidence={onSubmitEvidence}
                  onDeclareStatus={onDeclareStatus}
                  onRetry={onRetryActionItems}
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
          <Route path="documentos" element={<PortalDocuments visits={allVisits} />} />
          <Route
            path="pastas"
            element={
              <PortalFolders
                mainDriveFolderUrl={overview.main_drive_folder_url}
                units={overview.units}
                onOpen={(unitName) =>
                  unitName
                    ? audit('sanitary_folder_opened', { unit_name: unitName })
                    : audit('main_drive_folder_opened')
                }
              />
            }
          />
          <Route
            path="agenda"
            element={
              allVisits.length === 0 ? (
                emptyState('Nenhuma unidade vinculada ao seu acesso ainda. Fale com a equipe da consultoria.')
              ) : (
                <>
                  <PortalAppointments visits={allVisits} units={overview.units} schedulingSuspended={schedulingSuspended} />
                  <p className="mt-4 text-center text-xs text-navy-2">
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
    </>
  );
}
