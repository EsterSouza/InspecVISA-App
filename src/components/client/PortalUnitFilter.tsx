import { Label } from '../ui/Label';
import { Select } from '../ui/Select';

export interface PortalUnitFilterEntry {
  id: string;
  name: string;
  /** Pendências abertas nesta unidade — o número que acompanha o chip/option. */
  count: number;
}

interface PortalUnitFilterProps {
  /** Já ordenadas pelo chamador — pior primeiro. */
  entries: PortalUnitFilterEntry[];
  totalCount: number;
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

/** Acima disso os chips somem no celular e viram lista suspensa — não cabem mais numa ou duas linhas. */
const CHIP_TO_SELECT_THRESHOLD = 6;

export function PortalUnitFilter({ entries, totalCount, selectedId, onChange }: PortalUnitFilterProps) {
  if (entries.length <= 1) return null;

  const showSelectOnMobile = entries.length > CHIP_TO_SELECT_THRESHOLD;

  const chipClass = (active: boolean) =>
    `inline-flex h-[34px] items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors ${
      active
        ? 'border-primary-700 bg-primary-700 text-white'
        : 'border-control bg-surface text-navy-2 hover:border-navy-3'
    }`;

  return (
    <div className="mb-5">
      <Label htmlFor="portal-unit-filter" className="mb-2">
        Unidade
      </Label>

      {showSelectOnMobile && (
        <Select
          id="portal-unit-filter"
          value={selectedId ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          wrapperClassName="mb-5 sm:hidden"
        >
          <option value="">Todas as unidades ({totalCount})</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} ({entry.count})
            </option>
          ))}
        </Select>
      )}

      <div className={`flex flex-wrap gap-2 ${showSelectOnMobile ? 'hidden sm:flex' : ''}`}>
        <button type="button" onClick={() => onChange(null)} className={chipClass(selectedId === null)}>
          Todas as unidades
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              selectedId === null ? 'bg-surface/20 text-white' : 'bg-surface-sunken text-navy-2'
            }`}
          >
            {totalCount}
          </span>
        </button>
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onChange(entry.id)}
            className={chipClass(selectedId === entry.id)}
          >
            {entry.name}
            <span
              className={`rounded-sm px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                selectedId === entry.id ? 'bg-surface/20 text-white' : 'bg-surface-sunken text-navy-2'
              }`}
            >
              {entry.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
