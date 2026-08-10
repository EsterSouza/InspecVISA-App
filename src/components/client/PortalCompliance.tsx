import { Suspense, lazy } from 'react';
import { TrendingUp } from 'lucide-react';
import type { ClientPortalUnit } from '../../services/clientPortalService';
import { formatDateBR, scoreColor } from '../../utils/clientPortalFormat';
import { classificationFromPercent, classificationLabel } from '../../utils/scoring';

const ComplianceTrendChart = lazy(() =>
  import('./ComplianceTrendChart').then((m) => ({ default: m.ComplianceTrendChart }))
);

interface PortalComplianceProps {
  units: ClientPortalUnit[];
}

export function PortalCompliance({ units }: PortalComplianceProps) {
  const allVisits = units.flatMap((unit) => unit.visits.map((visit) => ({ ...visit, unitName: unit.client_name })));
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
  const perUnit = units
    .map((u) => {
      const us = u.visits
        .filter((v) => typeof v.compliance_score === 'number')
        .sort((a, b) => `${b.requested_date || ''}`.localeCompare(`${a.requested_date || ''}`));
      if (!us.length) return null;
      const latest = us[0];
      return {
        name: u.client_name,
        score: latest.compliance_score as number,
        sanitary: typeof latest.sanitary_score === 'number' ? latest.sanitary_score : null,
        nutrition: typeof latest.nutrition_score === 'number' ? latest.nutrition_score : null,
      };
    })
    .filter((x): x is { name: string; score: number; sanitary: number | null; nutrition: number | null } => x !== null)
    .sort((a, b) => a.score - b.score);

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-title text-base font-semibold text-navy">
          <TrendingUp className="h-4 w-4 text-primary-700" /> Conformidade da rede
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${scoreColor(avg)}`}>
          Média {avg}% · {classificationLabel(classificationFromPercent(avg))}
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
          <div key={u.name}>
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs font-medium text-gray-700">{u.name}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${u.score >= 85 ? 'bg-green-500' : u.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${u.score}%` }}
                />
              </div>
              <span className="hidden w-24 shrink-0 text-right text-[10px] font-bold uppercase tracking-tight text-gray-500 sm:inline">
                {classificationLabel(classificationFromPercent(u.score))}
              </span>
              <span className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold ${scoreColor(u.score)}`}>
                {u.score}%
              </span>
            </div>
            {(u.sanitary !== null || u.nutrition !== null) && (
              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-semibold text-gray-500 sm:ml-[10.75rem]">
                {u.sanitary !== null && (
                  <span>Sanitária <span className="text-gray-800">{u.sanitary}%</span></span>
                )}
                {u.nutrition !== null && (
                  <span>Nutrição <span className="text-gray-800">{u.nutrition}%</span></span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
