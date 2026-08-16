import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Headset,
  Inbox,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
} from 'lucide-react';
import {
  OperationalOverviewService,
  type OperationalBlock,
  type OperationalBlockCount,
  type OperationalCounts,
  type OperationalItem,
  type OperationalItemFilters,
  type OperationalItemsResult,
} from '../../services/operationalOverviewService';
import { AppointmentAdminService } from '../../services/appointmentAdminService';
import { requestDateTimeValue } from '../schedules/appointmentRequestsShared';

/**
 * As 7 filas do antigo `/painel` (P360-013), absorvidas pelo Início (FE-14). O filtro de
 * consultora, unidade e janela de dias mora no `Dashboard.tsx` — este componente só recebe os
 * valores já resolvidos e cuida da contagem + expansão de cada bloco. Cada bloco carrega de
 * forma independente: uma falha aqui nunca deve tocar o estado de outro bloco.
 */

interface BlockConfig {
  key: OperationalBlock;
  label: string;
  description: string;
  icon: typeof CalendarClock;
  accent: string;
  link?: (item: OperationalItem) => string;
}

const TECHNICAL_BLOCKS: BlockConfig[] = [
  {
    key: 'appointments',
    label: 'Compromissos próximos',
    description: 'Agenda dos próximos dias, de todos os tipos de visita.',
    icon: CalendarClock,
    accent: 'text-sky-700 bg-sky-50 border-sky-200',
    link: (item) => `/schedules?scheduleId=${item.id}`,
  },
  {
    key: 'appointment_requests_pending',
    label: 'Pedidos de agendamento',
    description: 'Visitas pedidas pelo portal público, ainda sem confirmação.',
    icon: Inbox,
    accent: 'text-amber-700 bg-amber-50 border-amber-200',
    link: (item) => `/schedules?tab=solicitacoes&requestId=${item.id}`,
  },
  {
    key: 'requests_new',
    label: 'Solicitações novas',
    description: 'Ninguém assumiu ainda.',
    icon: Headset,
    accent: 'text-primary-700 bg-primary-50 border-primary-200',
    link: (item) => `/requests?id=${item.id}`,
  },
  {
    key: 'awaiting_client',
    label: 'Clientes aguardando resposta',
    description: 'A bola está com o cliente.',
    icon: MessageCircleQuestion,
    accent: 'text-amber-700 bg-amber-50 border-amber-200',
    link: (item) => `/requests?id=${item.id}`,
  },
  {
    key: 'evidence_pending',
    label: 'Evidências aguardando revisão',
    description: 'Prova de correção enviada pelo cliente, ainda sem retorno técnico.',
    icon: FileWarning,
    accent: 'text-violet-700 bg-violet-50 border-violet-200',
    link: (item) => `/clients/${item.client_id}`,
  },
  {
    key: 'action_items_overdue',
    label: 'Planos de ação vencidos',
    description: 'Prazo publicado no portal já passou.',
    icon: AlertTriangle,
    accent: 'text-red-700 bg-red-50 border-red-200',
    link: (item) => `/plano-de-acao?item=${item.id}`,
  },
];

const FINANCIAL_BLOCK: BlockConfig = {
  key: 'financial_pending',
  label: 'Pendências financeiras',
  description: 'Contas com pagamento em atraso além da carência configurada.',
  icon: Banknote,
  accent: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  // Uma conta pode cobrir várias unidades — não há um único "registro de origem" para linkar.
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * "Pedidos de agendamento" não tem RPC própria — `appointment_requests` já é de leitura direta
 * para staff (mesma tabela que `AppointmentAdminService.listRequests()` usa em Agendamentos), e
 * criar uma sétima entrada nas duas funções `admin_operational_*` exigiria migration só pra isso.
 * Filtra e pagina no cliente; volume esperado (solicitações pendentes) é baixo.
 */
async function pendingAppointmentRequestItems(filters: OperationalItemFilters): Promise<OperationalItemsResult> {
  const all = await AppointmentAdminService.listRequests();
  const consultant = filters.consultantName?.trim().toLowerCase() || null;
  // Mesma ordenação de "Solicitações pendentes" (`AppointmentRequestsPanel`), pra o pedido
  // aparecer na mesma posição relativa nas duas telas.
  const filtered = all
    .filter((r) => r.status === 'requested')
    .filter((r) => !filters.clientId || r.client_id === filters.clientId)
    .filter((r) => !consultant || (r.preferred_consultant_name || '').trim().toLowerCase() === consultant)
    .sort((a, b) => requestDateTimeValue(b) - requestDateTimeValue(a));

  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  const items: OperationalItem[] = filtered.slice(offset, offset + limit).map((r) => ({
    id: r.id,
    client_id: r.client_id || '',
    client_name: r.unit_name,
    title: r.unit_name,
    type: r.appointment_type,
    // `requestDateTimeValue` já trata o caso sem `requested_starts_at` (data+período sem hora
    // exata) como horário local — evitar remontar a string aqui de novo, que vira meia-noite UTC
    // e mostra o dia errado em fuso negativo.
    due_at: new Date(requestDateTimeValue(r)).toISOString(),
    responsible: r.preferred_consultant_name,
  }));
  return { items, total_count: filtered.length };
}

interface BlockState {
  items: OperationalItem[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  expanded: boolean;
}

const EMPTY_BLOCK_STATE: BlockState = { items: [], totalCount: 0, loading: false, error: null, expanded: false };

const EMPTY_BLOCK_STATES: Record<OperationalBlock, BlockState> = {
  appointments: EMPTY_BLOCK_STATE,
  appointment_requests_pending: EMPTY_BLOCK_STATE,
  requests_new: EMPTY_BLOCK_STATE,
  awaiting_client: EMPTY_BLOCK_STATE,
  evidence_pending: EMPTY_BLOCK_STATE,
  action_items_overdue: EMPTY_BLOCK_STATE,
  financial_pending: EMPTY_BLOCK_STATE,
};

function ItemRow({
  item,
  block,
  config,
}: {
  item: OperationalItem;
  block: OperationalBlock;
  config: BlockConfig;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-gray-900">
          {item.title || item.account_name || 'Sem título'}
        </p>
        <p className="truncate text-[11px] text-gray-500">
          {item.client_name || (item.client_names && item.client_names.join(', ')) || ''}
          {item.type ? ` · ${item.type}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-semibold text-gray-600">
          {block === 'appointments' || block === 'appointment_requests_pending'
            ? formatDateTime(item.due_at)
            : formatDate(item.due_at)}
        </p>
        {(item.responsible || item.assigned_to) && (
          <p className="text-[10px] text-gray-400">{item.responsible || item.assigned_to}</p>
        )}
      </div>
    </>
  );

  const rowClass = 'flex w-full items-center gap-3 rounded-lg border border-gray-100 bg-white p-2.5 text-left hover:bg-gray-50';

  return config.link ? (
    <Link to={config.link(item)} className={rowClass}>
      {content}
    </Link>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}

function BlockCard({
  config,
  count,
  state,
  onToggle,
  onLoadMore,
}: {
  config: BlockConfig;
  count: OperationalCounts[OperationalBlock] | undefined;
  state: BlockState;
  onToggle: () => void;
  onLoadMore: () => void;
}) {
  const Icon = config.icon;
  const hasError = count?.error;

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${hasError ? 'border-red-200' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${config.accent}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-bold text-gray-900">{config.label}</p>
            <p className="text-[11px] text-gray-500">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasError ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              indisponível
            </span>
          ) : count?.count === undefined ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-sm font-black ${
                count.count > 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {count.count}
            </span>
          )}
          {state.expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {state.expanded && (
        <div className="space-y-2 border-t border-dashed border-gray-200 p-3">
          {state.loading && state.items.length === 0 ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : state.error ? (
            <p className="rounded-md border border-red-100 bg-red-50 p-2.5 text-xs text-red-700">
              Não deu para carregar esta lista agora: {state.error}
            </p>
          ) : state.items.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">Nada por aqui.</p>
          ) : (
            <>
              {state.items.map((item) => (
                <ItemRow key={item.id} item={item} block={config.key} config={config} />
              ))}
              {state.items.length < state.totalCount && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={state.loading}
                  className="w-full rounded-md border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {state.loading ? 'Carregando…' : `Carregar mais (${state.totalCount - state.items.length} restantes)`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export interface OperationalQueuesProps {
  consultantName: string | null;
  clientId: string | null;
  daysAhead: number;
}

export function OperationalQueues({ consultantName, clientId, daysAhead }: OperationalQueuesProps) {
  const [counts, setCounts] = useState<OperationalCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [blockStates, setBlockStates] = useState<Record<OperationalBlock, BlockState>>(EMPTY_BLOCK_STATES);

  const filters = useMemo(
    () => ({ consultantName, clientId, daysAhead }),
    [consultantName, clientId, daysAhead]
  );

  const loadCounts = useCallback(() => {
    setCountsLoading(true);
    setCountsError(null);
    Promise.allSettled([
      OperationalOverviewService.counts(filters),
      pendingAppointmentRequestItems({ ...filters, limit: 1 }),
    ]).then(([baseResult, pendingResult]) => {
      if (baseResult.status === 'rejected') {
        setCountsError(errorMessage(baseResult.reason));
      }
      const base = baseResult.status === 'fulfilled' ? baseResult.value : ({} as OperationalCounts);
      const pendingCount: OperationalBlockCount =
        pendingResult.status === 'fulfilled' ? { count: pendingResult.value.total_count } : { error: true };
      setCounts({ ...base, appointment_requests_pending: pendingCount });
      setCountsLoading(false);
    });
  }, [filters]);

  useEffect(() => {
    loadCounts();
    // Trocar filtro fecha as listas expandidas: o que estava carregado não reflete mais o filtro novo.
    setBlockStates(EMPTY_BLOCK_STATES);
  }, [loadCounts]);

  // Cada bloco busca de forma isolada: uma falha aqui nunca deve tocar o estado de outro bloco.
  const loadBlockItems = useCallback(
    (block: OperationalBlock, append: boolean) => {
      setBlockStates((prev) => ({ ...prev, [block]: { ...prev[block], loading: true, error: null } }));
      const offset = append ? blockStates[block].items.length : 0;
      const request =
        block === 'appointment_requests_pending'
          ? pendingAppointmentRequestItems({ ...filters, offset })
          : OperationalOverviewService.items(block, { ...filters, offset });
      request
        .then((result) => {
          setBlockStates((prev) => ({
            ...prev,
            [block]: {
              ...prev[block],
              items: append ? [...prev[block].items, ...result.items] : result.items,
              totalCount: result.total_count,
              loading: false,
              error: null,
            },
          }));
        })
        .catch((err) => {
          setBlockStates((prev) => ({
            ...prev,
            [block]: { ...prev[block], loading: false, error: errorMessage(err) },
          }));
        });
    },
    [filters, blockStates]
  );

  const toggleBlock = (block: OperationalBlock) => {
    setBlockStates((prev) => {
      const next = { ...prev[block], expanded: !prev[block].expanded };
      return { ...prev, [block]: next };
    });
    const alreadyLoaded = blockStates[block].items.length > 0 || blockStates[block].error;
    if (!blockStates[block].expanded && !alreadyLoaded) {
      loadBlockItems(block, false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
          O que exige ação agora
        </h2>
        <button
          type="button"
          onClick={loadCounts}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {countsError && (
        <p className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-700">
          Não deu para carregar os números do painel: {countsError}
        </p>
      )}

      <div className="space-y-2.5">
        {TECHNICAL_BLOCKS.map((config) => (
          <BlockCard
            key={config.key}
            config={config}
            count={counts?.[config.key]}
            state={blockStates[config.key]}
            onToggle={() => toggleBlock(config.key)}
            onLoadMore={() => loadBlockItems(config.key, true)}
          />
        ))}
      </div>

      <div className="mb-2 mt-6 flex items-center gap-2">
        <span className="h-px flex-1 bg-emerald-200" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Financeiro</span>
        <span className="h-px flex-1 bg-emerald-200" />
      </div>
      <p className="mb-2.5 text-[11px] text-gray-400">
        Separado de propósito: pendência de pagamento não é demanda técnica, e o filtro de
        consultora não se aplica aqui — atraso é da conta, não de quem atende.
      </p>
      <BlockCard
        config={FINANCIAL_BLOCK}
        count={counts?.financial_pending}
        state={blockStates.financial_pending}
        onToggle={() => toggleBlock('financial_pending')}
        onLoadMore={() => loadBlockItems('financial_pending', true)}
      />

      {countsLoading && !counts && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      )}
    </div>
  );
}
