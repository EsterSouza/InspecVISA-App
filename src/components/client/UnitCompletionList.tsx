import type { UnitActionStats } from '../../utils/clientPortalFormat';

interface UnitCompletionListProps {
  /** Já ordenadas pelo chamador — pior primeiro (`sortUnitStatsByAttention`). */
  stats: UnitActionStats[];
}

function meterColor(pct: number | null): string {
  if (pct == null) return 'bg-gray-200';
  if (pct >= 85) return 'bg-emerald-600';
  if (pct < 65) return 'bg-amber';
  return 'bg-primary-700';
}

/** "Cumprimento por unidade" — usado na Visão geral e no Plano de ação (protótipo FE-03). */
export function UnitCompletionList({ stats }: UnitCompletionListProps) {
  return (
    <div className="divide-y divide-gray-100">
      {stats.map((u) => (
        <div key={u.clientId} className="flex items-center gap-3 py-2.5">
          <div className="w-36 shrink-0 sm:w-44">
            <p className="truncate text-sm font-semibold text-navy">{u.unitName}</p>
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
        </div>
      ))}
    </div>
  );
}
