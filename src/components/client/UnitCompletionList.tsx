import { Link2 } from 'lucide-react';
import type { UnitActionStats } from '../../utils/clientPortalFormat';
import { CopyLinkButton } from './CopyLinkButton';

interface UnitCompletionListProps {
  /** Já ordenadas pelo chamador — pior primeiro (`sortUnitStatsByAttention`). */
  stats: UnitActionStats[];
  /** Vai pro plano de ação filtrado nesta unidade. Sem isso, o nome não é clicável. */
  onSelect?: (clientId: string) => void;
  /** Link público (sem login) da unidade, pra copiar e mandar pro gestor dela (PORT-02). */
  shareUrlByUnit?: Record<string, string | null>;
}

function meterColor(pct: number | null): string {
  if (pct == null) return 'bg-surface-sunken';
  if (pct >= 85) return 'bg-success';
  if (pct < 65) return 'bg-amber';
  return 'bg-primary-700';
}

/** "Cumprimento por unidade" — usado na Visão geral e no Plano de ação (protótipo FE-03). */
export function UnitCompletionList({ stats, onSelect, shareUrlByUnit }: UnitCompletionListProps) {
  return (
    <div>
      {(onSelect || shareUrlByUnit) && (
        <p className="mb-3 flex items-start gap-1.5 rounded-md bg-surface-sunken p-2.5 text-[11px] leading-snug text-navy-2">
          <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {onSelect && shareUrlByUnit
              ? <>Clique no nome pra ver as pendências dessa unidade aqui embaixo. <strong className="font-semibold text-navy">Link</strong> copia um endereço público e sem senha do plano de ação dela — pode mandar pro gestor da unidade, sem dar acesso à conta inteira.</>
              : onSelect
                ? 'Clique no nome pra ver as pendências dessa unidade aqui embaixo.'
                : <><strong className="font-semibold text-navy">Link</strong> copia um endereço público e sem senha do plano de ação da unidade — pode mandar pro gestor dela, sem dar acesso à conta inteira.</>}
          </span>
        </p>
      )}
      <div className="divide-y divide-default">
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
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                <div className={`h-full rounded-full ${meterColor(u.pctDone)}`} style={{ width: `${u.pctDone ?? 0}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums text-navy-2">
                {u.pctDone != null ? `${u.pctDone}% feito` : '—'}
              </span>
              {shareUrl && (
                <CopyLinkButton url={shareUrl} label={`plano de ação de ${u.unitName}`} variant="compact" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
