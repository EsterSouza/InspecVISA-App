import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Client, Schedule } from '../types';
import { formatDateTime, generateId } from '../utils/imageUtils';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Calendar, Clock, Plus, Trash2, CheckCircle, AlertCircle, User, Play, Edit2, Link2, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { ScheduleService } from '../services/scheduleService';
import { ClientService } from '../services/clientService';
import { getLocalActor } from '../utils/localActor';
import { AppointmentRequestsPanel } from '../components/schedules/AppointmentRequestsPanel';
import { AppointmentAdminService } from '../services/appointmentAdminService';
import { toDateKey } from '../utils/date';
import { WeekCalendar, type WeekCalendarEvent, type WeekCalendarEventState, type WeekCalendarWeek } from '../components/ui/WeekCalendar';
import { APPOINTMENT_TYPE_RULES } from '../utils/appointmentType';
import { addDays, formatWeekPeriod, mondayOf } from '../utils/weekCalendarDates';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from '../store/useToastStore';

type SchedulesTab = 'agenda' | 'solicitacoes';
type AgendaView = 'semana' | 'lista';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

// Consultoras da equipe — quem fica responsável pela visita (a inspeção herda).
const CONSULTANTS = ['Ester Caiafa', 'Ana Roberta Ribeiro'];

function defaultConsultants(): string[] {
  const me = getLocalActor().name;
  return CONSULTANTS.includes(me) ? [me] : [];
}

/**
 * Soma meses a uma data, "clampando" o dia ao último dia do mês de destino
 * (ex.: 31/01 + 1 mês -> 28/02, não 03/03) — evita o rollover automático do
 * `Date` nativo quando o dia original não existe no mês seguinte.
 */
function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthFirst = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInTargetMonth = new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(date.getDate(), daysInTargetMonth);
  return new Date(
    targetMonthFirst.getFullYear(),
    targetMonthFirst.getMonth(),
    clampedDay,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  );
}

function scheduleCalendarState(status: Schedule['status']): WeekCalendarEventState {
  switch (status) {
    case 'in_progress':
    case 'completed':
      return 'confirmado';
    case 'cancelled':
      return 'atencao';
    case 'pending':
    default:
      return 'a-confirmar';
  }
}

export function Schedules() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep link do painel operacional (P360-013): abre a agenda já rolada até o compromisso.
  const focusScheduleId = searchParams.get('scheduleId');
  // Deep link do painel operacional para um pedido de agendamento pendente: abre direto na
  // aba Pedidos de Visita, já com o card em foco.
  const focusRequestId = searchParams.get('requestId');
  const [activeTab, setActiveTab] = useState<SchedulesTab>(
    searchParams.get('tab') === 'solicitacoes' ? 'solicitacoes' : 'agenda'
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const { confirm, confirmDialog } = useConfirmDialog();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [agendaView, setAgendaView] = useState<AgendaView>('semana');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  // Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<'presencial' | 'online'>('presencial');
  const [selectedConsultants, setSelectedConsultants] = useState<string[]>(defaultConsultants);
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [repeatCount, setRepeatCount] = useState(2);
  const toggleConsultant = (name: string) =>
    setSelectedConsultants((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
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
      setLoadError(null);
    } catch (err: any) {
      console.error('Error loading schedules:', err);
      setLoadError(err?.message || 'Verifique sua conexão e tente novamente.');
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

  // Briefing pode ter sido confirmado sem cliente (lead que ainda não é cliente).
  // Editando esse agendamento, não força escolher um cliente só para mexer em
  // data/horário/observações.
  const editingSchedule = isEditing ? schedules.find((s) => s.id === editingId) : undefined;
  const clientOptionalForEdit = isEditing && editingSchedule?.appointmentType === 'briefing';

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!clientOptionalForEdit && !selectedClientId) || !scheduledDate || !scheduledTime) return;

    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
      // A equipe agenda a qualquer momento; a antecedência de 24h é só do cliente.
      if (!navigator.onLine) {
        toast.error('Sem conexão com a internet.', 'O agendamento precisa sincronizar com o portal do cliente.');
        return;
      }
      const selectedClient = selectedClientId ? clients.find((client) => client.id === selectedClientId) : undefined;
      if (!clientOptionalForEdit && !selectedClient) {
        toast.error('Cliente selecionado nao encontrado.');
        return;
      }
      const actor = getLocalActor();

      if (isEditing && editingId) {
        const existing = schedules.find(s => s.id === editingId);
        if (!existing) return;
        const updated = {
          ...existing,
          clientId: selectedClientId || undefined,
          scheduledAt,
          notes: notes,
          attendanceMode,
          consultantNames: selectedConsultants,
          localActorId: actor.id,
        };
        await ScheduleService.saveSchedule(updated);
        const linkedRequest = await AppointmentAdminService.getRequestByScheduleId(updated.id);
        const startsAt = new Date(`${scheduledDate}T${scheduledTime}`);
        const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        if (linkedRequest) {
          const clientFields = selectedClient
            ? {
                client_id: selectedClient.id,
                unit_name: selectedClient.name,
                responsible_name: selectedClient.responsibleName,
                phone: selectedClient.phone,
                email: selectedClient.email,
                ...portalPlaceForClient(selectedClient),
              }
            : {};
          await AppointmentAdminService.updateRequest(linkedRequest.id, {
            status: 'confirmed',
            ...clientFields,
            attendance_mode: attendanceMode,
            requested_date: scheduledDate,
            requested_time: scheduledTime,
            requested_period: startsAt.getHours() < 12 ? 'manha' : 'tarde',
            requested_starts_at: startsAt.toISOString(),
            requested_ends_at: endsAt.toISOString(),
            duration_minutes: 60,
            consultant_names: selectedConsultants.length ? selectedConsultants : null,
          });
        } else if (selectedClient) {
          const place = portalPlaceForClient(selectedClient);
          await AppointmentAdminService.insertConfirmedRequest({
            clientId: selectedClient.id,
            unitName: selectedClient.name,
            responsibleName: selectedClient.responsibleName,
            phone: selectedClient.phone,
            email: selectedClient.email,
            scheduleId: updated.id,
            date: scheduledDate,
            time: scheduledTime,
            attendanceMode,
            municipality: place.municipality,
            district: place.district,
            consultantNames: selectedConsultants,
          });
        }
      } else {
        // Criação manual sempre exige cliente (não passa pelo canal de briefing sem cliente).
        if (!selectedClient) {
          toast.error('Cliente selecionado nao encontrado.');
          return;
        }
        // Cria uma ocorrência (Schedule + solicitação confirmada no portal) — exatamente
        // o que o fluxo manual já fazia. Repetição mensal só chama isto várias vezes,
        // uma data por vez, cada ocorrência independente (editável/cancelável à parte).
        const createScheduleOccurrence = async (occurrenceAt: Date) => {
          const occurrenceDate = toDateKey(occurrenceAt);
          const newSchedule: Schedule = {
            id: generateId(),
            clientId: selectedClientId,
            scheduledAt: occurrenceAt,
            status: 'pending',
            appointmentType: 'inspection',
            durationMinutes: 60,
            notes: notes,
            attendanceMode,
            consultantNames: selectedConsultants,
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
            date: occurrenceDate,
            time: scheduledTime,
            attendanceMode,
            municipality: place.municipality,
            district: place.district,
          });
        };

        const occurrences = repeatMonthly ? Math.max(1, repeatCount) : 1;
        for (let i = 0; i < occurrences; i++) {
          try {
            await createScheduleOccurrence(i === 0 ? scheduledAt : addMonthsClamped(scheduledAt, i));
          } catch (occurrenceErr: any) {
            throw new Error(
              occurrences > 1
                ? `Falhou na visita ${i + 1} de ${occurrences} (as anteriores já foram criadas): ${occurrenceErr.message}`
                : occurrenceErr.message
            );
          }
        }
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error('Erro ao salvar agendamento', err.message);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    // Data e hora no mesmo fuso: com toISOString() a data vinha em UTC enquanto
    // toTimeString() já dava a hora local, então editar um agendamento das 21h
    // abria o formulário com o dia seguinte.
    const date = toDateKey(schedule.scheduledAt);
    const time = schedule.scheduledAt.toTimeString().split(' ')[0].substring(0, 5);
    
    setSelectedClientId(schedule.clientId ?? '');
    setClientSearch(schedule.clientName || clients.find(c => c.id === schedule.clientId)?.name || '');
    setScheduledDate(date);
    setScheduledTime(time);
    setNotes(schedule.notes || '');
    setAttendanceMode(schedule.attendanceMode || 'presencial');
    setSelectedConsultants(
      schedule.consultantNames && schedule.consultantNames.length > 0
        ? schedule.consultantNames
        : defaultConsultants()
    );
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
    setAttendanceMode('presencial');
    setSelectedConsultants(defaultConsultants());
    setRepeatMonthly(false);
    setRepeatCount(2);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir este agendamento?',
      confirmLabel: 'Excluir agendamento',
    });
    if (!ok) return;
    try {
      await ScheduleService.deleteSchedule(id);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir agendamento.');
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

  useEffect(() => {
    if (!focusScheduleId || schedules.length === 0) return;
    document.getElementById(`schedule-${focusScheduleId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusScheduleId, schedules]);
  const todayKey = toDateKey(new Date());

  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekEvents: WeekCalendarEvent[] = schedules
    .map((schedule) => {
      const dayIndex = weekDays.findIndex((d) => toDateKey(d) === toDateKey(schedule.scheduledAt));
      if (dayIndex === -1) return null;
      const typeLabel = schedule.appointmentType ? APPOINTMENT_TYPE_RULES[schedule.appointmentType].label : undefined;
      const time = schedule.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const event: WeekCalendarEvent = {
        id: schedule.id,
        dayIndex,
        startHour: schedule.scheduledAt.getHours(),
        durationHours: Math.max(1, Math.round((schedule.durationMinutes || 60) / 60)),
        title: schedule.clientName || 'Cliente',
        subtitle: [time, typeLabel].filter(Boolean).join(' · '),
        state: scheduleCalendarState(schedule.status),
        onClick: () => handleEdit(schedule),
      };
      return event;
    })
    .filter((e): e is WeekCalendarEvent => e !== null);
  const currentWeek: WeekCalendarWeek = {
    periodLabel: formatWeekPeriod(weekStart),
    days: weekDays.map((d, i) => ({
      label: WEEKDAY_LABELS[i],
      dayNumber: d.getDate(),
      isToday: toDateKey(d) === todayKey,
    })),
    events: weekEvents,
  };

  const loadingFirstPage = loading && schedules.length === 0;

  return (
    <PageShell>
      <PageHeader
        title="Agendamentos"
        description="Organize suas próximas inspeções e auditorias."
        actions={
          activeTab === 'agenda' && (
            <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Agendar Visita
            </Button>
          )
        }
      />

      {loadError && schedules.length === 0 ? (
        <div className="rounded-2xl border border-default bg-surface">
          <EmptyState
            role="alert"
            icon={<AlertTriangle className="h-8 w-8 text-danger" />}
            title="Não deu para carregar a agenda"
            description={loadError}
            action={
              <Button size="sm" onClick={() => void loadData()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : loadingFirstPage ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
      <>
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
            <div className="mt-2 truncate rounded-lg border border-primary-100 bg-surface px-3 py-2 text-xs font-medium text-primary-900">
              {publicScheduleUrl}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={copyPublicScheduleLink} className="border-primary-200 bg-surface text-primary-700 hover:bg-primary-50">
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
      <div className="mb-8 flex gap-1 rounded-xl bg-surface-sunken p-1">
        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'agenda'
              ? 'bg-surface text-primary-700 shadow-sm'
              : 'text-navy-3 hover:text-navy-2'
          }`}
        >
          Agenda
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('solicitacoes')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'solicitacoes'
              ? 'bg-surface text-primary-700 shadow-sm'
              : 'text-navy-3 hover:text-navy-2'
          }`}
        >
          Pedidos de Visita
        </button>
      </div>

      {activeTab === 'solicitacoes' ? (
        <AppointmentRequestsPanel focusRequestId={focusRequestId} />
      ) : (
      <div className="space-y-8">
        <section className="rounded-2xl border border-default bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center text-lg font-semibold text-navy">
              <Calendar className="mr-2 h-5 w-5 text-primary-600" />
              Agenda
            </h2>
            <div className="flex gap-1 rounded-lg bg-surface-sunken p-1">
              <button
                type="button"
                onClick={() => setAgendaView('semana')}
                aria-pressed={agendaView === 'semana'}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  agendaView === 'semana' ? 'bg-surface text-primary-700 shadow-sm' : 'text-navy-3 hover:text-navy-2'
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setAgendaView('lista')}
                aria-pressed={agendaView === 'lista'}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  agendaView === 'lista' ? 'bg-surface text-primary-700 shadow-sm' : 'text-navy-3 hover:text-navy-2'
                }`}
              >
                Lista
              </button>
            </div>
          </div>

          {agendaView === 'semana' && (
            <WeekCalendar
              week={currentWeek}
              onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
              onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
              emptyMessage="Sem visita agendada."
            />
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy mb-4 flex items-center">
            <Clock className="mr-2 h-5 w-5 text-primary-600" />
            Próximas Visitas
          </h2>
          {upcomingSchedules.length === 0 ? (
            <Card className="border-dashed bg-surface-sunken">
              <EmptyState
                icon={<Calendar className="h-8 w-8" />}
                title="Nenhuma visita agendada"
                description="Agende uma visita ou envie o link do cliente acima."
              />
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcomingSchedules.map(schedule => (
                <Card
                  key={schedule.id}
                  id={`schedule-${schedule.id}`}
                  className={`overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                    focusScheduleId === String(schedule.id) ? 'ring-2 ring-primary-400' : ''
                  }`}
                >
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
                        <h3 className="font-bold text-navy text-sm">{schedule.clientName || 'Cliente'}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-navy-3">
                          <span className="flex items-center"><Clock className="mr-1.5 h-3.5 w-3.5" /> 
                            {schedule.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {schedule.notes && <span className="flex items-center italic truncate max-w-[200px]"><AlertCircle className="mr-1.5 h-3.5 w-3.5 text-amber-strong" /> {schedule.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                       {schedule.clientId && (
                         <Button variant="outline" size="sm" onClick={() => navigate(`/new?clientId=${schedule.clientId}&scheduleId=${schedule.id}`)} className="text-primary-600 border-primary-100 hover:bg-primary-50">
                           <Play className="mr-2 h-4 w-4 fill-current" />
                           Iniciar
                         </Button>
                       )}
                       <Button variant="ghost" size="sm" onClick={() => handleEdit(schedule)} className="text-navy-3 hover:bg-surface-hover">
                         <Edit2 className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => handleDelete(schedule.id)} className="text-danger hover:bg-danger-soft">
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
            <h2 className="text-lg font-semibold text-navy-2 mb-4">Finalizados recentemente</h2>
            <div className="space-y-2">
              {pastSchedules.map(schedule => (
                 <div key={schedule.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-default opacity-60">
                   <div className="flex items-center space-x-3">
                     <CheckCircle className="h-4 w-4 text-navy-3" />
                     <span className="text-sm font-medium text-navy-2">{schedule.clientName}</span>
                     <span className="text-xs text-navy-3">{formatDateTime(schedule.scheduledAt)}</span>
                   </div>
                   {schedule.status === 'completed' ? (
                     <span className="text-[10px] bg-success-soft text-success-soft-ink px-2 py-0.5 rounded-full font-bold">CONCLUÍDO</span>
                   ) : (
                     <span className="text-[10px] bg-surface-sunken text-navy-3 px-2 py-0.5 rounded-full font-bold uppercase">{schedule.status}</span>
                   )}
                 </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}
      </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title" className="w-full max-w-lg shadow-2xl">
            <CardContent className="p-6">
              <h3 id="schedule-modal-title" className="text-xl font-bold text-navy mb-6">
                {isEditing ? 'Editar Agendamento' : 'Agendar Nova Inspeção'}
              </h3>
              <form onSubmit={handleSchedule} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="schedule-client-search" className="text-sm font-medium text-navy-2 flex items-center">
                    <User className="mr-2 h-4 w-4 text-navy-3" aria-hidden="true" /> Cliente
                    {clientOptionalForEdit && (
                      <span className="ml-1.5 font-normal text-navy-3">(opcional — briefing sem cliente)</span>
                    )}
                  </label>
                  {clientOptionalForEdit && !selectedClientId && (
                    <p className="text-xs text-navy-3">
                      Este briefing não tem cliente vinculado. Deixe em branco para manter assim, ou busque abaixo para vincular agora.
                    </p>
                  )}
                  <input
                    id="schedule-client-search"
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setSelectedClientId('');
                    }}
                    className="w-full rounded-xl border border-control p-3 text-sm placeholder:text-navy-3"
                  />
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-default bg-surface">
                    {filteredClients.length > 0 ? (
                      filteredClients.slice(0, 8).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => selectClient(client)}
                          className={`flex w-full items-center justify-between gap-3 border-b border-default px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary-50 ${
                            selectedClientId === client.id ? 'bg-primary-50 text-primary-700' : 'text-navy-2'
                          }`}
                        >
                          <span className="font-medium">{client.name}</span>
                          <span className="shrink-0 text-xs text-navy-3">{client.category?.toUpperCase()}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-navy-3">Nenhum cliente encontrado.</div>
                    )}
                  </div>
                  {selectedClient && (
                    <div className="rounded-xl border border-success-soft-border bg-success-soft px-3 py-2 text-sm text-success-soft-ink">
                      Agendamento vinculado a: <strong>{selectedClient.name}</strong>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="schedule-date" className="text-sm font-medium text-navy-2 flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-navy-3" aria-hidden="true" /> Data
                    </label>
                    {/* Sem data mínima: a equipe pode registrar visitas retroativas
                        para lançar relatórios de inspeções já realizadas. */}
                    <input
                      id="schedule-date"
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-xl border border-control p-3 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="schedule-time" className="text-sm font-medium text-navy-2 flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-navy-3" aria-hidden="true" /> Horário
                    </label>
                    <input
                      id="schedule-time"
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-xl border border-control p-3 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <span id="schedule-attendance-label" className="text-sm font-medium text-navy-2">
                    Modalidade <span className="text-danger">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="schedule-attendance-label">
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
                  <p className="text-xs text-navy-3">Define a margem de conflito reservada na agenda: presencial reserva deslocamento, online só a troca entre chamadas.</p>
                </div>

                {!isEditing && (
                  <div className="space-y-2 rounded-xl border border-default bg-surface-sunken p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-navy-2">
                      <input
                        type="checkbox"
                        checked={repeatMonthly}
                        onChange={(e) => setRepeatMonthly(e.target.checked)}
                        className="h-4 w-4 rounded border-control text-primary-600 focus:ring-primary-500"
                      />
                      Repetir mensalmente (mesmo dia/horário)
                    </label>
                    {repeatMonthly && (
                      <div className="flex items-center gap-2 pl-6">
                        <label htmlFor="schedule-repeat-count" className="text-sm text-navy-2">Quantas visitas:</label>
                        <input
                          id="schedule-repeat-count"
                          type="number"
                          min={2}
                          max={12}
                          value={repeatCount}
                          onChange={(e) => setRepeatCount(Math.min(12, Math.max(2, Number(e.target.value) || 2)))}
                          className="w-20 rounded-lg border border-control p-2 text-sm"
                        />
                        <span className="text-xs text-navy-3">(cria {repeatCount} agendamentos independentes, um por mês)</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <span id="schedule-consultants-label" className="text-sm font-medium text-navy-2">Consultora(s) responsável(is)</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="schedule-consultants-label">
                    {CONSULTANTS.map((name) => {
                      const active = selectedConsultants.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleConsultant(name)}
                          aria-pressed={active}
                          className={`min-h-11 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                            active
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'border border-default bg-surface text-navy-2 hover:bg-surface-hover'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-navy-3">A inspeção criada a partir desta visita herda quem você marcar aqui.</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="schedule-notes" className="text-sm font-medium text-navy-2">Observações (Opcional)</label>
                  <textarea
                    id="schedule-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-control p-3 text-sm placeholder:text-navy-3"
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
      {confirmDialog}
    </PageShell>
  );
}
