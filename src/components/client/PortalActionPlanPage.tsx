import { useEffect, useMemo, useRef } from 'react';
import type { ClientPortalActionItem, ClientPortalOverview } from '../../services/clientPortalService';
import {
  computeUnitActionStats,
  sortUnitStatsByAttention,
  unitShareUrl,
  type UnitActionStats,
} from '../../utils/clientPortalFormat';
import { PortalUnitFilter, type PortalUnitFilterEntry } from './PortalUnitFilter';
import { UnitCompletionList } from './UnitCompletionList';
import { PortalActionPlan, type DeclareStatusHandler, type SubmitEvidenceHandler } from './PortalActionPlan';

interface PortalActionPlanPageProps {
  overview: ClientPortalOverview;
  /** Sempre a conta inteira — o comparativo e os chips dependem de ver todas as unidades. */
  actionItems: ClientPortalActionItem[];
  actionItemsError: boolean;
  /** Só populado quando `selectedUnitId` está definido — busca real via `p_client_id`. */
  unitActionItems: ClientPortalActionItem[];
  unitActionItemsLoading: boolean;
  selectedUnitId: string | null;
  onUnitFilterChange: (unitId: string | null) => void;
  onSubmitEvidence: SubmitEvidenceHandler;
  onDeclareStatus: DeclareStatusHandler;
  onRetry: () => void;
}

/**
 * O filtro de unidade só existe dentro desta página (protótipo FE-03) — ao sair, volta pra
 * "Todas as unidades" pra Visão geral e o selo do menu nunca mostrarem o recorte de uma
 * unidade só como se fosse o total da conta.
 */
export function PortalActionPlanPage({
  overview,
  actionItems,
  actionItemsError,
  unitActionItems,
  unitActionItemsLoading,
  selectedUnitId,
  onUnitFilterChange,
  onSubmitEvidence,
  onDeclareStatus,
  onRetry,
}: PortalActionPlanPageProps) {
  useEffect(() => {
    return () => onUnitFilterChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clicar num nome em "Comparativo de cumprimento" só troca o filtro — a URL não muda e a
  // lista filtrada pode ficar fora da tela, então sem isso parece que o clique não fez nada.
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedUnitId) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedUnitId]);

  const isMulti = overview.units.length > 1;
  const stats = useMemo(() => computeUnitActionStats(actionItems), [actionItems]);
  const sortedStats = useMemo(() => sortUnitStatsByAttention(stats), [stats]);
  const shareUrlByUnit = useMemo(
    () => Object.fromEntries(overview.units.map((u) => [u.client_id, unitShareUrl(u)])),
    [overview.units]
  );

  const filterEntries: PortalUnitFilterEntry[] = useMemo(() => {
    const byId = new Map(stats.map((s) => [s.clientId, s]));
    return overview.units
      .map((unit) => byId.get(unit.client_id))
      .filter((s): s is UnitActionStats => !!s && s.open > 0)
      .map((s) => ({ id: s.clientId, name: s.unitName, count: s.open }));
  }, [overview.units, stats]);

  const totalOpen = stats.reduce((sum, s) => sum + s.open, 0);
  const displayedItems = selectedUnitId ? unitActionItems : actionItems;
  const displayedLoading = selectedUnitId ? unitActionItemsLoading : false;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-title text-2xl font-semibold text-navy">Plano de ação</h1>
        <p className="mt-1 max-w-[72ch] text-sm text-navy-2">
          Tudo que a consultoria apontou{isMulti ? ', agrupado por unidade' : ''}. Responda direto
          aqui — não precisa esperar a próxima visita.
        </p>
      </div>

      {isMulti && (
        <PortalUnitFilter
          entries={filterEntries}
          totalCount={totalOpen}
          selectedId={selectedUnitId}
          onChange={onUnitFilterChange}
        />
      )}

      {isMulti && sortedStats.length > 0 && (
        <div className="mb-6 rounded-lg border border-default bg-surface shadow-sm">
          <div className="border-b border-default px-4 py-3">
            <h2 className="font-title text-base font-semibold text-navy">Comparativo de cumprimento</h2>
          </div>
          <div className="p-4">
            <p className="mb-3 text-xs text-navy-2">
              Ordenado da unidade que mais precisa de atenção para a que menos precisa.
            </p>
            <UnitCompletionList stats={sortedStats} onSelect={onUnitFilterChange} shareUrlByUnit={shareUrlByUnit} />
          </div>
        </div>
      )}

      <div ref={resultsRef} />
      <PortalActionPlan
        items={displayedItems}
        loading={displayedLoading}
        error={actionItemsError}
        groupByUnit={isMulti && !selectedUnitId}
        onSelectUnit={onUnitFilterChange}
        onSubmitEvidence={onSubmitEvidence}
        onDeclareStatus={onDeclareStatus}
        onRetry={onRetry}
        alwaysShow
        defaultAuthorName={overview.account_name}
      />
    </div>
  );
}
