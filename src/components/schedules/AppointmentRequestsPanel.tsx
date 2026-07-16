import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  FileUp,
  Gauge,
  ImagePlus,
  Inbox,
  Loader2,
  MapPin,
  Paperclip,
  Phone,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  AppointmentAttachment,
  AppointmentRequest,
  Client,
  Schedule,
} from '../../types';
import {
  AppointmentAdminService,
  type BlockedDateRow,
  type InspectionOption,
  type InspectionPhotoOption,
} from '../../services/appointmentAdminService';
import { ClientService } from '../../services/clientService';
import { ScheduleService } from '../../services/scheduleService';
import { getActiveTenantId } from '../../utils/localScope';
import { getLocalActor } from '../../utils/localActor';
import { generateId } from '../../utils/imageUtils';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

const PERIOD_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  integral: 'Integral',
};

// Consultoras da equipe — quem fica responsável pela visita (a inspeção herda).
const SCHEDULE_CONSULTANTS = ['Ester Caiafa', 'Ana Roberta Ribeiro'];
function defaultScheduleConsultants(): string[] {
  const me = getLocalActor().name;
  return SCHEDULE_CONSULTANTS.includes(me) ? [me] : [];
}

interface ConsultantPickerProps {
  selected: string[];
  onToggle: (name: string) => void;
}

function ConsultantPicker({ selected, onToggle }: ConsultantPickerProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">Consultora(s) responsável(is)</label>
      <div className="flex flex-wrap gap-2">
        {SCHEDULE_CONSULTANTS.map((name) => {
          const active = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => onToggle(name)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400">A inspeção criada a partir desta visita herda quem você marcar.</p>
    </div>
  );
}

const STATUS_LABELS: Record<AppointmentRequest['status'], string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Relatório concluído',
  report_available: 'Relatório disponível',
  cancelled: 'Cancelada',
};

const STATUS_BADGES: Record<AppointmentRequest['status'], string> = {
  requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  rescheduled: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  report_available: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'operação falhou.';
}

function formatDateBR(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function requestDateTimeValue(request: AppointmentRequest): number {
  if (request.requested_starts_at) return new Date(request.requested_starts_at).getTime();
  const date = request.requested_date || request.created_at;
  const time = request.requested_time || '23:59';
  return new Date(`${date.split('T')[0]}T${time}`).getTime();
}

function requestTimeValue(request: AppointmentRequest): string {
  if (request.requested_time) return request.requested_time.slice(0, 5);
  if (request.requested_starts_at) {
    return new Date(request.requested_starts_at).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return '09:00';
}

export function AppointmentRequestsPanel() {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  // Encerradas (relatório publicado / canceladas)
  const [showClosed, setShowClosed] = useState(true);
  // Nova visita (agendamento direto pela equipe)
  const [showNewVisit, setShowNewVisit] = useState(false);
  // Aviso pós-publicação de relatório (e-mail + link de WhatsApp)
  const [reportNotify, setReportNotify] = useState<{ unitName: string; emailSent: boolean; whatsappLink?: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
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

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
      await loadData();
    } catch (err) {
      console.error(err);
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleReschedule = (request: AppointmentRequest) => {
    setRescheduleTarget(request);
  };

  const handleCancel = (request: AppointmentRequest) => {
    if (!confirm(`Cancelar a solicitação de "${request.unit_name}"?`)) return;
    void withBusy(request.id, () => AppointmentAdminService.cancelRequest(request));
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
    void withBusy(request.id, () => AppointmentAdminService.markInProgress(request.id));
  };

  const handleMarkCompleted = (request: AppointmentRequest) => {
    if (!confirm(`Marcar a inspeção de "${request.unit_name}" como concluída?`)) return;
    void withBusy(request.id, () => AppointmentAdminService.markCompleted(request.id));
  };

  const handleMarkNotCompleted = (request: AppointmentRequest) => {
    setNotCompletedTarget(request);
  };

  const handleSetCompliance = (request: AppointmentRequest, score: number | null) => {
    void withBusy(request.id, () => AppointmentAdminService.setComplianceScore(request.id, score));
  };

  const handleSetAreaScores = (request: AppointmentRequest, sanitary: number | null, nutrition: number | null) => {
    void withBusy(request.id, () => AppointmentAdminService.setAreaScores(request.id, sanitary, nutrition));
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
        setReportNotify({ unitName: request.unit_name, emailSent: res.emailSent, whatsappLink: res.whatsappLink });
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
    void withBusy(request.id, () => AppointmentAdminService.setReportHidden(request.id, next));
  };

  const byAppointmentDate = (a: AppointmentRequest, b: AppointmentRequest) =>
    requestDateTimeValue(a) - requestDateTimeValue(b);
  const pending = requests.filter((r) => r.status === 'requested').sort(byAppointmentDate);
  const active = requests
    .filter((r) => ['confirmed', 'in_progress', 'rescheduled', 'completed'].includes(r.status))
    .sort(byAppointmentDate);
  const closed = requests
    .filter((r) => ['report_available', 'cancelled'].includes(r.status))
    .sort(byAppointmentDate);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="border-red-100 bg-red-50/70 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-red-800">Não foi possível carregar as solicitações</h2>
              <p className="mt-1 text-sm text-red-700">{loadError}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              className="border-red-200 text-red-700 hover:bg-red-100"
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

      {/* ─── Solicitações pendentes ─────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center text-lg font-semibold text-gray-900">
            <Inbox className="mr-2 h-5 w-5 text-amber-500" />
            Solicitações pendentes
            {pending.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {pending.length}
              </span>
            )}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => void loadData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {pending.length === 0 ? (
          <Card className="border-dashed bg-gray-50 py-10 text-center">
            <p className="text-sm text-gray-500">Nenhuma solicitação pendente do portal público.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pending.map((request) => (
              <Card key={request.id} className="border-l-4 border-l-amber-400 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900">{request.unit_name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="flex items-center">
                          <MapPin className="mr-1 h-3.5 w-3.5" /> {request.district}
                        </span>
                        <span className="flex items-center">
                          <CalendarDays className="mr-1 h-3.5 w-3.5" />
                          {formatDateBR(request.requested_date)}
                          {request.requested_period
                            ? ` · ${PERIOD_LABELS[request.requested_period] || request.requested_period}`
                            : ''}
                        </span>
                        {request.phone && (
                          <span className="flex items-center">
                            <Phone className="mr-1 h-3.5 w-3.5" /> {request.phone}
                          </span>
                        )}
                        <span className="flex items-center text-xs text-gray-400">
                          <Clock className="mr-1 h-3 w-3" /> recebida em {formatCreatedAt(request.created_at)}
                        </span>
                      </div>
                      {request.notes && (
                        <p className="mt-2 text-sm italic text-gray-500">“{request.notes}”</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        disabled={busy === request.id}
                        onClick={() => setConfirmTarget(request)}
                      >
                        <CheckCircle className="mr-1.5 h-4 w-4" /> Confirmar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === request.id}
                        onClick={() => handleReschedule(request)}
                      >
                        Remarcar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === request.id}
                        onClick={() => handleCancel(request)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === request.id}
                        onClick={() => handleDelete(request)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ─── Solicitações ativas ────────────────────────────── */}
      <section>
        <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900">
          <CheckCircle className="mr-2 h-5 w-5 text-primary-600" />
          Solicitações ativas
        </h2>

        {active.length === 0 ? (
          <Card className="border-dashed bg-gray-50 py-10 text-center">
            <p className="text-sm text-gray-500">Nenhuma solicitação ativa no momento.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {active.map((request) => (
              <ActiveRequestCard
                key={request.id}
                request={request}
                busy={busy === request.id}
                onPublishReport={(file) => handlePublishReport(request, file)}
                onAddAttachment={(file) => handleAddAttachment(request, file)}
                onAddPhotos={() => setPhotoTarget(request)}
                onSetDueDate={() => setDueDateTarget(request)}
                onCancel={() => handleCancel(request)}
                onMarkInProgress={() => handleMarkInProgress(request)}
                onMarkCompleted={() => handleMarkCompleted(request)}
                onMarkNotCompleted={() => handleMarkNotCompleted(request)}
                onReschedule={() => handleReschedule(request)}
                onSetCompliance={(score) => handleSetCompliance(request, score)}
                onSetAreaScores={(sanitary, nutrition) => handleSetAreaScores(request, sanitary, nutrition)}
                onToggleReportHidden={() => handleToggleReportHidden(request)}
                onDelete={() => handleDelete(request)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Encerradas ─────────────────────────────────────── */}
      {closed.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            className="mb-4 flex items-center text-lg font-semibold text-gray-500 hover:text-gray-800"
          >
            <CheckCircle className="mr-2 h-5 w-5 text-gray-400" />
            Encerradas ({closed.length}) {showClosed ? '▾' : '▸'}
          </button>

          {showClosed && (
            <div className="grid gap-3">
              {closed.map((request) =>
                request.status === 'report_available' ? (
                  <ActiveRequestCard
                    key={request.id}
                    request={request}
                    busy={busy === request.id}
                    onPublishReport={(file) => handlePublishReport(request, file)}
                    onAddAttachment={(file) => handleAddAttachment(request, file)}
                    onAddPhotos={() => setPhotoTarget(request)}
                    onSetDueDate={() => setDueDateTarget(request)}
                    onCancel={() => handleCancel(request)}
                    onMarkInProgress={() => handleMarkInProgress(request)}
                    onShareWhatsapp={() => void handleShareReportWhatsapp(request)}
                    onSetCompliance={(score) => handleSetCompliance(request, score)}
                    onSetAreaScores={(sanitary, nutrition) => handleSetAreaScores(request, sanitary, nutrition)}
                    onToggleReportHidden={() => handleToggleReportHidden(request)}
                    onDelete={() => handleDelete(request)}
                  />
                ) : (
                  <div
                    key={request.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-gray-500">{request.unit_name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGES[request.status]}`}>
                        {STATUS_LABELS[request.status]}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-gray-400">{formatDateBR(request.requested_date)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === request.id}
                        onClick={() => handleDelete(request)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── Datas bloqueadas ───────────────────────────────── */}
      <BlockedDatesSection blockedDates={blockedDates} onChanged={() => void loadData()} />

      {/* ─── Modais ─────────────────────────────────────────── */}
      {confirmTarget && (
        <ConfirmRequestModal
          request={confirmTarget}
          clients={clients}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={() => {
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
          onSaved={() => {
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

      {reportNotify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-2xl">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Relatório publicado</h3>
              <p className="mt-1 text-sm text-gray-500">{reportNotify.unitName}</p>
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                {reportNotify.emailSent
                  ? 'E-mail enviado ao cliente automaticamente.'
                  : 'Sem e-mail cadastrado do cliente — avise pelo WhatsApp abaixo.'}
              </p>
              {reportNotify.whatsappLink ? (
                <a
                  href={reportNotify.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100"
                >
                  <Phone className="h-4 w-4" /> Avisar no WhatsApp
                </a>
              ) : (
                <p className="mt-4 text-xs text-gray-400">Cliente sem WhatsApp cadastrado.</p>
              )}
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setReportNotify(null)}>
                Fechar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Card de solicitação ativa ────────────────────────────────

interface ActiveRequestCardProps {
  request: AppointmentRequest;
  busy: boolean;
  onPublishReport: (file: File | null) => void;
  onAddAttachment: (file: File | null) => void;
  onAddPhotos: () => void;
  onSetDueDate: () => void;
  onCancel: () => void;
  onMarkInProgress: () => void;
  onMarkCompleted?: () => void;
  onMarkNotCompleted?: () => void;
  onShareWhatsapp?: () => void;
  onReschedule?: () => void;
  onSetCompliance: (score: number | null) => void;
  onSetAreaScores?: (sanitary: number | null, nutrition: number | null) => void;
  onToggleReportHidden: () => void;
  onDelete: () => void;
}

function PublishedFilesPanel({ requestId, busy }: { requestId: string; busy: boolean }) {
  const [files, setFiles] = useState<AppointmentAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFiles = () => {
    setLoading(true);
    AppointmentAdminService.listAttachments(requestId)
      .then((rows) => setFiles(rows.filter((row) => row.kind !== 'photo')))
      .catch((err) => console.warn('[PublishedFilesPanel] Falha ao carregar anexos:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!busy) loadFiles();
  }, [requestId, busy]);

  const handleRemove = async (file: AppointmentAttachment) => {
    if (!confirm(`Remover "${file.file_name || 'arquivo'}" do portal do cliente?`)) return;
    setRemovingId(file.id);
    try {
      await AppointmentAdminService.removePublishedAttachment(file.id);
      loadFiles();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setRemovingId(null);
    }
  };

  if (loading && files.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-400">
        Carregando arquivos publicados...
      </div>
    );
  }

  if (files.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Relatórios e anexos no portal</p>
        <button type="button" onClick={loadFiles} className="text-xs font-semibold text-primary-700 hover:text-primary-900">
          Atualizar
        </button>
      </div>
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
            <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 break-words text-sm text-gray-700">
              {file.file_name || (file.kind === 'report_pdf' ? 'Relatório PDF' : 'Anexo')}
            </span>
            {file.signed_url && (
              <Button type="button" variant="ghost" size="sm" onClick={() => window.open(file.signed_url, '_blank', 'noopener,noreferrer')}>
                Abrir
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removingId === file.id}
              onClick={() => void handleRemove(file)}
              className="text-red-600 hover:bg-red-50"
            >
              {removingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveRequestCard({
  request,
  busy,
  onPublishReport,
  onAddAttachment,
  onAddPhotos,
  onSetDueDate,
  onCancel,
  onMarkInProgress,
  onMarkCompleted,
  onMarkNotCompleted,
  onShareWhatsapp,
  onReschedule,
  onSetCompliance,
  onSetAreaScores,
  onToggleReportHidden,
  onDelete,
}: ActiveRequestCardProps) {
  const reportInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [scoreInput, setScoreInput] = useState<string>(
    request.compliance_score != null ? String(request.compliance_score) : ''
  );
  const [sanitaryInput, setSanitaryInput] = useState<string>(
    request.sanitary_score != null ? String(request.sanitary_score) : ''
  );
  const [nutritionInput, setNutritionInput] = useState<string>(
    request.nutrition_score != null ? String(request.nutrition_score) : ''
  );
  const isClosed = request.status === 'report_available' || request.status === 'cancelled';

  return (
    <Card className="border-l-4 border-l-primary-500 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExpanded((v) => !v);
              }
            }}
            className="flex cursor-pointer items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-gray-900">{request.unit_name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGES[request.status]}`}
                >
                  {STATUS_LABELS[request.status]}
                </span>
                {request.report_hidden && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    <EyeOff className="h-3 w-3" /> Relatório oculto
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                <span className="flex items-center">
                  <MapPin className="mr-1 h-3.5 w-3.5" /> {request.district}
                </span>
                <span className="flex items-center">
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  {formatDateBR(request.requested_date)}
                  {request.requested_time ? ` às ${request.requested_time.slice(0, 5)}` : ''}
                </span>
                {request.phone && (
                  <span className="flex items-center">
                    <Phone className="mr-1 h-3.5 w-3.5" /> {request.phone}
                  </span>
                )}
                {request.report_due_at && (
                  <span className="flex items-center text-xs text-primary-700">
                    <Clock className="mr-1 h-3 w-3" />
                    Prazo: {formatDateBR(request.report_due_at)}
                    {request.report_due_source === 'manual' ? ' (manual)' : ''}
                  </span>
                )}
                {!expanded && request.compliance_score != null && (
                  <span className="flex items-center gap-1 text-xs text-emerald-700">
                    <Gauge className="h-3.5 w-3.5" /> {request.compliance_score}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {busy && <Loader2 className="h-5 w-5 animate-spin text-primary-600" />}
              {expanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          {expanded && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5 text-emerald-600" />
                  Conformidade:
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder="—"
                    className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                  />
                  %
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const v = scoreInput.trim();
                      if (v === '') return onSetCompliance(null);
                      const n = Math.max(0, Math.min(100, Math.round(Number(v))));
                      if (Number.isFinite(n)) onSetCompliance(n);
                    }}
                    className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    Salvar
                  </button>
                </span>
                {onSetAreaScores && (
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5 text-indigo-600" />
                    Por área (ILPI):
                    <span className="text-[11px] font-semibold text-gray-400">San</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={sanitaryInput}
                      onChange={(e) => setSanitaryInput(e.target.value)}
                      placeholder="—"
                      className="w-12 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                    />
                    <span className="text-[11px] font-semibold text-gray-400">Nut</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={nutritionInput}
                      onChange={(e) => setNutritionInput(e.target.value)}
                      placeholder="—"
                      className="w-12 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                    />
                    %
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const parse = (v: string): number | null => {
                          const t = v.trim();
                          if (t === '') return null;
                          const n = Math.max(0, Math.min(100, Math.round(Number(t))));
                          return Number.isFinite(n) ? n : null;
                        };
                        onSetAreaScores(parse(sanitaryInput), parse(nutritionInput));
                      }}
                      className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                    >
                      Salvar
                    </button>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                <input
                  ref={reportInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    onPublishReport(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    onAddAttachment(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />

                {(request.status === 'confirmed' || request.status === 'rescheduled') && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onMarkInProgress}
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    <Play className="mr-1.5 h-4 w-4" /> Iniciar inspeção
                  </Button>
                )}
                {onReschedule && (request.status === 'confirmed' || request.status === 'rescheduled') && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={onReschedule}>
                    <CalendarDays className="mr-1.5 h-4 w-4" /> Remarcar
                  </Button>
                )}
                {request.status === 'in_progress' && onMarkCompleted && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onMarkCompleted}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Inspeção concluída
                  </Button>
                )}
                {request.status === 'in_progress' && onMarkNotCompleted && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onMarkNotCompleted}
                    className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Não realizada
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => reportInputRef.current?.click()}
                  className="text-green-700 border-green-200 hover:bg-green-50"
                >
                  <FileUp className="mr-1.5 h-4 w-4" /> Publicar relatório
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={onAddPhotos}>
                  <ImagePlus className="mr-1.5 h-4 w-4" /> Adicionar fotos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => attachmentInputRef.current?.click()}
                >
                  <Paperclip className="mr-1.5 h-4 w-4" /> Adicionar anexo
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={onSetDueDate}>
                  <Clock className="mr-1.5 h-4 w-4" /> Prazo manual
                </Button>
                {request.status === 'report_available' && onShareWhatsapp && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={onShareWhatsapp}>
                    <Phone className="mr-1.5 h-4 w-4" /> WhatsApp
                  </Button>
                )}
                {(request.status === 'report_available' || request.report_pdf_path) && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onToggleReportHidden}
                    className={request.report_hidden
                      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'}
                  >
                    {request.report_hidden
                      ? <><Eye className="mr-1.5 h-4 w-4" /> Mostrar ao cliente</>
                      : <><EyeOff className="mr-1.5 h-4 w-4" /> Ocultar do cliente</>}
                  </Button>
                )}
                {!isClosed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={onCancel}
                    className="ml-auto text-red-500 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={onDelete}
                  className={`${isClosed ? 'ml-auto' : ''} text-red-600 hover:bg-red-50`}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Excluir
                </Button>
              </div>

              <PublishedFilesPanel requestId={request.id} busy={busy} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Modal: confirmar solicitação ─────────────────────────────

interface ConfirmRequestModalProps {
  request: AppointmentRequest;
  clients: Client[];
  onClose: () => void;
  onConfirmed: () => void;
}

function ConfirmRequestModal({ request, clients, onClose, onConfirmed }: ConfirmRequestModalProps) {
  const [confirmedDate, setConfirmedDate] = useState(request.requested_date?.split('T')[0] || '');
  const [confirmedTime, setConfirmedTime] = useState(requestTimeValue(request));
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState(request.unit_name);
  const [newClientCategory, setNewClientCategory] = useState<Client['category']>('estetica');
  const [manualDueDate, setManualDueDate] = useState('');
  const [selectedConsultants, setSelectedConsultants] = useState<string[]>(defaultScheduleConsultants);
  const toggleConsultant = (name: string) =>
    setSelectedConsultants((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredClients = clientSearch
    ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const selectExistingClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientSearch(client.name);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedDate) {
      setError('Informe a data confirmada.');
      return;
    }
    if (clientMode === 'existing' && !selectedClientId) {
      setError('Selecione um cliente existente ou crie um novo.');
      return;
    }
    if (clientMode === 'new' && !newClientName.trim()) {
      setError('Informe o nome do novo cliente.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const actor = getLocalActor();
      const tenantId = getActiveTenantId();
      const now = new Date();

      // 1. Cliente: existente ou novo
      let clientId = selectedClientId;
      if (clientMode === 'new') {
        const newClient: Client = {
          id: generateId(),
          name: newClientName.trim(),
          category: newClientCategory,
          responsibleName: request.responsible_name || undefined,
          phone: request.phone || undefined,
          email: request.email || undefined,
          createdAt: now,
          updatedAt: now,
          tenantId,
          localActorId: actor.id,
          syncStatus: 'pending',
        };
        await ClientService.saveClient(newClient);
        clientId = newClient.id;
      }

      // 2. Agendamento interno
      const schedule: Schedule = {
        id: generateId(),
        clientId,
        scheduledAt: new Date(`${confirmedDate}T${confirmedTime || '09:00'}`),
        status: 'pending',
        notes: `Portal público — ${request.unit_name} (${request.district})`,
        consultantNames: selectedConsultants,
        updatedAt: now,
        tenantId,
        localActorId: actor.id,
        syncStatus: 'pending',
      };
      // 3. Atualizar a solicitação primeiro; só então persistir o agendamento
      // interno, evitando Schedule órfão caso a confirmação falhe.
      await AppointmentAdminService.confirmRequest(request.id, {
        confirmedDate,
        confirmedTime: confirmedTime || '09:00',
        clientId,
        scheduleId: schedule.id,
        manualDueDate: manualDueDate || undefined,
      });
      await ScheduleService.saveSchedule(schedule);

      onConfirmed();
    } catch (err) {
      console.error(err);
      setError(errorMessage(err) || 'Falha ao confirmar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Confirmar solicitação</h3>
          <p className="mb-6 text-sm text-gray-500">
            {request.unit_name} — {request.district}
          </p>

          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Data confirmada *</label>
                <input
                  type="date"
                  required
                  value={confirmedDate}
                  onChange={(e) => setConfirmedDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Horário</label>
                <input
                  type="time"
                  value={confirmedTime}
                  onChange={(e) => setConfirmedTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Cliente</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`flex-1 rounded-xl border p-2.5 text-sm font-medium ${
                    clientMode === 'existing'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Vincular existente
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('new')}
                  className={`flex-1 rounded-xl border p-2.5 text-sm font-medium ${
                    clientMode === 'new'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Criar novo
                </button>
              </div>

              {clientMode === 'existing' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setSelectedClientId('');
                    }}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                  />
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                    {filteredClients.length > 0 ? (
                      filteredClients.slice(0, 8).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectExistingClient(c)}
                          className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-50 ${
                            selectedClientId === c.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                          }`}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="shrink-0 text-xs text-gray-400">{c.category?.toUpperCase()}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado.</div>
                    )}
                  </div>
                  {selectedClient && (
                    <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                      Vinculado a: <strong>{selectedClient.name}</strong>
                    </div>
                  )}
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      const c = clients.find((x) => x.id === e.target.value);
                      if (c) setClientSearch(c.name);
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm"
                  >
                    <option value="">Selecione um cliente...</option>
                    {filteredClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Nome do cliente"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                  />
                  <select
                    value={newClientCategory}
                    onChange={(e) => setNewClientCategory(e.target.value as Client['category'])}
                    className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm"
                  >
                    <option value="estetica">Estética</option>
                    <option value="ilpi">ILPI</option>
                    <option value="alimentos">Alimentos</option>
                  </select>
                </div>
              )}
            </div>

            <ConsultantPicker selected={selectedConsultants} onToggle={toggleConsultant} />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Prazo manual do relatório (opcional)
              </label>
              <input
                type="date"
                value={manualDueDate}
                onChange={(e) => setManualDueDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm"
              />
              <p className="text-xs text-gray-400">
                Se vazio, o portal mostra o prazo padrão de 5 dias úteis após a inspeção.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar agendamento
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Modal: adicionar fotos da inspeção ───────────────────────

interface AddPhotosModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onAdded: () => void;
}

function AddPhotosModal({ request, onClose, onAdded }: AddPhotosModalProps) {
  const [inspections, setInspections] = useState<InspectionOption[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState(request.inspection_id || '');
  const [photos, setPhotos] = useState<InspectionPhotoOption[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [published, setPublished] = useState<{ id: string; caption: string | null; previewUrl?: string }[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadingInspections, setLoadingInspections] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPublished = () => {
    AppointmentAdminService.listPublishedPhotos(request.id)
      .then(setPublished)
      .catch((err) => console.warn('[AddPhotosModal] Falha ao carregar fotos publicadas:', err));
  };
  useEffect(loadPublished, [request.id]);

  const allSelected = photos.length > 0 && selectedPhotoIds.size === photos.length;
  const toggleAll = () => {
    setSelectedPhotoIds(allSelected ? new Set() : new Set(photos.map((p) => p.photoId)));
  };

  const handleRemovePublished = async (id: string) => {
    if (!confirm('Remover esta foto do portal do cliente?')) return;
    setRemovingId(id);
    try {
      await AppointmentAdminService.removePublishedAttachment(id);
      loadPublished();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setRemovingId(null);
    }
  };

  useEffect(() => {
    if (!request.client_id) {
      setLoadingInspections(false);
      return;
    }
    AppointmentAdminService.listCompletedInspectionsForClient(request.client_id)
      .then(setInspections)
      .catch((err) => {
        console.error(err);
        setError('Falha ao carregar inspeções do cliente vinculado.');
      })
      .finally(() => setLoadingInspections(false));
  }, [request.client_id]);

  useEffect(() => {
    if (!selectedInspectionId) {
      setPhotos([]);
      return;
    }
    setLoadingPhotos(true);
    AppointmentAdminService.listInspectionPhotoOptions(selectedInspectionId)
      .then(setPhotos)
      .catch((err) => {
        console.error(err);
        setError('Falha ao carregar fotos da inspeção.');
      })
      .finally(() => setLoadingPhotos(false));
  }, [selectedInspectionId]);

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const handleSave = async () => {
    const selected = photos.filter((p) => selectedPhotoIds.has(p.photoId));
    if (selected.length === 0 || !selectedInspectionId) return;
    setSaving(true);
    setError(null);
    try {
      await AppointmentAdminService.addPhotosToPortal(request, selectedInspectionId, selected);
      onAdded();
    } catch (err) {
      console.error(err);
      setError(errorMessage(err) || 'Falha ao publicar as fotos no portal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Adicionar fotos ao portal</h3>
          <p className="mb-6 text-sm text-gray-500">{request.unit_name}</p>

          {!request.client_id ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
              Esta solicitação ainda não está vinculada a um cliente. Confirme a solicitação
              vinculando um cliente antes de publicar fotos.
            </p>
          ) : loadingInspections ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : inspections.length === 0 ? (
            <p className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
              Nenhuma inspeção encontrada para o cliente vinculado.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Inspeção</label>
                <select
                  value={selectedInspectionId}
                  onChange={(e) => {
                    setSelectedInspectionId(e.target.value);
                    setSelectedPhotoIds(new Set());
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm"
                >
                  <option value="">Selecione a inspeção...</option>
                  {inspections.map((insp) => (
                    <option key={insp.id} value={insp.id}>
                      {new Date(insp.inspectionDate).toLocaleDateString('pt-BR')} —{' '}
                      {insp.status === 'completed' ? 'Finalizada' : 'Em andamento'}
                      {insp.consultantName ? ` · ${insp.consultantName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {loadingPhotos ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : selectedInspectionId && photos.length === 0 ? (
                <p className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                  Esta inspeção não possui fotos sincronizadas no Storage.
                </p>
              ) : (
                photos.length > 0 && (
                  <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {selectedPhotoIds.size} de {photos.length} selecionada(s)
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs font-bold text-primary-700 hover:underline"
                    >
                      {allSelected ? 'Limpar seleção' : 'Selecionar todas'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((photo) => {
                      const selected = selectedPhotoIds.has(photo.photoId);
                      return (
                        <button
                          key={photo.photoId}
                          type="button"
                          onClick={() => togglePhoto(photo.photoId)}
                          className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                            selected ? 'border-primary-600 ring-2 ring-primary-200' : 'border-gray-200'
                          }`}
                        >
                          {photo.previewUrl ? (
                            <img
                              src={photo.previewUrl}
                              alt={photo.caption || 'Foto da inspeção'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
                              sem preview
                            </div>
                          )}
                          {selected && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                )
              )}

              {published.length > 0 && (
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Já publicadas no portal ({published.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {published.map((p) => (
                      <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        {p.previewUrl ? (
                          <img src={p.previewUrl} alt={p.caption || ''} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">foto</div>
                        )}
                        <button
                          type="button"
                          disabled={removingId === p.id}
                          onClick={() => void handleRemovePublished(p.id)}
                          title="Remover do portal"
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600/90 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                        >
                          {removingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Fechar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={saving || selectedPhotoIds.size === 0}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publicar {selectedPhotoIds.size > 0 ? `${selectedPhotoIds.size} foto(s)` : 'fotos'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Modal: prazo manual ──────────────────────────────────────

interface DueDateModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onSaved: () => void;
}

function DueDateModal({ request, onClose, onSaved }: DueDateModalProps) {
  const [dueDate, setDueDate] = useState(request.report_due_at?.split('T')[0] || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!dueDate) return;
    setSaving(true);
    try {
      await AppointmentAdminService.setManualDueDate(request.id, dueDate);
      onSaved();
    } catch (err) {
      console.error(err);
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-lg font-bold text-gray-900">Prazo manual do relatório</h3>
          <p className="mb-4 text-sm text-gray-500">{request.unit_name}</p>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3 text-sm"
          />
          <div className="mt-5 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" className="flex-1" disabled={saving || !dueDate} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar prazo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Modal: nova visita (agendamento direto pela equipe) ──────

interface NewVisitModalProps {
  clients: Client[];
  onClose: () => void;
  onCreated: () => void;
}

function NewVisitModal({ clients, onClose, onCreated }: NewVisitModalProps) {
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [attendanceMode, setAttendanceMode] = useState<'presencial' | 'online'>('presencial');
  const [municipality, setMunicipality] = useState('');
  const [district, setDistrict] = useState('');
  const [selectedConsultants, setSelectedConsultants] = useState<string[]>(defaultScheduleConsultants);
  const toggleConsultant = (name: string) =>
    setSelectedConsultants((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = search
    ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients;
  const selectedClient = clients.find((c) => c.id === clientId);

  const selectClient = (client: Client) => {
    setClientId(client.id);
    setSearch(client.name);
    if (client.city) setMunicipality(client.city);
  };

  const handleSave = async () => {
    if (!clientId || !date) {
      setError('Selecione o cliente e a data.');
      return;
    }
    if (attendanceMode === 'presencial' && !district.trim()) {
      setError('Informe o bairro do atendimento presencial.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const actor = getLocalActor();
      const tenantId = getActiveTenantId();
      const now = new Date();
      const schedule: Schedule = {
        id: generateId(),
        clientId,
        scheduledAt: new Date(`${date}T${time || '09:00'}`),
        status: 'pending',
        notes: `Visita agendada pela equipe — ${selectedClient?.name ?? ''}`,
        consultantNames: selectedConsultants,
        updatedAt: now,
        tenantId,
        localActorId: actor.id,
        syncStatus: 'pending',
      };
      // Cria a solicitação PRIMEIRO (é onde estão as validações). Só salva o
      // agendamento interno se ela der certo, para nunca deixar um Schedule órfão.
      await AppointmentAdminService.insertConfirmedRequest({
        clientId,
        unitName: selectedClient?.name ?? 'Unidade',
        responsibleName: selectedClient?.responsibleName,
        phone: selectedClient?.phone,
        email: selectedClient?.email,
        scheduleId: schedule.id,
        date,
        time: time || '09:00',
        attendanceMode,
        municipality: municipality.trim() || selectedClient?.city || undefined,
        district: district.trim() || undefined,
      });
      await ScheduleService.saveSchedule(schedule);
      onCreated();
    } catch (err) {
      setError(errorMessage(err) || 'Falha ao criar a visita.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-xl font-bold text-gray-900">Nova visita</h3>
          <p className="mb-5 text-sm text-gray-500">
            Cria a visita já confirmada e vinculada ao cliente. Ela aparece no portal do cliente.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Cliente / unidade</label>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setClientId('');
                }}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm"
              />
              <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {filtered.length > 0 ? (
                  filtered.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-50 ${
                        clientId === c.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                      }`}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">{c.category?.toUpperCase()}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado.</div>
                )}
              </div>
              {selectedClient && (
                <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                  Visita vinculada a: <strong>{selectedClient.name}</strong>
                </div>
              )}
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  const c = clients.find((x) => x.id === e.target.value);
                  if (c) {
                    setSearch(c.name);
                    if (c.city) setMunicipality(c.city);
                  }
                }}
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm"
              >
                <option value="">Selecione...</option>
                {filtered.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Data</label>
                <input type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Horário</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAttendanceMode('presencial')} className={`h-11 rounded-xl border text-sm font-bold ${attendanceMode === 'presencial' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>Presencial</button>
              <button type="button" onClick={() => setAttendanceMode('online')} className={`h-11 rounded-xl border text-sm font-bold ${attendanceMode === 'online' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>Online</button>
            </div>

            {attendanceMode === 'presencial' && (
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)} placeholder="Município" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
                <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Bairro" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
              </div>
            )}

            <ConsultantPicker selected={selectedConsultants} onToggle={toggleConsultant} />

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar visita
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Modal: remarcar solicitação ──────────────────────────────

interface RescheduleModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onSaved: () => void;
}

function RescheduleModal({ request, onClose, onSaved }: RescheduleModalProps) {
  const [date, setDate] = useState(request.requested_date?.split('T')[0] || '');
  const [time, setTime] = useState(request.requested_time || '09:00');
  const [saving, setSaving] = useState(false);

  const handleSave = async (onlyMark: boolean) => {
    setSaving(true);
    try {
      if (onlyMark) {
        await AppointmentAdminService.rescheduleRequest(request);
      } else {
        await AppointmentAdminService.rescheduleRequest(request, date, time);
      }
      onSaved();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-lg font-bold text-gray-900">Remarcar inspeção</h3>
          <p className="mb-4 text-sm text-gray-500">{request.unit_name}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Nova data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Horário</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            A nova data atualiza o portal do cliente, a agenda interna e o bloqueio do calendário público.
          </p>

          <div className="mt-5 space-y-2">
            <Button
              type="button"
              className="w-full"
              disabled={saving || !date}
              onClick={() => void handleSave(false)}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remarcar para esta data
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={() => void handleSave(true)}
            >
              Marcar como remarcada (data a definir)
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Modal: inspeção não realizada ───────────────────────────

interface NotCompletedModalProps {
  request: AppointmentRequest;
  onClose: () => void;
  onSaved: () => void;
}

function NotCompletedModal({ request, onClose, onSaved }: NotCompletedModalProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!reason.trim()) {
      setError('Descreva o motivo — ele ficará visível para o cliente no portal.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await AppointmentAdminService.markNotCompleted(request.id, reason.trim());
      onSaved();
    } catch (err) {
      setError(errorMessage(err) || 'Falha ao registrar motivo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-6">
          <h3 className="mb-1 text-lg font-bold text-gray-900">Inspeção não realizada</h3>
          <p className="mb-4 text-sm text-gray-500">{request.unit_name}</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Cliente não estava no local, documentação pendente, acesso negado..."
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <p className="text-xs text-gray-400">
              Este texto ficará visível para o cliente no Portal do Cliente.
            </p>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={saving || !reason.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar e reagendar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Datas bloqueadas ─────────────────────────────────────────

interface BlockedDatesSectionProps {
  blockedDates: BlockedDateRow[];
  onChanged: () => void;
}

function BlockedDatesSection({ blockedDates, onChanged }: BlockedDatesSectionProps) {
  const [day, setDay] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!day) return;
    setSaving(true);
    try {
      await AppointmentAdminService.addBlockedDate(day, reason);
      setDay('');
      setReason('');
      onChanged();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: BlockedDateRow) => {
    setBusyId(row.id);
    try {
      await AppointmentAdminService.removeBlockedDate(row.id);
      onChanged();
    } catch (err) {
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <h2 className="mb-2 flex items-center text-lg font-semibold text-gray-900">
        <CalendarOff className="mr-2 h-5 w-5 text-primary-600" />
        Datas bloqueadas
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Feriados, férias e compromissos: os dias bloqueados desaparecem do calendário público.
      </p>

      <Card className="mb-4 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Data</label>
              <input
                type="date"
                required
                value={day}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-xl border border-gray-300 p-2.5 text-sm"
              />
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Motivo (opcional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: Feriado de Corpus Christi"
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm"
              />
            </div>
            <Button type="submit" size="sm" disabled={saving || !day}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarOff className="mr-1.5 h-4 w-4" />}
              Bloquear
            </Button>
          </form>
        </CardContent>
      </Card>

      {blockedDates.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma data bloqueada nos próximos dias.</p>
      ) : (
        <div className="space-y-2">
          {blockedDates.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <CalendarOff className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-800">{formatDateBR(row.day)}</span>
                {row.reason && <span className="text-gray-500">{row.reason}</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === row.id}
                onClick={() => void handleRemove(row)}
                className="text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

