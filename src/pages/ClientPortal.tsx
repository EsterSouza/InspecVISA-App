import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
} from 'lucide-react';
import { PublicHeader } from '../components/public/PublicHeader';
import { PortalQuickActions } from '../components/client/PortalQuickActions';
import {
  PortalNextAction,
  type NextActionOverdueItem,
  type NextActionPaymentOverdue,
  type NextActionReturnedEvidence,
  type NextActionUpcomingAppointment,
} from '../components/client/PortalNextAction';
import { PortalActionPlan, type SubmitEvidenceHandler } from '../components/client/PortalActionPlan';
import { PortalAppointments, type PortalAppointmentVisit } from '../components/client/PortalAppointments';
import { PortalDocuments } from '../components/client/PortalDocuments';
import { PortalBilling } from '../components/client/PortalBilling';
import { PortalCompliance } from '../components/client/PortalCompliance';
import {
  clientPortalService,
  type ClientPortalActionItem,
  type ClientPortalInvoice,
  type ClientPortalOverview,
} from '../services/clientPortalService';
import { generateFranchisePdf } from '../utils/franchiseReport';
import { filterUnitsBySelection, paymentLinks, toDateKey } from '../utils/clientPortalFormat';

const ACTIVE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled', 'completed']);

// Janela de antecedência para o sinal "compromisso próximo" na próxima ação: visitas
// mais distantes não são urgentes o bastante para ocupar o topo da tela.
const UPCOMING_APPOINTMENT_WINDOW_DAYS = 7;

export function ClientPortal() {
  const [token, setToken] = useState<string | null>(() => clientPortalService.getStoredToken());
  const [overview, setOverview] = useState<ClientPortalOverview | null>(null);
  const [invoices, setInvoices] = useState<ClientPortalInvoice[]>([]);
  const [invoicesError, setInvoicesError] = useState(false);
  const [actionItems, setActionItems] = useState<ClientPortalActionItem[]>([]);
  const [actionItemsError, setActionItemsError] = useState(false);
  const [loading, setLoading] = useState(!!clientPortalService.getStoredToken());

  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentAckBusy, setPaymentAckBusy] = useState(false);
  const [paymentAckSent, setPaymentAckSent] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  // Calendário: começa sempre no mês corrente
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadActionItems = useCallback(async (portalToken: string, options: { audit?: boolean } = {}) => {
    try {
      const items = await clientPortalService.actionItems(portalToken);
      setActionItems(items);
      setActionItemsError(false);
      if (options.audit && items.length > 0) {
        void clientPortalService.audit(portalToken, 'action_plan_viewed', {
          open: items.filter((item) => item.status !== 'resolved').length,
          overdue: items.filter((item) => item.is_overdue).length,
        });
      }
    } catch (err) {
      console.warn('[ClientPortal] Falha ao carregar o plano de acao:', err);
      setActionItemsError(true);
    }
  }, []);

  const loadOverview = useCallback(async (portalToken: string) => {
    setLoading(true);
    try {
      const data = await clientPortalService.overview(portalToken);
      setOverview(data);
      setError(null);
      void clientPortalService.audit(portalToken, 'overview_viewed', {
        units: data.units.length,
      });
    } catch (err) {
      console.warn('[ClientPortal] Falha ao carregar painel:', err);
      clientPortalService.clearToken();
      setToken(null);
      setOverview(null);
    } finally {
      setLoading(false);
    }

    // Notas fiscais e plano de ação em chamadas separadas e em paralelo: cada uma falha
    // sozinha, e a pendência sanitária não pode esperar a Edge Function do financeiro.
    await Promise.all([
      clientPortalService
        .invoices(portalToken)
        .then((invoiceRows) => {
          setInvoices(invoiceRows);
          setInvoicesError(false);
        })
        .catch((err) => {
          console.warn('[ClientPortal] Falha ao carregar notas fiscais:', err);
          setInvoicesError(true);
        }),
      loadActionItems(portalToken, { audit: true }),
    ]);
  }, [loadActionItems]);

  useEffect(() => {
    if (token) void loadOverview(token);
  }, [token, loadOverview]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !code.trim()) {
      setError('Informe o e-mail/usuario e a senha.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await clientPortalService.login(identifier.trim(), code.trim());
      clientPortalService.storeToken(result.portal_token);
      setToken(result.portal_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar agora.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clientPortalService.clearToken();
    setToken(null);
    setOverview(null);
    setInvoices([]);
    setInvoicesError(false);
    setActionItems([]);
    setActionItemsError(false);
    setSelectedUnitId(null);
    setIdentifier('');
    setCode('');
  };

  const handlePaymentAcknowledgement = async () => {
    if (!token) return;
    setPaymentAckBusy(true);
    try {
      await clientPortalService.acknowledgePayment(token);
      setPaymentAckSent(true);
      void clientPortalService.audit(token, 'payment_acknowledged', { source: 'payment_panel' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel registrar o aviso de pagamento.');
    } finally {
      setPaymentAckBusy(false);
    }
  };

  // P360-011 — o envio da evidência não muda o item: ele volta do servidor com o estado novo
  // (`pending`) e a pendência continua aberta até a consultora decidir.
  const handleSubmitEvidence: SubmitEvidenceHandler = useCallback(
    async ({ item, file, uploadKey, note }) => {
      if (!token) throw new Error('Sessão expirada. Entre de novo para enviar o arquivo.');
      await clientPortalService.submitEvidence(token, {
        actionItemId: item.id,
        uploadKey,
        file,
        note,
      });
      await loadActionItems(token);
    },
    [token, loadActionItems]
  );

  const handleUnitFilterChange = (unitId: string | null) => {
    setSelectedUnitId(unitId);
    if (token) void clientPortalService.audit(token, 'unit_filter_changed', { client_id: unitId });
  };

  const audit = useCallback(
    (eventType: Parameters<typeof clientPortalService.audit>[1], payload?: Record<string, unknown>) => {
      if (token) void clientPortalService.audit(token, eventType, payload);
    },
    [token]
  );

  // ─── Dados derivados (dependem de overview, então ficam antes dos returns condicionais) ──
  const filteredUnits = useMemo(
    () => filterUnitsBySelection(overview?.units || [], selectedUnitId),
    [overview, selectedUnitId]
  );
  const filteredVisits: PortalAppointmentVisit[] = useMemo(
    () =>
      filteredUnits.flatMap((unit) =>
        unit.visits.map((visit) => ({ ...visit, unitName: unit.client_name, city: unit.city }))
      ),
    [filteredUnits]
  );

  const nextActionPayment: NextActionPaymentOverdue | null = useMemo(() => {
    const payment = overview?.payment;
    if (!payment || payment.status !== 'pending') return null;
    const dueDateKey = payment.due_date?.split('T')[0] ?? null;
    const overdue = !dueDateKey || dueDateKey <= toDateKey(new Date());
    if (!overdue) return null;
    const links = paymentLinks(payment);
    if (links.length === 0) return null;
    return { type: 'payment_overdue', dueDate: payment.due_date ?? null, links };
  }, [overview]);

  const nextActionAppointment: NextActionUpcomingAppointment | null = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + UPCOMING_APPOINTMENT_WINDOW_DAYS);
    const limitKey = toDateKey(limitDate);
    const candidates = filteredVisits
      .filter(
        (v) =>
          v.requested_date &&
          v.requested_date >= todayKey &&
          v.requested_date <= limitKey &&
          ACTIVE_VISIT_STATUSES.has(v.status)
      )
      .sort((a, b) => `${a.requested_date}${a.requested_time || ''}`.localeCompare(`${b.requested_date}${b.requested_time || ''}`));
    const next = candidates[0];
    if (!next || !next.requested_date) return null;
    return {
      type: 'upcoming_appointment',
      unitName: next.unitName,
      date: next.requested_date,
      time: next.requested_time,
      publicToken: next.public_token,
    };
  }, [filteredVisits]);

  const filteredActionItems = useMemo(
    () => (selectedUnitId ? actionItems.filter((item) => item.client_id === selectedUnitId) : actionItems),
    [actionItems, selectedUnitId]
  );

  // Devolução vem ANTES de prazo vencido: o item vencido o cliente já sabe que está atrasado,
  // enquanto a devolução é informação nova, dele para nós, que só ele pode destravar. Se os dois
  // valem para o mesmo item, mandar refazer a evidência é a ação útil.
  const nextActionReturnedEvidence: NextActionReturnedEvidence | null = useMemo(() => {
    const returned = filteredActionItems.find(
      (item) => item.status === 'published' && item.evidence_status === 'changes_requested'
    );
    if (!returned) return null;
    return {
      type: 'evidence_returned',
      unitName: returned.unit_name,
      itemLabel: returned.title,
      href: '#portal-action-plan',
    };
  }, [filteredActionItems]);

  const nextActionOverdueItem: NextActionOverdueItem | null = useMemo(() => {
    // O mais atrasado primeiro; o portal já entrega a lista ordenada por prazo.
    const overdue = filteredActionItems.find((item) => item.status === 'published' && item.is_overdue);
    if (!overdue || !overdue.due_date) return null;
    return {
      type: 'item_overdue',
      unitName: overdue.unit_name,
      itemLabel: overdue.title,
      dueDate: overdue.due_date,
      href: '#portal-action-plan',
    };
  }, [filteredActionItems]);

  // ─── Carregando painel ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-600" />
          <p className="text-sm text-gray-500">Carregando seu painel...</p>
        </div>
      </div>
    );
  }

  // ─── Login do cliente ────────────────────────────────────────
  if (!token || !overview) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <main className="mx-auto max-w-[440px] px-4 py-12">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Portal do Cliente</h2>
            <p className="mt-1 text-sm text-gray-500">
              Acompanhe seus compromissos, relatórios, fotos e anexos de todas as suas unidades.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" /> E-mail ou usuario
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="contato@suaempresa.com.br ou usuario"
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <KeyRound className="h-4 w-4 text-gray-400" /> Senha
                </label>
                <input
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Senha permanente fornecida pela consultoria"
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Acessar meu painel
              </button>
            </form>

            <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-400">
              Ainda não tem acesso? Solicite a senha à equipe da consultoria. Para acompanhar
              uma única visita, use o link do protocolo recebido no agendamento.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ─── Painel do cliente ───────────────────────────────────────
  const schedulingSuspended = !!overview.scheduling_suspended;
  // Esconder entrega sem dizer nada faria o portal mentir ("nenhum relatório disponível").
  // O cliente não vê o motivo, mas sabe que existe e a quem perguntar.
  const blockedFeatures = (
    [
      ['reports', 'Relatórios e documentos'],
      ['photos', 'Fotos'],
      ['compliance', 'Indicadores de conformidade'],
      ['action_plan', 'Plano de ação'],
    ] as const
  )
    .filter(([key]) => overview.feature_gates?.[key] === false)
    .map(([, label]) => label);
  const totalVisits = overview.units.reduce((sum, u) => sum + u.visits.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
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
              onClick={() => generateFranchisePdf(overview)}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
            >
              <Download className="h-3.5 w-3.5" /> Resumo (PDF)
            </button>
            <button
              type="button"
              onClick={handleLogout}
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

        {overview.units.length > 1 && (
          <div className="mb-6 flex items-center gap-2">
            <label htmlFor="portal-unit-filter" className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Unidade
            </label>
            <select
              id="portal-unit-filter"
              value={selectedUnitId ?? ''}
              onChange={(e) => handleUnitFilterChange(e.target.value || null)}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Todas</option>
              {overview.units.map((unit) => (
                <option key={unit.client_id} value={unit.client_id}>
                  {unit.client_name}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {overview.action_plan_enabled && (
          <PortalActionPlan
            items={filteredActionItems}
            error={actionItemsError}
            showUnitName={overview.units.length > 1 && !selectedUnitId}
            onSubmitEvidence={handleSubmitEvidence}
          />
        )}

        <PortalDocuments visits={filteredVisits} />

        <PortalCompliance units={filteredUnits} />

        <PortalBilling
          payment={overview.payment}
          invoices={invoices}
          invoicesError={invoicesError}
          paymentAckBusy={paymentAckBusy}
          paymentAckSent={paymentAckSent}
          onAcknowledgePayment={() => void handlePaymentAcknowledgement()}
          onAudit={audit}
        />

        {filteredUnits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Nenhuma unidade vinculada ao seu acesso ainda. Fale com a equipe da consultoria.
          </div>
        ) : (
          <PortalAppointments
            visits={filteredVisits}
            schedulingSuspended={schedulingSuspended}
            calendarMonth={calendarMonth}
            onCalendarMonthChange={setCalendarMonth}
          />
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
          Toque em um compromisso para ver seus detalhes e os materiais aplicáveis.
        </p>
      </main>
    </div>
  );
}
