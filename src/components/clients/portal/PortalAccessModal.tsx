import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ClientPortalFeature, ClientPortalFeatureRow, SchedulingSuspensionMode } from '../../../types';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../../../services/appointmentAdminService';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { errorMessage } from './shared';

// ─── Central de acesso do portal (PORT-01) ────────────────────
//
// Um lugar só para "o que este cliente enxerga e quando". Pagamento continua no modal de
// Pagamento — lá é dinheiro; aqui é acesso.

const PORTAL_FEATURES: { key: ClientPortalFeature; label: string; hint: string }[] = [
  { key: 'reports', label: 'Relatórios e documentos', hint: 'PDFs de laudo e anexos publicados na visita.' },
  { key: 'photos', label: 'Fotos', hint: 'Fotos da inspeção anexadas ao compromisso.' },
  { key: 'action_plan', label: 'Plano de ação', hint: 'Pendências publicadas com prazo e responsável.' },
  { key: 'compliance', label: 'Indicadores de conformidade', hint: 'Percentuais, classificação e contagem de não conformidades.' },
];

const SCHEDULING_MODES: { key: SchedulingSuspensionMode; label: string; hint: string }[] = [
  { key: 'auto', label: 'Automático', hint: 'Suspende sozinho quando a conta passa da tolerância de atraso, e volta quando o pagamento é marcado como pago.' },
  { key: 'always_open', label: 'Sempre liberado', hint: 'Exceção manual: continua agendando mesmo em atraso.' },
  { key: 'suspended', label: 'Suspenso', hint: 'Suspenso na mão, independente de pagamento.' },
];

/** `datetime-local` só aceita `YYYY-MM-DDTHH:mm`; o banco devolve ISO com fuso. */
function toLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface PortalAccessModalProps {
  account: ClientPortalAccountRow;
  onClose: () => void;
  onSaved: () => void;
}

export function PortalAccessModal({ account, onClose, onSaved }: PortalAccessModalProps) {
  const [rows, setRows] = useState<ClientPortalFeatureRow[]>([]);
  const [mode, setMode] = useState<SchedulingSuspensionMode>(account.scheduling_suspension_mode);
  const [graceDays, setGraceDays] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      AppointmentAdminService.listPortalFeatures(account.id),
      AppointmentAdminService.getPortalSettings().catch(() => null),
    ])
      .then(([featureRows, settings]) => {
        setRows(featureRows);
        if (settings?.overdue_grace_days != null) setGraceDays(settings.overdue_grace_days);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [account.id]);

  useEffect(load, [load]);

  const rowFor = (feature: ClientPortalFeature) => rows.find((row) => row.feature === feature);

  const save = async (feature: ClientPortalFeature, patch: Partial<ClientPortalFeatureRow>) => {
    const current = rowFor(feature);
    setBusy(feature);
    setError(null);
    try {
      await AppointmentAdminService.setPortalFeature(account.id, feature, {
        state: patch.state ?? current?.state ?? 'released',
        releaseAt: patch.release_at !== undefined ? patch.release_at : current?.release_at ?? null,
        hideAt: patch.hide_at !== undefined ? patch.hide_at : current?.hide_at ?? null,
        lockWhenOverdue:
          patch.lock_when_overdue !== undefined ? patch.lock_when_overdue : current?.lock_when_overdue ?? false,
      });
      load();
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const saveMode = async (next: SchedulingSuspensionMode) => {
    setBusy('scheduling');
    setError(null);
    try {
      await AppointmentAdminService.setSchedulingMode(account.id, next);
      setMode(next);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="portal-access-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-2xl">
        <CardContent className="p-6">
          <h3 id="portal-access-title" className="mb-1 text-xl font-bold text-navy">Acesso do portal</h3>
          <p className="mb-5 text-sm text-navy-3">{account.name}</p>

          {error && (
            <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mb-5 rounded-xl border border-default bg-surface-sunken p-3">
            <p id="scheduling-mode-label" className="text-sm font-bold text-navy">Agendamento</p>
            <p className="mb-3 text-xs text-navy-3">
              Tolerância atual: {graceDays} dia{graceDays === 1 ? '' : 's'} depois do vencimento. Muda em
              Configurações do portal e vale para toda a carteira.
            </p>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-labelledby="scheduling-mode-label">
              {SCHEDULING_MODES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={busy === 'scheduling'}
                  onClick={() => void saveMode(option.key)}
                  title={option.hint}
                  aria-pressed={mode === option.key}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    mode === option.key
                      ? 'border-primary-500 bg-primary-50 text-primary-800'
                      : 'border-default bg-surface text-navy-2 hover:bg-surface-hover'
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className="mt-0.5 block leading-tight">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mb-1 text-sm font-bold text-navy">O que o cliente enxerga</p>
          <p className="mb-3 text-xs text-navy-3">
            Atraso de pagamento <span className="font-semibold">não</span> esconde o que já foi entregue. Só o que
            estiver marcado abaixo fecha sozinho quando a conta atrasa.
          </p>

          {loading ? (
            <div className="space-y-3" role="status" aria-label="Carregando travas de acesso">
              <div className="h-20 animate-pulse rounded-xl bg-surface-sunken" />
              <div className="h-20 animate-pulse rounded-xl bg-surface-sunken" />
              <div className="h-20 animate-pulse rounded-xl bg-surface-sunken" />
              <span className="sr-only">Carregando as travas desta conta...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {PORTAL_FEATURES.map(({ key, label, hint }) => {
                const row = rowFor(key);
                const state = row?.state ?? 'released';
                return (
                  <div key={key} className="rounded-xl border border-default bg-surface p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p id={`feature-${key}-label`} className="text-sm font-semibold text-navy">{label}</p>
                        <p className="text-xs text-navy-3">{hint}</p>
                      </div>
                      {busy === key && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-navy-3" aria-hidden="true" />}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5" role="group" aria-labelledby={`feature-${key}-label`}>
                      {(['released', 'hidden', 'scheduled'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          disabled={busy === key}
                          aria-pressed={state === option}
                          onClick={() =>
                            void save(key, {
                              state: option,
                              // Programar sem data é recusado pelo banco; sugere daqui a uma semana.
                              release_at:
                                option === 'scheduled'
                                  ? row?.release_at ||
                                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                                  : null,
                            })
                          }
                          className={`h-9 rounded-lg border text-xs font-bold transition-colors ${
                            state === option
                              ? option === 'hidden'
                                ? 'border-red-400 bg-red-50 text-red-700'
                                : option === 'scheduled'
                                  ? 'border-sky-400 bg-sky-50 text-sky-700'
                                  : 'border-green-500 bg-green-50 text-green-700'
                              : 'border-default text-navy-3 hover:bg-surface-hover'
                          }`}
                        >
                          {option === 'released' ? 'Liberado' : option === 'hidden' ? 'Oculto' : 'Programado'}
                        </button>
                      ))}
                    </div>

                    {state === 'scheduled' && (
                      <div className="mt-2 text-xs text-navy-2">
                        <label htmlFor={`release-at-${key}`}>Liberar a partir de</label>
                        <input
                          id={`release-at-${key}`}
                          type="datetime-local"
                          value={toLocalInput(row?.release_at ?? null)}
                          disabled={busy === key}
                          onChange={(e) =>
                            void save(key, {
                              state: 'scheduled',
                              release_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-control p-2 text-sm"
                        />
                      </div>
                    )}

                    <div className="mt-2 text-xs text-navy-2">
                      <label htmlFor={`hide-at-${key}`}>
                        Ocultar a partir de <span className="text-navy-3">(fim de contrato — opcional)</span>
                      </label>
                      <input
                        id={`hide-at-${key}`}
                        type="datetime-local"
                        value={toLocalInput(row?.hide_at ?? null)}
                        disabled={busy === key}
                        onChange={(e) =>
                          void save(key, { hide_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                        }
                        className="mt-1 w-full rounded-lg border border-control p-2 text-sm"
                      />
                    </div>

                    <label className="mt-2 flex items-center gap-2 text-xs text-navy-2">
                      <input
                        type="checkbox"
                        checked={!!row?.lock_when_overdue}
                        disabled={busy === key}
                        onChange={(e) => void save(key, { lock_when_overdue: e.target.checked })}
                        className="h-4 w-4 rounded border-control"
                      />
                      Fechar sozinho enquanto o pagamento estiver atrasado
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
