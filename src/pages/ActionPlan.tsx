import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
} from 'lucide-react';
import type { Client, ClientActionEvidence, ClientActionItem, ClientActionItemStatus } from '../types';
import { ClientService } from '../services/clientService';
import {
  AppointmentAdminService,
  type ActionItemResponseSummary,
  type AdminActionCheckpoint,
} from '../services/appointmentAdminService';
import { errorMessage, formatDateBR, PAGE_SIZE, usePagedList } from '../components/schedules/appointmentRequestsShared';
import { EvidenceReview } from '../components/schedules/ActionPlanPanel';
import { usePromptDialog } from '../components/ui/usePromptDialog';
import { PageShell } from '../components/ui/PageShell';
import { toast } from '../store/useToastStore';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

type Segment = 'analise' | 'vencidas' | 'abertas' | 'concluidas';

const SEGMENT_LABELS: Record<Segment, string> = {
  analise: 'Para analisar',
  vencidas: 'Vencidas',
  abertas: 'Abertas',
  concluidas: 'Concluídas',
};

const SEGMENTS = Object.keys(SEGMENT_LABELS) as Segment[];

const PRIORITY_LABELS: Record<ClientActionItem['priority'], string> = {
  urgent: 'Urgente',
  important: 'Importante',
  recommended: 'Recomendada',
};

const PRIORITY_BADGE: Record<ClientActionItem['priority'], 'danger' | 'warning' | 'neutral'> = {
  urgent: 'danger',
  important: 'warning',
  recommended: 'neutral',
};

const CLIENT_STATUS_LABELS: Record<NonNullable<ClientActionItem['client_status']>, string> = {
  done: 'Já corrigiu',
  in_progress: 'Providenciando',
  not_done: 'Ainda não fez',
};

const CLIENT_STATUS_BADGE: Record<NonNullable<ClientActionItem['client_status']>, 'success' | 'warning' | 'danger'> = {
  done: 'success',
  in_progress: 'warning',
  not_done: 'danger',
};

/** Filtro pela resposta do cliente — a pergunta "o que ele me devolveu?", que a aba de prazo não responde. */
type ResponseFilter = '' | 'aguardando' | 'done' | 'in_progress' | 'not_done' | 'sem';

const RESPONSE_FILTER_LABELS: Record<ResponseFilter, string> = {
  '': 'Toda resposta do cliente',
  aguardando: 'Arquivo aguardando revisão',
  done: 'Declarou: já corrigiu',
  in_progress: 'Declarou: providenciando',
  not_done: 'Declarou: ainda não fez',
  sem: 'Sem resposta nenhuma',
};

const EMPTY_SUMMARY: ActionItemResponseSummary = {
  pendingEvidence: 0,
  totalEvidence: 0,
  lastEvidenceAt: null,
  checkpointsDone: 0,
  checkpointsTotal: 0,
};

function todayLocal(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isOverdue(item: ClientActionItem): boolean {
  if (item.status !== 'published' || !item.due_date) return false;
  return parseDateOnly(item.due_date) < todayLocal();
}

function daysOverdue(dueDate: string): number {
  const diff = todayLocal().getTime() - parseDateOnly(dueDate).getTime();
  return Math.round(diff / 86_400_000);
}

/**
 * A pendência está esperando **decisão da consultora**, não cobrança do cliente.
 *
 * Três coisas fazem o cliente "entregar": anexar arquivo (que nasce `pending`), declarar que já
 * corrigiu, ou marcar todos os tópicos da ação. "Providenciando" e "ainda não fez" ficam de fora
 * de propósito — são cobrança, e vivem nas abas de prazo. Assim a fila esvazia sozinha: aprovar,
 * devolver, resolver ou ocultar tira o item daqui.
 */
function awaitsReview(item: ClientActionItem, summary: ActionItemResponseSummary): boolean {
  if (item.status !== 'published') return false;
  if (summary.pendingEvidence > 0) return true;
  if (item.client_status === 'done') return true;
  return summary.checkpointsTotal > 0 && summary.checkpointsDone === summary.checkpointsTotal;
}

/**
 * As abas não são uma partição: "Para analisar" é outra lente sobre as mesmas linhas, e uma
 * pendência vencida com arquivo novo aparece nas duas. Era isso que faltava — a fila de análise
 * não cabia dentro de "vencidas / abertas / concluídas".
 */
function inSegment(item: ClientActionItem, segment: Segment, summary: ActionItemResponseSummary): boolean {
  if (segment === 'analise') return awaitsReview(item, summary);
  if (item.status === 'resolved') return segment === 'concluidas';
  if (item.status !== 'published') return false; // oculto — não aparece em nenhuma aba de prazo
  return segment === (isOverdue(item) ? 'vencidas' : 'abertas');
}

function matchesResponse(item: ClientActionItem, filter: ResponseFilter, summary: ActionItemResponseSummary): boolean {
  switch (filter) {
    case '':
      return true;
    case 'aguardando':
      return summary.pendingEvidence > 0;
    case 'sem':
      return !item.client_status && summary.totalEvidence === 0 && summary.checkpointsDone === 0;
    default:
      return item.client_status === filter;
  }
}

/**
 * FE-08 — plano de ação do admin. Lê `client_action_items` como fonte única (não a RPC
 * `admin_operational_overview`, que tem bugs conhecidos e fora de escopo aqui — ver
 * docs/HANDOFF-FRONTEND.md § "Fora de escopo"). Lista + detalhe: a tabela é o índice, o
 * `situation`/`recommended_action` inteiros aparecem no painel lateral, sem abrir relatório
 * e sem abrir inspeção.
 *
 * ACT-01 (27/08/2026) — a tela virou também a **fila de análise**: aba "Para analisar", filtro
 * por resposta do cliente, os tópicos que ele marcou no detalhe, e navegação Anterior/Próxima
 * dentro do modal, que avança sozinha depois de resolver. Antes, o único caminho até a resposta
 * do cliente era clicar num bloco do Início, um item por vez, sem saber quantos faltavam.
 */
export function ActionPlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<ClientActionItem[]>([]);
  const [summaries, setSummaries] = useState<Map<string, ActionItemResponseSummary>>(new Map());
  const [summaryReady, setSummaryReady] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState(searchParams.get('client') || '');
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>('');
  const [segment, setSegment] = useState<Segment>('analise');
  const [sortDir, setSortDir] = useState<'ascending' | 'descending'>('ascending');

  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('item'));
  const [evidence, setEvidence] = useState<ClientActionEvidence[]>([]);
  const [checkpoints, setCheckpoints] = useState<AdminActionCheckpoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const { prompt, promptDialog } = usePromptDialog();

  const summaryOf = useCallback(
    (itemId: string): ActionItemResponseSummary => summaries.get(itemId) || EMPTY_SUMMARY,
    [summaries]
  );

  const loadItems = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    AppointmentAdminService.listAllActionItems()
      .then(setItems)
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
    // O resumo da devolução é complementar: se falhar, a tela continua de pé com prazo,
    // prioridade e declaração — só a fila de análise fica sem os sinais de arquivo/tópico.
    AppointmentAdminService.listActionResponseSummary()
      .then(setSummaries)
      .catch((err) => console.warn('[ActionPlan] Falha ao carregar as respostas do cliente:', err))
      .finally(() => setSummaryReady(true));
  }, []);

  useEffect(() => {
    loadItems();
    ClientService.getClients()
      .then(setClients)
      .catch((err) => console.warn('[ActionPlan] Falha ao carregar clientes:', err));
  }, [loadItems]);

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const loadDetail = useCallback((itemId: string) => {
    setDetailLoading(true);
    Promise.all([
      AppointmentAdminService.listActionItemEvidence([itemId]),
      AppointmentAdminService.listActionItemCheckpoints(itemId),
    ])
      .then(([rows, points]) => {
        setEvidence(rows);
        setCheckpoints(points);
      })
      .catch((err) => console.warn('[ActionPlan] Falha ao carregar o detalhe da pendência:', err))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setEvidence([]);
      setCheckpoints([]);
    }
  }, [selectedId, loadDetail]);

  const searchFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (clientId && item.client_id !== clientId) return false;
      if (!matchesResponse(item, responseFilter, summaries.get(item.id) || EMPTY_SUMMARY)) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.situation.toLowerCase().includes(query) ||
        item.recommended_action.toLowerCase().includes(query)
      );
    });
  }, [items, clientId, responseFilter, search, summaries]);

  const counts = useMemo(() => {
    const result: Record<Segment, number> = { analise: 0, vencidas: 0, abertas: 0, concluidas: 0 };
    for (const item of searchFiltered) {
      const summary = summaries.get(item.id) || EMPTY_SUMMARY;
      for (const key of SEGMENTS) {
        if (inSegment(item, key, summary)) result[key] += 1;
      }
    }
    return result;
  }, [searchFiltered, summaries]);

  const segmentFiltered = useMemo(
    () => searchFiltered.filter((item) => inSegment(item, segment, summaries.get(item.id) || EMPTY_SUMMARY)),
    [searchFiltered, segment, summaries]
  );

  const sorted = useMemo(() => {
    const factor = sortDir === 'ascending' ? 1 : -1;
    return [...segmentFiltered].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return factor * (parseDateOnly(a.due_date).getTime() - parseDateOnly(b.due_date).getTime());
    });
  }, [segmentFiltered, sortDir]);

  const { page, totalPages, items: pagedItems, setPage } = usePagedList(
    sorted,
    `${clientId}|${search}|${responseFilter}|${segment}|${sortDir}`
  );

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) || null : null;

  // Continuidade: a fila é `sorted` inteira, não a página. Anterior/Próxima atravessam a
  // paginação, e a página segue o item aberto — senão a pessoa fecha o modal na pendência 11
  // e a tabela atrás dela ainda está na página 1.
  const queueIndex = selectedId ? sorted.findIndex((item) => item.id === selectedId) : -1;
  const nextInQueue = queueIndex >= 0 && queueIndex < sorted.length - 1 ? sorted[queueIndex + 1] : null;
  const prevInQueue = queueIndex > 0 ? sorted[queueIndex - 1] : null;

  useEffect(() => {
    if (queueIndex < 0) return;
    setPage(Math.floor(queueIndex / PAGE_SIZE) + 1);
  }, [queueIndex, setPage]);

  // Chegando por deep link (`?item=`, vindo do Início), a lista atrás do modal precisa estar na
  // aba do item — senão a pessoa fecha o detalhe e não acha a linha. Semeadura **uma vez**, e só
  // depois do resumo, porque é ele que diz se o item está na fila de análise; trocar de aba
  // depois disso é escolha dela.
  const deepLinkSeeded = useRef(false);
  useEffect(() => {
    if (deepLinkSeeded.current || !selectedItem || !summaryReady) return;
    deepLinkSeeded.current = true;
    const summary = summaries.get(selectedItem.id) || EMPTY_SUMMARY;
    const target = SEGMENTS.find((key) => inSegment(selectedItem, key, summary));
    if (target) setSegment(target);
  }, [selectedItem, summaryReady, summaries]);

  const changeStatus = async (item: ClientActionItem, status: ClientActionItemStatus) => {
    // O próximo da fila é decidido **antes** de recarregar: depois de resolver, o item sai da
    // aba e o índice já não aponta para lugar nenhum.
    const advanceTo = nextInQueue?.id ?? null;
    setSavingStatus(true);
    try {
      await AppointmentAdminService.setActionItemStatus(item.id, status);
      loadItems();
      setSelectedId(advanceTo);
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setSavingStatus(false);
    }
  };

  const filtering = !!search || !!clientId || !!responseFilter;

  return (
    <PageShell>
      <PageHeader
        title="Plano de ação"
        description="Uma linha por pendência, com o texto inteiro — sem abrir relatório e sem abrir inspeção."
        actions={
          <Button variant="outline" size="sm" onClick={loadItems} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          icon={<Search />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no texto da pendência"
          aria-label="Buscar pendência"
          wrapperClassName="flex-1 sm:max-w-xs"
        />
        <Select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-label="Cliente"
          className="w-auto"
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select
          value={responseFilter}
          onChange={(e) => setResponseFilter(e.target.value as ResponseFilter)}
          aria-label="Resposta do cliente"
          className="w-auto"
        >
          {(Object.keys(RESPONSE_FILTER_LABELS) as ResponseFilter[]).map((key) => (
            <option key={key} value={key}>{RESPONSE_FILTER_LABELS[key]}</option>
          ))}
        </Select>
        <div className="inline-flex gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5">
          {SEGMENTS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={segment === key}
              onClick={() => setSegment(key)}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                segment === key ? 'bg-surface text-primary-700 shadow-sm' : 'text-navy-3 hover:text-navy'
              }`}
            >
              {SEGMENT_LABELS[key]} <span className="tabular-nums">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {segment === 'analise' && (
        <p className="mb-3 text-sm text-navy-3">
          O que o cliente devolveu e está esperando você: arquivo aguardando revisão, “já corrigiu”
          declarado ou todos os tópicos marcados. Sai daqui quando você aprova, devolve, resolve ou
          oculta — e o modal já abre a próxima.
        </p>
      )}

      {loadError ? (
        <div className="rounded-md border border-danger-soft-border bg-danger-soft p-4 text-sm text-danger-soft-ink">
          Não deu para carregar o plano de ação: {loadError}
        </div>
      ) : loading && items.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pendência</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead
                  align="right"
                  sortDirection={sortDir}
                  onSort={() => setSortDir((d) => (d === 'ascending' ? 'descending' : 'ascending'))}
                >
                  Prazo
                </TableHead>
                <TableHead>Resposta do cliente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-auto py-0">
                    <EmptyState
                      icon={<ClipboardList className="h-8 w-8" />}
                      title={
                        segment === 'analise'
                          ? 'Nada esperando sua análise'
                          : `Nenhuma pendência ${SEGMENT_LABELS[segment].toLowerCase()}`
                      }
                      description={filtering ? 'Nenhum resultado para os filtros atuais.' : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item) => {
                  const overdue = isOverdue(item);
                  const summary = summaryOf(item.id);
                  return (
                    <TableRow
                      key={item.id}
                      selected={item.id === selectedId}
                      onClick={() => setSelectedId(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell primary className="max-w-[420px]">
                        <p className="truncate">{item.title}</p>
                        <p className="truncate text-xs font-normal text-navy-3">
                          {clientsById.get(item.client_id)?.name || 'Cliente'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_BADGE[item.priority]}>{PRIORITY_LABELS[item.priority]}</Badge>
                      </TableCell>
                      <TableCell align="right">
                        <span className="tabular-nums">{formatDateBR(item.due_date)}</span>
                        {overdue && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-sm border border-amber-soft-border bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-strong">
                            <AlertTriangle className="h-3 w-3" /> vencido
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.client_status ? (
                          <Badge variant={CLIENT_STATUS_BADGE[item.client_status]}>
                            {CLIENT_STATUS_LABELS[item.client_status]}
                          </Badge>
                        ) : (
                          <span className="text-navy-3">—</span>
                        )}
                        {(summary.pendingEvidence > 0 || summary.checkpointsTotal > 0) && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-navy-3">
                            {summary.pendingEvidence > 0 && (
                              <span className="inline-flex items-center gap-1 text-amber-strong">
                                <Paperclip className="h-3 w-3" />
                                {summary.pendingEvidence} para revisar
                              </span>
                            )}
                            {summary.checkpointsTotal > 0 && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <CheckSquare className="h-3 w-3" />
                                {summary.checkpointsDone}/{summary.checkpointsTotal} tópicos
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageCount={totalPages}
            onPageChange={setPage}
            totalItems={sorted.length}
            pageSize={PAGE_SIZE}
          />
        </TableContainer>
      )}

      <Modal
        isOpen={!!selectedItem}
        className="max-w-3xl"
        onClose={() => setSelectedId(null)}
        title={selectedItem?.title}
        footer={
          selectedItem && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prevInQueue}
                  onClick={() => prevInQueue && setSelectedId(prevInQueue.id)}
                  aria-label="Pendência anterior da fila"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-1 tabular-nums text-xs font-semibold text-navy-3" aria-live="polite">
                  {queueIndex >= 0 ? `${queueIndex + 1} de ${sorted.length}` : 'fora da fila'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nextInQueue}
                  onClick={() => nextInQueue && setSelectedId(nextInQueue.id)}
                  aria-label="Próxima pendência da fila"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {selectedItem.status !== 'published' ? (
                  <Button size="sm" disabled={savingStatus} onClick={() => void changeStatus(selectedItem, 'published')}>
                    {selectedItem.status === 'resolved' ? (
                      <><RotateCcw className="mr-2 h-4 w-4" /> Reabrir</>
                    ) : (
                      <><Eye className="mr-2 h-4 w-4" /> Publicar</>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" disabled={savingStatus} onClick={() => void changeStatus(selectedItem, 'hidden')}>
                      <EyeOff className="mr-2 h-4 w-4" /> Ocultar
                    </Button>
                    <Button size="sm" disabled={savingStatus} onClick={() => void changeStatus(selectedItem, 'resolved')}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Resolver
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        }
      >
        {selectedItem && (
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Situação encontrada</p>
              <p className="mt-1 text-navy">{selectedItem.situation}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">O que fazer</p>
              <p className="mt-1 text-navy">{selectedItem.recommended_action}</p>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Prazo</p>
                <p className="mt-1 tabular-nums text-navy">{formatDateBR(selectedItem.due_date)}</p>
                {isOverdue(selectedItem) && selectedItem.due_date && (
                  <p className="mt-0.5 text-xs font-semibold text-amber-strong">
                    Vencido há {daysOverdue(selectedItem.due_date)} dia(s)
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Responsável</p>
                <p className="mt-1 text-navy">{selectedItem.responsible || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Cliente</p>
                <button
                  type="button"
                  onClick={() => navigate(`/clients/${selectedItem.client_id}`)}
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-900"
                >
                  {clientsById.get(selectedItem.client_id)?.name || 'Ver cliente'}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {selectedItem.client_status && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">Resposta do cliente</p>
                <div className="mt-1 rounded-md border border-default bg-surface-sunken p-2.5">
                  <Badge variant={CLIENT_STATUS_BADGE[selectedItem.client_status]}>
                    {CLIENT_STATUS_LABELS[selectedItem.client_status]}
                  </Badge>
                  {selectedItem.client_status_note && (
                    <p className="mt-1.5 text-navy-2">“{selectedItem.client_status_note}”</p>
                  )}
                  {selectedItem.client_status_by_name && (
                    <p className="mt-1 text-xs text-navy-3">
                      — {selectedItem.client_status_by_name}
                      {selectedItem.client_status_by_role ? ` (${selectedItem.client_status_by_role})` : ''}
                      {selectedItem.client_status_at ? ` · ${formatDateBR(selectedItem.client_status_at)}` : ''}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* PORT-05 — o que o cliente marcou tópico a tópico. Sem isto, "Providenciando" esconde
                que dois dos três pontos já foram feitos, e é justamente o que muda a cobrança. */}
            {checkpoints.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-3">
                  Tópicos marcados pelo cliente{' '}
                  <span className="tabular-nums">
                    ({checkpoints.filter((point) => point.done).length}/{checkpoints.length})
                  </span>
                </p>
                <ul className="mt-1 space-y-1.5">
                  {checkpoints.map((point) => (
                    <li key={point.id} className="flex items-start gap-2">
                      {point.done ? (
                        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success-soft-ink" aria-hidden />
                      ) : (
                        <Square className="mt-0.5 h-4 w-4 shrink-0 text-navy-3" aria-hidden />
                      )}
                      <span className={point.done ? 'text-navy' : 'text-navy-2'}>
                        {point.text}
                        {point.done && point.doneByName && (
                          <span className="ml-1 text-xs text-navy-3">
                            — {point.doneByName}
                            {point.doneAt ? ` · ${formatDateBR(point.doneAt)}` : ''}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-3">Evidência</p>
              {detailLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-3" />
              ) : evidence.length === 0 ? (
                <p className="text-xs text-navy-3">Nenhuma evidência enviada.</p>
              ) : (
                <EvidenceReview
                  evidence={evidence}
                  onReviewed={() => {
                    loadDetail(selectedItem.id);
                    loadItems(); // a revisão muda o resumo: o item pode sair da fila de análise
                  }}
                  prompt={prompt}
                />
              )}
            </div>
          </div>
        )}
      </Modal>
      {promptDialog}
    </PageShell>
  );
}
