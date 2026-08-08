import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, FileText, Image, Paperclip, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClientPortalVisit } from '../../services/clientPortalService';
import { formatDateBR, parseDateParts, toDateKey } from '../../utils/clientPortalFormat';

export type PortalAppointmentVisit = ClientPortalVisit & { unitName: string; city: string | null };

interface PortalAppointmentsProps {
  visits: PortalAppointmentVisit[];
  schedulingSuspended: boolean;
  calendarMonth: Date;
  onCalendarMonthChange: (next: Date) => void;
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

const CALENDAR_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

export function PortalAppointments({
  visits,
  schedulingSuspended,
  calendarMonth,
  onCalendarMonthChange,
  loading,
}: PortalAppointmentsProps) {
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

  const visitsByDate = new Map<string, PortalAppointmentVisit[]>();
  for (const visit of visits) {
    if (!visit.requested_date) continue;
    const list = visitsByDate.get(visit.requested_date) || [];
    list.push(visit);
    visitsByDate.set(visit.requested_date, list);
  }

  const month = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const start = new Date(monthStart);
  const end = new Date(monthEnd);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)));
  const cells: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    cells.push(new Date(cursor));
  }
  const todayKey = toDateKey(new Date());

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
          <div className="flex items-center justify-between gap-1 sm:justify-end">
            <button
              type="button"
              onClick={() => onCalendarMonthChange(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="Mês anterior"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex-1 text-center text-sm font-bold lowercase text-gray-900 first-letter:uppercase sm:min-w-[130px] sm:flex-none">
              {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => onCalendarMonthChange(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="Próximo mês"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const n = new Date();
                onCalendarMonthChange(new Date(n.getFullYear(), n.getMonth(), 1));
              }}
              className="ml-1 inline-flex h-11 items-center gap-1 rounded-md border border-gray-200 px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              title="Voltar ao mês atual"
              aria-label="Voltar ao mês atual"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Hoje
            </button>
          </div>
        </div>
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-gray-500 sm:gap-2 sm:text-[11px]">
            {CALENDAR_WEEKDAYS.map((label) => (
              <div key={label} className="py-1">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((date) => {
              const key = toDateKey(date);
              const dayVisits = visitsByDate.get(key) || [];
              const inMonth = key.startsWith(month);
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`flex min-h-[40px] flex-col rounded-md border p-1 sm:min-h-[104px] sm:p-2 ${
                    dayVisits.length > 0
                      ? 'border-primary-200 bg-primary-50/60'
                      : inMonth
                        ? 'border-gray-100 bg-white'
                        : 'border-transparent bg-transparent'
                  } ${isToday ? 'ring-2 ring-primary-300' : ''}`}
                >
                  <p className={`text-xs font-bold leading-none sm:text-base sm:font-black ${inMonth ? 'text-gray-900' : 'text-gray-300'}`}>
                    {date.getDate()}
                  </p>

                  {dayVisits.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-0.5 pt-1 sm:hidden">
                      {dayVisits.slice(0, 4).map((v) => (
                        <span key={v.public_token} className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                      ))}
                    </div>
                  )}

                  <div className="mt-2 hidden space-y-1 sm:block">
                    {dayVisits.slice(0, 2).map((visit) => (
                      <Link
                        key={visit.public_token}
                        to={`/cliente/visita/${visit.public_token}`}
                        className="block truncate rounded bg-white/80 px-1.5 py-1 text-[10px] font-semibold text-primary-900 shadow-sm"
                        title={`${visit.unitName} - ${visitDisplayStatus(visit.status, schedulingSuspended).label}`}
                      >
                        {visit.requested_time ? `${visit.requested_time} ` : ''}{visit.unitName}
                      </Link>
                    ))}
                    {dayVisits.length > 2 && (
                      <p className="text-[10px] font-semibold text-primary-700">+{dayVisits.length - 2}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
