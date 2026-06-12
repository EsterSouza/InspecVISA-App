import React, { useCallback, useEffect, useState, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Image,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Paperclip,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import { PublicHeader } from '../components/public/PublicHeader';
import {
  clientPortalService,
  type ClientPortalOverview,
} from '../services/clientPortalService';
import { generateFranchisePdf } from '../utils/franchiseReport';

const ComplianceTrendChart = lazy(() =>
  import('../components/client/ComplianceTrendChart').then((m) => ({ default: m.ComplianceTrendChart }))
);

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-700 bg-green-100';
  if (score >= 60) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Relatorio concluido',
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

const ACTIVE_VISIT_STATUSES = new Set(['requested', 'confirmed', 'in_progress', 'rescheduled', 'completed']);
const CALENDAR_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateParts(value: string): Date {
  const [y, m, d] = value.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatDateBR(value: string | null): string {
  if (!value) return 'A confirmar';
  const [y, m, d] = value.split('T')[0].split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function ClientPortal() {
  const [token, setToken] = useState<string | null>(() => clientPortalService.getStoredToken());
  const [overview, setOverview] = useState<ClientPortalOverview | null>(null);
  const [loading, setLoading] = useState(!!clientPortalService.getStoredToken());

  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Calendário: começa sempre no mês corrente
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadOverview = useCallback(async (portalToken: string) => {
    setLoading(true);
    try {
      const data = await clientPortalService.overview(portalToken);
      setOverview(data);
      setError(null);
    } catch (err) {
      console.warn('[ClientPortal] Falha ao carregar painel:', err);
      clientPortalService.clearToken();
      setToken(null);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (token) void loadOverview(token);
  }, [token, loadOverview]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !code.trim()) {
      setError('Informe o e-mail/usuario e a senha.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await clientPortalService.login(identifier.trim(), code.trim());
      clientPortalService.storeToken(result.portal_token);
      setToken(result.portal_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar agora.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clientPortalService.clearToken();
    setToken(null);
    setOverview(null);
    setIdentifier('');
    setCode('');
  };

  // ─── Carregando painel ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-600" />
          <p className="text-sm text-gray-500">Carregando seu painel...</p>
        </div>
      </div>
    );
  }

  // ─── Login do cliente ────────────────────────────────────────
  if (!token || !overview) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <main className="mx-auto max-w-[440px] px-4 py-12">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Portal do Cliente</h2>
            <p className="mt-1 text-sm text-gray-500">
              Acompanhe as inspeções, relatórios, fotos e anexos de todas as suas unidades.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" /> E-mail ou usuario
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="contato@suaempresa.com.br ou usuario"
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <KeyRound className="h-4 w-4 text-gray-400" /> Senha
                </label>
                <input
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Senha permanente fornecida pela consultoria"
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
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Acessar meu painel
              </button>
            </form>

            <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-400">
              Ainda não tem acesso? Solicite a senha à equipe da consultoria. Para acompanhar
              uma única visita, use o link do protocolo recebido no agendamento.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ─── Painel do cliente ───────────────────────────────────────
  const totalVisits = overview.units.reduce((sum, u) => sum + u.visits.length, 0);
  const allVisits = overview.units.flatMap((unit) =>
    unit.visits.map((visit) => ({ ...visit, unitName: unit.client_name, city: unit.city }))
  );
  const activeVisits = allVisits.filter((visit) => ACTIVE_VISIT_STATUSES.has(visit.status)).length;
  const reportCount = allVisits.reduce((sum, visit) => sum + (visit.report_count || 0), 0);
  const photoCount = allVisits.reduce((sum, visit) => sum + (visit.photo_count || 0), 0);
  const attachmentCount = allVisits.reduce((sum, visit) => sum + (visit.attachment_count || 0), 0);
  const visitsByDate = new Map<string, typeof allVisits>();
  for (const visit of allVisits) {
    if (!visit.requested_date) continue;
    const list = visitsByDate.get(visit.requested_date) || [];
    list.push(visit);
    visitsByDate.set(visit.requested_date, list);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">{overview.account_name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {overview.units.length} unidade{overview.units.length === 1 ? '' : 's'} ·{' '}
              {totalVisits} inspeç{totalVisits === 1 ? 'ão' : 'ões'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => generateFranchisePdf(overview)}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"
            >
              <Download className="h-3.5 w-3.5" /> Resumo (PDF)
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-bold uppercase leading-tight text-gray-400 sm:text-xs">Em acompanhamento</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{activeVisits}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-bold uppercase leading-tight text-gray-400 sm:text-xs">Relatórios</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{reportCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-bold uppercase leading-tight text-gray-400 sm:text-xs">Fotos</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{photoCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-bold uppercase leading-tight text-gray-400 sm:text-xs">Anexos</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{attachmentCount}</p>
          </div>
        </div>

        {(() => {
          const scored = allVisits
            .filter((v) => typeof v.compliance_score === 'number')
            .slice()
            .sort((a, b) => `${a.requested_date || ''}`.localeCompare(`${b.requested_date || ''}`));
          if (scored.length === 0) return null;
          const avg = Math.round(scored.reduce((s, v) => s + (v.compliance_score || 0), 0) / scored.length);
          const chartData = scored.map((v) => ({
            date: formatDateBR(v.requested_date).slice(0, 5),
            score: v.compliance_score as number,
          }));
          const perUnit = overview.units
            .map((u) => {
              const us = u.visits
                .filter((v) => typeof v.compliance_score === 'number')
                .sort((a, b) => `${b.requested_date || ''}`.localeCompare(`${a.requested_date || ''}`));
              return us.length ? { name: u.client_name, score: us[0].compliance_score as number } : null;
            })
            .filter((x): x is { name: string; score: number } => x !== null)
            .sort((a, b) => a.score - b.score);

          return (
            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
                  <TrendingUp className="h-4 w-4 text-primary-700" /> Conformidade da rede
                </h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${scoreColor(avg)}`}>
                  Média {avg}%
                </span>
              </div>

              {chartData.length >= 2 && (
                <div className="mb-4 h-48 w-full">
                  <Suspense fallback={<div className="h-full animate-pulse rounded-lg bg-gray-50" />}>
                    <ComplianceTrendChart data={chartData} />
                  </Suspense>
                </div>
              )}

              <div className="space-y-1.5">
                {perUnit.map((u) => (
                  <div key={u.name} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs font-medium text-gray-700">{u.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${u.score >= 85 ? 'bg-green-500' : u.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${u.score}%` }}
                      />
                    </div>
                    <span className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold ${scoreColor(u.score)}`}>
                      {u.score}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {overview.payment && (overview.payment.type || overview.payment.link || overview.payment.status === 'paid') && (
          <div
            className={`mb-6 flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
              overview.payment.status === 'paid'
                ? 'border-green-200 bg-green-50/70'
                : 'border-amber-200 bg-amber-50/70'
            }`}
          >
            <div className="flex items-center gap-3">
              {overview.payment.status === 'paid' ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
              ) : (
                <CreditCard className="h-6 w-6 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {overview.payment.status === 'paid' ? 'Pagamento confirmado' : 'Pagamento pendente'}
                  {overview.payment.type && (
                    <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                      {overview.payment.type === 'monthly' ? 'Mensal' : 'Único'}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {overview.payment.status === 'paid'
                    ? 'Obrigado! Seu pagamento está em dia.'
                    : 'Use o botão para efetuar o pagamento e liberar o acompanhamento completo.'}
                </p>
              </div>
            </div>
            {overview.payment.status !== 'paid' && overview.payment.link && (
              <a
                href={overview.payment.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
              >
                <CreditCard className="h-4 w-4" />
                Pagar agora
              </a>
            )}
          </div>
        )}

        <Link
          to="/agendar"
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800"
        >
          <CalendarPlus className="h-4 w-4" />
          Agendar nova inspeção
        </Link>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary-700" />
              Calendário de inspeções
            </h3>
            <div className="flex items-center justify-between gap-1 sm:justify-end">
              <button
                type="button"
                onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="flex-1 text-center text-sm font-bold lowercase text-gray-900 first-letter:uppercase sm:min-w-[130px] sm:flex-none">
                {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => { const n = new Date(); setCalendarMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }}
                className="ml-1 inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                title="Voltar ao mês atual"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Hoje
              </button>
            </div>
          </div>
          {(() => {
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
            const monthVisits = allVisits
              .filter((v) => v.requested_date?.startsWith(month))
              .sort((a, b) =>
                `${a.requested_date}${a.requested_time || ''}`.localeCompare(`${b.requested_date}${b.requested_time || ''}`)
              );
            return (
              <div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-gray-400 sm:gap-2 sm:text-[11px]">
                  {CALENDAR_WEEKDAYS.map((label) => (
                    <div key={label} className="py-1">{label}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {cells.map((date) => {
                    const key = toDateKey(date);
                    const visits = visitsByDate.get(key) || [];
                    const inMonth = key.startsWith(month);
                    const isToday = key === todayKey;
                    return (
                      <div
                        key={key}
                        className={`flex min-h-[40px] flex-col rounded-md border p-1 sm:min-h-[104px] sm:p-2 ${
                          visits.length > 0
                            ? 'border-primary-200 bg-primary-50/60'
                            : inMonth
                              ? 'border-gray-100 bg-white'
                              : 'border-transparent bg-transparent'
                        } ${isToday ? 'ring-2 ring-primary-300' : ''}`}
                      >
                        <p className={`text-xs font-bold leading-none sm:text-base sm:font-black ${inMonth ? 'text-gray-900' : 'text-gray-300'}`}>
                          {date.getDate()}
                        </p>

                        {/* Mobile: bolinhas indicadoras */}
                        {visits.length > 0 && (
                          <div className="mt-auto flex flex-wrap gap-0.5 pt-1 sm:hidden">
                            {visits.slice(0, 4).map((v) => (
                              <span key={v.public_token} className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                            ))}
                          </div>
                        )}

                        {/* Desktop: chips com nome */}
                        <div className="mt-2 hidden space-y-1 sm:block">
                          {visits.slice(0, 2).map((visit) => (
                            <Link
                              key={visit.public_token}
                              to={`/cliente/visita/${visit.public_token}`}
                              className="block truncate rounded bg-white/80 px-1.5 py-1 text-[10px] font-semibold text-primary-900 shadow-sm"
                              title={`${visit.unitName} - ${STATUS_LABELS[visit.status] || visit.status}`}
                            >
                              {visit.requested_time ? `${visit.requested_time} ` : ''}{visit.unitName}
                            </Link>
                          ))}
                          {visits.length > 2 && (
                            <p className="text-[10px] font-semibold text-primary-700">+{visits.length - 2}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Lista legível das visitas do mês (principal no celular) */}
                {monthVisits.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-400">
                    Nenhuma inspeção neste mês. Use as setas para ver outros meses.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    {monthVisits.map((visit) => {
                      const d = visit.requested_date ? parseDateParts(visit.requested_date) : null;
                      return (
                        <li key={visit.public_token}>
                          <Link
                            to={`/cliente/visita/${visit.public_token}`}
                            className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 transition-colors hover:bg-primary-50/50"
                          >
                            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-50 text-primary-800">
                              <span className="text-[9px] font-bold uppercase leading-none">
                                {d ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '--'}
                              </span>
                              <span className="text-base font-black leading-none">{d ? d.getDate() : '--'}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900">{visit.unitName}</p>
                              <p className="text-xs text-gray-500">
                                {visit.requested_time ? `${visit.requested_time} · ` : ''}
                                {STATUS_LABELS[visit.status] || visit.status}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                STATUS_BADGES[visit.status] || 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {STATUS_LABELS[visit.status] || visit.status}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}
        </section>

        {overview.units.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Nenhuma unidade vinculada ao seu acesso ainda. Fale com a equipe da consultoria.
          </div>
        ) : (
          <div className="space-y-5">
            {overview.units.map((unit) => (
              <section
                key={unit.client_name}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <header className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-5 py-3.5">
                  <Building2 className="h-4 w-4 shrink-0 text-primary-700" />
                  <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                    {unit.client_name}
                  </h3>
                  {unit.city && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="h-3 w-3" /> {unit.city}
                    </span>
                  )}
                </header>
                {unit.has_personalized_sanitary_folder && unit.personalized_sanitary_folder_url && (
                  <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-3">
                    <a
                      href={unit.personalized_sanitary_folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Abrir pasta sanitaria personalizada
                    </a>
                  </div>
                )}

                {unit.visits.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">
                    Nenhuma inspeção registrada para esta unidade.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {unit.visits.map((visit) => (
                      <li key={visit.public_token}>
                        <Link
                          to={`/cliente/visita/${visit.public_token}`}
                          className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-primary-50/40"
                        >
                          <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
                            {formatDateBR(visit.requested_date)}
                            {visit.requested_time ? ` às ${visit.requested_time}` : ''}
                          </span>
                          <span className="hidden flex-wrap items-center gap-2 text-[11px] text-gray-500 sm:flex">
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
                          </span>
                          <span className="hidden shrink-0 text-xs font-semibold text-primary-700 md:inline">
                            Abrir detalhes e arquivos
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              STATUS_BADGES[visit.status] || 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {STATUS_LABELS[visit.status] || visit.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
          Toque em uma inspeção para ver a linha do tempo, baixar o relatório, fotos e anexos.
        </p>
      </main>
    </div>
  );
}
