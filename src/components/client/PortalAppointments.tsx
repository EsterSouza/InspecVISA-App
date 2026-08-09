import { useState } from 'react';
import { CalendarDays, CalendarOff, FileText, Image, Paperclip } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { ClientPortalVisit } from '../../services/clientPortalService';
import { formatDateBR, parseDateParts, toDateKey } from '../../utils/clientPortalFormat';
import { WeekCalendar, type WeekCalendarEvent, type WeekCalendarEventState, type WeekCalendarWeek } from '../ui/WeekCalendar';
import { addDays, formatWeekPeriod, mondayOf } from '../../utils/weekCalendarDates';

export type PortalAppointmentVisit = ClientPortalVisit & { unitName: string; city: string | null };

interface PortalAppointmentsProps {
  visits: PortalAppointmentVisit[];
  schedulingSuspended: boolean;
  loading?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Relatório em andamento',
  report_available: 'Relatório disponível',
  cancelled: 'Cancelada',
};

const STATUS_BADGES: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  rescheduled: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  report_available: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

// Visitas ainda não entregues: quando a conta está suspensa por pagamento,
// exibem "Suspenso" no portal (apenas visual; o status real no banco é preservado).
const SUSPENDABLE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled']);

function visitDisplayStatus(status: string, suspended: boolean): { label: string; badge: string } {
  if (suspended && SUSPENDABLE_VISIT_STATUSES.has(status)) {
    return { label: 'Suspenso', badge: 'bg-red-100 text-red-700' };
  }
  return {
    label: STATUS_LABELS[status] || status,
    badge: STATUS_BADGES[status] || 'bg-gray-100 text-gray-500',
  };
}

function visitCalendarState(status: string, suspended: boolean): WeekCalendarEventState {
  if (suspended && SUSPENDABLE_VISIT_STATUSES.has(status)) return 'atencao';
  if (status === 'cancelled') return 'atencao';
  if (status === 'requested' || status === 'rescheduled') return 'a-confirmar';
  return 'confirmado'; // confirmed, in_progress, completed, report_available
}

const CALENDAR_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

export function PortalAppointments({
  visits,
  schedulingSuspended,
  loading,
}: PortalAppointmentsProps) {
  const navigate = useNavigate();
  const [agendaView, setAgendaView] = useState<'semana' | 'lista'>('semana');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  if (loading) {
    return (
      <div className="mb-8 h-64 animate-pulse rounded-xl border border-gray-200 bg-gray-50" aria-hidden="true" />
    );
  }

  const todayKeyTop = toDateKey(new Date());
  const sortedVisits = [...visits].sort((a, b) => {
    const ka = `${a.requested_date || '9999-12-31'}${a.requested_time || ''}`;
    const kb = `${b.requested_date || '9999-12-31'}${b.requested_time || ''}`;
    const aUpcoming = (a.requested_date || '') >= todayKeyTop;
    const bUpcoming = (b.requested_date || '') >= todayKeyTop;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? ka.localeCompare(kb) : kb.localeCompare(ka);
  });

  const todayKey = toDateKey(new Date());
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekEvents: WeekCalendarEvent[] = visits
    .map((visit) => {
      if (!visit.requested_date || !visit.requested_time) return null;
      const dayIndex = weekDays.findIndex((d) => toDateKey(d) === visit.requested_date);
      if (dayIndex === -1) return null;
      const startHour = Number(visit.requested_time.split(':')[0]);
      if (!Number.isFinite(startHour)) return null;
      const event: WeekCalendarEvent = {
        id: visit.public_token,
        dayIndex,
        startHour,
        durationHours: 1,
        title: visit.unitName,
        subtitle: [visit.requested_time, visit.city].filter(Boolean).join(' · '),
        state: visitCalendarState(visit.status, schedulingSuspended),
        onClick: () => navigate(`/cliente/visita/${visit.public_token}`),
      };
      return event;
    })
    .filter((e): e is WeekCalendarEvent => e !== null);
  const currentWeek: WeekCalendarWeek = {
    periodLabel: formatWeekPeriod(weekStart),
    days: weekDays.map((d, i) => ({
      label: CALENDAR_WEEKDAYS[i],
      dayNumber: d.getDate(),
      isToday: toDateKey(d) === todayKey,
    })),
    events: weekEvents,
  };

  return (
    <>
      {schedulingSuspended && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <CalendarOff className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Agendamentos suspensos</p>
              <p className="mt-1 text-red-700">
                Os novos agendamentos estão temporariamente suspensos por pendência de pagamento.
                Regularize o pagamento para liberar novas solicitações de horário.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary-700" />
            Calendário de compromissos
          </h3>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setAgendaView('semana')}
              aria-pressed={agendaView === 'semana'}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                agendaView === 'semana' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setAgendaView('lista')}
              aria-pressed={agendaView === 'lista'}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                agendaView === 'lista' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
            emptyMessage="Sem compromisso."
          />
        )}
      </section>

      <section className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-5 py-3.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary-700" />
          <h3 className="text-sm font-bold text-gray-900">Agendamentos e arquivos</h3>
          <span className="ml-auto text-xs text-gray-500">
            {sortedVisits.length} visita{sortedVisits.length === 1 ? '' : 's'}
          </span>
        </header>
        {sortedVisits.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-500">Nenhum compromisso registrado ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {sortedVisits.map((visit) => {
              const d = visit.requested_date ? parseDateParts(visit.requested_date) : null;
              const st = visitDisplayStatus(visit.status, schedulingSuspended);
              return (
                <li key={visit.public_token}>
                  <Link
                    to={`/cliente/visita/${visit.public_token}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary-50/40 sm:px-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-50 text-primary-800">
                      <span className="text-[9px] font-bold uppercase leading-none">
                        {d ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '--'}
                      </span>
                      <span className="text-base font-black leading-none">{d ? d.getDate() : '--'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{visit.unitName}</p>
                      <p className="truncate text-xs text-gray-500">
                        {formatDateBR(visit.requested_date)}
                        {visit.requested_time ? ` às ${visit.requested_time}` : ''}
                        {visit.city ? ` · ${visit.city}` : ''}
                      </p>
                      {((visit.report_count || 0) > 0 || (visit.photo_count || 0) > 0 || (visit.attachment_count || 0) > 0) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          {(visit.report_count || 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3 w-3" /> {visit.report_count}
                            </span>
                          )}
                          {(visit.photo_count || 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Image className="h-3 w-3" /> {visit.photo_count}
                            </span>
                          )}
                          {(visit.attachment_count || 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="h-3 w-3" /> {visit.attachment_count}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.badge}`}>
                        {st.label}
                      </span>
                      <span className="hidden text-xs font-semibold text-primary-700 sm:inline">Abrir detalhes</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
