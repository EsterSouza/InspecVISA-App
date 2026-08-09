import type { ClientPortalUnit } from '../../services/clientPortalService';
import { latestComplianceScore, scoreColor } from '../../utils/clientPortalFormat';

interface PortalUnitFilterProps {
  units: ClientPortalUnit[];
  selectedUnitId: string | null;
  onChange: (unitId: string | null) => void;
}

/** Acima disso os chips somem no celular e viram <select> — não cabem mais numa ou duas linhas. */
const CHIP_TO_SELECT_THRESHOLD = 6;

/** Pior nota primeiro — é a unidade que mais precisa de atenção. Sem nota ainda vai pro fim. */
function sortByAttention(units: ClientPortalUnit[]): { unit: ClientPortalUnit; score: number | null }[] {
  return units
    .map((unit) => ({ unit, score: latestComplianceScore(unit.visits) }))
    .sort((a, b) => {
      if (a.score == null && b.score == null) return a.unit.client_name.localeCompare(b.unit.client_name);
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return a.score - b.score;
    });
}

function unitLabel(unit: ClientPortalUnit, score: number | null): string {
  return score != null ? `${unit.client_name} · ${score}%` : unit.client_name;
}

export function PortalUnitFilter({ units, selectedUnitId, onChange }: PortalUnitFilterProps) {
  if (units.length <= 1) return null;

  const ranked = sortByAttention(units);
  const showSelectOnMobile = units.length > CHIP_TO_SELECT_THRESHOLD;

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'border-primary-700 bg-primary-700 text-white'
        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
    }`;

  const chips = (
    <div className={`flex flex-wrap gap-2 ${showSelectOnMobile ? 'hidden sm:flex' : ''}`}>
      <button type="button" onClick={() => onChange(null)} className={chipClass(selectedUnitId === null)}>
        Todas
      </button>
      {ranked.map(({ unit, score }) => (
        <button
          key={unit.client_id}
          type="button"
          onClick={() => onChange(unit.client_id)}
          className={chipClass(selectedUnitId === unit.client_id)}
        >
          {unit.client_name}
          {score != null && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                selectedUnitId === unit.client_id ? 'bg-white/20 text-white' : scoreColor(score)
              }`}
            >
              {score}%
            </span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mb-6">
      <label htmlFor="portal-unit-filter" className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
        Unidade
      </label>
      {showSelectOnMobile && (
        <select
          id="portal-unit-filter"
          value={selectedUnitId ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:hidden"
        >
          <option value="">Todas</option>
          {ranked.map(({ unit, score }) => (
            <option key={unit.client_id} value={unit.client_id}>
              {unitLabel(unit, score)}
            </option>
          ))}
        </select>
      )}
      {chips}
    </div>
  );
}
