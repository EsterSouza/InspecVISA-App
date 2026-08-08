import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarPlus, CheckCircle, Phone, RefreshCw } from 'lucide-react';
import type { AppointmentRequest, Client } from '../../types';
import {
  AppointmentAdminService,
  type AppointmentEventNotificationResult,
  type BlockedDateRow,
} from '../../services/appointmentAdminService';
import { ClientService } from '../../services/clientService';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { errorMessage, requestDateTimeValue } from './appointmentRequestsShared';
import { PendingRequestsSection } from './PendingRequestsSection';
import { ActiveRequestsSection } from './ActiveRequestsSection';
import { ClosedRequestsSection } from './ClosedRequestsSection';
import { BlockedDatesSection } from './BlockedDatesSection';
import { ConfirmRequestModal } from './modals/ConfirmRequestModal';
import { AddPhotosModal } from './modals/AddPhotosModal';
import { DueDateModal } from './modals/DueDateModal';
import { NewVisitModal } from './modals/NewVisitModal';
import { RescheduleModal } from './modals/RescheduleModal';
import { NotCompletedModal } from './modals/NotCompletedModal';

// Aviso pós-ação (relatório publicado / confirmação / remarcação / cancelamento).
type EventNotifyKind = 'report_available' | 'confirmed' | 'rescheduled' | 'cancelled';
const EVENT_NOTIFY_TITLES: Record<EventNotifyKind, string> = {
  report_available: 'Relatório publicado',
  confirmed: 'Compromisso confirmado',
  rescheduled: 'Compromisso remarcado',
  cancelled: 'Compromisso cancelado',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-label="Carregando solicitações">
      <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      </div>
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-100" />
        <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
      </div>
      <span className="sr-only">Carregando solicitações...</span>
    </div>
  );
}

export function AppointmentRequestsPanel() {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Cliente/datas bloqueadas falharam ao carregar, mas as solicitações vieram — aviso não
  // bloqueante em vez de esconder o painel inteiro (Promise.allSettled abaixo).
  const [partialError, setPartialError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // id da request em operação

  // Modal de confirmação
  const [confirmTarget, setConfirmTarget] = useState<AppointmentRequest | null>(null);
  // Modal de fotos
  const [photoTarget, setPhotoTarget] = useState<AppointmentRequest | null>(null);
  // Prazo manual
  const [dueDateTarget, setDueDateTarget] = useState<AppointmentRequest | null>(null);
  // Remarcação
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRequest | null>(null);
  // Não realizada
  const [notCompletedTarget, setNotCompletedTarget] = useState<AppointmentRequest | null>(null);
  // Solicitações ativas (fica recolhida por padrão para não ocupar a tela)
  const [showActive, setShowActive] = useState(false);
  // Encerradas (relatório publicado / canceladas) — também recolhida por padrão
  const [showClosed, setShowClosed] = useState(false);
  // Nova visita (agendamento direto pela equipe)
  const [showNewVisit, setShowNewVisit] = useState(false);
  // Aviso pós-ação (relatório publicado / confirmação / remarcação / cancelamento):
  // e-mail (deduplicado) + link de WhatsApp pronto para a consultora encaminhar.
  const [eventNotify, setEventNotify] = useState<{ unitName: string; kind: EventNotifyKind; emailSent: boolean; whatsappLink?: string | null } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    setPartialError(null);
    try {
      const [reqResult, clientResult, blockedResult] = await Promise.allSettled([
        AppointmentAdminService.listRequests(),
        ClientService.getClients(),
        AppointmentAdminService.listBlockedDates(),
      ]);

      if (reqResult.status === 'fulfilled') {
        setRequests(reqResult.value);
      } else {
        throw reqResult.reason;
      }

      setClients(clientResult.status === 'fulfilled' ? clientResult.value : []);
      setBlockedDates(blockedResult.status === 'fulfilled' ? blockedResult.value : []);

      if (clientResult.status === 'rejected' || blockedResult.status === 'rejected') {
        setPartialError(
          'Solicitações carregadas, mas clientes e/ou datas bloqueadas falharam — alguns filtros e o bloqueio de datas podem estar incompletos.'
        );
      }
    } catch (err) {
      console.error('[AppointmentRequestsPanel] Falha ao carregar solicitações:', err);
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const withBusy = async <T,>(id: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(id);
    try {
      const result = await fn();
      await loadData();
      return result;
    } catch (err) {
      console.error(err);
      alert(`Erro: ${errorMessage(err)}`);
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const showEventNotify = (unitName: string, kind: EventNotifyKind, notify: AppointmentEventNotificationResult | null) => {
    if (!notify) return;
    setEventNotify({ unitName, kind, emailSent: notify.emailSent, whatsappLink: notify.whatsappLink });
  };

  const handleReschedule = (request: AppointmentRequest) => {
    setRescheduleTarget(request);
  };

  const handleCancel = (request: AppointmentRequest) => {
    if (!confirm(`Cancelar a solicitação de "${request.unit_name}"?`)) return;
    void withBusy(request.id, () => AppointmentAdminService.cancelRequest(request))
      .then((result) => showEventNotify(request.unit_name, 'cancelled', result ?? null));
  };

  const handleDelete = (request: AppointmentRequest) => {
    if (!confirm(`Excluir definitivamente "${request.unit_name}" do registro de solicitações?`)) return;
    void withBusy(request.id, () => AppointmentAdminService.deleteRequest(request));
  };

  const handleShareReportWhatsapp = async (request: AppointmentRequest) => {
    const portalUrl = `${window.location.origin}/cliente/visita/${request.public_token}`;
    const message = `O relatorio da inspecao sanitaria de ${request.unit_name} ja esta disponivel no Portal do Cliente: ${portalUrl}`;
    const digits = String(request.phone || '').replace(/\D/g, '');
    if (digits) {
      const phone = digits.length <= 11 ? `55${digits}` : digits;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    await navigator.clipboard.writeText(message);
    alert('Mensagem com link do portal copiada para compartilhar no WhatsApp.');
  };

  const handleMarkInProgress = (request: AppointmentRequest) => {
    void withBusy(request.id, () => AppointmentAdminService.markInProgress(request));
  };

  const handleMarkCompleted = (request: AppointmentRequest) => {
    if (!confirm(`Marcar a inspeção de "${request.unit_name}" como concluída?`)) return;
    void withBusy(request.id, () => AppointmentAdminService.markCompleted(request.id));
  };

  const handleMarkNotCompleted = (request: AppointmentRequest) => {
    setNotCompletedTarget(request);
  };

  const handleSetCompliance = (request: AppointmentRequest, score: number | null) => {
    void withBusy(request.id, () => AppointmentAdminService.setComplianceScore(request, score));
  };

  const handleSetAreaScores = (request: AppointmentRequest, sanitary: number | null, nutrition: number | null) => {
    void withBusy(request.id, () => AppointmentAdminService.setAreaScores(request, sanitary, nutrition));
  };

  const handlePublishReport = (request: AppointmentRequest, file: File | null) => {
    if (!file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('O relatório deve ser um arquivo PDF.');
      return;
    }
    setBusy(request.id);
    AppointmentAdminService.publishReport(request, file)
      .then((res) => {
        setEventNotify({ unitName: request.unit_name, kind: 'report_available', emailSent: res.emailSent, whatsappLink: res.whatsappLink });
        return loadData();
      })
      .catch((err) => {
        console.error(err);
        alert(`Erro: ${errorMessage(err)}`);
      })
      .finally(() => setBusy(null));
  };

  const handleAddAttachment = (request: AppointmentRequest, file: File | null) => {
    if (!file) return;
    void withBusy(request.id, () => AppointmentAdminService.addAttachment(request, file));
  };

  const handleToggleReportHidden = (request: AppointmentRequest) => {
    const next = !request.report_hidden;
    void withBusy(request.id, () => AppointmentAdminService.setReportHidden(request, next));
  };

  // Mais recentes primeiro; as mais antigas ficam no fim (e nas últimas páginas).
  const byNewestFirst = (a: AppointmentRequest, b: AppointmentRequest) =>
    requestDateTimeValue(b) - requestDateTimeValue(a);
  const pending = requests.filter((r) => r.status === 'requested').sort(byNewestFirst);
  const active = requests
    .filter((r) => ['confirmed', 'in_progress', 'rescheduled', 'completed'].includes(r.status))
    .sort(byNewestFirst);
  const closed = requests
    .filter((r) => ['report_available', 'cancelled'].includes(r.status))
    .sort(byNewestFirst);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (loadError) {
    return (
      <Card className="border-red-100 bg-red-50/70 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="alert">
              <h2 className="text-sm font-bold text-red-800">Não foi possível carregar as solicitações</h2>
              <p className="mt-1 text-sm text-red-700">{loadError}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              className="min-h-11 border-red-200 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      {partialError && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {partialError}
          </span>
          <Button variant="outline" size="sm" onClick={() => void loadData()} className="min-h-11 border-amber-300 text-amber-800 hover:bg-amber-100">
            <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      )}

      {/* ─── Nova visita (agendamento direto pela equipe) ───── */}
      <div className="flex items-center justify-between rounded-xl border border-primary-100 bg-primary-50/50 p-4">
        <div>
          <p className="text-sm font-bold text-gray-900">Agendar você mesma</p>
          <p className="text-xs text-gray-500">
            Cria uma visita já confirmada e vinculada ao cliente — aparece no portal dele com rastreio completo.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNewVisit(true)}>
          <CalendarPlus className="mr-1.5 h-4 w-4" /> Nova visita
        </Button>
      </div>

      <PendingRequestsSection
        pending={pending}
        busy={busy}
        onRefresh={() => void loadData()}
        onConfirm={setConfirmTarget}
        onReschedule={handleReschedule}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />

      <ActiveRequestsSection
        active={active}
        clients={clients}
        busy={busy}
        show={showActive}
        onToggleShow={() => setShowActive((v) => !v)}
        onPublishReport={handlePublishReport}
        onAddAttachment={handleAddAttachment}
        onAddPhotos={setPhotoTarget}
        onSetDueDate={setDueDateTarget}
        onCancel={handleCancel}
        onMarkInProgress={handleMarkInProgress}
        onMarkCompleted={handleMarkCompleted}
        onMarkNotCompleted={handleMarkNotCompleted}
        onReschedule={handleReschedule}
        onSetCompliance={handleSetCompliance}
        onSetAreaScores={handleSetAreaScores}
        onToggleReportHidden={handleToggleReportHidden}
        onDelete={handleDelete}
      />

      <ClosedRequestsSection
        closed={closed}
        clients={clients}
        busy={busy}
        show={showClosed}
        onToggleShow={() => setShowClosed((v) => !v)}
        onPublishReport={handlePublishReport}
        onAddAttachment={handleAddAttachment}
        onAddPhotos={setPhotoTarget}
        onSetDueDate={setDueDateTarget}
        onCancel={handleCancel}
        onMarkInProgress={handleMarkInProgress}
        onShareWhatsapp={(request) => void handleShareReportWhatsapp(request)}
        onSetCompliance={handleSetCompliance}
        onSetAreaScores={handleSetAreaScores}
        onToggleReportHidden={handleToggleReportHidden}
        onDelete={handleDelete}
      />

      {/* ─── Datas bloqueadas ───────────────────────────────── */}
      <BlockedDatesSection blockedDates={blockedDates} onChanged={() => void loadData()} />

      {/* ─── Modais ─────────────────────────────────────────── */}
      {confirmTarget && (
        <ConfirmRequestModal
          request={confirmTarget}
          clients={clients}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={(notify) => {
            showEventNotify(confirmTarget.unit_name, 'confirmed', notify);
            setConfirmTarget(null);
            void loadData();
          }}
        />
      )}

      {photoTarget && (
        <AddPhotosModal
          request={photoTarget}
          onClose={() => setPhotoTarget(null)}
          onAdded={() => {
            setPhotoTarget(null);
            void loadData();
          }}
        />
      )}

      {dueDateTarget && (
        <DueDateModal
          request={dueDateTarget}
          onClose={() => setDueDateTarget(null)}
          onSaved={() => {
            setDueDateTarget(null);
            void loadData();
          }}
        />
      )}

      {rescheduleTarget && (
        <RescheduleModal
          request={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={(notify) => {
            showEventNotify(rescheduleTarget.unit_name, 'rescheduled', notify);
            setRescheduleTarget(null);
            void loadData();
          }}
        />
      )}

      {notCompletedTarget && (
        <NotCompletedModal
          request={notCompletedTarget}
          onClose={() => setNotCompletedTarget(null)}
          onSaved={() => {
            setNotCompletedTarget(null);
            void loadData();
          }}
        />
      )}

      {showNewVisit && (
        <NewVisitModal
          clients={clients}
          onClose={() => setShowNewVisit(false)}
          onCreated={() => {
            setShowNewVisit(false);
            void loadData();
          }}
        />
      )}

      {eventNotify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card role="dialog" aria-modal="true" aria-labelledby="event-notify-title" className="w-full max-w-sm shadow-2xl">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 id="event-notify-title" className="text-lg font-bold text-gray-900">
                {EVENT_NOTIFY_TITLES[eventNotify.kind]}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{eventNotify.unitName}</p>
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700" aria-live="polite">
                {eventNotify.emailSent
                  ? 'E-mail enviado ao cliente automaticamente.'
                  : 'Sem e-mail cadastrado do cliente — avise pelo WhatsApp abaixo.'}
              </p>
              {eventNotify.whatsappLink ? (
                <a
                  href={eventNotify.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100"
                >
                  <Phone className="h-4 w-4" /> Avisar no WhatsApp
                </a>
              ) : (
                <p className="mt-4 text-xs text-gray-500">Cliente sem WhatsApp cadastrado.</p>
              )}
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setEventNotify(null)}>
                Fechar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
