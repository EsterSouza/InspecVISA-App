import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, KeyRound, Loader2, Mail } from 'lucide-react';
import { PublicHeader } from '../components/public/PublicHeader';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import {
  type NextActionOverdueItem,
  type NextActionPaymentOverdue,
  type NextActionReturnedEvidence,
  type NextActionUpcomingAppointment,
} from '../components/client/PortalNextAction';
import {
  type DeclareStatusHandler,
  type SubmitEvidenceHandler,
} from '../components/client/PortalActionPlan';
import {
  type CreateServiceRequestHandler,
  type ReplyServiceRequestHandler,
} from '../components/client/PortalServiceRequests';
import { type PortalAppointmentVisit } from '../components/client/PortalAppointments';
import { ClientPortalShell } from '../components/client/ClientPortalShell';
import {
  clientPortalService,
  type ClientPortalActionItem,
  type ClientPortalInvoice,
  type ClientPortalOverview,
  type ClientPortalServiceRequest,
} from '../services/clientPortalService';
import { paymentLinks } from '../utils/clientPortalFormat';
import { toDateKey } from '../utils/date';

const ACTIVE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled', 'completed']);

// Janela de antecedência para o sinal "compromisso próximo" na próxima ação: visitas
// mais distantes não são urgentes o bastante para ocupar o topo da tela.
const UPCOMING_APPOINTMENT_WINDOW_DAYS = 7;

export function ClientPortal() {
  const [token, setToken] = useState<string | null>(() => clientPortalService.getStoredToken());
  const [overview, setOverview] = useState<ClientPortalOverview | null>(null);
  const [invoices, setInvoices] = useState<ClientPortalInvoice[]>([]);
  const [invoicesError, setInvoicesError] = useState(false);
  // Sempre TODAS as unidades: Visão geral, o selo de vencidas do menu e o comparativo de
  // cumprimento precisam do total da conta, não de um recorte por unidade.
  const [actionItems, setActionItems] = useState<ClientPortalActionItem[]>([]);
  const [actionItemsError, setActionItemsError] = useState(false);
  // Só existe quando o cliente filtra uma unidade específica DENTRO do Plano de ação — é aí
  // que `p_client_id` é usado de verdade, buscando de novo no servidor em vez de confiar num
  // recorte feito em memória do payload completo.
  const [unitActionItems, setUnitActionItems] = useState<ClientPortalActionItem[]>([]);
  const [unitActionItemsLoading, setUnitActionItemsLoading] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<ClientPortalServiceRequest[]>([]);
  const [serviceRequestsError, setServiceRequestsError] = useState(false);
  const [loading, setLoading] = useState(!!clientPortalService.getStoredToken());

  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentAckBusy, setPaymentAckBusy] = useState(false);
  const [paymentAckSent, setPaymentAckSent] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const loadActionItems = useCallback(async (portalToken: string, options: { audit?: boolean } = {}) => {
    try {
      const items = await clientPortalService.actionItems(portalToken, null);
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

  const loadUnitActionItems = useCallback(async (portalToken: string, clientId: string) => {
    setUnitActionItemsLoading(true);
    try {
      setUnitActionItems(await clientPortalService.actionItems(portalToken, clientId));
      void clientPortalService.audit(portalToken, 'unit_filter_changed', { client_id: clientId });
    } catch (err) {
      console.warn('[ClientPortal] Falha ao carregar o plano de acao da unidade:', err);
    } finally {
      setUnitActionItemsLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async (portalToken: string) => {
    try {
      const invoiceRows = await clientPortalService.invoices(portalToken);
      setInvoices(invoiceRows);
      setInvoicesError(false);
    } catch (err) {
      console.warn('[ClientPortal] Falha ao carregar notas fiscais:', err);
      setInvoicesError(true);
    }
  }, []);

  const loadServiceRequests = useCallback(async (portalToken: string) => {
    try {
      setServiceRequests(await clientPortalService.serviceRequests(portalToken, null));
      setServiceRequestsError(false);
    } catch (err) {
      console.warn('[ClientPortal] Falha ao carregar as solicitacoes:', err);
      setServiceRequestsError(true);
    }
  }, []);

  const loadOverview = useCallback(
    async (portalToken: string) => {
      setLoading(true);
      try {
        const data = await clientPortalService.overview(portalToken);
        setOverview(data);
        setError(null);
        void clientPortalService.audit(portalToken, 'overview_viewed', { units: data.units.length });
      } catch (err) {
        console.warn('[ClientPortal] Falha ao carregar painel:', err);
        clientPortalService.clearToken();
        setToken(null);
        setOverview(null);
      } finally {
        setLoading(false);
      }
      // Notas fiscais, plano de ação e solicitações em paralelo: cada uma falha sozinha.
      await Promise.all([loadInvoices(portalToken), loadActionItems(portalToken, { audit: true })]);
    },
    [loadInvoices, loadActionItems]
  );

  useEffect(() => {
    if (token) void loadOverview(token);
  }, [token, loadOverview]);

  useEffect(() => {
    if (!token || !overview?.service_requests_enabled) return;
    void loadServiceRequests(token);
  }, [token, overview?.service_requests_enabled, loadServiceRequests]);

  // Filtro de unidade só existe dentro do Plano de ação: quando o cliente escolhe uma
  // unidade, busca de novo no servidor (RPC com `p_client_id`) em vez de confiar num recorte
  // do payload completo já em memória.
  useEffect(() => {
    if (!token || !selectedUnitId) return;
    void loadUnitActionItems(token, selectedUnitId);
  }, [token, selectedUnitId, loadUnitActionItems]);

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
    setUnitActionItems([]);
    setServiceRequests([]);
    setServiceRequestsError(false);
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

  const refreshActionItems = useCallback(async () => {
    if (!token) return;
    const tasks = [loadActionItems(token)];
    if (selectedUnitId) tasks.push(loadUnitActionItems(token, selectedUnitId));
    await Promise.all(tasks);
  }, [token, selectedUnitId, loadActionItems, loadUnitActionItems]);

  // P360-011 — o envio da evidência não muda o item: ele volta do servidor com o estado novo
  // (`pending`) e a pendência continua aberta até a consultora decidir.
  const handleSubmitEvidence: SubmitEvidenceHandler = useCallback(
    async ({ item, file, uploadKey, note, byName, byRole }) => {
      if (!token) throw new Error('Sessão expirada. Entre de novo para enviar o arquivo.');
      await clientPortalService.submitEvidence(token, {
        actionItemId: item.id,
        uploadKey,
        file,
        note,
        byName,
        byRole,
      });
      await refreshActionItems();
    },
    [token, refreshActionItems]
  );

  const handleDeclareStatus: DeclareStatusHandler = useCallback(
    async ({ item, status, note, byName, byRole }) => {
      if (!token) throw new Error('Sessão expirada. Entre de novo para responder.');
      await clientPortalService.setItemStatus(
        { accountToken: token },
        { actionItemId: item.id, status, note, byName, byRole }
      );
      await refreshActionItems();
    },
    [token, refreshActionItems]
  );

  // P360-012 — abrir a solicitação não muda mais nada na tela: ela volta do servidor com
  // número e estado próprios, e é a lista que se recarrega.
  const handleCreateServiceRequest: CreateServiceRequestHandler = useCallback(
    async (input) => {
      if (!token) throw new Error('Sessão expirada. Entre de novo para registrar sua solicitação.');
      const result = await clientPortalService.createServiceRequest(token, input);
      await loadServiceRequests(token);
      return { requestNumber: result.requestNumber, attachmentError: result.attachmentError };
    },
    [token, loadServiceRequests]
  );

  const handleReplyServiceRequest: ReplyServiceRequestHandler = useCallback(
    async ({ request, message, byName, byRole }) => {
      if (!token) throw new Error('Sessão expirada. Entre de novo para responder.');
      await clientPortalService.replyServiceRequest(token, {
        requestId: request.id,
        message,
        byName,
        byRole,
      });
      await loadServiceRequests(token);
    },
    [token, loadServiceRequests]
  );

  const handleUnitFilterChange = useCallback((unitId: string | null) => {
    setSelectedUnitId(unitId);
  }, []);

  const audit = useCallback(
    (eventType: Parameters<typeof clientPortalService.audit>[1], payload?: Record<string, unknown>) => {
      if (token) void clientPortalService.audit(token, eventType, payload);
    },
    [token]
  );

  // ─── Dados derivados (dependem de overview, então ficam antes dos returns condicionais) ──
  // Fora do Plano de ação não existe mais filtro de unidade (decisão do protótipo FE-03):
  // agenda, documentos e financeiro sempre mostram a conta inteira, com a unidade como
  // metadado de cada linha.
  const allVisits: PortalAppointmentVisit[] = useMemo(
    () =>
      (overview?.units || []).flatMap((unit) =>
        unit.visits.map((visit) => ({ ...visit, unitName: unit.client_name, city: unit.city }))
      ),
    [overview]
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
    const candidates = allVisits
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
  }, [allVisits]);

  // Devolução vem ANTES de prazo vencido: o item vencido o cliente já sabe que está atrasado,
  // enquanto a devolução é informação nova, dele para nós, que só ele pode destravar. Se os dois
  // valem para o mesmo item, mandar refazer a evidência é a ação útil.
  const nextActionReturnedEvidence: NextActionReturnedEvidence | null = useMemo(() => {
    const returned = actionItems.find(
      (item) => item.status === 'published' && item.evidence_status === 'changes_requested'
    );
    if (!returned) return null;
    return {
      type: 'evidence_returned',
      unitName: returned.unit_name,
      itemLabel: returned.title,
      href: '/cliente/plano-de-acao',
    };
  }, [actionItems]);

  const nextActionOverdueItem: NextActionOverdueItem | null = useMemo(() => {
    // O mais atrasado primeiro; o portal já entrega a lista ordenada por prazo.
    const overdue = actionItems.find((item) => item.status === 'published' && item.is_overdue);
    if (!overdue || !overdue.due_date) return null;
    return {
      type: 'item_overdue',
      unitName: overdue.unit_name,
      itemLabel: overdue.title,
      dueDate: overdue.due_date,
      href: '/cliente/plano-de-acao',
    };
  }, [actionItems]);

  // ─── Carregando painel ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center py-24" role="status" aria-live="polite">
          <div className="mb-3 h-8 w-8 animate-pulse rounded-full bg-primary-100" aria-hidden="true" />
          <div className="h-3 w-40 animate-pulse rounded bg-surface-sunken" aria-hidden="true" />
          <span className="sr-only">Carregando seu painel...</span>
        </div>
      </div>
    );
  }

  // ─── Login do cliente ────────────────────────────────────────
  if (!token || !overview) {
    return (
      <div className="min-h-screen bg-canvas">
        <PublicHeader />
        <main className="mx-auto max-w-[440px] px-4 py-12">
          <div className="rounded-xl border border-default bg-surface p-6 shadow-sm">
            <h1 className="font-title text-xl font-semibold text-navy">Portal do Cliente</h1>
            <p className="mt-1 text-sm text-navy-3">
              Acompanhe seus compromissos, relatórios, fotos e anexos de todas as suas unidades.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-navy-3" aria-hidden="true" /> E-mail ou usuario
                  </span>
                }
                htmlFor="portal-login-identifier"
              >
                <Input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="contato@suaempresa.com.br ou usuario"
                  className="min-h-11"
                />
              </Field>
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-navy-3" aria-hidden="true" /> Senha
                  </span>
                }
                htmlFor="portal-login-password"
              >
                <Input
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Senha permanente fornecida pela consultoria"
                  className="min-h-11"
                />
              </Field>

              {error && (
                <div role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Acessar meu painel
              </button>
            </form>

            <p className="mt-6 border-t border-default pt-4 text-xs text-navy-3">
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
    <div className="min-h-screen bg-canvas">
      <PublicHeader />
      <ClientPortalShell
        overview={overview}
        invoices={invoices}
        invoicesError={invoicesError}
        actionItems={actionItems}
        actionItemsError={actionItemsError}
        unitActionItems={unitActionItems}
        unitActionItemsLoading={unitActionItemsLoading}
        serviceRequests={serviceRequests}
        serviceRequestsError={serviceRequestsError}
        selectedUnitId={selectedUnitId}
        onUnitFilterChange={handleUnitFilterChange}
        allVisits={allVisits}
        nextActionPayment={nextActionPayment}
        nextActionAppointment={nextActionAppointment}
        nextActionReturnedEvidence={nextActionReturnedEvidence}
        nextActionOverdueItem={nextActionOverdueItem}
        blockedFeatures={blockedFeatures}
        schedulingSuspended={schedulingSuspended}
        totalVisits={totalVisits}
        audit={audit}
        onSubmitEvidence={handleSubmitEvidence}
        onDeclareStatus={handleDeclareStatus}
        onCreateServiceRequest={handleCreateServiceRequest}
        onReplyServiceRequest={handleReplyServiceRequest}
        paymentAckBusy={paymentAckBusy}
        paymentAckSent={paymentAckSent}
        onAcknowledgePayment={() => void handlePaymentAcknowledgement()}
        onLogout={handleLogout}
        onRetryActionItems={() => void loadActionItems(token, { audit: true })}
        onRetryServiceRequests={() => void loadServiceRequests(token)}
        onRetryInvoices={() => void loadInvoices(token)}
      />
    </div>
  );
}
