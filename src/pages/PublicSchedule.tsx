import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Loader2,
  MapPin,
  Phone,
  Send,
  Users,
} from 'lucide-react';
import type { AppointmentSlot, SlotPeriod } from '../types';
import { publicAppointmentService } from '../services/publicAppointmentService';
import { PublicHeader } from '../components/public/PublicHeader';
import { formatProtocol } from '../utils/protocol';

const PERIOD_LABELS: Record<SlotPeriod, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  integral: 'Integral',
};

function formatSlotDate(startsAt: string | null): string {
  if (!startsAt) return 'Data a combinar';
  const d = new Date(startsAt);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function PublicSchedule() {
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [unitName, setUnitName] = useState('');
  const [district, setDistrict] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedPeriod, setRequestedPeriod] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicAppointmentService
      .listAvailableSlots()
      .then((data) => {
        if (!cancelled) setSlots(data);
      })
      .catch((err) => {
        console.warn('[PublicSchedule] Falha ao carregar datas disponíveis:', err);
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim() || !district.trim() || !phone.trim()) {
      setError('Preencha os campos obrigatórios: nome da unidade, bairro e telefone.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await publicAppointmentService.createAppointmentRequest({
        slot_id: selectedSlotId ?? undefined,
        unit_name: unitName.trim(),
        district: district.trim(),
        responsible_name: responsibleName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        requested_date: !selectedSlotId && requestedDate ? requestedDate : undefined,
        requested_period: !selectedSlotId && requestedPeriod ? requestedPeriod : undefined,
        notes: notes.trim() || undefined,
      });
      setToken(result.public_token);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.warn('[PublicSchedule] Falha ao enviar solicitação:', err);
      setError(
        'Não foi possível enviar sua solicitação agora. Verifique sua conexão e tente novamente em alguns instantes.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard indisponível — sem ação */
    }
  };

  // ─── Tela de sucesso ─────────────────────────────────────────
  if (token) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <main className="mx-auto max-w-[600px] px-4 py-10">
          <div className="rounded-2xl border border-green-100 bg-green-50/60 p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Solicitação enviada!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Recebemos sua solicitação de inspeção. Guarde o protocolo abaixo para acompanhar o
              andamento e baixar o relatório quando estiver pronto.
            </p>

            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Protocolo</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-gray-900">
                {formatProtocol(token)}
              </p>
            </div>

            <Link
              to={`/portal/${token}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <ClipboardCheck className="h-4 w-4" />
              Acompanhar minha solicitação
            </Link>

            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Link copiado!' : 'Copiar link de acompanhamento'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── Formulário ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-[600px] px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Agendar inspeção sanitária</h2>
          <p className="mt-1 text-sm text-gray-500">
            Preencha os dados abaixo e nossa equipe entrará em contato para confirmar a visita.
          </p>
        </div>

        {/* Datas disponíveis */}
        <section className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            <CalendarDays className="h-4 w-4 text-primary-600" />
            Datas disponíveis
          </h3>

          {slotsLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              No momento não há datas pré-definidas. Informe abaixo sua data e turno de preferência —
              o agendamento está sujeito à disponibilidade da equipe.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slots.map((slot) => {
                const selected = selectedSlotId === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(selected ? null : slot.id)}
                    className={`rounded-xl border p-3 text-left shadow-sm transition-all ${
                      selected
                        ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 bg-white hover:border-primary-300'
                    }`}
                  >
                    <p className="text-sm font-bold capitalize text-gray-900">
                      {formatSlotDate(slot.starts_at)}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-primary-700">
                      {slot.period ? PERIOD_LABELS[slot.period] : 'Horário a combinar'}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                      <Users className="h-3 w-3" />
                      {slot.spots_left ?? Math.max(slot.capacity - slot.booked_count, 0)}{' '}
                      {(slot.spots_left ?? slot.capacity - slot.booked_count) === 1 ? 'vaga' : 'vagas'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          {selectedSlotId && (
            <p className="mt-2 text-xs text-gray-500">
              Data selecionada. Toque novamente no card para desmarcar e sugerir outra data.
            </p>
          )}
        </section>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Nome da unidade <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Ex.: Clínica Estética Bela Vida"
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <MapPin className="h-4 w-4 text-gray-400" />
              Bairro <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Ex.: Centro"
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Nome do responsável</label>
            <input
              type="text"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Quem acompanhará a inspeção"
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Phone className="h-4 w-4 text-gray-400" />
                Telefone/WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>

          {!selectedSlotId && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Data desejada</label>
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Turno sugerido</label>
                <select
                  value={requestedPeriod}
                  onChange={(e) => setRequestedPeriod(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">Indiferente</option>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informações adicionais sobre a unidade ou a inspeção..."
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar solicitação
              </>
            )}
          </button>

          <p className="pb-6 text-center text-xs text-gray-400">
            Seus dados são usados apenas para organizar a inspeção e o contato da equipe.
          </p>
        </form>
      </main>
    </div>
  );
}
