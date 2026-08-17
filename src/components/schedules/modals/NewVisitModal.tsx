import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Client, Schedule } from '../../../types';
import { AppointmentAdminService } from '../../../services/appointmentAdminService';
import { ScheduleService } from '../../../services/scheduleService';
import { getActiveTenantId } from '../../../utils/localScope';
import { getLocalActor } from '../../../utils/localActor';
import { generateId } from '../../../utils/imageUtils';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { TEXT_INPUT, defaultScheduleConsultants, errorMessage } from '../appointmentRequestsShared';
import { ConsultantPicker } from '../ConsultantPicker';

interface NewVisitModalProps {
  clients: Client[];
  onClose: () => void;
  onCreated: () => void;
}

export function NewVisitModal({ clients, onClose, onCreated }: NewVisitModalProps) {
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [attendanceMode, setAttendanceMode] = useState<'presencial' | 'online'>('presencial');
  const [meetingUrl, setMeetingUrl] = useState('');
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
        attendanceMode,
        meetingUrl: attendanceMode === 'online' ? meetingUrl.trim() || undefined : undefined,
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
        consultantNames: selectedConsultants,
        meetingUrl: attendanceMode === 'online' ? meetingUrl.trim() || undefined : undefined,
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
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-visit-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl"
      >
        <CardContent className="p-6">
          <h3 id="new-visit-title" className="mb-1 text-xl font-bold text-navy">Nova visita</h3>
          <p className="mb-5 text-sm text-navy-3">
            Cria a visita já confirmada e vinculada ao cliente. Ela aparece no portal do cliente.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-visit-client-search" className="text-sm font-medium text-navy-2">Cliente / unidade</label>
              <input
                id="new-visit-client-search"
                type="text"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setClientId('');
                }}
                className={TEXT_INPUT.replace('p-3', 'p-2.5')}
              />
              <div className="max-h-44 overflow-y-auto rounded-xl border border-default bg-surface">
                {filtered.length > 0 ? (
                  filtered.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-default px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-50 ${
                        clientId === c.id ? 'bg-primary-50 text-primary-700' : 'text-navy-2'
                      }`}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-navy-3">{c.category?.toUpperCase()}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-navy-3">Nenhum cliente encontrado.</div>
                )}
              </div>
              {selectedClient && (
                <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                  Visita vinculada a: <strong>{selectedClient.name}</strong>
                </div>
              )}
              <label htmlFor="new-visit-client-select" className="sr-only">Selecionar cliente</label>
              <select
                id="new-visit-client-select"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  const c = clients.find((x) => x.id === e.target.value);
                  if (c) {
                    setSearch(c.name);
                    if (c.city) setMunicipality(c.city);
                  }
                }}
                className="w-full rounded-xl border border-control bg-surface p-3 text-sm"
              >
                <option value="">Selecione...</option>
                {filtered.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="new-visit-date" className="text-sm font-medium text-navy-2">Data</label>
                {/* Sem data mínima: permite registrar visitas retroativas e lançar relatórios antigos. */}
                <input id="new-visit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={TEXT_INPUT} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="new-visit-time" className="text-sm font-medium text-navy-2">Horário</label>
                <input id="new-visit-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={TEXT_INPUT} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modo de atendimento">
              <button
                type="button"
                onClick={() => setAttendanceMode('presencial')}
                aria-pressed={attendanceMode === 'presencial'}
                className={`h-11 rounded-xl border text-sm font-bold ${attendanceMode === 'presencial' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-default text-navy-2'}`}
              >
                Presencial
              </button>
              <button
                type="button"
                onClick={() => setAttendanceMode('online')}
                aria-pressed={attendanceMode === 'online'}
                className={`h-11 rounded-xl border text-sm font-bold ${attendanceMode === 'online' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-default text-navy-2'}`}
              >
                Online
              </button>
            </div>

            {attendanceMode === 'presencial' && (
              <div className="grid grid-cols-2 gap-3">
                <label htmlFor="new-visit-municipality" className="sr-only">Município</label>
                <input id="new-visit-municipality" type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)} placeholder="Município" className={TEXT_INPUT} />
                <label htmlFor="new-visit-district" className="sr-only">Bairro</label>
                <input id="new-visit-district" type="text" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Bairro" className={TEXT_INPUT} />
              </div>
            )}

            {attendanceMode === 'online' && (
              <div className="space-y-1.5">
                <label htmlFor="new-visit-meeting-url" className="text-sm font-medium text-navy-2">
                  Link da videoconferência
                </label>
                <input
                  id="new-visit-meeting-url"
                  type="url"
                  inputMode="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className={TEXT_INPUT}
                />
              </div>
            )}

            <ConsultantPicker selected={selectedConsultants} onToggle={toggleConsultant} />

            {error && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
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
