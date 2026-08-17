import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FilterX,
  Headset,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react';
import type {
  Client,
  ServiceRequest,
  ServiceRequestEvent,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '../types';
import { ClientService } from '../services/clientService';
import { ServiceRequestService } from '../services/serviceRequestService';
import { AppointmentAdminService } from '../services/appointmentAdminService';
import { getLocalActor } from '../utils/localActor';
import {
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_CATEGORY_LABELS,
  SERVICE_REQUEST_PRIORITY_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  serviceRequestWaitingOn,
} from '../utils/serviceRequests';
import { usePagedList } from '../components/schedules/appointmentRequestsShared';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Pagination } from '../components/ui/Pagination';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

/**
 * P360-012 — painel interno das solicitações.
 *
 * A tela é organizada pela pergunta que a consultora faz cem vezes por dia: **o que depende de
 * mim?** Por isso a separação primária não é por status nem por cliente, e sim por quem está
 * esperando — a fila da equipe primeiro, a do cliente depois, e o encerrado fora do caminho.
 *
 * Esta página fica FORA de Agendamentos de propósito (critério de aceite do card): solicitação
 * não é compromisso, não tem data nem duração, e misturar as duas listas foi exatamente o que
 * fez o WhatsApp virar o canal padrão.
 *
 * FE-17 — a lista de cards virou tabela densa (Table/Pagination do FE-04b). Histórico, nota e
 * as ações menos usadas (perguntar ao cliente, reatribuir, mudar prioridade) saíram do card
 * expansível e foram para um Drawer por linha, mesmo padrão do ActionPlan.tsx (FE-08).
 */

const CONSULTANTS = ['Ester Caiafa', 'Ana Roberta Ribeiro'];

type QueueFilter = 'team' | 'client' | 'closed' | 'all';

const QUEUE_LABELS: Record<QueueFilter, string> = {
  team: 'Aguardando a equipe',
  client: 'Aguardando o cliente',
  closed: 'Encerradas',
  all: 'Todas',
};

const QUEUE_STATUSES: Record<QueueFilter, ServiceRequestStatus[] | undefined> = {
  team: ['open', 'in_progress'],
  client: ['awaiting_client'],
  closed: ['resolved', 'cancelled'],
  all: undefined,
};

const statusTheme: Record<ServiceRequestStatus, string> = {
  open: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-primary-100 text-accent-ink',
  awaiting_client: 'bg-amber-soft text-amber-soft-ink',
  resolved: 'bg-success-soft text-success-soft-ink',
  cancelled: 'bg-surface-sunken text-navy-2',
};

const priorityTheme: Record<ServiceRequestPriority, string> = {
  low: 'bg-surface-sunken text-navy-2',
  normal: 'bg-surface-sunken text-navy-2',
  high: 'bg-amber-soft text-amber-soft-ink',
  urgent: 'bg-danger-soft text-danger-soft-ink',
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatDateTimeBR(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateBR(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Há quantos dias parada — é o número que decide o que a consultora abre primeiro. */
function daysSince(value: string): number {
  const diff = Date.now() - new Date(value).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

// ─── Detalhe de uma solicitação (Drawer) ──────────────────────────────────────

function RequestDetail({
  request,
  unitName,
  onChanged,
}: {
  request: ServiceRequest;
  unitName: string;
  onChanged: () => void;
}) {
  const [events, setEvents] = useState<ServiceRequestEvent[]>([]);
  const [note, setNote] = useState('');
  const [noteVisible, setNoteVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);

  const waitingOn = serviceRequestWaitingOn(request.status);
  const stalled = daysSince(request.last_event_at);

  const loadEvents = useCallback(() => {
    ServiceRequestService.events(request.id)
      .then(setEvents)
      .catch((err) => console.warn('[ServiceRequests] Falha ao carregar o historico:', err));
  }, [request.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const apply = async (changes: Parameters<typeof ServiceRequestService.update>[1], notify = false) => {
    setBusy(true);
    setError(null);
    setWhatsappLink(null);
    try {
      await ServiceRequestService.update(request.id, changes);
      // Avisar o cliente é sempre depois: a mudança já está gravada, e falhar o e-mail não
      // pode desfazer a decisão nem fazer a consultora repetir o gesto.
      if (notify) {
        const result = await ServiceRequestService.notifyClient(request.id);
        setWhatsappLink(result?.whatsappLink || null);
      }
      setNote('');
      setNoteVisible(false);
      loadEvents();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const askClient = () => {
    if (!note.trim()) {
      setError('Diga ao cliente o que você precisa que ele responda.');
      return;
    }
    void apply({ status: 'awaiting_client', note: note.trim(), noteVisibleToClient: true }, true);
  };

  const openAttachment = async () => {
    try {
      const url = await ServiceRequestService.attachmentUrl(request);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-bold text-navy-2">
          Nº {request.request_number}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTheme[request.status]}`}>
          {SERVICE_REQUEST_STATUS_LABELS[request.status]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityTheme[request.priority]}`}>
          {SERVICE_REQUEST_PRIORITY_LABELS[request.priority]}
        </span>
        <span className="text-[11px] font-medium text-navy-3">
          {SERVICE_REQUEST_CATEGORY_LABELS[request.category]}
        </span>
        <span className="text-[11px] text-navy-3">· {unitName}</span>
      </div>

      <p className="whitespace-pre-wrap text-sm text-navy-2">{request.description}</p>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-navy-3">
        <span>Aberta em {formatDateTimeBR(request.created_at)}</span>
        <span>· Última movimentação {formatDateTimeBR(request.last_event_at)}</span>
        {waitingOn !== 'none' && stalled >= 3 && (
          <span className="font-bold text-amber-soft-ink">· parada há {stalled} dias</span>
        )}
        {request.sla_hint_date && waitingOn !== 'none' && (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> retorno prometido até {request.sla_hint_date.split('-').reverse().join('/')}
          </span>
        )}
        {request.opened_by_name && (
          <span>· por {request.opened_by_name}{request.opened_by_role ? ` (${request.opened_by_role})` : ''}</span>
        )}
      </p>

      {request.attachment_name && (
        <button
          type="button"
          onClick={() => void openAttachment()}
          className="inline-flex items-center gap-1.5 rounded-md border border-default px-2 py-1 text-[11px] font-semibold text-navy-2 hover:bg-surface-hover"
        >
          <Paperclip className="h-3 w-3" /> {request.attachment_name}
          <ExternalLink className="h-3 w-3 text-navy-3" />
        </button>
      )}

      {/* ─── Ações ─── */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-default pt-3">
        <select
          value={request.assigned_to || ''}
          onChange={(e) => void apply({ assignedTo: e.target.value || null })}
          disabled={busy}
          aria-label="Responsável"
          className="rounded-md border border-control px-2 py-1 text-[11px] font-medium text-navy-2"
        >
          <option value="">Sem responsável</option>
          {CONSULTANTS.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={request.priority}
          onChange={(e) => void apply({ priority: e.target.value as ServiceRequestPriority })}
          disabled={busy}
          aria-label="Prioridade"
          className="rounded-md border border-control px-2 py-1 text-[11px] font-medium text-navy-2"
        >
          {(Object.keys(SERVICE_REQUEST_PRIORITY_LABELS) as ServiceRequestPriority[]).map((value) => (
            <option key={value} value={value}>{SERVICE_REQUEST_PRIORITY_LABELS[value]}</option>
          ))}
        </select>

        {request.status === 'open' && (
          <button
            type="button"
            onClick={() => void apply({ status: 'in_progress', assignedTo: request.assigned_to || getLocalActor().name })}
            disabled={busy}
            className="rounded-md bg-primary-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-primary-800 disabled:opacity-60"
          >
            Assumir
          </button>
        )}

        {waitingOn !== 'none' && (
          <button
            type="button"
            onClick={() => void apply({ status: 'resolved', note: note.trim() || undefined, noteVisibleToClient: !!note.trim() }, true)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-success-soft-border bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success-soft-ink hover:bg-success-soft disabled:opacity-60"
          >
            <CheckCircle2 className="h-3 w-3" /> Concluir
          </button>
        )}

        {request.status === 'resolved' && (
          <button
            type="button"
            onClick={() => void apply({ status: 'in_progress' })}
            disabled={busy}
            className="rounded-md border border-default px-2.5 py-1 text-[11px] font-semibold text-navy-2 hover:bg-surface-hover disabled:opacity-60"
          >
            Reabrir
          </button>
        )}
      </div>

      <div className="space-y-2.5 rounded-lg border border-default bg-surface-sunken p-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-navy-3">Histórico</p>
        <ul className="space-y-1.5">
          {events.length === 0 && <li className="text-[11px] text-navy-3">Sem registros ainda.</li>}
          {events.map((event) => (
            <li key={event.id} className="text-[11px] text-navy-2">
              <span className="font-semibold text-navy-2">
                {event.actor_kind === 'client' ? 'Cliente' : event.actor_name || 'Equipe'}
              </span>
              <span className="text-navy-3"> · {formatDateTimeBR(event.created_at)}</span>
              {event.to_status && (
                <span className="ml-1 rounded bg-surface px-1 text-[10px] font-semibold text-navy-3">
                  {SERVICE_REQUEST_STATUS_LABELS[event.to_status]}
                </span>
              )}
              {!event.visible_to_client && event.actor_kind === 'staff' && (
                <span className="ml-1 text-[10px] font-semibold uppercase text-navy-3">interna</span>
              )}
              {event.note && <p className="whitespace-pre-wrap text-navy-2">{event.note}</p>}
            </li>
          ))}
        </ul>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Escreva para o cliente ou registre uma nota interna"
          aria-label="Nota da solicitação"
          className="w-full rounded-md border border-control p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-navy-2">
          <input
            type="checkbox"
            checked={noteVisible}
            onChange={(e) => setNoteVisible(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          O cliente pode ler esta nota
        </label>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void apply({ note: note.trim(), noteVisibleToClient: noteVisible })}
            disabled={busy || !note.trim()}
            className="inline-flex items-center gap-1 rounded-md border border-default bg-surface px-2.5 py-1 text-[11px] font-semibold text-navy-2 hover:bg-surface-active disabled:opacity-60"
          >
            <MessageSquare className="h-3 w-3" /> Registrar nota
          </button>
          <button
            type="button"
            onClick={askClient}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-amber-soft-border bg-amber-soft px-2.5 py-1 text-[11px] font-bold text-amber-soft-ink hover:bg-amber-soft disabled:opacity-60"
          >
            <Send className="h-3 w-3" /> Perguntar ao cliente
          </button>
        </div>
        <p className="text-[11px] text-navy-3">
          "Perguntar ao cliente" passa a solicitação para a fila dele e envia o aviso. A nota
          vai junto — sem ela, ele vê que está esperando e não sabe o quê.
        </p>
      </div>

      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-soft-ink hover:text-success-soft-ink"
        >
          <ExternalLink className="h-3 w-3" /> Avisar também pelo WhatsApp
        </a>
      )}

      {busy && <p className="flex items-center gap-1 text-[11px] text-navy-3"><Loader2 className="h-3 w-3 animate-spin" /> salvando…</p>}
      {error && <p className="text-[11px] font-medium text-danger-soft-ink">{error}</p>}
    </div>
  );
}

// ─── Prazos informativos ──────────────────────────────────────────────────────

/**
 * O SLA daqui é **promessa ao cliente**, e por isso nasce vazio. Enquanto a Ester não definir
 * um número, o portal não fala em prazo nenhum — não diz "em breve", não estima. Deixar em
 * branco é uma resposta válida e é o default.
 */
function SlaPanel({
  sla,
  onSaved,
}: {
  sla: Record<string, number>;
  onSaved: (sla: Record<string, number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(sla).map(([key, value]) => [key, String(value)]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next: Record<string, number> = {};
      for (const [key, value] of Object.entries(draft)) {
        const days = Number(value);
        if (!value.trim()) continue;
        if (!Number.isFinite(days) || days <= 0 || days > 365) {
          throw new Error(`Prazo inválido em "${key}": use de 1 a 365 dias, ou deixe em branco.`);
        }
        next[key] = Math.round(days);
      }
      await ServiceRequestService.saveSla(next);
      onSaved(next);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-default bg-surface p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy-2">
          <Clock3 className="h-3.5 w-3.5" /> Prazo informativo de retorno
        </span>
        <span className="text-[11px] font-semibold text-primary-700">
          {open ? 'fechar' : Object.keys(sla).length ? `${Object.keys(sla).length} configurado(s)` : 'nenhum — o portal não promete prazo'}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-navy-3">
            Em dias corridos, contados da abertura. O número é congelado na solicitação no
            momento em que ela nasce — mudar aqui não reescreve o que já foi dito a ninguém.
            Deixe em branco para não prometer nada nessa categoria.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[{ value: 'default', label: 'Padrão (todas)' }, ...SERVICE_REQUEST_CATEGORIES].map((category) => (
              <label key={category.value} className="flex items-center justify-between gap-2 rounded-md border border-default px-2 py-1.5 text-[11px] text-navy-2">
                <span>{category.label}</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={draft[category.value] ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [category.value]: e.target.value }))}
                  placeholder="—"
                  aria-label={`Prazo para ${category.label}`}
                  className="w-16 rounded border border-control px-1.5 py-0.5 text-right"
                />
              </label>
            ))}
          </div>
          {error && <p className="text-[11px] font-medium text-danger-soft-ink">{error}</p>}
          {saved && <p className="text-[11px] font-medium text-success-soft-ink">Prazos salvos.</p>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-800 disabled:opacity-60"
          >
            Salvar prazos
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function ServiceRequests() {
  const [searchParams] = useSearchParams();
  // Deep link do painel operacional (P360-013): abre a solicitação já em foco no Drawer.
  const focusRequestId = searchParams.get('id');

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueFilter>(focusRequestId ? 'all' : 'team');
  const [clientId, setClientId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<ServiceRequestPriority | ''>('');
  const [search, setSearch] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sla, setSla] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(focusRequestId);

  const load = useCallback(() => {
    setLoading(true);
    ServiceRequestService.list({
      status: QUEUE_STATUSES[queue],
      clientId: clientId || null,
      assignedTo: assignedTo || null,
      priority: priority || null,
      search,
    })
      .then((rows) => {
        setRequests(rows);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [queue, clientId, assignedTo, priority, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    ClientService.getClients()
      .then(setClients)
      .catch((err) => console.warn('[ServiceRequests] Falha ao carregar unidades:', err));
    // A trava é do tenant: se estiver desligada, o cliente não consegue abrir nada e a tela
    // vazia significaria "ninguém pediu", que é mentira.
    AppointmentAdminService.getPortalSettings()
      .then((settings) => {
        setEnabled(!!settings.service_requests_enabled);
        setSla((settings.service_request_sla || {}) as Record<string, number>);
      })
      .catch((err) => {
        console.warn('[ServiceRequests] Falha ao ler as configuracoes do portal:', err);
        setEnabled(null);
      });
  }, []);

  const clientNames = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients]
  );

  const counts = useMemo(() => {
    const waitingTeam = requests.filter((r) => serviceRequestWaitingOn(r.status) === 'team').length;
    const waitingClient = requests.filter((r) => serviceRequestWaitingOn(r.status) === 'client').length;
    const unassigned = requests.filter((r) => !r.assigned_to && serviceRequestWaitingOn(r.status) !== 'none').length;
    return { waitingTeam, waitingClient, unassigned };
  }, [requests]);

  const { page, totalPages, items: pagedRequests, setPage } = usePagedList(requests);

  const selectedRequest = selectedId ? requests.find((r) => r.id === selectedId) || null : null;

  return (
    <PageShell>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Headset className="h-6 w-6 text-primary-700" /> Solicitações
          </span>
        }
        description="Demandas abertas pelos clientes no portal. Não são agendamentos: aqui não há data nem duração, só o que alguém pediu e em que pé está."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-default bg-surface px-3 py-2 text-xs font-semibold text-navy-2 hover:bg-surface-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        }
      />

      {enabled === false && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-soft-border bg-amber-soft p-3 text-xs text-amber-soft-ink">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            As solicitações estão <strong>desligadas</strong> no portal deste tenant — nenhum
            cliente consegue abrir demanda. Ligue em Clientes › Portal › Configurações.
          </span>
        </p>
      )}

      <SlaPanel sla={sla} onSaved={setSla} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(QUEUE_LABELS) as QueueFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setQueue(value)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold ${
              queue === value ? 'bg-primary-700 text-white' : 'border border-default bg-surface text-navy-2 hover:bg-surface-hover'
            }`}
          >
            {QUEUE_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Assunto ou número"
          aria-label="Buscar solicitação"
          className="rounded-md border border-control px-2.5 py-1.5 text-xs"
        />
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-label="Filtrar por unidade"
          className="rounded-md border border-control px-2.5 py-1.5 text-xs"
        >
          <option value="">Todas as unidades</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          aria-label="Filtrar por responsável"
          className="rounded-md border border-control px-2.5 py-1.5 text-xs"
        >
          <option value="">Qualquer responsável</option>
          {CONSULTANTS.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as ServiceRequestPriority | '')}
          aria-label="Filtrar por prioridade"
          className="rounded-md border border-control px-2.5 py-1.5 text-xs"
        >
          <option value="">Qualquer prioridade</option>
          {(Object.keys(SERVICE_REQUEST_PRIORITY_LABELS) as ServiceRequestPriority[]).map((value) => (
            <option key={value} value={value}>{SERVICE_REQUEST_PRIORITY_LABELS[value]}</option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-xs font-medium text-navy-3">
        {requests.length} solicitação(ões) nesta lista
        {counts.waitingTeam > 0 && <span className="ml-1 font-bold text-primary-700">· {counts.waitingTeam} com a equipe</span>}
        {counts.waitingClient > 0 && <span className="ml-1 font-bold text-amber-soft-ink">· {counts.waitingClient} com o cliente</span>}
        {counts.unassigned > 0 && <span className="ml-1 font-bold text-danger-soft-ink">· {counts.unassigned} sem responsável</span>}
      </p>

      {error && requests.length === 0 ? (
        <div className="rounded-md border border-default bg-surface">
          <EmptyState
            role="alert"
            icon={<AlertTriangle className="h-8 w-8 text-danger" />}
            title="Não deu para carregar as solicitações"
            description={error}
            action={
              <Button size="sm" onClick={load}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : loading && requests.length === 0 ? (
        <TableContainer>
          <Table aria-busy="true" aria-label="Carregando solicitações">
            <TableHeader>
              <TableRow>
                <TableHead>Aberta em</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-11" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <>
        {error && (
          <p className="mb-3 rounded-md border border-danger-soft-border bg-danger-soft p-3 text-xs text-danger-soft-ink">{error}</p>
        )}
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aberta em</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead align="right">Espera</TableHead>
                <TableHead><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-auto py-0">
                    {search || clientId || assignedTo || priority ? (
                      <EmptyState
                        icon={<FilterX className="h-8 w-8" />}
                        title="Nada com este filtro"
                        description="Nenhum resultado para os filtros atuais. O dado pode existir, só está escondido."
                        action={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSearch(''); setClientId(''); setAssignedTo(''); setPriority(''); }}
                          >
                            Limpar filtros
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={<Headset className="h-8 w-8" />}
                        title="Nenhuma solicitação nesta fila"
                        description="Quando um cliente pedir alguma coisa pelo portal, ela aparece aqui."
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                pagedRequests.map((request) => {
                  const waitingOn = serviceRequestWaitingOn(request.status);
                  const stalled = daysSince(request.last_event_at);
                  return (
                    <TableRow
                      key={request.id}
                      id={`request-${request.id}`}
                      selected={request.id === selectedId}
                      onClick={() => setSelectedId(request.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(request.id);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell align="right">{formatDateBR(request.created_at)}</TableCell>
                      <TableCell primary className="max-w-[200px]">
                        <p className="truncate">{clientNames.get(request.client_id) || 'Unidade'}</p>
                        <p className="truncate text-xs font-normal text-navy-3">Nº {request.request_number}</p>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate font-medium text-navy">{request.subject}</p>
                        <p className="truncate text-xs text-navy-3">{SERVICE_REQUEST_CATEGORY_LABELS[request.category]}</p>
                      </TableCell>
                      <TableCell>
                        {request.assigned_to ? (
                          <span className="inline-flex items-center gap-1 text-xs text-navy-2">
                            <UserRound className="h-3 w-3 text-navy-3" /> {request.assigned_to}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-soft-ink">sem responsável</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityTheme[request.priority]}`}>
                          {SERVICE_REQUEST_PRIORITY_LABELS[request.priority]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTheme[request.status]}`}>
                          {SERVICE_REQUEST_STATUS_LABELS[request.status]}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        {waitingOn === 'none' ? (
                          <span className="text-navy-3">—</span>
                        ) : (
                          <span className={stalled >= 3 ? 'font-bold text-amber-soft-ink' : 'text-navy-2'}>
                            {stalled === 0 ? 'hoje' : `${stalled} dia${stalled > 1 ? 's' : ''}`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(request.id); }}
                        >
                          Responder
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={totalPages} onPageChange={setPage} totalItems={requests.length} pageSize={10} />
        </TableContainer>
        </>
      )}

      <Drawer
        isOpen={!!selectedRequest}
        onClose={() => setSelectedId(null)}
        title={selectedRequest?.subject}
      >
        {selectedRequest && (
          <RequestDetail
            request={selectedRequest}
            unitName={clientNames.get(selectedRequest.client_id) || 'Unidade'}
            onChanged={load}
          />
        )}
      </Drawer>
    </PageShell>
  );
}
