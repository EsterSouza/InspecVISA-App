import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  FileText,
  Image,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Paperclip,
} from 'lucide-react';
import { PublicHeader } from '../components/public/PublicHeader';
import {
  clientPortalService,
  type ClientPortalOverview,
} from '../services/clientPortalService';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  rescheduled: 'Remarcada',
  completed: 'Finalizada',
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

function formatMonthTitle(value: string): string {
  return parseLocalDate(`${value}-01`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
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

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (token) void loadOverview(token);
  }, [token, loadOverview]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !code.trim()) {
      setError('Informe o e-mail e o código de acesso.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await clientPortalService.login(email.trim(), code.trim());
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
    setEmail('');
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
                  <Mail className="h-4 w-4 text-gray-400" /> E-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@suaempresa.com.br"
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <KeyRound className="h-4 w-4 text-gray-400" /> Código de acesso
                </label>
                <input
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Fornecido pela consultoria"
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
              Ainda não tem acesso? Solicite o código à equipe da consultoria. Para acompanhar
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
  const monthKeys = Array.from(
    new Set(allVisits.map((visit) => visit.requested_date?.slice(0, 7)).filter(Boolean) as string[])
  ).sort();

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
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-400">Em acompanhamento</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{activeVisits}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-400">Relatorios</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{reportCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-400">Fotos</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{photoCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-400">Anexos</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{attachmentCount}</p>
          </div>
        </div>

        <Link
          to="/agendar"
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800"
        >
          <CalendarPlus className="h-4 w-4" />
          Agendar nova inspeção
        </Link>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
            <CalendarDays className="h-4 w-4 text-primary-700" />
            Calendario de inspeções
          </h3>
          {monthKeys.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
              Nenhuma inspeção agendada ainda.
            </p>
          ) : (
            <div className="space-y-7">
              {monthKeys.map((month) => {
                const monthStart = parseLocalDate(`${month}-01`);
                const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                const start = new Date(monthStart);
                const end = new Date(monthEnd);
                start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
                end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)));
                const cells: Date[] = [];
                for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
                  cells.push(new Date(cursor));
                }
                return (
                  <div key={month}>
                    <p className="mb-2 text-sm font-bold capitalize text-gray-900">{formatMonthTitle(month)}</p>
                    <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-gray-400 sm:gap-2">
                      {CALENDAR_WEEKDAYS.map((label) => (
                        <div key={label} className="py-1">{label}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {cells.map((date) => {
                        const key = toDateKey(date);
                        const visits = visitsByDate.get(key) || [];
                        const inMonth = key.startsWith(month);
                        return (
                          <div
                            key={key}
                            className={`min-h-[86px] rounded-md border p-1.5 sm:min-h-[104px] sm:p-2 ${
                              visits.length > 0
                                ? 'border-primary-200 bg-primary-50/60'
                                : inMonth
                                  ? 'border-gray-100 bg-white'
                                  : 'border-transparent bg-transparent'
                            }`}
                          >
                            <p className={`text-base font-black leading-none ${inMonth ? 'text-gray-900' : 'text-gray-200'}`}>
                              {date.getDate()}
                            </p>
                            <div className="mt-2 space-y-1">
                              {visits.slice(0, 2).map((visit) => (
                                <Link
                                  key={visit.public_token}
                                  to={`/portal/${visit.public_token}`}
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
                  </div>
                );
              })}
            </div>
          )}
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

                {unit.visits.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">
                    Nenhuma inspeção registrada para esta unidade.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {unit.visits.map((visit) => (
                      <li key={visit.public_token}>
                        <Link
                          to={`/portal/${visit.public_token}`}
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
