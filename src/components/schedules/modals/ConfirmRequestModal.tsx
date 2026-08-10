import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AppointmentRequest, Client, Schedule } from '../../../types';
import {
  AppointmentAdminService,
  type AppointmentEventNotificationResult,
} from '../../../services/appointmentAdminService';
import { ClientService } from '../../../services/clientService';
import { ScheduleService } from '../../../services/scheduleService';
import { getActiveTenantId } from '../../../utils/localScope';
import { getLocalActor } from '../../../utils/localActor';
import { generateId } from '../../../utils/imageUtils';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { TEXT_INPUT, defaultScheduleConsultants, errorMessage, requestTimeValue } from '../appointmentRequestsShared';
import { ConsultantPicker } from '../ConsultantPicker';
import { APPOINTMENT_TYPE_RULES, type AppointmentType } from '../../../utils/appointmentType';
import { PORTAL_APPOINTMENT_TYPE_OPTIONS, publicAppointmentDurations, formatDuration } from '../../../utils/publicAppointmentForm';

interface ConfirmRequestModalProps {
  request: AppointmentRequest;
  clients: Client[];
  onClose: () => void;
  onConfirmed: (notify: AppointmentEventNotificationResult | null) => void;
}

export function ConfirmRequestModal({ request, clients, onClose, onConfirmed }: ConfirmRequestModalProps) {
  const [confirmedDate, setConfirmedDate] = useState(request.requested_date?.split('T')[0] || '');
  const [confirmedTime, setConfirmedTime] = useState(requestTimeValue(request));
  const [appointmentType, setAppointmentType] = useState<AppointmentType>(request.appointment_type);
  const [durationMinutes, setDurationMinutes] = useState<number>(
    request.duration_minutes && publicAppointmentDurations(request.appointment_type).includes(request.duration_minutes)
      ? request.duration_minutes
      : publicAppointmentDurations(request.appointment_type)[0]
  );
  const handleAppointmentTypeChange = (type: AppointmentType) => {
    setAppointmentType(type);
    const allowed = publicAppointmentDurations(type);
    if (!allowed.includes(durationMinutes)) setDurationMinutes(allowed[0]);
  };
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
        appointmentType,
        subject: request.subject || undefined,
        durationMinutes,
        meetingUrl: request.meeting_url || undefined,
        participantNames: request.participant_names || undefined,
        cancellationReason: request.cancellation_reason || undefined,
        notes: `Portal público — ${request.unit_name} (${request.district})`,
        consultantNames: selectedConsultants,
        updatedAt: now,
        tenantId,
        localActorId: actor.id,
        syncStatus: 'pending',
      };
      // 3. Atualizar a solicitação primeiro; só então persistir o agendamento
      // interno, evitando Schedule órfão caso a confirmação falhe.
      const notify = await AppointmentAdminService.confirmRequest(request, {
        confirmedDate,
        confirmedTime: confirmedTime || '09:00',
        clientId,
        scheduleId: schedule.id,
        consultantNames: selectedConsultants,
        manualDueDate: manualDueDate || undefined,
        appointmentType,
        durationMinutes,
      });
      await ScheduleService.saveSchedule(schedule);

      onConfirmed(notify);
    } catch (err) {
      console.error(err);
      setError(errorMessage(err) || 'Falha ao confirmar a solicitação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-request-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl"
      >
        <CardContent className="p-6">
          <h3 id="confirm-request-title" className="mb-1 text-xl font-bold text-gray-900">Confirmar solicitação</h3>
          <p className="mb-3 text-sm text-gray-500">
            {request.unit_name} — {request.district}
          </p>

          {request.subject && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Motivo informado pelo cliente: </span>
              “{request.subject}”
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="confirm-request-type" className="text-sm font-medium text-gray-700">
                Tipo de compromisso
              </label>
              <select
                id="confirm-request-type"
                value={appointmentType}
                onChange={(e) => handleAppointmentTypeChange(e.target.value as AppointmentType)}
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm"
              >
                {PORTAL_APPOINTMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {APPOINTMENT_TYPE_RULES[option.value].label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                O cliente solicitou como “{APPOINTMENT_TYPE_RULES[request.appointment_type].label}”. Troque para
                “Inspeção” se for o caso — só assim é possível iniciar a inspeção, publicar relatório e fotos.
              </p>
              <label htmlFor="confirm-request-duration" className="sr-only">Duração</label>
              <select
                id="confirm-request-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm"
              >
                {publicAppointmentDurations(appointmentType).map((duration) => (
                  <option key={duration} value={duration}>{formatDuration(duration)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="confirm-request-date" className="text-sm font-medium text-gray-700">Data confirmada *</label>
                <input
                  id="confirm-request-date"
                  type="date"
                  required
                  value={confirmedDate}
                  onChange={(e) => setConfirmedDate(e.target.value)}
                  className={TEXT_INPUT}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm-request-time" className="text-sm font-medium text-gray-700">Horário</label>
                <input
                  id="confirm-request-time"
                  type="time"
                  value={confirmedTime}
                  onChange={(e) => setConfirmedTime(e.target.value)}
                  className={TEXT_INPUT}
                />
              </div>
            </div>

            <div className="space-y-2">
              <span id="confirm-request-client-label" className="text-sm font-medium text-gray-700">Cliente</span>
              <div className="flex gap-2" role="group" aria-labelledby="confirm-request-client-label">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  aria-pressed={clientMode === 'existing'}
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
                  aria-pressed={clientMode === 'new'}
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
                  <label htmlFor="confirm-request-client-search" className="sr-only">Buscar cliente</label>
                  <input
                    id="confirm-request-client-search"
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setSelectedClientId('');
                    }}
                    className={TEXT_INPUT}
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
                          <span className="shrink-0 text-xs text-gray-500">{c.category?.toUpperCase()}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">Nenhum cliente encontrado.</div>
                    )}
                  </div>
                  {selectedClient && (
                    <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                      Vinculado a: <strong>{selectedClient.name}</strong>
                    </div>
                  )}
                  <label htmlFor="confirm-request-client-select" className="sr-only">Selecionar cliente</label>
                  <select
                    id="confirm-request-client-select"
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
                  <label htmlFor="confirm-request-new-client-name" className="sr-only">Nome do cliente</label>
                  <input
                    id="confirm-request-new-client-name"
                    type="text"
                    placeholder="Nome do cliente"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className={TEXT_INPUT}
                  />
                  <label htmlFor="confirm-request-new-client-category" className="sr-only">Categoria do cliente</label>
                  <select
                    id="confirm-request-new-client-category"
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
              <label htmlFor="confirm-request-due-date" className="text-sm font-medium text-gray-700">
                Prazo manual do relatório (opcional)
              </label>
              <input
                id="confirm-request-due-date"
                type="date"
                value={manualDueDate}
                onChange={(e) => setManualDueDate(e.target.value)}
                className={TEXT_INPUT}
              />
              <p className="text-xs text-gray-500">
                Se vazio, o portal mostra o prazo padrão de 5 dias úteis após a inspeção.
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
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
