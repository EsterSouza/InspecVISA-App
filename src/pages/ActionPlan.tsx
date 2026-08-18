import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { Client, ClientActionEvidence, ClientActionItem, ClientActionItemStatus } from '../types';
import { ClientService } from '../services/clientService';
import { AppointmentAdminService } from '../services/appointmentAdminService';
import { errorMessage, formatDateBR, usePagedList } from '../components/schedules/appointmentRequestsShared';
import { EvidenceReview } from '../components/schedules/ActionPlanPanel';
import { usePromptDialog } from '../components/ui/PromptDialog';
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

type Segment = 'vencidas' | 'abertas' | 'concluidas';

const SEGMENT_LABELS: Record<Segment, string> = {
  vencidas: 'Vencidas',
  abertas: 'Abertas',
  concluidas: 'Concluídas',
};

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

function segmentOf(item: ClientActionItem): Segment | null {
  if (item.status === 'resolved') return 'concluidas';
  if (item.status === 'published') return isOverdue(item) ? 'vencidas' : 'abertas';
  return null; // oculto — não aparece em nenhum segmento desta tela
}

/**
 * FE-08 — plano de ação do admin. Lê `client_action_items` como fonte única (não a RPC
 * `admin_operational_overview`, que tem bugs conhecidos e fora de escopo aqui — ver
 * docs/HANDOFF-FRONTEND.md § "Fora de escopo"). Lista + detalhe: a tabela é o índice, o
 * `situation`/`recommended_action` inteiros aparecem no painel lateral, sem abrir relatório
 * e sem abrir inspeção — mesmo texto do card.
 */
export function ActionPlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<ClientActionItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState(searchParams.get('client') || '');
  const [segment, setSegment] = useState<Segment>('vencidas');
  const [sortDir, setSortDir] = useState<'ascending' | 'descending'>('ascending');

  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('item'));
  const [evidence, setEvidence] = useState<ClientActionEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const { prompt, promptDialog } = usePromptDialog();

  const loadItems = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    AppointmentAdminService.listAllActionItems()
      .then(setItems)
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadItems();
    ClientService.getClients()
      .then(setClients)
      .catch((err) => console.warn('[ActionPlan] Falha ao carregar clientes:', err));
  }, [loadItems]);

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const loadEvidence = useCallback((itemId: string) => {
    setEvidenceLoading(true);
    AppointmentAdminService.listActionItemEvidence([itemId])
      .then(setEvidence)
      .catch((err) => console.warn('[ActionPlan] Falha ao carregar evidências:', err))
      .finally(() => setEvidenceLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId) loadEvidence(selectedId);
    else setEvidence([]);
  }, [selectedId, loadEvidence]);

  const searchFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (clientId && item.client_id !== clientId) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.situation.toLowerCase().includes(query) ||
        item.recommended_action.toLowerCase().includes(query)
      );
    });
  }, [items, clientId, search]);

  const counts = useMemo(() => {
    const result: Record<Segment, number> = { vencidas: 0, abertas: 0, concluidas: 0 };
    for (const item of searchFiltered) {
      const s = segmentOf(item);
      if (s) result[s] += 1;
    }
    return result;
  }, [searchFiltered]);

  const segmentFiltered = useMemo(
    () => searchFiltered.filter((item) => segmentOf(item) === segment),
    [searchFiltered, segment]
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

  const { page, totalPages, items: pagedItems, setPage } = usePagedList(sorted);

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) || null : null;

  // Chegando por deep link (`?item=`, vindo do Painel), a lista atrás da gaveta precisa estar no
  // segmento do item — senão a pessoa fecha o detalhe e não acha a linha, porque o padrão da tela
  // é "vencidas" e a evidência costuma vir de item ainda no prazo. Semeadura **uma vez**: trocar
  // de aba depois disso é escolha dela.
  const deepLinkSeeded = useRef(false);
  useEffect(() => {
    if (deepLinkSeeded.current || !selectedItem) return;
    deepLinkSeeded.current = true;
    const target = segmentOf(selectedItem);
    if (target) setSegment(target);
  }, [selectedItem]);

  const changeStatus = async (item: ClientActionItem, status: ClientActionItemStatus) => {
    setSavingStatus(true);
    try {
      await AppointmentAdminService.setActionItemStatus(item.id, status);
      loadItems();
    } catch (err) {
      toast.error('Erro', errorMessage(err));
    } finally {
      setSavingStatus(false);
    }
  };

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
        <div className="inline-flex gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5">
          {(Object.keys(SEGMENT_LABELS) as Segment[]).map((key) => (
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
                      title={`Nenhuma pendência ${SEGMENT_LABELS[segment].toLowerCase()}`}
                      description={search || clientId ? 'Nenhum resultado para os filtros atuais.' : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item) => {
                  const overdue = isOverdue(item);
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
            pageSize={10}
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

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-3">Evidência</p>
              {evidenceLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-3" />
              ) : evidence.length === 0 ? (
                <p className="text-xs text-navy-3">Nenhuma evidência enviada.</p>
              ) : (
                <EvidenceReview evidence={evidence} onReviewed={() => loadEvidence(selectedItem.id)} prompt={prompt} />
              )}
            </div>
          </div>
        )}
      </Modal>
      {promptDialog}
    </PageShell>
  );
}
