import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Loader2,
  MapPin,
  Monitor,
  Phone,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { AttendanceMode, PublicAvailableTime, PublicCalendarDay } from '../types';
import { publicAppointmentService } from '../services/publicAppointmentService';
import { PublicHeader } from '../components/public/PublicHeader';
import { formatProtocol } from '../utils/protocol';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
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

function formatDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatFullDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
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

  const [unitName, setUnitName] = useState('');
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

  useEffect(() => {
    let cancelled = false;
    setCalendarLoading(true);
    publicAppointmentService
      .listCalendarDays()
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setDays(data);
        const first = data[0]?.day || '';
        setSelectedDay(first);
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
  }, [calendarReloadKey]);

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
    if (!unitName.trim()) return 'Informe o nome da unidade.';
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
      const result = await publicAppointmentService.createAppointmentRequest({
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
    } catch (err: any) {
      console.warn('[PublicSchedule] Falha ao enviar agendamento:', err);
      setError(err?.message?.includes('horario indisponivel')
        ? 'Este horario acabou de ser reservado. Escolha outro horario disponivel.'
        : 'Nao foi possivel enviar seu agendamento agora. Tente novamente em alguns instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`);
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
              to={`/portal/${token}`}
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
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 pb-16">
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-gray-950">Agendar inspeção</h2>
          <p className="mt-1 text-sm text-gray-500">
            Escolha uma data útil e um horário entre 09h30 e 16h. A agenda é limitada e os
            horários ocupados já são removidos automaticamente.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <section className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
                  <CalendarDays className="h-4 w-4 text-primary-700" />
                  Datas disponíveis
                </h3>
                <span className="text-xs font-medium text-gray-400">Segunda a sexta</span>
              </div>

              {calendarLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary-700" />
                </div>
              ) : days.length === 0 ? (
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                  {days.map((day) => {
                    const selected = selectedDay === day.day;
                    return (
                      <button
                        key={day.day}
                        type="button"
                        onClick={() => setSelectedDay(day.day)}
                        className={`rounded-md border p-3 text-left transition-all ${
                          selected
                            ? 'border-primary-700 bg-primary-50 text-primary-950 ring-2 ring-primary-100'
                            : 'border-gray-200 bg-white text-gray-800 hover:border-primary-300'
                        }`}
                      >
                        <p className="text-xs font-bold uppercase text-gray-400">
                          {WEEKDAY_LABELS[day.weekday - 1] || ''}
                        </p>
                        <p className="mt-1 text-base font-black capitalize">{formatDay(day.day)}</p>
                        <p className="mt-1 text-xs font-medium text-primary-700">
                          {day.available_count} horário{day.available_count === 1 ? '' : 's'}
                        </p>
                      </button>
                    );
                  })}
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
              ) : times.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  Selecione outra data. Este dia nao tem horários livres.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {times.map((time) => {
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Nome fantasia da unidade</label>
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

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAttendanceMode('presencial')}
                  className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold ${
                    attendanceMode === 'presencial'
                      ? 'border-primary-700 bg-primary-50 text-primary-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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

              {attendanceMode === 'presencial' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Município</label>
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
                    <label className="text-sm font-medium text-gray-700">Bairro</label>
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
                <label className="text-sm font-medium text-gray-700">Responsável</label>
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
                    WhatsApp
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
                  <label className="text-sm font-medium text-gray-700">Email</label>
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
                <label className="text-sm font-medium text-gray-700">Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Detalhes sobre a unidade, acesso, preferência ou documentos..."
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

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
