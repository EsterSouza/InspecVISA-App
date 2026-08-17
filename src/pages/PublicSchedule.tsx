import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  Loader2,
  MapPin,
  Monitor,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { AppointmentType, AttendanceMode, PublicAvailableTime, PublicCalendarDay } from '../types';
import { publicAppointmentService } from '../services/publicAppointmentService';
import { clientPortalService, type ClientPortalUnit } from '../services/clientPortalService';
import { PublicHeader } from '../components/public/PublicHeader';
import { formatProtocol } from '../utils/protocol';
import { isAppointmentAtLeast24hAhead } from '../utils/appointmentLeadTime';
import { toDateKey } from '../utils/date';
import { isInspectionAppointment, APPOINTMENT_TYPE_RULES } from '../utils/appointmentType';
import {
  appointmentTypeOptionsFor,
  buildAppointmentNotes,
  defaultPublicAppointmentDuration,
  formatDuration,
  PUBLIC_APPOINTMENT_DRAFT_KEY,
  publicAppointmentDurations,
} from '../utils/publicAppointmentForm';
import { isRioState } from '../utils/state';
import { SCHEDULE_CONSULTANTS } from '../components/schedules/appointmentRequestsShared';

const RIO_MUNICIPALITIES = [
  'Rio de Janeiro', 'Niteroi', 'Sao Goncalo', 'Duque de Caxias', 'Nova Iguacu',
  'Belford Roxo', 'Sao Joao de Meriti', 'Nilopolis', 'Mesquita', 'Queimados', 'Itaborai', 'Marica',
];
const CALENDAR_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const ACTIVE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled', 'completed']);

type Draft = {
  step?: number;
  appointmentType?: AppointmentType;
  durationMinutes?: number;
  selectedDay?: string;
  unitName?: string;
  selectedClientId?: string;
  attendanceMode?: AttendanceMode;
  municipality?: string;
  district?: string;
  responsibleName?: string;
  phone?: string;
  email?: string;
  subject?: string;
  objective?: string;
  participants?: string;
  notes?: string;
  consultantNames?: string[];
};

function readDraft(): Draft {
  try {
    return JSON.parse(sessionStorage.getItem(PUBLIC_APPOINTMENT_DRAFT_KEY) || '{}') as Draft;
  } catch {
    return {};
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(PUBLIC_APPOINTMENT_DRAFT_KEY);
  } catch {
    // armazenamento indisponível
  }
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function monthStartKey(date: Date): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function daysToLoadForMonth(date: Date): number {
  const now = new Date();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const first = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.max(1, Math.floor((end.getTime() - first.getTime()) / 86400000) + 1);
}

function formatMonthTitle(value: string): string {
  return parseLocalDate(value + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatFullDay(value: string): string {
  return parseLocalDate(value).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function isActiveVisit(visit: { status: string; requested_date: string | null }): boolean {
  return !!visit.requested_date && ACTIVE_VISIT_STATUSES.has(visit.status);
}

export function PublicSchedule() {
  const initialDraft = readDraft();
  const [step, setStep] = useState(initialDraft.step && initialDraft.step > 0 ? initialDraft.step : 1);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>(initialDraft.appointmentType || 'briefing');
  const [durationMinutes, setDurationMinutes] = useState(
    initialDraft.durationMinutes || defaultPublicAppointmentDuration(initialDraft.appointmentType || 'briefing')
  );
  const [days, setDays] = useState<PublicCalendarDay[]>([]);
  const [times, setTimes] = useState<PublicAvailableTime[]>([]);
  const [selectedDay, setSelectedDay] = useState(initialDraft.selectedDay || '');
  const [selectedTime, setSelectedTime] = useState<PublicAvailableTime | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const source = initialDraft.selectedDay ? parseLocalDate(initialDraft.selectedDay) : new Date();
    return new Date(source.getFullYear(), source.getMonth(), 1);
  });
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [timesLoading, setTimesLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [timesError, setTimesError] = useState<string | null>(null);
  const [calendarReloadKey, setCalendarReloadKey] = useState(0);
  const [timesReloadKey, setTimesReloadKey] = useState(0);

  const [portalChecking, setPortalChecking] = useState(() => !!clientPortalService.getStoredToken());
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [portalAccount, setPortalAccount] = useState('');
  const [portalUnits, setPortalUnits] = useState<ClientPortalUnit[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialDraft.selectedClientId || '');
  const [unitName, setUnitName] = useState(initialDraft.unitName || '');
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>(initialDraft.attendanceMode || 'presencial');
  const [municipality, setMunicipality] = useState(initialDraft.municipality || 'Rio de Janeiro');
  const [district, setDistrict] = useState(initialDraft.district || '');
  const [responsibleName, setResponsibleName] = useState(initialDraft.responsibleName || '');
  const [phone, setPhone] = useState(initialDraft.phone || '');
  const [email, setEmail] = useState(initialDraft.email || '');
  const [subject, setSubject] = useState(initialDraft.subject || '');
  const [objective, setObjective] = useState(initialDraft.objective || '');
  const [participants, setParticipants] = useState(initialDraft.participants || '');
  const [notes, setNotes] = useState(initialDraft.notes || '');
  const [consultantNames, setConsultantNames] = useState<string[]>(initialDraft.consultantNames || []);
  const toggleConsultant = (name: string) =>
    setConsultantNames((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const portalMode = !!portalToken && portalUnits.length > 0;
  const inspection = isInspectionAppointment(appointmentType);
  const selectedUnit = useMemo(
    () => portalUnits.find((unit) => unit.client_id === selectedClientId) || null,
    [portalUnits, selectedClientId]
  );
  const selectedMonth = selectedDay ? monthKey(selectedDay) : monthKey(monthStartKey(calendarMonth));
  const selectedUnitAllowsInPerson = !portalMode || isRioState(selectedUnit?.state);
  const unitBlockedInSelectedMonth = useMemo(() => {
    if (!portalMode || !inspection) return new Set<string>();
    return new Set(
      portalUnits
        .filter((unit) => unit.visits.some((visit) => isActiveVisit(visit) && monthKey(visit.requested_date!) === selectedMonth))
        .map((unit) => unit.client_id)
    );
  }, [portalMode, portalUnits, inspection, selectedMonth]);
  const selectedUnitBlockedInMonth = !!selectedClientId && unitBlockedInSelectedMonth.has(selectedClientId);
  const dayAvailability = useMemo(() => new Map(days.map((day) => [day.day, day])), [days]);
  const visibleTimes = useMemo(() => times.filter((time) => isAppointmentAtLeast24hAhead(time.starts_at)), [times]);

  const calendarCells = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const last = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const start = new Date(first);
    const end = new Date(last);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)));
    const cells: Array<{ key: string; date: Date; inRange: boolean; available?: PublicCalendarDay }> = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = toDateKey(cursor);
      cells.push({
        key,
        date: new Date(cursor),
        inRange: cursor.getMonth() === calendarMonth.getMonth(),
        available: monthKey(key) === monthKey(monthStartKey(calendarMonth)) ? dayAvailability.get(key) : undefined,
      });
    }
    return cells;
  }, [calendarMonth, dayAvailability]);

  useEffect(() => {
    const stored = clientPortalService.getStoredToken();
    if (!stored) return;
    let cancelled = false;
    clientPortalService.overview(stored)
      .then((data) => {
        if (cancelled) return;
        setPortalToken(stored);
        setPortalAccount(data.account_name);
        setPortalUnits(data.units);
        setSelectedClientId((current) => current || data.units[0]?.client_id || '');
        if (data.units[0]?.city) setMunicipality((current) => current || data.units[0].city || '');
      })
      .catch(() => clientPortalService.clearToken())
      .finally(() => { if (!cancelled) setPortalChecking(false); });
    return () => { cancelled = true; };
  }, []);

  // Briefing é sempre online.
  useEffect(() => {
    if (appointmentType === 'briefing' && attendanceMode !== 'online') setAttendanceMode('online');
  }, [appointmentType, attendanceMode]);

  useEffect(() => {
    if (portalMode && !selectedUnitAllowsInPerson && attendanceMode === 'presencial') setAttendanceMode('online');
  }, [attendanceMode, portalMode, selectedUnitAllowsInPerson]);

  useEffect(() => {
    if (token) return;
    try {
      sessionStorage.setItem(PUBLIC_APPOINTMENT_DRAFT_KEY, JSON.stringify({
        step, appointmentType, durationMinutes, selectedDay, unitName, selectedClientId, attendanceMode,
        municipality, district, responsibleName, phone, email, subject, objective, participants, notes,
        consultantNames,
      } satisfies Draft));
    } catch {
      // armazenamento indisponível
    }
  }, [
    token, step, appointmentType, durationMinutes, selectedDay, unitName, selectedClientId, attendanceMode,
    municipality, district, responsibleName, phone, email, subject, objective, participants, notes, consultantNames,
  ]);

  useEffect(() => {
    let cancelled = false;
    setCalendarLoading(true);
    setCalendarError(null);
    const startDate = monthStartKey(calendarMonth);
    publicAppointmentService.listCalendarDays(startDate, daysToLoadForMonth(calendarMonth), appointmentType, durationMinutes, consultantNames)
      .then((data) => {
        if (!cancelled) {
          setDays(data);
          setSelectedDay((current) => current && data.some((day) => day.day === current) ? current : '');
        }
      })
      .catch((error) => {
        console.warn('[PublicSchedule] Falha ao carregar calendario:', error);
        if (!cancelled) {
          setDays([]);
          setCalendarError('Não foi possível carregar a agenda agora.');
        }
      })
      .finally(() => { if (!cancelled) setCalendarLoading(false); });
    return () => { cancelled = true; };
  }, [calendarMonth, appointmentType, durationMinutes, calendarReloadKey, consultantNames]);

  useEffect(() => {
    if (!selectedDay) {
      setTimes([]);
      setSelectedTime(null);
      return;
    }
    let cancelled = false;
    setTimesLoading(true);
    setTimesError(null);
    setSelectedTime(null);
    publicAppointmentService.listAvailableTimes(selectedDay, appointmentType, durationMinutes, consultantNames)
      .then((data) => { if (!cancelled) setTimes(data); })
      .catch((error) => {
        console.warn('[PublicSchedule] Falha ao carregar horarios:', error);
        if (!cancelled) {
          setTimes([]);
          setTimesError('Não foi possível carregar os horários deste dia.');
        }
      })
      .finally(() => { if (!cancelled) setTimesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDay, appointmentType, durationMinutes, timesReloadKey, consultantNames]);

  useEffect(() => {
    stepTitleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    errorRef.current?.focus();
  }, [submitError]);

  const goToStep = (target: number) => {
    setSubmitError(null);
    setStep(target);
  };

  const chooseType = (nextType: AppointmentType) => {
    setAppointmentType(nextType);
    setDurationMinutes(defaultPublicAppointmentDuration(nextType));
    setSelectedTime(null);
    setSubject('');
    setObjective('');
    setParticipants('');
    setNotes('');
    setSubmitError(null);
  };

  // Rascunho de sessão pode trazer finalidade ou duração que este modo não permite.
  useEffect(() => {
    if (portalChecking) return;
    const allowed = appointmentTypeOptionsFor(portalMode);
    if (!allowed.some((option) => option.value === appointmentType)) {
      chooseType(allowed[0].value);
    } else if (!publicAppointmentDurations(appointmentType).includes(durationMinutes)) {
      setDurationMinutes(defaultPublicAppointmentDuration(appointmentType));
    }
  }, [portalChecking, portalMode, appointmentType, durationMinutes]);

  const selectDay = (day: string) => {
    setSelectedDay(day);
    setSelectedTime(null);
    setSubmitError(null);
    if (step < 2) setStep(2);
  };

  const validateScheduling = (): string | null => {
    if (!consultantNames.length) return 'Escolha ao menos uma consultora.';
    if (!selectedTime) return 'Escolha um horário disponível.';
    if (portalMode) {
      if (!selectedClientId) return 'Selecione a unidade.';
      if (inspection && selectedUnitBlockedInMonth) {
        return 'Esta unidade já possui uma inspeção solicitada neste mês.';
      }
      if (attendanceMode === 'presencial' && !selectedUnitAllowsInPerson) {
        return 'Atendimentos presenciais são permitidos apenas para unidades cadastradas no RJ.';
      }
    } else if (!unitName.trim()) {
      return 'Informe o nome da unidade ou empresa.';
    }
    if (attendanceMode === 'presencial') {
      if (!municipality.trim()) return 'Informe o município do atendimento presencial.';
      if (!district.trim()) return 'Informe o bairro do atendimento presencial.';
    }
    return null;
  };

  // Sem portal não há cadastro: o contato do lead é a única forma de retorno das consultoras.
  const validateDetails = (): string | null => {
    if (portalMode) return null;
    if (!responsibleName.trim()) return 'Informe o nome do responsável.';
    if (!phone.trim()) return 'Informe um WhatsApp para retorno.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail válido.';
    return null;
  };

  const nextFromSchedule = () => {
    const error = validateScheduling();
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    setStep(3);
  };

  const nextFromDetails = () => {
    const error = validateDetails();
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    setStep(4);
  };

  const handleSubmit = async () => {
    const validation = validateScheduling();
    if (validation || !selectedTime) {
      setSubmitError(validation || 'Escolha um horário disponível.');
      setStep(2);
      return;
    }
    const detailsValidation = validateDetails();
    if (detailsValidation) {
      setSubmitError(detailsValidation);
      setStep(3);
      return;
    }
    const participantNames = participants.split(/[,\n]/).map((name) => name.trim()).filter(Boolean);
    const payload = {
      attendance_mode: attendanceMode,
      municipality: attendanceMode === 'presencial' ? municipality.trim() : undefined,
      district: attendanceMode === 'presencial' ? district.trim() : 'Online',
      responsible_name: responsibleName.trim() || undefined,
      phone: phone.trim() || undefined,
      requested_starts_at: selectedTime.starts_at,
      requested_ends_at: selectedTime.ends_at,
      appointment_type: appointmentType,
      duration_minutes: durationMinutes,
      subject: subject.trim() || undefined,
      participant_names: participantNames.length ? participantNames : undefined,
      consultant_names: consultantNames.length ? consultantNames : undefined,
      notes: buildAppointmentNotes(objective, notes),
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = portalMode
        ? await clientPortalService.createAppointment(portalToken!, { ...payload, client_id: selectedClientId })
        : await publicAppointmentService.createAppointmentRequest({
            ...payload,
            unit_name: unitName.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
          });
      clearDraft();
      setToken(result.public_token);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.warn('[PublicSchedule] Falha ao enviar solicitacao:', error);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('horario indisponivel')) {
        setSelectedTime(null);
        setTimesReloadKey((value) => value + 1);
        setSubmitError('Este horário acabou de ser reservado. Escolha outro horário; os demais dados foram preservados.');
        setStep(2);
      } else {
        setSubmitError('Não foi possível enviar sua solicitação agora. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/cliente');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard indisponível
    }
  };

  // Antes de saber se há sessão do portal, mostrar as finalidades erradas mudaria o rascunho.
  if (portalChecking) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <div role="status" className="flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-700" />
          <p className="text-sm text-gray-500">Verificando seu acesso...</p>
        </div>
      </div>
    );
  }

  if (token) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <main className="mx-auto max-w-[640px] px-4 py-10">
          <div className="rounded-xl border border-green-100 bg-green-50/70 p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" aria-hidden="true" />
            <h1 className="text-xl font-bold text-gray-900">Solicitação enviada</h1>
            <p className="mt-2 text-sm text-gray-600">Nossa equipe analisará o pedido e retornará com a confirmação.</p>
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Protocolo</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-gray-900">{formatProtocol(token)}</p>
            </div>
            <Link to="/cliente" className="mt-6 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-800">
              <ClipboardCheck className="h-4 w-4" /> Abrir meu portal
            </Link>
            <button type="button" onClick={copyPortalLink} className="mt-3 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Copy className="h-4 w-4" /> {copied ? 'Link copiado' : 'Copiar link'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const typeOptions = appointmentTypeOptionsFor(portalMode);
  const errorBanner = submitError ? (
    <div ref={errorRef} tabIndex={-1} role="alert" className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700 outline-none">{submitError}</div>
  ) : null;
  const stepLabel = step === 1
    ? (portalMode ? 'O que você deseja agendar?' : 'Vamos começar por um briefing')
    : step === 2 ? (portalMode ? 'Defina data, horário e modalidade' : 'Defina data e horário')
    : step === 3 ? 'Conte-nos sobre a solicitação' : 'Revise antes de enviar';

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary-700">Agendar horário com as consultoras</p>
            <h1 ref={stepTitleRef} tabIndex={-1} className="mt-1 text-2xl font-bold text-gray-950 outline-none">{stepLabel}</h1>
          </div>
          {portalMode && <Link to="/cliente" className="inline-flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Voltar ao portal</Link>}
        </div>

        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Etapas da solicitação">
          {['Finalidade', 'Agenda', 'Detalhes', 'Resumo'].map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={'rounded-md px-2 py-2 text-center text-xs font-semibold ' + (step === index + 1 ? 'bg-primary-700 text-white' : step > index + 1 ? 'bg-primary-50 text-primary-800' : 'bg-gray-100 text-gray-500')}>
              <span className="hidden sm:inline">{index + 1}. </span>{label}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <section aria-describedby="purpose-help">
            <p id="purpose-help" className="mb-4 max-w-2xl text-sm text-gray-600">{portalMode
              ? 'Escolha a finalidade para ver somente horários, duração e campos compatíveis.'
              : 'Uma conversa curta e online para entendermos sua necessidade e indicarmos o próximo passo.'}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {typeOptions.map((option) => {
                const selected = appointmentType === option.value;
                return (
                  <button key={option.value} type="button" onClick={() => chooseType(option.value)} className={'min-h-28 rounded-xl border p-4 text-left focus:outline-none focus:ring-2 focus:ring-primary-400 ' + (selected ? 'border-primary-700 bg-primary-50 ring-1 ring-primary-200' : 'border-gray-200 bg-white hover:border-primary-300')}>
                    <span className="block text-sm font-bold text-gray-900">{APPOINTMENT_TYPE_RULES[option.value].label}</span>
                    <span className="mt-1 block text-sm text-gray-600">{option.description}</span>
                    <span className="mt-3 block text-xs font-semibold text-primary-700">{publicAppointmentDurations(option.value).map(formatDuration).join(' · ')}</span>
                  </button>
                );
              })}
            </div>
            {!portalMode && (
              <div className="mt-4 flex max-w-2xl flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-primary-100 bg-primary-50 p-3 text-sm text-primary-900">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                <span>Inspeções, reuniões, orientação documental e treinamentos são agendados dentro do portal.</span>
                <Link to="/cliente" className="font-semibold underline underline-offset-2 hover:no-underline">Entrar no Portal do Cliente</Link>
              </div>
            )}
            <button type="button" onClick={() => setStep(2)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary-700 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-800">
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="block text-sm font-bold text-gray-900">Consultora <span className="text-red-600">*</span></span>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Consultora">
                  {SCHEDULE_CONSULTANTS.map((name) => {
                    const active = consultantNames.includes(name);
                    return <button key={name} type="button" onClick={() => toggleConsultant(name)} aria-pressed={active} className={'min-h-11 rounded-md border px-3.5 text-sm font-semibold ' + (active ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-primary-50')}>{name.split(' ')[0]}</button>;
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">Para ILPI, geralmente é preciso marcar com as duas — a agenda mostra só os horários livres para todas as escolhidas.</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <label htmlFor="duration" className="block text-sm font-bold text-gray-900">Duração</label>
                <select id="duration" value={durationMinutes} onChange={(event) => { setDurationMinutes(Number(event.target.value)); setSelectedTime(null); }} className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100">
                  {publicAppointmentDurations(appointmentType).map((duration) => <option key={duration} value={duration}>{formatDuration(duration)}</option>)}
                </select>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><CalendarDays className="h-4 w-4 text-primary-700" /> Datas disponíveis</h2>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Mês anterior" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
                    <span aria-live="polite" className="min-w-32 text-center text-xs font-bold capitalize text-gray-700">{formatMonthTitle(monthKey(monthStartKey(calendarMonth)))}</span>
                    <button type="button" aria-label="Próximo mês" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
                {calendarLoading ? <div role="status" className="flex h-52 items-center justify-center gap-2 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-primary-700" /> Carregando agenda...</div> : calendarError ? (
                  <div role="alert" className="rounded-md border border-red-100 bg-red-50 p-4 text-sm text-red-700">{
                    calendarError
                  }<button type="button" onClick={() => setCalendarReloadKey((value) => value + 1)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"><RefreshCw className="h-4 w-4" /> Tentar novamente</button></div>
                ) : days.length === 0 ? <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Não há disponibilidade para esta finalidade e duração neste mês.</p> : (
                  <>
                    <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-gray-500 sm:gap-2">{CALENDAR_WEEKDAYS.map((label) => <div key={label} className="py-1">{label}</div>)}</div>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {calendarCells.map((cell) => {
                        const available = !!cell.available;
                        return <button key={cell.key} type="button" disabled={!available} onClick={() => available && selectDay(cell.key)} aria-label={available ? 'Selecionar ' + formatFullDay(cell.key) + ', ' + cell.available!.available_count + ' horários disponíveis' : formatFullDay(cell.key) + ', indisponível'} className={'min-h-16 rounded-md border p-1.5 text-left sm:min-h-20 ' + (selectedDay === cell.key ? 'border-primary-700 bg-primary-50 ring-2 ring-primary-100' : available ? 'border-gray-200 bg-white hover:border-primary-300' : cell.inRange ? 'border-gray-100 bg-gray-50 text-gray-300' : 'border-transparent bg-transparent text-gray-200')}>
                          <span className="text-base font-black">{cell.date.getDate()}</span>
                          {available && <span className="mt-1 block text-[10px] font-semibold text-primary-700 sm:text-xs">{cell.available!.available_count} vaga{cell.available!.available_count === 1 ? '' : 's'}</span>}
                        </button>;
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Clock className="h-4 w-4 text-primary-700" /> {selectedDay ? formatFullDay(selectedDay) : 'Escolha uma data'}</h2>
                <div className="mt-4">
                  {timesLoading ? <div role="status" className="flex h-24 items-center justify-center gap-2 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-primary-700" /> Carregando horários...</div> : timesError ? <div role="alert" className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">{timesError}<button type="button" onClick={() => setTimesReloadKey((value) => value + 1)} className="mt-3 block min-h-11 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold">Tentar novamente</button></div> : !selectedDay ? <p className="text-sm text-gray-500">Clique em um dia disponível para continuar.</p> : visibleTimes.length === 0 ? <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">Este dia não tem horários livres para essa duração.</p> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{visibleTimes.map((time) => <button key={time.starts_at} type="button" onClick={() => { setSelectedTime(time); setSubmitError(null); }} aria-pressed={selectedTime?.starts_at === time.starts_at} className={'min-h-11 rounded-md border text-sm font-bold ' + (selectedTime?.starts_at === time.starts_at ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-primary-50')}>{time.label}</button>)}</div>}
                </div>
              </div>
            </div>

            <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {portalMode && <div className="mb-4 flex gap-2 rounded-md border border-primary-100 bg-primary-50 p-3 text-xs text-primary-900"><ShieldCheck className="h-4 w-4 shrink-0 text-primary-700" />Agendando como <strong>{portalAccount}</strong>.</div>}
              {errorBanner}
              <h2 className="text-sm font-bold text-gray-900">{portalMode ? 'Local e modalidade' : 'Sobre a sua unidade'}</h2>
              <div className="mt-4 space-y-4">
                {portalMode ? <div><label htmlFor="unit" className="text-sm font-medium text-gray-700">Unidade <span className="text-red-600">*</span></label><select id="unit" value={selectedClientId} onChange={(event) => { const id = event.target.value; setSelectedClientId(id); const unit = portalUnits.find((item) => item.client_id === id); if (unit?.city) setMunicipality(unit.city); }} className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"><option value="">Selecione uma unidade...</option>{portalUnits.map((unit) => <option key={unit.client_id} value={unit.client_id} disabled={inspection && unitBlockedInSelectedMonth.has(unit.client_id)}>{unit.client_name}{inspection && unitBlockedInSelectedMonth.has(unit.client_id) ? ' — inspeção já solicitada neste mês' : ''}</option>)}</select>{inspection && selectedUnitBlockedInMonth && <p className="mt-1 text-xs text-amber-700">A cota mensal se aplica somente a inspeções.</p>}</div> : <div><label htmlFor="unit-name" className="text-sm font-medium text-gray-700">Nome da unidade ou empresa <span className="text-red-600">*</span></label><input id="unit-name" value={unitName} onChange={(event) => setUnitName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100" /></div>}
                {!portalMode && <p className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600"><Monitor className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />O briefing é online. Enviaremos o link da reunião junto com a confirmação.</p>}
                {portalMode && <fieldset><legend className="text-sm font-medium text-gray-700">Modalidade</legend><div className="mt-1.5 grid grid-cols-2 gap-2"><button type="button" disabled={!selectedUnitAllowsInPerson} onClick={() => setAttendanceMode('presencial')} aria-pressed={attendanceMode === 'presencial'} className={'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold ' + (attendanceMode === 'presencial' ? 'border-primary-700 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-700') + (!selectedUnitAllowsInPerson ? ' cursor-not-allowed opacity-50' : '')}><MapPin className="h-4 w-4" />Presencial</button><button type="button" onClick={() => setAttendanceMode('online')} aria-pressed={attendanceMode === 'online'} className={'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold ' + (attendanceMode === 'online' ? 'border-primary-700 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-700')}><Monitor className="h-4 w-4" />Online</button></div></fieldset>}
                {portalMode && !selectedUnitAllowsInPerson && <p className="rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">Atendimentos presenciais são permitidos apenas para unidades cadastradas no RJ.</p>}
                {attendanceMode === 'presencial' && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div><label htmlFor="municipality" className="text-sm font-medium text-gray-700">Município <span className="text-red-600">*</span></label><input id="municipality" list="rio-municipios" value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm" /><datalist id="rio-municipios">{RIO_MUNICIPALITIES.map((city) => <option key={city} value={city} />)}</datalist></div><div><label htmlFor="district" className="text-sm font-medium text-gray-700">Bairro <span className="text-red-600">*</span></label><input id="district" value={district} onChange={(event) => setDistrict(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm" /></div></div>}
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => goToStep(1)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" />Alterar finalidade</button>
                  <button type="button" onClick={nextFromSchedule} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-800">Continuar <ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </aside>
          </section>
        )}

        {step === 3 && <section className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm">{errorBanner}<div className="space-y-4"><div><label htmlFor="subject" className="text-sm font-medium text-gray-700">Assunto</label><input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: Revisão de pendências" className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm" /></div><div><label htmlFor="objective" className="text-sm font-medium text-gray-700">Objetivo</label><textarea id="objective" value={objective} onChange={(event) => setObjective(event.target.value)} rows={3} className="mt-1.5 w-full rounded-md border border-gray-300 p-3 text-sm" /></div><div><label htmlFor="participants" className="flex items-center gap-1.5 text-sm font-medium text-gray-700"><Users className="h-4 w-4 text-gray-400" />Participantes</label><input id="participants" value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Separe os nomes por vírgula" className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm" /></div><div><label htmlFor="responsible" className="text-sm font-medium text-gray-700">Responsável {!portalMode && <span className="text-red-600">*</span>}</label><input id="responsible" value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm" /></div><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="phone" className="flex items-center gap-1.5 text-sm font-medium text-gray-700"><Phone className="h-4 w-4 text-gray-400" />WhatsApp {!portalMode && <span className="text-red-600">*</span>}</label><input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm" /></div>{portalMode ? <div className="rounded-md border border-primary-100 bg-primary-50 p-3 text-xs text-primary-900"><strong>E-mail de confirmação</strong><p className="mt-1">Será usado exclusivamente o e-mail cadastrado da unidade selecionada.</p></div> : <div><label htmlFor="email" className="text-sm font-medium text-gray-700">E-mail</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm" /></div>}</div><div><label htmlFor="notes" className="flex items-center gap-1.5 text-sm font-medium text-gray-700"><FileText className="h-4 w-4 text-gray-400" />Observações</label><textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1.5 w-full rounded-md border border-gray-300 p-3 text-sm" /></div></div><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => setStep(2)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" />Voltar</button><button type="button" onClick={nextFromDetails} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800">Revisar solicitação <ChevronRight className="h-4 w-4" /></button></div></section>}

        {step === 4 && <section className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-gray-900">Resumo da solicitação</h2>{errorBanner}<dl className="mt-5 divide-y divide-gray-100"><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-gray-500">Tipo</dt><dd className="flex items-center gap-2 text-right text-sm font-semibold text-gray-900">{APPOINTMENT_TYPE_RULES[appointmentType].label}<button type="button" onClick={() => goToStep(1)} className="text-xs font-semibold text-primary-700 underline underline-offset-2 hover:no-underline">Alterar</button></dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-gray-500">Unidade</dt><dd className="flex items-center gap-2 text-right text-sm font-semibold text-gray-900">{portalMode ? selectedUnit?.client_name || '—' : unitName || '—'}<button type="button" onClick={() => goToStep(2)} className="text-xs font-semibold text-primary-700 underline underline-offset-2 hover:no-underline">Alterar</button></dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-gray-500">Consultora</dt><dd className="flex items-center gap-2 text-right text-sm font-semibold text-gray-900">{consultantNames.length ? consultantNames.map((n) => n.split(' ')[0]).join(' + ') : '—'}<button type="button" onClick={() => goToStep(2)} className="text-xs font-semibold text-primary-700 underline underline-offset-2 hover:no-underline">Alterar</button></dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-gray-500">Modalidade</dt><dd className="flex items-center gap-2 text-right text-sm font-semibold text-gray-900">{attendanceMode === 'online' ? 'Online' : 'Presencial'}<button type="button" onClick={() => goToStep(2)} className="text-xs font-semibold text-primary-700 underline underline-offset-2 hover:no-underline">Alterar</button></dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-gray-500">Duração</dt><dd className="flex items-center gap-2 text-right text-sm font-semibold text-gray-900">{formatDuration(durationMinutes)}<button type="button" onClick={() => goToStep(2)} className="text-xs font-semibold text-primary-700 underline underline-offset-2 hover:no-underline">Alterar</button></dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-gray-500">Data e horário</dt><dd className="flex items-center gap-2 text-right text-sm font-semibold text-gray-900">{selectedDay ? formatFullDay(selectedDay) : '—'}{selectedTime ? ' · ' + selectedTime.label : ''}<button type="button" onClick={() => goToStep(2)} className="text-xs font-semibold text-primary-700 underline underline-offset-2 hover:no-underline">Alterar</button></dd></div></dl><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => setStep(3)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" />Voltar</button><button type="button" disabled={submitting} onClick={() => void handleSubmit()} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</> : <><Send className="h-4 w-4" />Enviar solicitação</>}</button></div></section>}
      </main>
    </div>
  );
}
