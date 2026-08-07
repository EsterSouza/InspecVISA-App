import { useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, UserRound } from 'lucide-react';
import type { ClientPortalActionItem } from '../../services/clientPortalService';
import type { ClientActionItemPriority } from '../../types';
import { formatDateBR } from '../../utils/clientPortalFormat';

/** Acima disso a lista começa recolhida — o plano de ação de uma rede passa fácil de 30 itens. */
const COMPACT_THRESHOLD = 5;

const priorityLabel: Record<ClientActionItemPriority, string> = {
  urgent: 'Urgente',
  important: 'Importante',
  recommended: 'Recomendada',
};

const priorityTheme: Record<ClientActionItemPriority, string> = {
  urgent: 'bg-red-100 text-red-700',
  important: 'bg-amber-100 text-amber-700',
  recommended: 'bg-sky-100 text-sky-700',
};

interface PortalActionPlanProps {
  items: ClientPortalActionItem[];
  loading?: boolean;
  error?: boolean;
  /** Só faz sentido rotular a unidade quando o cliente enxerga mais de uma. */
  showUnitName?: boolean;
}

function ActionItemCard({ item, showUnitName }: { item: ClientPortalActionItem; showUnitName?: boolean }) {
  const resolved = item.status === 'resolved';
  return (
    <li
      className={`rounded-lg border p-3 ${
        resolved ? 'border-gray-100 bg-gray-50' : item.is_overdue ? 'border-red-200 bg-red-50/60' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityTheme[item.priority]}`}>
          {priorityLabel[item.priority]}
        </span>
        {resolved ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
            {item.resolved_at ? ` em ${formatDateBR(item.resolved_at)}` : ''}
          </span>
        ) : (
          item.is_overdue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Prazo vencido
            </span>
          )
        )}
        {item.occurrence_count > 1 && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
            Reincidente ({item.occurrence_count}x)
          </span>
        )}
        {showUnitName && <span className="text-[11px] font-medium text-gray-500">{item.unit_name}</span>}
      </div>

      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
      <p className="mt-1 text-xs text-gray-600">{item.situation}</p>
      <p className="mt-1.5 text-xs text-gray-800">
        <span className="font-semibold">O que fazer: </span>
        {item.recommended_action}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          {item.due_date ? `Prazo ${formatDateBR(item.due_date)}` : 'Prazo a combinar'}
        </span>
        {item.responsible && (
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" /> {item.responsible}
          </span>
        )}
      </div>
    </li>
  );
}

export function PortalActionPlan({ items, loading, error, showUnitName }: PortalActionPlanProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <section className="mb-6 h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-50" aria-hidden="true" />;
  }

  if (error) {
    return (
      <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        Não foi possível carregar o plano de ação agora. Atualize a página ou fale com a equipe da consultoria.
      </section>
    );
  }

  if (items.length === 0) return null;

  const open = items.filter((item) => item.status !== 'resolved');
  const resolved = items.filter((item) => item.status === 'resolved');
  const overdue = open.filter((item) => item.is_overdue).length;
  const compact = open.length > COMPACT_THRESHOLD && !expanded;
  const visible = compact ? open.slice(0, COMPACT_THRESHOLD) : open;

  return (
    <section aria-labelledby="portal-action-plan" className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3
          id="portal-action-plan"
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700"
        >
          <ClipboardList className="h-4 w-4 text-primary-700" /> Plano de ação
        </h3>
        <span className="text-xs font-medium text-gray-500">
          {open.length} pendente{open.length === 1 ? '' : 's'}
          {overdue > 0 && <span className="ml-1 font-bold text-red-700">· {overdue} vencida(s)</span>}
          {resolved.length > 0 && <span className="ml-1">· {resolved.length} concluída(s)</span>}
        </span>
      </div>

      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Nenhuma pendência em aberto. Tudo que foi apontado já está concluído.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <ActionItemCard key={item.id} item={item} showUnitName={showUnitName} />
          ))}
        </ul>
      )}

      {open.length > COMPACT_THRESHOLD && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 text-xs font-semibold text-primary-700 hover:text-primary-900"
        >
          {compact ? `Ver todas as ${open.length} pendências` : 'Mostrar menos'}
        </button>
      )}

      {resolved.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700">
            Histórico · {resolved.length} pendência(s) concluída(s)
          </summary>
          <ul className="mt-2 space-y-2">
            {resolved.map((item) => (
              <ActionItemCard key={item.id} item={item} showUnitName={showUnitName} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
