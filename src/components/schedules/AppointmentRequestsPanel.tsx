import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle,
  Clock,
  FileUp,
  Globe,
  GlobeLock,
  ImagePlus,
  Inbox,
  Loader2,
  MapPin,
  Paperclip,
  Phone,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  AppointmentRequest,
  AppointmentSlot,
  Client,
  Schedule,
  SlotPeriod,
} from '../../types';
import {
  AppointmentAdminService,
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
  noite: 'Noite',
  integral: 'Integral',
};

const STATUS_LABELS: Record<AppointmentRequest['status'], string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Finalizada',
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

export function AppointmentRequestsPanel() {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // id da request em operação

  // Modal de confirmação
  const [confirmTarget, setConfirmTarget] = useState<AppointmentRequest | null>(null);
  // Modal de fotos
  const [photoTarget, setPhotoTarget] = useState<AppointmentRequest | null>(null);
  // Prazo manual
  const [dueDateTarget, setDueDateTarget] = useState<AppointmentRequest | null>(null);

  const loadData = async () => {
    try {
      const [reqs, slotList, clientList] = await Promise.all([
        AppointmentAdminService.listRequests(),
        AppointmentAdminService.listSlots(),
        ClientService.getClients(),
      ]);
      setRequests(reqs);
      setSlots(slotList);
      setClients(clientList);
    } catch (err) {
      console.error('[AppointmentRequestsPanel] Falha ao carregar solicitações:', err);
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
    const suggestion = prompt(
      'Nova data sugerida (AAAA-MM-DD) — deixe em branco para apenas marcar como remarcada:',
      request.requested_date?.split('T')[0] || ''
    );
    if (suggestion === null) return;
    void withBusy(request.id, () =>
      AppointmentAdminService.rescheduleRequest(request.id, suggestion.trim() || undefined)
    );
  };

  const handleCancel = (request: AppointmentRequest) => {
    if (!confirm(`Cancelar a solicitação de "${request.unit_name}"?`)) return;
    void withBusy(request.id, () => AppointmentAdminService.cancelRequest(request.id));
  };

  const handlePublishReport = (request: AppointmentRequest, file: File | null) => {
    if (!file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('O relatório deve ser um arquivo PDF.');
      return;
    }
    void withBusy(request.id, () => AppointmentAdminService.publishReport(request, file));
  };

  const handleAddAttachment = (request: AppointmentRequest, file: File | null) => {
    if (!file) return;
    void withBusy(request.id, () => AppointmentAdminService.addAttachment(request, file));
  };

  const pending = requests.filter((r) => r.status === 'requested');
  const active = requests.filter((r) =>
    ['confirmed', 'in_progress', 'rescheduled', 'completed', 'report_available'].includes(r.status)
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
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
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Disponibilidade pública ────────────────────────── */}
      <PublicAvailabilitySection slots={slots} onChanged={() => void loadData()} />

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
}

function ActiveRequestCard({
  request,
  busy,
  onPublishReport,
  onAddAttachment,
  onAddPhotos,
  onSetDueDate,
  onCancel,
}: ActiveRequestCardProps) {
  const reportInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="border-l-4 border-l-primary-500 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-gray-900">{request.unit_name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGES[request.status]}`}
                >
                  {STATUS_LABELS[request.status]}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                <span className="flex items-center">
                  <MapPin className="mr-1 h-3.5 w-3.5" /> {request.district}
                </span>
                <span className="flex items-center">
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  {formatDateBR(request.requested_date)}
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
              </div>
            </div>
            {busy && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-600" />}
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
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onCancel}
              className="ml-auto text-red-500 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
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
  const [confirmedTime, setConfirmedTime] = useState('09:00');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState(request.unit_name);
  const [newClientCategory, setNewClientCategory] = useState<Client['category']>('estetica');
  const [manualDueDate, setManualDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredClients = clientSearch
    ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;

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
        updatedAt: now,
        tenantId,
        localActorId: actor.id,
        syncStatus: 'pending',
      };
      await ScheduleService.saveSchedule(schedule);

      // 3. Atualizar a solicitação
      await AppointmentAdminService.confirmRequest(request.id, {
        confirmedDate,
        clientId,
        scheduleId: schedule.id,
        manualDueDate: manualDueDate || undefined,
      });

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
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                  />
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
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
  const [loadingInspections, setLoadingInspections] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                )
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

// ─── Disponibilidade pública (slots) ──────────────────────────

interface PublicAvailabilitySectionProps {
  slots: AppointmentSlot[];
  onChanged: () => void;
}

function PublicAvailabilitySection({ slots, onChanged }: PublicAvailabilitySectionProps) {
  const [date, setDate] = useState('');
  const [period, setPeriod] = useState<SlotPeriod>('manha');
  const [capacity, setCapacity] = useState(1);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    try {
      await AppointmentAdminService.createSlot({ date, period, capacity, isPublic });
      setDate('');
      setCapacity(1);
      onChanged();
    } catch (err) {
      console.error(err);
      alert(`Erro ao criar disponibilidade: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async (slot: AppointmentSlot) => {
    setBusySlotId(slot.id);
    try {
      await AppointmentAdminService.setSlotPublic(slot.id, !slot.is_public);
      onChanged();
    } catch (err) {
      console.error(err);
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setBusySlotId(null);
    }
  };

  const handleCancelSlot = async (slot: AppointmentSlot) => {
    if (!confirm('Cancelar esta disponibilidade? Ela deixará de aparecer no portal público.')) return;
    setBusySlotId(slot.id);
    try {
      await AppointmentAdminService.cancelSlot(slot.id);
      onChanged();
    } catch (err) {
      console.error(err);
      alert(`Erro: ${errorMessage(err)}`);
    } finally {
      setBusySlotId(null);
    }
  };

  const visibleSlots = slots.filter((s) => s.status !== 'cancelled');

  return (
    <section>
      <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900">
        <Globe className="mr-2 h-5 w-5 text-primary-600" />
        Disponibilidade pública
      </h2>

      <Card className="mb-4 shadow-sm">
        <CardContent className="p-5">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Data</label>
              <input
                type="date"
                required
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-gray-300 p-2.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Turno</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as SlotPeriod)}
                className="rounded-xl border border-gray-300 bg-white p-2.5 text-sm"
              >
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
                <option value="integral">Integral</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Vagas</label>
              <input
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-xl border border-gray-300 p-2.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              Visível no portal
            </label>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-1.5 h-4 w-4" />
              )}
              Criar
            </Button>
          </form>
        </CardContent>
      </Card>

      {visibleSlots.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhuma disponibilidade cadastrada. Sem slots, o portal aceita apenas sugestões de data.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleSlots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3"
            >
              <div className="flex items-center gap-3 text-sm">
                {slot.is_public ? (
                  <Globe className="h-4 w-4 text-green-600" />
                ) : (
                  <GlobeLock className="h-4 w-4 text-gray-400" />
                )}
                <span className="font-medium text-gray-800">
                  {slot.starts_at
                    ? new Date(slot.starts_at).toLocaleDateString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })
                    : 'Data a combinar'}
                </span>
                <span className="text-gray-500">
                  {slot.period ? PERIOD_LABELS[slot.period] : ''}
                </span>
                <span className="text-xs text-gray-400">
                  {slot.booked_count}/{slot.capacity} reservas
                </span>
                {slot.status === 'full' && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                    Lotado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busySlotId === slot.id}
                  onClick={() => void handleTogglePublic(slot)}
                  title={slot.is_public ? 'Ocultar do portal' : 'Publicar no portal'}
                >
                  {slot.is_public ? <GlobeLock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busySlotId === slot.id}
                  onClick={() => void handleCancelSlot(slot)}
                  className="text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
