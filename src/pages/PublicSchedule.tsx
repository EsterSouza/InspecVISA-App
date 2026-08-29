import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Check,
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
import { PublicShell } from '../components/public/PublicShell';
import { Button } from '../components/ui/Button';
import { buttonVariants } from '../components/ui/buttonVariants';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Label } from '../components/ui/Label';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { formatProtocol } from '../utils/protocol';
import { isAppointmentAtLeast24hAhead } from '../utils/appointmentLeadTime';
import { toDateKey } from '../utils/date';
import { APPOINTMENT_TYPE_RULES } from '../utils/appointmentType';
import {
  appointmentTypeOptionsFor,
  buildAppointmentNotes,
  defaultPublicAppointmentDuration,
  formatDuration,
  PUBLIC_APPOINTMENT_DRAFT_KEY,
  publicAppointmentDurations,
} from '../utils/publicAppointmentForm';
import { isRioState } from '../utils/state';
import { cn } from '../lib/utils';
import { SCHEDULE_CONSULTANTS } from '../components/schedules/appointmentRequestsShared';

const RIO_MUNICIPALITIES = [
  'Rio de Janeiro', 'Niteroi', 'Sao Goncalo', 'Duque de Caxias', 'Nova Iguacu',
  'Belford Roxo', 'Sao Joao de Meriti', 'Nilopolis', 'Mesquita', 'Queimados', 'Itaborai', 'Marica',
];
const STEP_LABELS = ['Finalidade', 'Agenda', 'Detalhes', 'Resumo'];
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

/** Data sempre em dd/mm/aaaa; o dia da semana entra como complemento (Artefato A, microcopy). */
function formatDayNumeric(value: string): string {
  return parseLocalDate(value).toLocaleDateString('pt-BR');
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
  // A cota de uma por mês é da inspeção avulsa. A auditoria também vale como inspeção no
  // resto do app, mas é mensal por contrato — não pode esbarrar na cota (PORT-07).
  const monthlyQuotaApplies = appointmentType === 'inspection';
  const selectedUnit = useMemo(
    () => portalUnits.find((unit) => unit.client_id === selectedClientId) || null,
    [portalUnits, selectedClientId]
  );
  const selectedMonth = selectedDay ? monthKey(selectedDay) : monthKey(monthStartKey(calendarMonth));
  const selectedUnitAllowsInPerson = !portalMode || isRioState(selectedUnit?.state);
  /**
   * PORT-07 — a finalidade é escolhida na etapa 1, antes da unidade. A opção aparece se ALGUMA
   * unidade do acesso tem o serviço; quem não tem é barrado no seletor de unidade, logo abaixo.
   */
  const contractedAcrossUnits = useMemo(
    () => ({
      has_audit_service: portalUnits.some((unit) => unit.has_audit_service),
      has_online_followup: portalUnits.some((unit) => unit.has_online_followup),
    }),
    [portalUnits]
  );
  const unitHasContractedType = (unit: ClientPortalUnit): boolean => {
    if (appointmentType === 'audit') return !!unit.has_audit_service;
    if (appointmentType === 'online_followup') return !!unit.has_online_followup;
    return true;
  };
  const contractedTypeLabel = appointmentType === 'audit' ? 'auditoria' : 'acompanhamento online';
  const selectedUnitLacksContract = !!selectedUnit && !unitHasContractedType(selectedUnit);
  const unitBlockedInSelectedMonth = useMemo(() => {
    // A cota é da inspeção avulsa. A auditoria é mensal por contrato e esbarraria nela todo
    // mês, então fica de fora mesmo valendo como inspeção no resto do app (PORT-07).
    if (!portalMode || appointmentType !== 'inspection') return new Set<string>();
    return new Set(
      portalUnits
        .filter((unit) => unit.visits.some((visit) => isActiveVisit(visit) && monthKey(visit.requested_date!) === selectedMonth))
        .map((unit) => unit.client_id)
    );
  }, [portalMode, portalUnits, appointmentType, selectedMonth]);
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
    const allowed = appointmentTypeOptionsFor(portalMode, contractedAcrossUnits);
    if (!allowed.some((option) => option.value === appointmentType)) {
      chooseType(allowed[0].value);
    } else if (!publicAppointmentDurations(appointmentType).includes(durationMinutes)) {
      setDurationMinutes(defaultPublicAppointmentDuration(appointmentType));
    }
  }, [portalChecking, portalMode, contractedAcrossUnits, appointmentType, durationMinutes]);

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
      if (monthlyQuotaApplies && selectedUnitBlockedInMonth) {
        return 'Esta unidade já possui uma inspeção solicitada neste mês.';
      }
      if (attendanceMode === 'presencial' && !selectedUnitAllowsInPerson) {
        return 'Atendimentos presenciais são permitidos apenas para unidades cadastradas no RJ.';
      }
      // PORT-07 — o servidor recusa igual; isto é só para não deixar o cliente digitar tudo
      // e levar o erro no envio.
      if (selectedUnitLacksContract) {
        return `Esta unidade não tem ${contractedTypeLabel} no contrato. Fale com a consultoria.`;
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
      <PublicShell>
        <div role="status" className="flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-700" aria-hidden="true" />
          <p className="text-sm text-navy-2">Verificando seu acesso...</p>
        </div>
      </PublicShell>
    );
  }

  if (token) {
    return (
      <PublicShell>
        <Card className="border-success-soft-border bg-success-soft/60 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" aria-hidden="true" />
          <h1 className="font-title text-2xl font-semibold text-navy">Recebemos seu pedido</h1>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm text-navy-2">
            Guardamos o horário que você escolheu. A consultoria confere a agenda e volta com a
            confirmação pelo WhatsApp que você informou.
          </p>
          <div className="mt-6 rounded-md border border-default bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-2">Protocolo</p>
            <p className="mt-1 font-title text-2xl font-semibold tracking-widest tabular-nums text-navy">
              {formatProtocol(token)}
            </p>
            <p className="mt-2 text-sm text-navy-2">Guarde este número: é por ele que encontramos sua solicitação.</p>
          </div>
          <Link to="/cliente" className={cn(buttonVariants({ fullWidth: true }), 'mt-6 gap-2 py-3')}>
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Abrir meu portal
          </Link>
          <Button type="button" variant="outline" fullWidth onClick={copyPortalLink} className="mt-3 gap-2 bg-surface py-3">
            <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Link copiado' : 'Copiar link do portal'}
          </Button>
        </Card>
      </PublicShell>
    );
  }

  const typeOptions = appointmentTypeOptionsFor(portalMode, contractedAcrossUnits);
  const errorBanner = submitError ? (
    <div
      ref={errorRef}
      tabIndex={-1}
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink outline-none"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{submitError}</span>
    </div>
  ) : null;
  const stepLabel = step === 1
    ? (portalMode ? 'O que você quer agendar?' : 'Vamos começar por um briefing')
    : step === 2 ? (portalMode ? 'Escolha data, horário e modalidade' : 'Escolha data e horário')
    : step === 3 ? 'Conte para a gente o que você precisa' : 'Confira antes de enviar';

  return (
    <PublicShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent-ink">Agendar com a consultoria</p>
          <h1 ref={stepTitleRef} tabIndex={-1} className="mt-1 font-title text-2xl font-semibold text-navy outline-none">
            {stepLabel}
          </h1>
        </div>
        {portalMode && (
          <Link to="/cliente" className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0 bg-surface')}>
            Voltar ao portal
          </Link>
        )}
      </div>

      {/* A etapa também é número e palavra: a cor sozinha não diz em qual delas você está. */}
      <ol className="mb-7 grid grid-cols-4 gap-1.5 sm:gap-2" aria-label={'Etapa ' + step + ' de 4'}>
        {STEP_LABELS.map((label, index) => {
          const position = index + 1;
          const done = step > position;
          const current = step === position;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={
                'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-2 text-xs ' +
                (current
                  ? 'border-primary-700 bg-primary-50 font-bold text-primary-800'
                  : done
                    ? 'border-default bg-surface font-semibold text-navy-2'
                    : 'border-default bg-canvas font-medium text-navy-2')
              }
            >
              <span
                aria-hidden="true"
                className={
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' +
                  (current
                    ? 'bg-primary-700 text-on-accent'
                    : done
                      ? 'bg-success text-on-accent'
                      : 'border border-control text-navy-2')
                }
              >
                {done ? <Check className="h-3 w-3" /> : position}
              </span>
              <span className="truncate">{label}</span>
              {done && <span className="sr-only">concluída</span>}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section aria-labelledby="purpose-title">
          <h2 id="purpose-title" className="sr-only">Finalidade do agendamento</h2>
          <p className="mb-4 max-w-[68ch] text-sm text-navy-2">
            {portalMode
              ? 'Escolha a finalidade: a agenda passa a mostrar só os horários, as durações e os campos que combinam com ela.'
              : 'Uma conversa curta e online para entendermos sua necessidade e indicarmos o próximo passo.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {typeOptions.map((option) => {
              const selected = appointmentType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseType(option.value)}
                  aria-pressed={selected}
                  className={
                    'min-h-28 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
                    (selected
                      ? 'border-primary-700 bg-primary-50 ring-1 ring-primary-700'
                      : 'border-default bg-surface hover:border-control')
                  }
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-title text-sm font-semibold text-navy">
                      {APPOINTMENT_TYPE_RULES[option.value].label}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />}
                  </span>
                  <span className="mt-1 block text-sm text-navy-2">{option.description}</span>
                  <span className="mt-3 block text-xs font-semibold text-accent-ink">
                    {publicAppointmentDurations(option.value).map(formatDuration).join(' · ')}
                  </span>
                </button>
              );
            })}
          </div>
          {!portalMode && (
            <div className="mt-4 rounded-md border border-primary-100 bg-primary-50 p-3 text-sm text-navy">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                <span>Inspeção, reunião, orientação documental e treinamento são agendados dentro do portal.</span>
              </p>
              <Link to="/cliente" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 bg-surface')}>
                Entrar no Portal do Cliente
              </Link>
            </div>
          )}
          <Button type="button" onClick={() => setStep(2)} className="mt-6 gap-2">
            Escolher data <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          {errorBanner}

          <Card className="p-4 sm:p-5">
            <fieldset>
              <legend className="font-title text-base font-semibold text-navy">
                Com quem <span className="text-danger-soft-ink" aria-hidden="true">*</span>
              </legend>
              <p className="mt-1 max-w-[68ch] text-sm text-navy-2">
                Para ILPI costuma ser preciso marcar com as duas — a agenda mostra só os horários
                livres para todas as escolhidas.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SCHEDULE_CONSULTANTS.map((name) => {
                  const active = consultantNames.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleConsultant(name)}
                      aria-pressed={active}
                      className={
                        'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
                        (active
                          ? 'border-primary-700 bg-primary-700 text-on-accent'
                          : 'border-control bg-surface text-navy-2 hover:bg-surface-hover')
                      }
                    >
                      {active && <Check className="h-4 w-4" aria-hidden="true" />}
                      {name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Card>

          <Card className="p-4 sm:p-5">
            <Label htmlFor="duration" className="mb-2 font-title text-base">Quanto tempo</Label>
            <Select
              id="duration"
              value={durationMinutes}
              onChange={(event) => { setDurationMinutes(Number(event.target.value)); setSelectedTime(null); }}
              className="min-h-11"
            >
              {publicAppointmentDurations(appointmentType).map((duration) => (
                <option key={duration} value={duration}>{formatDuration(duration)}</option>
              ))}
            </Select>
          </Card>

          <Card className="-mx-2 p-2 sm:mx-0 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-title text-base font-semibold text-navy">
                <CalendarDays className="h-4 w-4 text-primary-700" aria-hidden="true" /> Datas com vaga
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-control text-navy-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-live="polite" className="min-w-32 text-center text-sm font-semibold first-letter:uppercase text-navy">
                  {formatMonthTitle(monthKey(monthStartKey(calendarMonth)))}
                </span>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-control text-navy-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {calendarLoading ? (
              <div role="status" className="flex h-52 items-center justify-center gap-2 text-sm text-navy-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary-700" aria-hidden="true" /> Carregando a agenda...
              </div>
            ) : calendarError ? (
              <div role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-4 text-sm text-danger-soft-ink">
                {calendarError}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCalendarReloadKey((value) => value + 1)}
                  className="mt-3 gap-2 border-danger-soft-border bg-surface text-danger-soft-ink"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar de novo
                </Button>
              </div>
            ) : days.length === 0 ? (
              <p className="rounded-md border border-dashed border-control bg-surface-sunken p-4 text-sm text-navy-2">
                Nenhuma vaga neste mês para esta finalidade e duração. Veja o mês seguinte ou escolha
                uma duração menor.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-navy-2 sm:gap-2">
                  {CALENDAR_WEEKDAYS.map((label) => <div key={label} className="py-1">{label}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarCells.map((cell) => {
                    const available = !!cell.available;
                    const selected = selectedDay === cell.key;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={!available}
                        aria-pressed={available ? selected : undefined}
                        onClick={() => available && selectDay(cell.key)}
                        aria-label={
                          available
                            ? 'Escolher ' + formatFullDay(cell.key) + ', ' + cell.available!.available_count + ' horários livres'
                            : formatFullDay(cell.key) + ', sem vaga'
                        }
                        className={
                          'min-h-16 rounded-md border p-1 text-left sm:p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-20 ' +
                          (selected
                            ? 'border-primary-700 bg-primary-50 ring-1 ring-primary-700'
                            : available
                              ? 'border-default bg-surface hover:border-control'
                              : cell.inRange
                                ? 'border-default bg-surface-sunken text-navy-2'
                                : 'border-transparent bg-transparent text-navy-2')
                        }
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span className="font-title text-base font-semibold tabular-nums">{cell.date.getDate()}</span>
                          {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary-700" aria-hidden="true" />}
                        </span>
                        {available && (
                          <span className="mt-1 block text-[11px] font-semibold text-accent-ink">
                            {cell.available!.available_count} vaga{cell.available!.available_count === 1 ? '' : 's'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-title text-base font-semibold text-navy">
              <Clock className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
              <span className="first-letter:uppercase">{selectedDay ? formatFullDay(selectedDay) : 'Horários'}</span>
            </h2>
            <div className="mt-4">
              {timesLoading ? (
                <div role="status" className="flex h-24 items-center justify-center gap-2 text-sm text-navy-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-700" aria-hidden="true" /> Carregando os horários...
                </div>
              ) : timesError ? (
                <div role="alert" className="rounded-md border border-danger-soft-border bg-danger-soft p-3 text-sm text-danger-soft-ink">
                  {timesError}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTimesReloadKey((value) => value + 1)}
                    className="mt-3 gap-2 border-danger-soft-border bg-surface text-danger-soft-ink"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar de novo
                  </Button>
                </div>
              ) : !selectedDay ? (
                <p className="text-sm text-navy-2">Escolha acima um dia com vaga para ver os horários livres.</p>
              ) : visibleTimes.length === 0 ? (
                <p className="rounded-md border border-dashed border-control bg-surface-sunken p-3 text-sm text-navy-2">
                  Este dia não tem horário livre para essa duração. Escolha outro dia.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {visibleTimes.map((time) => {
                    const selected = selectedTime?.starts_at === time.starts_at;
                    return (
                      <button
                        key={time.starts_at}
                        type="button"
                        onClick={() => { setSelectedTime(time); setSubmitError(null); }}
                        aria-pressed={selected}
                        className={
                          'inline-flex min-h-11 items-center justify-center gap-1 rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
                          (selected
                            ? 'border-primary-700 bg-primary-700 text-on-accent'
                            : 'border-control bg-surface text-navy-2 hover:bg-surface-hover')
                        }
                      >
                        {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        {time.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-title text-base font-semibold text-navy">
              {portalMode ? 'Onde vai ser' : 'Sobre a sua unidade'}
            </h2>
            {portalMode && (
              <p className="mt-2 flex items-start gap-2 rounded-md border border-primary-100 bg-primary-50 p-3 text-sm text-navy">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                <span>Você está agendando como <strong>{portalAccount}</strong>.</span>
              </p>
            )}
            <div className="mt-4 space-y-4">
              {portalMode ? (
                <Field
                  label="Unidade"
                  htmlFor="unit"
                  required
                  hint={monthlyQuotaApplies && selectedUnitBlockedInMonth ? 'A cota de uma por mês vale só para inspeção.' : undefined}
                >
                  <Select
                    value={selectedClientId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setSelectedClientId(id);
                      const unit = portalUnits.find((item) => item.client_id === id);
                      if (unit?.city) setMunicipality(unit.city);
                    }}
                    className="min-h-11"
                  >
                    <option value="">Selecione uma unidade...</option>
                    {portalUnits.map((unit) => (
                      <option
                        key={unit.client_id}
                        value={unit.client_id}
                        disabled={!unitHasContractedType(unit) || (monthlyQuotaApplies && unitBlockedInSelectedMonth.has(unit.client_id))}
                      >
                        {unit.client_name}
                        {!unitHasContractedType(unit) ? ` — sem ${contractedTypeLabel} no contrato` : ''}
                        {monthlyQuotaApplies && unitBlockedInSelectedMonth.has(unit.client_id) ? ' — inspeção já solicitada neste mês' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Nome da unidade ou empresa" htmlFor="unit-name" required>
                  <Input value={unitName} onChange={(event) => setUnitName(event.target.value)} className="min-h-11" />
                </Field>
              )}

              {!portalMode && (
                <p className="flex items-center gap-2 rounded-md border border-default bg-surface-sunken p-3 text-sm text-navy-2">
                  <Monitor className="h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
                  O briefing é online. O link da reunião vai junto com a confirmação.
                </p>
              )}

              {portalMode && (
                <fieldset>
                  <legend className="text-sm font-semibold text-navy">Modalidade</legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!selectedUnitAllowsInPerson}
                      onClick={() => setAttendanceMode('presencial')}
                      aria-pressed={attendanceMode === 'presencial'}
                      className={
                        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
                        (attendanceMode === 'presencial'
                          ? 'border-primary-700 bg-primary-50 text-primary-800'
                          : 'border-control text-navy-2') +
                        (!selectedUnitAllowsInPerson ? ' cursor-not-allowed bg-surface-sunken' : '')
                      }
                    >
                      <MapPin className="h-4 w-4" aria-hidden="true" />Presencial
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceMode('online')}
                      aria-pressed={attendanceMode === 'online'}
                      className={
                        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
                        (attendanceMode === 'online'
                          ? 'border-primary-700 bg-primary-50 text-primary-800'
                          : 'border-control text-navy-2')
                      }
                    >
                      <Monitor className="h-4 w-4" aria-hidden="true" />Online
                    </button>
                  </div>
                </fieldset>
              )}

              {portalMode && !selectedUnitAllowsInPerson && (
                <p className="rounded-md border border-amber-soft-border bg-amber-soft p-3 text-sm text-amber-soft-ink">
                  O atendimento presencial vale só para unidade cadastrada no RJ. Esta fica em outro
                  estado, então o encontro é online.
                </p>
              )}

              {attendanceMode === 'presencial' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Município" htmlFor="municipality" required>
                    <Input
                      list="rio-municipios"
                      value={municipality}
                      onChange={(event) => setMunicipality(event.target.value)}
                      className="min-h-11"
                    />
                    <datalist id="rio-municipios">
                      {RIO_MUNICIPALITIES.map((city) => <option key={city} value={city} />)}
                    </datalist>
                  </Field>
                  <Field label="Bairro" htmlFor="district" required>
                    <Input value={district} onChange={(event) => setDistrict(event.target.value)} className="min-h-11" />
                  </Field>
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => goToStep(1)} className="gap-2 bg-surface">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />Trocar a finalidade
            </Button>
            <Button type="button" onClick={nextFromSchedule} className="flex-1 gap-2">
              Continuar <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          {errorBanner}
          <Card className="p-4 sm:p-5">
            <p className="mb-4 max-w-[68ch] text-sm text-navy-2">
              O que você contar aqui chega junto com o pedido e ajuda a consultoria a preparar o
              encontro. Só o que está marcado com <span className="font-semibold">*</span> é obrigatório.
            </p>
            <div className="space-y-4">
              <Field label="Assunto (opcional)" htmlFor="subject">
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Ex.: Revisão de pendências"
                  className="min-h-11"
                />
              </Field>
              <Field label="Objetivo (opcional)" htmlFor="objective">
                <Textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={3} />
              </Field>
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-navy-2" aria-hidden="true" />Quem participa (opcional)
                  </span>
                }
                htmlFor="participants"
              >
                <Input
                  value={participants}
                  onChange={(event) => setParticipants(event.target.value)}
                  placeholder="Separe os nomes por vírgula"
                  className="min-h-11"
                />
              </Field>
              <Field
                label={portalMode ? 'Responsável (opcional)' : 'Responsável'}
                htmlFor="responsible"
                required={!portalMode}
              >
                <Input value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} className="min-h-11" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-navy-2" aria-hidden="true" />WhatsApp
                    </span>
                  }
                  htmlFor="phone"
                  required={!portalMode}
                  hint={portalMode ? undefined : 'É por aqui que a confirmação chega.'}
                >
                  <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="min-h-11" />
                </Field>
                {portalMode ? (
                  <p className="self-end rounded-md border border-primary-100 bg-primary-50 p-3 text-sm text-navy">
                    <strong className="block">Confirmação por e-mail</strong>
                    Vai para o e-mail cadastrado da unidade escolhida.
                  </p>
                ) : (
                  <Field label="E-mail (opcional)" htmlFor="email">
                    <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11" />
                  </Field>
                )}
              </div>
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-navy-2" aria-hidden="true" />Observações (opcional)
                  </span>
                }
                htmlFor="notes"
              >
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
              </Field>
            </div>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="gap-2 bg-surface">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />Voltar
            </Button>
            <Button type="button" onClick={nextFromDetails} className="flex-1 gap-2">
              Conferir o pedido <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          {errorBanner}
          <Card className="p-4 sm:p-5">
            <h2 className="font-title text-lg font-semibold text-navy">O que vamos enviar</h2>
            <p className="mt-1 text-sm text-navy-2">Confira os dados — dá para alterar qualquer linha.</p>
            <dl className="mt-4 divide-y divide-default">
              {[
                { label: 'Finalidade', value: APPOINTMENT_TYPE_RULES[appointmentType].label, target: 1 },
                { label: 'Unidade', value: portalMode ? selectedUnit?.client_name || '—' : unitName || '—', target: 2 },
                {
                  label: 'Consultora',
                  value: consultantNames.length ? consultantNames.map((name) => name.split(' ')[0]).join(' + ') : '—',
                  target: 2,
                },
                { label: 'Modalidade', value: attendanceMode === 'online' ? 'Online' : 'Presencial', target: 2 },
                { label: 'Duração', value: formatDuration(durationMinutes), target: 2 },
                {
                  label: 'Data e horário',
                  value: selectedDay
                    ? formatDayNumeric(selectedDay) + (selectedTime ? ' · ' + selectedTime.label : '')
                    : '—',
                  target: 2,
                },
              ].map((row) => (
                <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <dt className="text-sm text-navy-2">{row.label}</dt>
                  <dd className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 break-words text-sm font-semibold text-navy">{row.value}</span>
                    <button
                      type="button"
                      onClick={() => goToStep(row.target)}
                      aria-label={'Alterar ' + row.label.toLowerCase()}
                      className="shrink-0 rounded-sm text-xs font-semibold text-accent-ink underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      Alterar
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(3)} className="gap-2 bg-surface">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />Voltar
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void handleSubmit()} className="flex-1 gap-2">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Enviando...</>
              ) : (
                <><Send className="h-4 w-4" aria-hidden="true" />Enviar pedido</>
              )}
            </Button>
          </div>
        </section>
      )}
    </PublicShell>
  );
}
