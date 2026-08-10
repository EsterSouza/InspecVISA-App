import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import type { UnitActionStats } from '../../utils/clientPortalFormat';

interface UnitCompletionListProps {
  /** Já ordenadas pelo chamador — pior primeiro (`sortUnitStatsByAttention`). */
  stats: UnitActionStats[];
  /** Vai pro plano de ação filtrado nesta unidade. Sem isso, o nome não é clicável. */
  onSelect?: (clientId: string) => void;
  /** Link público (sem login) da unidade, pra copiar e mandar pro gestor dela (PORT-02). */
  shareUrlByUnit?: Record<string, string | null>;
}

function meterColor(pct: number | null): string {
  if (pct == null) return 'bg-gray-200';
  if (pct >= 85) return 'bg-emerald-600';
  if (pct < 65) return 'bg-amber';
  return 'bg-primary-700';
}

/** "Cumprimento por unidade" — usado na Visão geral e no Plano de ação (protótipo FE-03). */
export function UnitCompletionList({ stats, onSelect, shareUrlByUnit }: UnitCompletionListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = (clientId: string, url: string) => {
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedId(clientId);
        window.setTimeout(() => setCopiedId((current) => (current === clientId ? null : current)), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="divide-y divide-gray-100">
      {stats.map((u) => {
        const shareUrl = shareUrlByUnit?.[u.clientId];
        return (
          <div key={u.clientId} className="flex items-center gap-3 py-2.5">
            <div className="w-36 shrink-0 sm:w-44">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(u.clientId)}
                  className="truncate text-left text-sm font-semibold text-navy hover:text-primary-700 hover:underline"
                >
                  {u.unitName}
                </button>
              ) : (
                <p className="truncate text-sm font-semibold text-navy">{u.unitName}</p>
              )}
              {u.overdue > 0 && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-sm border border-amber-soft-border bg-amber-soft px-1.5 py-0.5 text-[11px] font-semibold text-amber-soft-ink">
                  {u.overdue} vencida{u.overdue === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${meterColor(u.pctDone)}`} style={{ width: `${u.pctDone ?? 0}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums text-navy-2">
              {u.pctDone != null ? `${u.pctDone}% feito` : '—'}
            </span>
            {shareUrl && (
              <button
                type="button"
                onClick={() => copyLink(u.clientId, shareUrl)}
                title={copiedId === u.clientId ? 'Link copiado' : `Copiar link do plano de ação de ${u.unitName} para o gestor`}
                aria-label={copiedId === u.clientId ? `Link copiado para ${u.unitName}` : `Copiar link do plano de ação de ${u.unitName}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 text-navy-2 hover:bg-gray-50 hover:text-primary-700"
              >
                {copiedId === u.clientId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedId === u.clientId && <span className="sr-only" aria-live="polite">Link copiado</span>}
              </button>
            )}
          </div>
        );
      })}
      {shareUrlByUnit && (
        <p className="flex items-center gap-1.5 pt-2 text-[11px] text-navy-2">
          <Link2 className="h-3 w-3 shrink-0" /> O ícone copia um link sem senha com o plano de ação da unidade — dá para
          mandar direto para o gestor dela.
        </p>
      )}
    </div>
  );
}
