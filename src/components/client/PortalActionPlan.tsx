import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import type { ClientDeclaredStatus, ClientPortalActionItem } from '../../services/clientPortalService';
import type { ClientActionEvidenceStatus, ClientActionItemPriority } from '../../types';
import { formatDateBR } from '../../utils/clientPortalFormat';
import {
  EVIDENCE_ACCEPT_ATTRIBUTE,
  EVIDENCE_LIMITS_LABEL,
  checkEvidenceFile,
} from '../../utils/evidenceFile';

/** Acima disso a lista começa recolhida — o plano de ação de uma rede passa fácil de 30 itens. */
const COMPACT_THRESHOLD = 5;

/** Pendências mostradas por unidade em "Todas" — o resto só aparece ao abrir a unidade inteira. */
const GROUP_PREVIEW_LIMIT = 3;

const priorityLabel: Record<ClientActionItemPriority, string> = {
  urgent: 'Urgente',
  important: 'Importante',
  recommended: 'Recomendada',
};

const priorityTheme: Record<ClientActionItemPriority, string> = {
  urgent: 'bg-danger-soft text-danger-soft-ink',
  important: 'bg-amber-soft text-amber-soft-ink',
  recommended: 'bg-surface-sunken text-navy-2',
};

const evidenceLabel: Record<ClientActionEvidenceStatus, string> = {
  pending: 'Evidência em análise',
  approved: 'Evidência aprovada',
  changes_requested: 'Evidência devolvida para ajuste',
};

const evidenceTheme: Record<ClientActionEvidenceStatus, string> = {
  pending: 'border-sky-200 bg-sky-50 text-sky-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  changes_requested: 'border-amber-200 bg-amber-50 text-amber-900',
};

export type DeclareStatusHandler = (params: {
  item: ClientPortalActionItem;
  status: ClientDeclaredStatus;
  note: string;
  byName: string;
  byRole: string;
}) => Promise<void>;

export type SubmitEvidenceHandler = (params: {
  item: ClientPortalActionItem;
  file: File;
  uploadKey: string;
  note: string;
  byName: string;
  byRole: string;
}) => Promise<void>;

/**
 * PORT-02 — nome e função ficam na página, não no card do item: quem envia é a mesma pessoa
 * durante a visita inteira, e repetir a digitação a cada pendência faria ela desistir na
 * segunda. Guardado só no navegador, para reaparecer preenchido na próxima vez.
 */
const AUTHOR_KEY = 'inspecvisa-evidencia-autor';

export function readStoredAuthor(): { byName: string; byRole: string } {
  try {
    const raw = localStorage.getItem(AUTHOR_KEY);
    if (!raw) return { byName: '', byRole: '' };
    const parsed = JSON.parse(raw) as { byName?: string; byRole?: string };
    return { byName: parsed.byName || '', byRole: parsed.byRole || '' };
  } catch {
    return { byName: '', byRole: '' };
  }
}

export function storeAuthor(author: { byName: string; byRole: string }) {
  try {
    localStorage.setItem(AUTHOR_KEY, JSON.stringify(author));
  } catch { /* armazenamento indisponível */ }
}

interface PortalActionPlanProps {
  items: ClientPortalActionItem[];
  loading?: boolean;
  error?: boolean;
  /**
   * "Todas as unidades" com mais de uma unidade: as pendências abertas viram grupos por
   * unidade (cabeçalho + contadores), em vez de uma lista só empilhada. Cada grupo mostra no
   * máximo `GROUP_PREVIEW_LIMIT` pendências; o resto só aparece ao trocar o filtro pra aquela
   * unidade via `onSelectUnit`.
   */
  groupByUnit?: boolean;
  /** Troca o filtro global de unidade — usado pelo "ver todas as pendências de <unidade>". */
  onSelectUnit?: (clientId: string) => void;
  onSubmitEvidence?: SubmitEvidenceHandler;
  onDeclareStatus?: DeclareStatusHandler;
  /**
   * Quando o plano de ação É a página (o link do relatório), a seção precisa aparecer mesmo
   * vazia e dizer por quê. Sumir faz o cliente concluir que a função não existe — foi
   * exatamente o que aconteceu no primeiro teste do link.
   */
  alwaysShow?: boolean;
  onRetry?: () => void;
  /** FE-10: pré-preenche "Seu nome" quando não há assinatura salva ainda, pra tirar o campo em branco. */
  defaultAuthorName?: string;
}

/**
 * P360-011 — envio da prova de correção.
 *
 * A `uploadKey` nasce junto com a escolha do arquivo e sobrevive a quantas tentativas forem
 * precisas: é ela que faz o servidor reconhecer o reenvio como o MESMO envio, em vez de
 * empilhar cópias quando a rede cai no meio.
 */
function EvidenceUpload({
  item,
  author,
  onAuthorChange,
  onSubmitEvidence,
}: {
  item: ClientPortalActionItem;
  author: { byName: string; byRole: string };
  onAuthorChange: (author: { byName: string; byRole: string }) => void;
  onSubmitEvidence: SubmitEvidenceHandler;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setUploadKey('');
    setNote('');
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleChoose = (chosen: File | undefined) => {
    if (!chosen) return;
    const check = checkEvidenceFile(chosen);
    if (!check.ok) {
      setFile(null);
      setError(check.message ?? 'Arquivo não aceito.');
      return;
    }
    setError(null);
    setFile(chosen);
    setUploadKey(crypto.randomUUID());
  };

  const handleSend = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmitEvidence({
        item,
        file,
        uploadKey,
        note: note.trim(),
        byName: author.byName.trim(),
        byRole: author.byRole.trim(),
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const alreadySent = item.evidence_count > 0;

  return (
    <div className="mt-2.5 border-t border-dashed border-default pt-2.5">
      <input
        ref={inputRef}
        type="file"
        accept={EVIDENCE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => handleChoose(e.target.files?.[0])}
        data-testid={`evidence-input-${item.id}`}
      />

      {!file ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            {alreadySent ? <RefreshCw className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
            {alreadySent ? 'Enviar outra evidência' : 'Enviar evidência'}
          </button>
          <span className="text-[11px] text-navy-3">{EVIDENCE_LIMITS_LABEL}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-navy-2">
            <Paperclip className="h-3.5 w-3.5 text-navy-3" />
            <span className="font-medium">{file.name}</span>
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Quer explicar o que foi feito? (opcional)"
            className="w-full rounded-md border border-control p-2 text-xs placeholder:text-navy-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={author.byName}
              onChange={(e) => onAuthorChange({ ...author, byName: e.target.value })}
              maxLength={120}
              placeholder="Seu nome"
              aria-label="Seu nome"
              className="w-full rounded-md border border-control p-2 text-xs placeholder:text-navy-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <input
              type="text"
              value={author.byRole}
              onChange={(e) => onAuthorChange({ ...author, byRole: e.target.value })}
              maxLength={120}
              placeholder="Sua função"
              aria-label="Sua função"
              className="w-full rounded-md border border-control p-2 text-xs placeholder:text-navy-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <p className="text-[11px] text-navy-3">
            O nome e a função ficam registrados no relatório junto com a evidência.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              {busy ? 'Enviando...' : 'Enviar para a consultoria'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="rounded-md border border-default px-3 py-1.5 text-xs font-medium text-navy-2 hover:bg-surface-hover disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] font-medium text-danger-soft-ink">{error}</p>}
    </div>
  );
}

const declaredLabel: Record<ClientDeclaredStatus, string> = {
  done: 'Já corrigi',
  in_progress: 'Estou providenciando',
  not_done: 'Ainda não fiz',
};

const declaredTheme: Record<ClientDeclaredStatus, string> = {
  done: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  in_progress: 'border-sky-300 bg-sky-50 text-sky-800',
  not_done: 'border-orange-300 bg-orange-50 text-orange-900',
};

/**
 * PORT-03 — o cliente diz em que pé está, inclusive quando NÃO fez.
 *
 * Antes só existia anexar arquivo, então quem ainda não corrigiu ficava calado — e calado é
 * indistinguível de "nem abriu o portal". "Ainda não fiz" exige motivo, porque é o motivo que
 * serve para a próxima visita; nos outros dois o texto é opcional, senão o cliente desiste de
 * responder e volta ao silêncio, que é justamente o que isto resolve.
 */
function DeclareStatus({
  item,
  author,
  onAuthorChange,
  onDeclareStatus,
}: {
  item: ClientPortalActionItem;
  author: { byName: string; byRole: string };
  onAuthorChange: (author: { byName: string; byRole: string }) => void;
  onDeclareStatus: DeclareStatusHandler;
}) {
  const [choice, setChoice] = useState<ClientDeclaredStatus | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!choice || busy) return;
    if (choice === 'not_done' && !note.trim()) {
      setError('Conte o motivo — é o que a consultoria leva para a próxima visita.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onDeclareStatus({
        item,
        status: choice,
        note: note.trim(),
        byName: author.byName.trim(),
        byRole: author.byRole.trim(),
      });
      setChoice(null);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar agora.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 border-t border-dashed border-default pt-2.5">
      <p className="mb-1.5 text-[11px] font-semibold text-navy-2">
        {item.client_status ? 'Mudou de situação?' : 'Em que pé está?'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(['done', 'in_progress', 'not_done'] as ClientDeclaredStatus[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => { setChoice(option); setError(null); }}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              choice === option ? declaredTheme[option] : 'border-default bg-surface text-navy-2 hover:bg-surface-hover'
            }`}
          >
            {declaredLabel[option]}
          </button>
        ))}
      </div>

      {choice && (
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={choice === 'not_done' ? 'Por que ainda não foi feito? *' : 'Quer detalhar? (opcional)'}
            aria-label="Detalhe da situação"
            className="w-full rounded-md border border-control p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={author.byName}
              onChange={(e) => onAuthorChange({ ...author, byName: e.target.value })}
              maxLength={120}
              placeholder="Seu nome"
              aria-label="Seu nome na resposta"
              className="w-full rounded-md border border-control p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <input
              type="text"
              value={author.byRole}
              onChange={(e) => onAuthorChange({ ...author, byRole: e.target.value })}
              maxLength={120}
              placeholder="Sua função"
              aria-label="Sua função na resposta"
              className="w-full rounded-md border border-control p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
              {busy ? 'Registrando...' : 'Registrar resposta'}
            </button>
            <button
              type="button"
              onClick={() => { setChoice(null); setNote(''); setError(null); }}
              disabled={busy}
              className="rounded-md border border-default px-3 py-1.5 text-xs font-medium text-navy-2 hover:bg-surface-hover disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] font-medium text-danger-soft-ink">{error}</p>}
    </div>
  );
}

function DeclaredState({ item }: { item: ClientPortalActionItem }) {
  if (!item.client_status) return null;
  return (
    <div className={`mt-2.5 rounded-lg border px-2.5 py-2 text-xs ${declaredTheme[item.client_status]}`}>
      <p className="font-semibold">
        Sua resposta: {declaredLabel[item.client_status]}
        {item.client_status_at ? ` · ${formatDateBR(item.client_status_at)}` : ''}
      </p>
      {item.client_status_note && <p className="mt-1">{item.client_status_note}</p>}
      {item.client_status_by_name && (
        <p className="mt-0.5 opacity-80">
          Registrado por {item.client_status_by_name}
          {item.client_status_by_role ? ` (${item.client_status_by_role})` : ''}
        </p>
      )}
    </div>
  );
}

function EvidenceState({ item }: { item: ClientPortalActionItem }) {
  if (!item.evidence_status) return null;
  const status = item.evidence_status;

  return (
    <div className={`mt-2.5 rounded-lg border px-2.5 py-2 text-xs ${evidenceTheme[status]}`}>
      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
        {status === 'pending' && <Clock3 className="h-3.5 w-3.5" />}
        {status === 'approved' && <CheckCircle2 className="h-3.5 w-3.5" />}
        {status === 'changes_requested' && <AlertTriangle className="h-3.5 w-3.5" />}
        {evidenceLabel[status]}
        {item.evidence_count > 1 && (
          <span className="font-normal opacity-80">· {item.evidence_count} arquivos enviados</span>
        )}
      </p>
      {item.evidence_submitted_at && (
        <p className="mt-0.5 opacity-80">
          Enviada em {formatDateBR(item.evidence_submitted_at)}
          {item.evidence_file_name ? ` · ${item.evidence_file_name}` : ''}
          {item.evidence_by_name ? ` · por ${item.evidence_by_name}` : ''}
          {item.evidence_by_role ? ` (${item.evidence_by_role})` : ''}
        </p>
      )}
      {item.evidence_review_note && (
        <p className="mt-1.5">
          <span className="font-semibold">Orientação da consultoria: </span>
          {item.evidence_review_note}
        </p>
      )}
      {status === 'pending' && (
        <p className="mt-1 opacity-80">
          A consultoria avisa quando terminar a análise. A pendência continua aberta até lá.
        </p>
      )}
    </div>
  );
}

function ActionItemCard({
  item,
  showUnitName,
  author,
  onAuthorChange,
  onSubmitEvidence,
  onDeclareStatus,
}: {
  item: ClientPortalActionItem;
  showUnitName?: boolean;
  author: { byName: string; byRole: string };
  onAuthorChange: (author: { byName: string; byRole: string }) => void;
  onSubmitEvidence?: SubmitEvidenceHandler;
  onDeclareStatus?: DeclareStatusHandler;
}) {
  const resolved = item.status === 'resolved';
  return (
    <li
      className={`rounded-lg border p-3 ${
        resolved ? 'border-default bg-surface-sunken' : item.is_overdue ? 'border-amber-soft-border bg-amber-soft/60' : 'border-default bg-surface'
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
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-bold text-amber-soft-ink">
              <AlertTriangle className="h-3.5 w-3.5" /> Prazo vencido
            </span>
          )
        )}
        {item.occurrence_count > 1 && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
            Reincidente ({item.occurrence_count}x)
          </span>
        )}
        {showUnitName && <span className="text-[11px] font-medium text-navy-2">{item.unit_name}</span>}
      </div>

      <p className="text-sm font-semibold text-navy">{item.title}</p>
      <p className="mt-1 text-xs text-navy-2">{item.situation}</p>
      <p className="mt-1.5 rounded-md border border-primary-100 bg-primary-50 p-2 text-xs text-navy">
        <span className="font-semibold">O que fazer: </span>
        {item.recommended_action}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-navy-3">
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

      <DeclaredState item={item} />
      <EvidenceState item={item} />

      {onDeclareStatus && item.accepts_evidence && (
        <DeclareStatus
          item={item}
          author={author}
          onAuthorChange={onAuthorChange}
          onDeclareStatus={onDeclareStatus}
        />
      )}

      {onSubmitEvidence && item.accepts_evidence && (
        <EvidenceUpload
          item={item}
          author={author}
          onAuthorChange={onAuthorChange}
          onSubmitEvidence={onSubmitEvidence}
        />
      )}
    </li>
  );
}

interface ActionItemGroup {
  clientId: string;
  unitName: string;
  items: ClientPortalActionItem[];
  overdueCount: number;
}

/**
 * Agrupa as pendências abertas por unidade, preservando a ordem que já vem da RPC (prazo,
 * depois prioridade) dentro de cada grupo. Ordena os grupos pela urgência: mais vencidas
 * primeiro, depois mais pendências, depois nome — é a unidade que mais precisa de atenção.
 */
function groupOpenItemsByUnit(open: ClientPortalActionItem[]): ActionItemGroup[] {
  const groups = new Map<string, ActionItemGroup>();
  for (const item of open) {
    const group = groups.get(item.client_id);
    if (group) {
      group.items.push(item);
      if (item.is_overdue) group.overdueCount += 1;
    } else {
      groups.set(item.client_id, {
        clientId: item.client_id,
        unitName: item.unit_name,
        items: [item],
        overdueCount: item.is_overdue ? 1 : 0,
      });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.overdueCount - a.overdueCount || b.items.length - a.items.length || a.unitName.localeCompare(b.unitName)
  );
}

export function PortalActionPlan({
  items,
  loading,
  error,
  groupByUnit,
  onSelectUnit,
  onSubmitEvidence,
  onDeclareStatus,
  alwaysShow,
  onRetry,
  defaultAuthorName,
}: PortalActionPlanProps) {
  const [expanded, setExpanded] = useState(false);
  const [author, setAuthor] = useState(() => {
    const stored = readStoredAuthor();
    return stored.byName ? stored : { ...stored, byName: defaultAuthorName || '' };
  });

  const handleAuthorChange = (next: { byName: string; byRole: string }) => {
    setAuthor(next);
    storeAuthor(next);
  };

  if (loading) {
    return <section className="mb-6 h-28 animate-pulse rounded-xl border border-default bg-surface-sunken" aria-hidden="true" />;
  }

  if (error) {
    return (
      <section className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 sm:flex-row sm:items-center sm:justify-between">
        <p role="alert">Não foi possível carregar o plano de ação agora. Atualize a página ou fale com a equipe da consultoria.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-surface px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        )}
      </section>
    );
  }

  // No link do relatório o plano de ação É a página: sumir quando está vazio faz o cliente
  // concluir que a função não existe. Aparece e explica.
  if (items.length === 0) {
    if (!alwaysShow) return null;
    return (
      <section aria-labelledby="portal-action-plan" className="mb-6 rounded-xl border border-default bg-surface p-4 shadow-sm">
        <h3
          id="portal-action-plan"
          className="mb-2 flex items-center gap-2 font-title text-base font-semibold text-navy"
        >
          <ClipboardList className="h-4 w-4 text-primary-700" /> Plano de ação
        </h3>
        <p className="rounded-lg border border-dashed border-default bg-surface-sunken p-3 text-xs text-navy-2">
          Nenhuma pendência publicada para esta unidade ainda. Assim que a consultoria publicar o
          plano de ação desta inspeção, ele aparece aqui — e é por aqui que você responde o que já
          foi corrigido, anexa a evidência ou avisa o que ainda não deu para fazer.
        </p>
      </section>
    );
  }

  const open = items.filter((item) => item.status !== 'resolved');
  const resolved = items.filter((item) => item.status === 'resolved');
  const overdue = open.filter((item) => item.is_overdue).length;
  const compact = open.length > COMPACT_THRESHOLD && !expanded;
  const visible = compact ? open.slice(0, COMPACT_THRESHOLD) : open;
  const isGrouped = !!groupByUnit && new Set(open.map((item) => item.client_id)).size > 1;
  const groups = isGrouped ? groupOpenItemsByUnit(open) : [];

  return (
    <section aria-labelledby="portal-action-plan" className="mb-6 rounded-xl border border-default bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3
          id="portal-action-plan"
          className="flex items-center gap-2 font-title text-base font-semibold text-navy"
        >
          <ClipboardList className="h-4 w-4 text-primary-700" /> Plano de ação
        </h3>
        <span className="text-xs font-medium text-navy-2">
          {open.length} pendente{open.length === 1 ? '' : 's'}
          {overdue > 0 && <span className="ml-1 font-bold text-amber-strong">· {overdue} vencida(s)</span>}
          {resolved.length > 0 && <span className="ml-1">· {resolved.length} concluída(s)</span>}
        </span>
      </div>

      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Nenhuma pendência em aberto. Tudo que foi apontado já está concluído.
        </p>
      ) : isGrouped ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.clientId}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-t-lg border border-default bg-surface-sunken px-3 py-2">
                <h4 className="font-title text-sm font-semibold text-navy">{group.unitName}</h4>
                <span className="text-[11px] font-medium text-navy-2">
                  {group.items.length} pendente{group.items.length === 1 ? '' : 's'}
                  {group.overdueCount > 0 && (
                    <span className="ml-1 font-bold text-amber-strong">· {group.overdueCount} vencida(s)</span>
                  )}
                </span>
              </div>
              <ul className="space-y-2">
                {group.items.slice(0, GROUP_PREVIEW_LIMIT).map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    author={author}
                    onAuthorChange={handleAuthorChange}
                    onSubmitEvidence={onSubmitEvidence}
                    onDeclareStatus={onDeclareStatus}
                  />
                ))}
              </ul>
              {group.items.length > GROUP_PREVIEW_LIMIT && onSelectUnit && (
                <button
                  type="button"
                  onClick={() => onSelectUnit(group.clientId)}
                  className="mt-2 text-xs font-semibold text-primary-700 hover:text-primary-900"
                >
                  Ver todas as {group.items.length} pendências de {group.unitName}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <ActionItemCard
              key={item.id}
              item={item}
              author={author}
              onAuthorChange={handleAuthorChange}
              onSubmitEvidence={onSubmitEvidence}
              onDeclareStatus={onDeclareStatus}
            />
          ))}
        </ul>
      )}

      {!isGrouped && open.length > COMPACT_THRESHOLD && (
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
          <summary className="cursor-pointer text-xs font-semibold text-navy-3 hover:text-navy-2">
            Histórico · {resolved.length} pendência(s) concluída(s)
          </summary>
          <ul className="mt-2 space-y-2">
            {resolved.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                showUnitName={!!groupByUnit}
                author={author}
                onAuthorChange={handleAuthorChange}
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
