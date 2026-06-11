import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Client, Schedule } from '../types';
import { formatDateTime, generateId } from '../utils/imageUtils';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Calendar, Clock, Plus, Trash2, CheckCircle, AlertCircle, User, Play, Edit2, Loader2, WifiOff, Link2, Copy, ExternalLink } from 'lucide-react';
import { ScheduleService } from '../services/scheduleService';
import { ClientService } from '../services/clientService';
import { useAuthStore } from '../store/useAuthStore';
import { getLocalActor } from '../utils/localActor';
import { AppointmentRequestsPanel } from '../components/schedules/AppointmentRequestsPanel';
import { AppointmentAdminService } from '../services/appointmentAdminService';
import {
  formatAppointmentLeadTimeMessage,
  getMinAppointmentDateTime,
  isAppointmentAtLeast24hAhead,
  toDateInputValue,
} from '../utils/appointmentLeadTime';

type SchedulesTab = 'agenda' | 'solicitacoes';

export function Schedules() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SchedulesTab>('agenda');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [linkCopied, setLinkCopied] = useState(false);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const minScheduleDate = toDateInputValue(getMinAppointmentDateTime());
  const filteredClients = clientSearch
    ? clients.filter((client) => client.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const selectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientSearch(client.name);
  };

  const portalPlaceForClient = (client: Client) => ({
    municipality: client.city || 'Rio de Janeiro',
    district: client.address || client.city || 'A definir',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, cList] = await Promise.all([
        ScheduleService.getSchedules(),
        ClientService.getClients()
      ]);
      
      const revivedSchedules = sList.map(s => ({
        ...s,
        clientName: cList.find(c => c.id === s.clientId)?.name
      }));

      // Sort: Pending first, then by date
      revivedSchedules.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
      });

      setSchedules(revivedSchedules);
      setClients(cList);
    } catch (err) {
      console.error('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return ScheduleService.subscribeToChanges(loadData);
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !scheduledDate || !scheduledTime) return;

    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
      if (!isAppointmentAtLeast24hAhead(scheduledAt)) {
        alert(formatAppointmentLeadTimeMessage());
        return;
      }
      if (!navigator.onLine) {
        alert('Sem conexão com a internet. O agendamento precisa sincronizar com o portal do cliente.');
        return;
      }
      const selectedClient = clients.find((client) => client.id === selectedClientId);
      if (!selectedClient) {
        alert('Cliente selecionado nao encontrado.');
        return;
      }
      const actor = getLocalActor();
      
      if (isEditing && editingId) {
        const existing = schedules.find(s => s.id === editingId);
        if (!existing) return;
        const updated = {
          ...existing,
          clientId: selectedClientId,
          scheduledAt,
          notes: notes,
          localActorId: actor.id,
        };
        await ScheduleService.saveSchedule(updated);
        const linkedRequest = await AppointmentAdminService.getRequestByScheduleId(updated.id);
        const place = portalPlaceForClient(selectedClient);
        if (linkedRequest) {
          const startsAt = new Date(`${scheduledDate}T${scheduledTime}`);
          const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
          await AppointmentAdminService.updateRequest(linkedRequest.id, {
            status: 'confirmed',
            client_id: selectedClient.id,
            unit_name: selectedClient.name,
            responsible_name: selectedClient.responsibleName,
            phone: selectedClient.phone,
            email: selectedClient.email,
            municipality: place.municipality,
            district: place.district,
            requested_date: scheduledDate,
            requested_time: scheduledTime,
            requested_period: startsAt.getHours() < 12 ? 'manha' : 'tarde',
            requested_starts_at: startsAt.toISOString(),
            requested_ends_at: endsAt.toISOString(),
          });
        } else {
          await AppointmentAdminService.insertConfirmedRequest({
            clientId: selectedClient.id,
            unitName: selectedClient.name,
            responsibleName: selectedClient.responsibleName,
            phone: selectedClient.phone,
            email: selectedClient.email,
            scheduleId: updated.id,
            date: scheduledDate,
            time: scheduledTime,
            attendanceMode: 'presencial',
            municipality: place.municipality,
            district: place.district,
          });
        }
      } else {
        const newSchedule: Schedule = {
          id: generateId(),
          clientId: selectedClientId,
          scheduledAt,
          status: 'pending',
          notes: notes,
          updatedAt: new Date(),
          localActorId: actor.id,
          syncStatus: 'pending'
        };
        await ScheduleService.saveSchedule(newSchedule);
        const place = portalPlaceForClient(selectedClient);
        await AppointmentAdminService.insertConfirmedRequest({
          clientId: selectedClient.id,
          unitName: selectedClient.name,
          responsibleName: selectedClient.responsibleName,
          phone: selectedClient.phone,
          email: selectedClient.email,
          scheduleId: newSchedule.id,
          date: scheduledDate,
          time: scheduledTime,
          attendanceMode: 'presencial',
          municipality: place.municipality,
          district: place.district,
        });
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert('Erro ao salvar agendamento: ' + err.message);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    const date = schedule.scheduledAt.toISOString().split('T')[0];
    const time = schedule.scheduledAt.toTimeString().split(' ')[0].substring(0, 5);
    
    setSelectedClientId(schedule.clientId);
    setClientSearch(schedule.clientName || clients.find(c => c.id === schedule.clientId)?.name || '');
    setScheduledDate(date);
    setScheduledTime(time);
    setNotes(schedule.notes || '');
    setIsEditing(true);
    setEditingId(schedule.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setSelectedClientId('');
    setClientSearch('');
    setScheduledDate('');
    setScheduledTime('');
    setNotes('');
    setIsEditing(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir este agendamento?')) {
      try {
        await ScheduleService.deleteSchedule(id);
        loadData();
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir agendamento.');
      }
    }
  };

  const publicScheduleUrl = `${window.location.origin}/agendar`;

  const copyPublicScheduleLink = async () => {
    try {
      await navigator.clipboard.writeText(publicScheduleUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      prompt('Copie o link de agendamento:', publicScheduleUrl);
    }
  };

  const upcomingSchedules = schedules.filter(s => s.status === 'pending');
  const pastSchedules = schedules.filter(s => s.status !== 'pending').slice(0, 10);

  if (loading && schedules.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-sm text-gray-500">Organize suas próximas inspeções e auditorias.</p>
        </div>
        {activeTab === 'agenda' && (
          <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Agendar Visita
          </Button>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-primary-900">
              <Link2 className="h-4 w-4 shrink-0" />
              Link do cliente
            </div>
            <p className="mt-1 text-sm text-primary-800">
              Envie este link para o cliente escolher data e horario disponivel.
            </p>
            <div className="mt-2 truncate rounded-lg border border-primary-100 bg-white px-3 py-2 text-xs font-medium text-primary-900">
              {publicScheduleUrl}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={copyPublicScheduleLink} className="border-primary-200 bg-white text-primary-700 hover:bg-primary-50">
              <Copy className="mr-1.5 h-4 w-4" />
              {linkCopied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.open(publicScheduleUrl, '_blank', 'noopener,noreferrer')} className="text-primary-700 hover:bg-primary-100">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Abrir
            </Button>
          </div>
        </div>
      </div>

      {/* Abas: agenda interna x solicitações do portal público */}
      <div className="mb-8 flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'agenda'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Agenda
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('solicitacoes')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'solicitacoes'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Solicitações
        </button>
      </div>

      {activeTab === 'solicitacoes' ? (
        <AppointmentRequestsPanel />
      ) : (
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="mr-2 h-5 w-5 text-primary-600" />
            Próximas Visitas
          </h2>
          {upcomingSchedules.length === 0 ? (
            <Card className="bg-gray-50 border-dashed py-12 flex flex-col items-center justify-center">
              <Calendar className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">Nenhuma visita agendada.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcomingSchedules.map(schedule => (
                <Card key={schedule.id} className="overflow-hidden border-l-4 border-l-primary-500 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start space-x-4">
                      <div className="bg-primary-50 p-3 rounded-xl flex flex-col items-center justify-center min-w-[64px]">
                        <span className="text-xs font-bold text-primary-600 uppercase">
                          {schedule.scheduledAt.toLocaleDateString('pt-BR', { month: 'short' })}
                        </span>
                        <span className="text-xl font-black text-primary-900 leading-none mt-1">
                          {schedule.scheduledAt.getDate()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{schedule.clientName || 'Cliente'}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center"><Clock className="mr-1.5 h-3.5 w-3.5" /> 
                            {schedule.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {schedule.notes && <span className="flex items-center italic truncate max-w-[200px]"><AlertCircle className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> {schedule.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                       <Button variant="outline" size="sm" onClick={() => navigate(`/new?clientId=${schedule.clientId}&scheduleId=${schedule.id}`)} className="text-primary-600 border-primary-100 hover:bg-primary-50">
                         <Play className="mr-2 h-4 w-4 fill-current" />
                         Iniciar
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => handleEdit(schedule)} className="text-gray-500 hover:bg-gray-50">
                         <Edit2 className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => handleDelete(schedule.id)} className="text-red-500 hover:bg-red-50">
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {pastSchedules.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-600 mb-4">Finalizados recentemente</h2>
            <div className="space-y-2">
              {pastSchedules.map(schedule => (
                 <div key={schedule.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 opacity-60">
                   <div className="flex items-center space-x-3">
                     <CheckCircle className="h-4 w-4 text-gray-400" />
                     <span className="text-sm font-medium text-gray-700">{schedule.clientName}</span>
                     <span className="text-xs text-gray-400">{formatDateTime(schedule.scheduledAt)}</span>
                   </div>
                   {schedule.status === 'completed' ? (
                     <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">CONCLUÍDO</span>
                   ) : (
                     <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase">{schedule.status}</span>
                   )}
                 </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                {isEditing ? 'Editar Agendamento' : 'Agendar Nova Inspeção'}
              </h3>
              <form onSubmit={handleSchedule} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <User className="mr-2 h-4 w-4 text-gray-400" /> Cliente
                  </label>
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
                      filteredClients.slice(0, 8).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => selectClient(client)}
                          className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-50 ${
                            selectedClientId === client.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                          }`}
                        >
                          <span className="font-medium">{client.name}</span>
                          <span className="shrink-0 text-xs text-gray-400">{client.category?.toUpperCase()}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado.</div>
                    )}
                  </div>
                  {selectedClient && (
                    <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                      Agendamento vinculado a: <strong>{selectedClient.name}</strong>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-gray-400" /> Data
                    </label>
                    <input
                      type="date"
                      required
                      min={minScheduleDate}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-gray-400" /> Horário
                    </label>
                    <input
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Observações (Opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                    placeholder="Ex: Levar checklist extra..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    {isEditing ? 'Salvar Alterações' : 'Confirmar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
