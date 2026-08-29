import { useState } from 'react';
import { CalendarCheck, CalendarClock, CalendarDays, CalendarOff, FileText, Flag, FolderOpen, Image, Paperclip, Video } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { ClientPortalUnit, ClientPortalVisit } from '../../services/clientPortalService';
import { formatDateBR, parseDateParts } from '../../utils/clientPortalFormat';
import { toDateKey } from '../../utils/date';
import { WeekCalendar, type WeekCalendarAllDayItem, type WeekCalendarEvent, type WeekCalendarEventState, type WeekCalendarWeek } from '../ui/WeekCalendar';
import { MILESTONE_BADGE_CLASSES } from '../ui/calendarEventState';
import { addDays, formatWeekPeriod, mondayOf } from '../../utils/weekCalendarDates';
import { APPOINTMENT_STATUS_LABELS } from '../../utils/appointmentType';

export type PortalAppointmentVisit = ClientPortalVisit & { unitName: string; city: string | null };

interface PortalAppointmentsProps {
  visits: PortalAppointmentVisit[];
  units?: ClientPortalUnit[];
  schedulingSuspended: boolean;
  loading?: boolean;
}

// Prazos e entregas que não são visitas agendadas (sem hora): prazo/entrega do relatório e
// previsão de entrega da pasta sanitária personalizada. Aparecem misturados às visitas na lista
// da agenda (não no calendário semanal, que é por hora).
interface ServiceDateItem {
  key: string;
  date: string;
  label: string;
  note?: string | null;
  unitName: string;
  city: string | null;
  icon: 'due' | 'delivered' | 'folder' | 'milestone';
  publicToken?: string;
}

function buildServiceDateItems(visits: PortalAppointmentVisit[], units: ClientPortalUnit[]): ServiceDateItem[] {
  const items: ServiceDateItem[] = [];

  for (const visit of visits) {
    if (visit.appointment_type !== 'inspection') continue;
    if (visit.report_delivered_at) {
      items.push({
        key: `${visit.public_token}-delivered`,
        date: visit.report_delivered_at.split('T')[0],
        label: 'Relatório entregue',
        unitName: visit.unitName,
        city: visit.city,
        icon: 'delivered',
        publicToken: visit.public_token,
      });
    } else if (visit.report_due_at) {
      items.push({
        key: `${visit.public_token}-due`,
        date: visit.report_due_at.split('T')[0],
        label: 'Prazo de entrega do relatório',
        unitName: visit.unitName,
        city: visit.city,
        icon: 'due',
        publicToken: visit.public_token,
      });
    }
  }

  for (const unit of units) {
    if (unit.personalized_sanitary_folder_expected_delivery_date && !unit.personalized_sanitary_folder_url) {
      items.push({
        key: `${unit.client_id}-sanitary-folder`,
        date: unit.personalized_sanitary_folder_expected_delivery_date.split('T')[0],
        label: 'Pasta sanitária personalizada: previsão de entrega',
        unitName: unit.client_name,
        city: unit.city,
        icon: 'folder',
      });
    }

    // AGD-02b — só os marcos que a consultora marcou como visíveis chegam até aqui
    // (client_portal_overview já filtra); nunca bloqueiam agendar visita nesse dia.
    for (const milestone of unit.milestones || []) {
      items.push({
        key: `milestone-${milestone.id}`,
        date: milestone.milestone_date,
        label: milestone.title,
        note: milestone.note,
        unitName: unit.client_name,
        city: unit.city,
        icon: 'milestone',
      });
    }
  }

  return items;
}

const STATUS_BADGES: Record<string, string> = {
  requested: 'bg-amber-soft text-amber-soft-ink',
  confirmed: 'bg-primary-100 text-accent-ink',
  in_progress: 'bg-primary-100 text-accent-ink',
  rescheduled: 'bg-amber-soft text-amber-soft-ink',
  completed: 'bg-success-soft text-success-soft-ink',
  report_available: 'bg-success-soft text-success-soft-ink',
  cancelled: 'bg-surface-sunken text-navy-3',
};

// Visitas ainda não entregues: quando a conta está suspensa por pagamento,
// exibem "Suspenso" no portal (apenas visual; o status real no banco é preservado).
const SUSPENDABLE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled']);

function visitDisplayStatus(status: string, suspended: boolean): { label: string; badge: string } {
  if (suspended && SUSPENDABLE_VISIT_STATUSES.has(status)) {
    return { label: 'Suspenso', badge: 'bg-danger-soft text-danger-soft-ink' };
  }
  return {
    label: APPOINTMENT_STATUS_LABELS[status] || status,
    badge: STATUS_BADGES[status] || 'bg-surface-sunken text-navy-3',
  };
}

function visitCalendarState(status: string, suspended: boolean): WeekCalendarEventState {
  if (suspended && SUSPENDABLE_VISIT_STATUSES.has(status)) return 'atencao';
  if (status === 'cancelled') return 'atencao';
  if (status === 'requested' || status === 'rescheduled') return 'a-confirmar';
  return 'confirmado'; // confirmed, in_progress, completed, report_available
}

const CALENDAR_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

type AgendaRow =
  | { kind: 'visit'; sortDate: string; sortTime: string; visit: PortalAppointmentVisit }
  | { kind: 'milestone'; sortDate: string; sortTime: string; item: ServiceDateItem };

export function PortalAppointments({
  visits,
  units = [],
  schedulingSuspended,
  loading,
}: PortalAppointmentsProps) {
  const navigate = useNavigate();
  const [agendaView, setAgendaView] = useState<'semana' | 'lista'>('semana');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  if (loading) {
    return (
      <div className="mb-8 h-64 animate-pulse rounded-xl border border-default bg-surface-sunken" aria-hidden="true" />
    );
  }

  const todayKeyTop = toDateKey(new Date());
  const serviceDateItems = buildServiceDateItems(visits, units);
  const agendaRows: AgendaRow[] = [
    ...visits.map((visit) => ({
      kind: 'visit' as const,
      sortDate: visit.requested_date || '9999-12-31',
      sortTime: visit.requested_time || '',
      visit,
    })),
    ...serviceDateItems.map((item) => ({ kind: 'milestone' as const, sortDate: item.date, sortTime: '', item })),
  ].sort((a, b) => {
    const aUpcoming = a.sortDate >= todayKeyTop;
    const bUpcoming = b.sortDate >= todayKeyTop;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    const ka = `${a.sortDate}${a.sortTime}`;
    const kb = `${b.sortDate}${b.sortTime}`;
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
        subtitle: [visit.requested_time, visit.attendance_mode === 'online' ? 'Online' : visit.city].filter(Boolean).join(' · '),
        state: visitCalendarState(visit.status, schedulingSuspended),
        onClick: () => navigate(`/cliente/visita/${visit.public_token}`),
      };
      return event;
    })
    .filter((e): e is WeekCalendarEvent => e !== null);
  // AGD-02b — marco visível vira sinalização no primeiro horário do dia, igual na agenda do
  // admin. Sem hora, então não entra em `events`; nunca impede escolher aquele dia para visita.
  const milestoneAllDayItems: WeekCalendarAllDayItem[] = serviceDateItems
    .filter((item) => item.icon === 'milestone')
    .map((item) => {
      const dayIndex = weekDays.findIndex((d) => toDateKey(d) === item.date);
      if (dayIndex === -1) return null;
      const allDayItem: WeekCalendarAllDayItem = {
        id: item.key,
        dayIndex,
        title: item.label,
        icon: <Flag className="h-3 w-3" aria-hidden="true" />,
      };
      return allDayItem;
    })
    .filter((item): item is WeekCalendarAllDayItem => item !== null);
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
        <div className="mb-8 rounded-xl border border-danger-soft-border bg-danger-soft p-4 text-sm text-danger-soft-ink">
          <div className="flex items-start gap-2">
            <CalendarOff className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div>
              <p className="font-bold">Agendamentos suspensos</p>
              <p className="mt-1 text-danger-soft-ink">
                Os novos agendamentos estão temporariamente suspensos por pendência de pagamento.
                Regularize o pagamento para liberar novas solicitações de horário.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-8 rounded-xl border border-default bg-surface p-3 shadow-sm sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary-700" />
            Calendário de compromissos
          </h3>
          <div className="flex gap-1 rounded-lg bg-surface-sunken p-1">
            <button
              type="button"
              onClick={() => setAgendaView('semana')}
              aria-pressed={agendaView === 'semana'}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${
                agendaView === 'semana' ? 'bg-surface text-primary-700 shadow-sm' : 'text-navy-3 hover:text-navy-2'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setAgendaView('lista')}
              aria-pressed={agendaView === 'lista'}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${
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
            allDayItems={milestoneAllDayItems}
            onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
            onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
            emptyMessage="Sem compromisso."
          />
        )}
      </section>

      <section className="mb-5 overflow-hidden rounded-xl border border-default bg-surface shadow-sm">
        <header className="flex items-center gap-2 border-b border-default bg-surface-sunken/70 px-5 py-3.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary-700" />
          <h3 className="text-sm font-bold text-navy">Agendamentos e arquivos</h3>
          <span className="ml-auto text-xs text-navy-3">
            {visits.length} visita{visits.length === 1 ? '' : 's'}
          </span>
        </header>
        {agendaRows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-navy-3">Nenhum compromisso registrado ainda.</p>
        ) : (
          <ul className="divide-y divide-surface-sunken">
            {agendaRows.map((row) => {
              if (row.kind === 'milestone') {
                const item = row.item;
                const isMilestone = item.icon === 'milestone';
                const Icon = item.icon === 'delivered' ? CalendarCheck : item.icon === 'folder' ? FolderOpen : isMilestone ? Flag : CalendarClock;
                const content = (
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                        isMilestone ? MILESTONE_BADGE_CLASSES : 'bg-surface-sunken text-navy-3'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{item.label}</p>
                      <p className="truncate text-xs text-navy-3">
                        {formatDateBR(item.date)} · {item.unitName}
                        {item.city ? ` · ${item.city}` : ''}
                      </p>
                      {isMilestone && item.note && <p className="truncate text-xs text-navy-3">{item.note}</p>}
                    </div>
                  </div>
                );
                return (
                  <li key={item.key}>
                    {item.publicToken ? (
                      <Link
                        to={`/cliente/visita/${item.publicToken}`}
                        className="block transition-colors hover:bg-primary-50/40"
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              }

              const visit = row.visit;
              const d = visit.requested_date ? parseDateParts(visit.requested_date) : null;
              const st = visitDisplayStatus(visit.status, schedulingSuspended);
              return (
                <li key={visit.public_token} className="flex items-stretch">
                  <Link
                    to={`/cliente/visita/${visit.public_token}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-primary-50/40 sm:px-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-50 text-primary-800">
                      <span className="text-[9px] font-bold uppercase leading-none">
                        {d ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '--'}
                      </span>
                      <span className="text-base font-black leading-none">{d ? d.getDate() : '--'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{visit.unitName}</p>
                      <p className="truncate text-xs text-navy-3">
                        {formatDateBR(visit.requested_date)}
                        {visit.requested_time ? ` às ${visit.requested_time}` : ''}
                        {visit.attendance_mode === 'online' ? ' · Online' : visit.city ? ` · ${visit.city}` : ''}
                      </p>
                      {((visit.report_count || 0) > 0 || (visit.photo_count || 0) > 0 || (visit.attachment_count || 0) > 0) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-navy-3">
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
                  {visit.attendance_mode === 'online' && visit.meeting_url?.startsWith('https://') && (
                    <a
                      href={visit.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="m-2 inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary-700 px-3 text-sm font-semibold text-on-accent hover:bg-primary-800"
                    >
                      <Video className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Entrar na reunião</span>
                      <span className="sm:hidden">Entrar</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
