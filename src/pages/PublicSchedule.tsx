import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  Loader2,
  MapPin,
  Monitor,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type { AttendanceMode, PublicAvailableTime, PublicCalendarDay } from '../types';
import { publicAppointmentService } from '../services/publicAppointmentService';
import { clientPortalService, type ClientPortalUnit } from '../services/clientPortalService';
import { PublicHeader } from '../components/public/PublicHeader';
import { formatProtocol } from '../utils/protocol';
import { isAppointmentAtLeast24hAhead } from '../utils/appointmentLeadTime';
import { isRioState } from '../utils/state';

const RIO_MUNICIPALITIES = [
  'Rio de Janeiro',
  'Niteroi',
  'Sao Goncalo',
  'Duque de Caxias',
  'Nova Iguacu',
  'Belford Roxo',
  'Sao Joao de Meriti',
  'Nilopolis',
  'Mesquita',
  'Queimados',
  'Itaborai',
  'Marica',
];

const CALENDAR_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const ACTIVE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled', 'completed']);

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function daysToLoadForMonth(date: Date): number {
  const now = new Date();
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startsThisMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  const first = startsThisMonth ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.max(1, Math.floor((monthEnd.getTime() - first.getTime()) / 86400000) + 1);
}

function monthStartKey(date: Date): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function formatMonthTitle(value: string): string {
  const date = parseLocalDate(`${value}-01`);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function isActiveVisit(visit: { status: string; requested_date: string | null }): boolean {
  return !!visit.requested_date && ACTIVE_VISIT_STATUSES.has(visit.status);
}

function formatFullDay(value: string): string {
  return parseLocalDate(value).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

export function PublicSchedule() {
  const [days, setDays] = useState<PublicCalendarDay[]>([]);
  const [times, setTimes] = useState<PublicAvailableTime[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTime, setSelectedTime] = useState<PublicAvailableTime | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [timesLoading, setTimesLoading] = useState(false);
  const [calendarReloadKey, setCalendarReloadKey] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [unitName, setUnitName] = useState('');
  // Modo portal: cliente logado agenda só para as próprias unidades vinculadas
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [portalAccount, setPortalAccount] = useState<string>('');
  const [portalUnits, setPortalUnits] = useState<ClientPortalUnit[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('presencial');
  const [municipality, setMunicipality] = useState('Rio de Janeiro');
  const [district, setDistrict] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedDayLabel = useMemo(
    () => (selectedDay ? formatFullDay(selectedDay) : 'Escolha uma data'),
    [selectedDay]
  );

  const portalMode = !!portalToken && portalUnits.length > 0;
  const selectedUnit = useMemo(
    () => portalUnits.find((unit) => unit.client_id === selectedClientId) || null,
    [portalUnits, selectedClientId]
  );
  const visibleMonth = monthKey(monthStartKey(calendarMonth));
  const selectedMonth = selectedDay ? monthKey(selectedDay) : visibleMonth;
  const selectedUnitAllowsInPerson = !portalMode || isRioState(selectedUnit?.state);
  const unitBlockedInSelectedMonth = useMemo(() => {
    if (!portalMode || !selectedMonth) return new Set<string>();
    return new Set(
      portalUnits
        .filter((unit) =>
          unit.visits.some((visit) => isActiveVisit(visit) && monthKey(visit.requested_date!) === selectedMonth)
        )
        .map((unit) => unit.client_id)
    );
  }, [portalMode, portalUnits, selectedMonth]);
  const selectedUnitBlockedInMonth = !!selectedClientId && unitBlockedInSelectedMonth.has(selectedClientId);
  const dayAvailability = useMemo(() => new Map(days.map((day) => [day.day, day])), [days]);
  const visibleTimes = useMemo(
    () => times.filter((time) => isAppointmentAtLeast24hAhead(time.starts_at)),
    [times]
  );
  const portalVisitsByDay = useMemo(() => {
    const map = new Map<string, ClientPortalUnit[]>();
    for (const unit of portalUnits) {
      for (const visit of unit.visits) {
        if (!isActiveVisit(visit)) continue;
        const list = map.get(visit.requested_date!) || [];
        list.push(unit);
        map.set(visit.requested_date!, list);
      }
    }
    return map;
  }, [portalUnits]);
  const calendarCells = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const last = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const start = new Date(first);
    const end = new Date(last);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)));

    const cells: Array<{
      key: string;
      date: Date;
      inRange: boolean;
      month: string;
      available?: PublicCalendarDay;
      bookings: ClientPortalUnit[];
    }> = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = toDateKey(cursor);
      cells.push({
        key,
        date: new Date(cursor),
        inRange: cursor.getMonth() === calendarMonth.getMonth(),
        month: monthKey(key),
        available: monthKey(key) === monthKey(monthStartKey(calendarMonth)) ? dayAvailability.get(key) : undefined,
        bookings: portalVisitsByDay.get(key) || [],
      });
    }
    return cells;
  }, [calendarMonth, dayAvailability, portalVisitsByDay]);

  // Detecta sessão do portal do cliente e carrega só as unidades vinculadas.
  useEffect(() => {
    const stored = clientPortalService.getStoredToken();
    if (!stored) return;
    let cancelled = false;
    clientPortalService
      .overview(stored)
      .then((data) => {
        if (cancelled) return;
        setPortalToken(stored);
        setPortalAccount(data.account_name);
        setPortalUnits(data.units);
        if (data.units.length > 0) {
          setSelectedClientId(data.units[0].client_id);
          if (data.units[0].city) setMunicipality(data.units[0].city);
        }
      })
      .catch(() => {
        // token inválido/expirado — segue como público
        clientPortalService.clearToken();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!portalMode || !selectedMonth) return;
    if (selectedClientId && !unitBlockedInSelectedMonth.has(selectedClientId)) return;
    const nextUnit = portalUnits.find((unit) => !unitBlockedInSelectedMonth.has(unit.client_id));
    setSelectedClientId(nextUnit?.client_id || '');
    if (nextUnit?.city) setMunicipality(nextUnit.city);
  }, [portalMode, portalUnits, selectedClientId, selectedMonth, unitBlockedInSelectedMonth]);

  useEffect(() => {
    if (portalMode && !selectedUnitAllowsInPerson && attendanceMode === 'presencial') {
      setAttendanceMode('online');
    }
  }, [attendanceMode, portalMode, selectedUnitAllowsInPerson]);

  useEffect(() => {
    let cancelled = false;
    setCalendarLoading(true);
    const startDate = monthStartKey(calendarMonth);
    publicAppointmentService
      .listCalendarDays(startDate, daysToLoadForMonth(calendarMonth))
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setDays(data);
        setSelectedDay((currentDay) => {
          const currentSelectionInMonth = currentDay && monthKey(currentDay) === monthKey(startDate);
          return currentSelectionInMonth ? currentDay : (data[0]?.day || '');
        });
      })
      .catch((err) => {
        console.warn('[PublicSchedule] Falha ao carregar calendario:', err);
        if (!cancelled) setError('Nao foi possivel carregar o calendario agora. Tente novamente em alguns instantes.');
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [calendarMonth, calendarReloadKey]);

  useEffect(() => {
    if (!selectedDay) {
      setTimes([]);
      setSelectedTime(null);
      return;
    }

    let cancelled = false;
    setTimesLoading(true);
    setSelectedTime(null);
    publicAppointmentService
      .listAvailableTimes(selectedDay)
      .then((data) => {
        if (cancelled) return;
        setTimes(data);
      })
      .catch((err) => {
        console.warn('[PublicSchedule] Falha ao carregar horarios:', err);
        if (!cancelled) setTimes([]);
      })
      .finally(() => {
        if (!cancelled) setTimesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  const validate = () => {
    if (!selectedTime) return 'Escolha um horario disponivel.';
    if (portalMode) {
      if (!selectedClientId) return 'Selecione a unidade.';
      if (selectedUnitBlockedInMonth) return 'Esta unidade ja possui uma vistoria marcada neste mes.';
      if (attendanceMode === 'presencial' && !selectedUnitAllowsInPerson) {
        return 'Vistoria presencial esta disponivel apenas para unidades cadastradas no RJ.';
      }
    } else if (!unitName.trim()) {
      return 'Informe o nome da unidade.';
    }
    if (attendanceMode === 'presencial') {
      if (!municipality.trim()) return 'Informe o municipio do atendimento presencial.';
      if (!district.trim()) return 'Informe o bairro do atendimento presencial.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = portalMode
        ? await clientPortalService.createAppointment(portalToken!, {
            client_id: selectedClientId,
            attendance_mode: attendanceMode,
            municipality: attendanceMode === 'presencial' ? municipality.trim() : undefined,
            district: attendanceMode === 'presencial' ? district.trim() : 'Online',
            responsible_name: responsibleName.trim() || undefined,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            requested_starts_at: selectedTime!.starts_at,
            requested_ends_at: selectedTime!.ends_at,
            notes: notes.trim() || undefined,
          })
        : await publicAppointmentService.createAppointmentRequest({
            unit_name: unitName.trim(),
            attendance_mode: attendanceMode,
            municipality: attendanceMode === 'presencial' ? municipality.trim() : undefined,
            district: attendanceMode === 'presencial' ? district.trim() : 'Online',
            responsible_name: responsibleName.trim() || undefined,
            phone: phone.trim(),
            email: email.trim() || undefined,
            requested_starts_at: selectedTime!.starts_at,
            requested_ends_at: selectedTime!.ends_at,
            notes: notes.trim() || undefined,
          });
      setToken(result.public_token);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.warn('[PublicSchedule] Falha ao enviar agendamento:', err);
      const msg = err instanceof Error ? err.message : '';
      setError(msg.includes('horario indisponivel')
        ? 'Este horário acabou de ser reservado. Escolha outro horário disponível.'
        : 'Não foi possível enviar seu agendamento agora. Tente novamente em alguns instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/cliente`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard indisponivel
    }
  };

  if (token) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <main className="mx-auto max-w-[640px] px-4 py-10">
          <div className="rounded-xl border border-green-100 bg-green-50/70 p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Agendamento solicitado</h2>
            <p className="mt-2 text-sm text-gray-600">
              Guarde este link. Ele fica disponivel para acompanhar a inspeção, relatórios, fotos e anexos.
            </p>
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Protocolo</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-gray-900">
                {formatProtocol(token)}
              </p>
            </div>
            <Link
              to="/cliente"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800"
            >
              <ClipboardCheck className="h-4 w-4" />
              Abrir meu portal
            </Link>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Link copiado' : 'Copiar link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Acompanhe sua inspeção sanitária pelo Portal do Cliente: ${window.location.origin}/cliente`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
            >
              <Phone className="h-4 w-4" />
              Guardar link no WhatsApp
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 pb-16 sm:px-6">
        <div className="mb-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-2xl font-bold text-gray-950">Agendar inspeção</h2>
            {portalMode && (
              <Link
                to="/cliente"
                className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Voltar ao painel do cliente
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Escolha uma data útil e um horário entre 09h30 e 16h. A agenda é limitada e os
            horários ocupados já são removidos automaticamente.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.8fr)]">
          <section className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary-700" />
                  Datas disponíveis
                </h3>
                <div className="flex items-center justify-between gap-1 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                    title="Mes anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="flex-1 text-center text-xs font-bold capitalize text-gray-700 sm:min-w-[132px] sm:flex-none">
                    {formatMonthTitle(visibleMonth)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                    title="Proximo mes"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const n = new Date();
                      setCalendarMonth(new Date(n.getFullYear(), n.getMonth(), 1));
                    }}
                    className="ml-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Hoje
                  </button>
                </div>
              </div>

              {calendarLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary-700" />
                </div>
              ) : days.length === 0 && error ? (
                <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  <p>Nao ha horarios disponiveis nos proximos dias uteis.</p>
                  {error && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setCalendarReloadKey((key) => key + 1);
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-primary-700 hover:bg-primary-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Tentar novamente
                    </button>
                  )}
                </div>
              ) : (
                <div>
                      {portalMode && (
                        <p className="mb-2 text-xs text-gray-400">Ponto azul = vistoria já marcada neste mês</p>
                      )}
                      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-gray-400 sm:gap-2">
                        {CALENDAR_WEEKDAYS.map((label) => (
                          <div key={label} className="py-1">{label}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                        {calendarCells
                          .map((cell) => {
                            const selected = selectedDay === cell.key;
                            const available = !!cell.available;
                            const hasBooking = cell.bookings.length > 0;
                            return (
                              <button
                                key={cell.key}
                                type="button"
                                disabled={!available}
                                onClick={() => available && setSelectedDay(cell.key)}
                                className={`min-h-[72px] rounded-md border p-1.5 text-left transition-all sm:min-h-[86px] sm:p-2 ${
                                  selected
                                    ? 'border-primary-700 bg-primary-50 text-primary-950 ring-2 ring-primary-100'
                                    : available
                                      ? 'border-gray-200 bg-white text-gray-800 hover:border-primary-300'
                                      : cell.inRange
                                        ? 'border-gray-100 bg-gray-50 text-gray-300'
                                        : 'border-transparent bg-transparent text-gray-200'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-base font-black leading-none sm:text-lg">
                                    {cell.date.getDate()}
                                  </span>
                                  {hasBooking && (
                                    <span className="mt-0.5 h-2 w-2 rounded-full bg-primary-700" />
                                  )}
                                </div>
                                {available ? (
                                  <p className="mt-2 text-[10px] font-semibold leading-tight text-primary-700 sm:text-xs">
                                    {cell.available!.available_count} horário{cell.available!.available_count === 1 ? '' : 's'}
                                  </p>
                                ) : cell.inRange ? (
                                  <p className="mt-2 text-[10px] leading-tight text-gray-300">sem vaga</p>
                                ) : null}
                                {portalMode && hasBooking && (
                                  <p className="mt-1 truncate text-[10px] font-semibold leading-tight text-gray-500">
                                    {cell.bookings.length} marcada{cell.bookings.length === 1 ? '' : 's'}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                      </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
                <Clock className="h-4 w-4 text-primary-700" />
                {selectedDayLabel}
              </h3>
              {timesLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-700" />
                </div>
              ) : visibleTimes.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  Selecione outra data. Este dia nao tem horários livres.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {visibleTimes.map((time) => {
                    const selected = selectedTime?.starts_at === time.starts_at;
                    return (
                      <button
                        key={time.starts_at}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`h-11 rounded-md border text-sm font-bold transition-all ${
                          selected
                            ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        {time.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-700">
              Dados da unidade
            </h3>

            {portalMode && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-primary-100 bg-primary-50/60 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                <p className="text-xs text-primary-900">
                  Agendando como <span className="font-bold">{portalAccount}</span>. Você só vê e
                  agenda as unidades do seu cadastro.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {portalMode ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Unidade <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                    <select
                      required
                      value={selectedClientId}
                      onChange={(e) => {
                        setSelectedClientId(e.target.value);
                        const u = portalUnits.find((x) => x.client_id === e.target.value);
                        if (u?.city) setMunicipality(u.city);
                      }}
                      className="w-full appearance-none rounded-md border border-gray-300 bg-white py-3 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    >
                      <option value="">Selecione uma unidade...</option>
                      {portalUnits.map((u) => (
                        <option
                          key={u.client_id}
                          value={u.client_id}
                          disabled={unitBlockedInSelectedMonth.has(u.client_id)}
                        >
                          {u.client_name}
                          {u.city ? ` — ${u.city}` : ''}
                          {unitBlockedInSelectedMonth.has(u.client_id) ? ' — já marcada neste mês' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedUnitBlockedInMonth && (
                    <p className="text-xs text-amber-700">
                      Esta unidade já possui vistoria marcada em {selectedMonth ? formatMonthTitle(selectedMonth) : 'este mês'}.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nome fantasia da unidade <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      placeholder="Ex.: Clínica Bela Vida — Unidade Tijuca"
                      className="w-full rounded-md border border-gray-300 py-3 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectedUnitAllowsInPerson && setAttendanceMode('presencial')}
                  disabled={!selectedUnitAllowsInPerson}
                  className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold ${
                    attendanceMode === 'presencial'
                      ? 'border-primary-700 bg-primary-50 text-primary-800'
                      : selectedUnitAllowsInPerson
                        ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceMode('online')}
                  className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold ${
                    attendanceMode === 'online'
                      ? 'border-primary-700 bg-primary-50 text-primary-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  Online
                </button>
              </div>
              {portalMode && !selectedUnitAllowsInPerson && (
                <p className="rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
                  Vistoria presencial só fica disponível para unidade com estado RJ no cadastro.
                </p>
              )}

              {attendanceMode === 'presencial' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Município <span className="text-red-500">*</span></label>
                    <input
                      list="rio-municipios"
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                    <datalist id="rio-municipios">
                      {RIO_MUNICIPALITIES.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Bairro <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Ex.: Tijuca"
                      className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Responsável <span className="text-gray-400">(opcional)</span></label>
                <input
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  placeholder="Quem acompanhará a inspeção"
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Phone className="h-4 w-4 text-gray-400" />
                    WhatsApp <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(21) 00000-0000"
                    className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email <span className="text-gray-400">(opcional)</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Observações <span className="text-gray-400">(opcional)</span></label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Detalhes sobre a unidade, acesso, preferência ou documentos..."
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <p className="text-xs text-gray-400">
                Campos com <span className="font-bold text-red-500">*</span> são obrigatórios.
              </p>

              {selectedDay && selectedTime && (
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-600">
                    Horário selecionado
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">
                    {formatFullDay(selectedDay)} · {selectedTime.label}
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Solicitar agendamento
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
