import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
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

        <Link
          to="/agendar"
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800"
        >
          <CalendarPlus className="h-4 w-4" />
          Agendar nova inspeção
        </Link>

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
