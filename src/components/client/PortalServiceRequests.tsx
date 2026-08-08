import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Headset,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  UserRound,
  X,
} from 'lucide-react';
import type { ClientPortalServiceRequest, CreateServiceRequestInput } from '../../services/clientPortalService';
import type { ServiceRequestCategory, ServiceRequestStatus } from '../../types';
import { formatDateBR } from '../../utils/clientPortalFormat';
import {
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_CATEGORY_LABELS,
  SERVICE_REQUEST_CLIENT_STATUS_LABELS,
} from '../../utils/serviceRequests';
import { EVIDENCE_ACCEPT_ATTRIBUTE, EVIDENCE_LIMITS_LABEL, checkEvidenceFile } from '../../utils/evidenceFile';
import { readStoredAuthor, storeAuthor } from './PortalActionPlan';

/**
 * P360-012 — solicitações de consultoria no portal.
 *
 * O que esta tela deliberadamente NÃO é: um chat. Não há caixa de mensagem livre, não há
 * indicador de "digitando", não há promessa de resposta. O cliente abre uma demanda com
 * assunto e descrição, acompanha o número e o estado, e só volta a escrever quando a
 * consultoria pergunta alguma coisa — `accepts_reply`, que vem do servidor.
 *
 * A seção fica separada dos compromissos de propósito (critério de aceite do card): pedido
 * administrativo e visita agendada são coisas diferentes, com prazos diferentes.
 */

const statusTheme: Record<ServiceRequestStatus, string> = {
  open: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  awaiting_client: 'bg-amber-100 text-amber-900',
  resolved: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export type CreateServiceRequestHandler = (input: CreateServiceRequestInput) => Promise<{
  requestNumber: number;
  attachmentError?: string;
}>;

export type ReplyServiceRequestHandler = (params: {
  request: ClientPortalServiceRequest;
  message: string;
  byName: string;
  byRole: string;
}) => Promise<void>;

interface PortalServiceRequestsProps {
  requests: ClientPortalServiceRequest[];
  units: { client_id: string; client_name: string }[];
  loading?: boolean;
  error?: boolean;
  onCreate?: CreateServiceRequestHandler;
  onReply?: ReplyServiceRequestHandler;
  onRetry?: () => void;
}

// ─── Formulário de abertura ───────────────────────────────────────────────────

function NewRequestForm({
  units,
  author,
  onAuthorChange,
  onCreate,
  onDone,
}: {
  units: { client_id: string; client_name: string }[];
  author: { byName: string; byRole: string };
  onAuthorChange: (author: { byName: string; byRole: string }) => void;
  onCreate: CreateServiceRequestHandler;
  onDone: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState(units.length === 1 ? units[0].client_id : '');
  const [category, setCategory] = useState<ServiceRequestCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  /**
   * Nasce junto com o formulário e sobrevive a quantas tentativas forem precisas: é ela que faz
   * o servidor reconhecer o reenvio como a MESMA submissão, em vez de abrir duas solicitações
   * quando a rede cai ou o dedo escorrega no botão.
   */
  const [submissionKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = (chosen: File | undefined) => {
    if (!chosen) return;
    const check = checkEvidenceFile(chosen);
    if (!check.ok) {
      setFile(null);
      setError(check.message ?? 'Arquivo não aceito.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setError(null);
    setFile(chosen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!clientId) return setError('Escolha a unidade.');
    if (!category) return setError('Escolha a categoria.');
    if (subject.trim().length < 3) return setError('Descreva o assunto em pelo menos 3 caracteres.');
    if (description.trim().length < 10) return setError('Conte o que você precisa em pelo menos 10 caracteres.');

    setBusy(true);
    setError(null);
    try {
      const result = await onCreate({
        clientId,
        category,
        subject: subject.trim(),
        description: description.trim(),
        submissionKey,
        byName: author.byName.trim() || undefined,
        byRole: author.byRole.trim() || undefined,
        file,
      });
      onDone(
        result.attachmentError
          ? `Solicitação ${result.requestNumber} registrada, mas o anexo não subiu (${result.attachmentError}). Você pode reenviar o arquivo quando a consultoria responder.`
          : `Solicitação ${result.requestNumber} registrada. A consultoria responde por aqui.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const selectedCategory = SERVICE_REQUEST_CATEGORIES.find((item) => item.value === category);

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="service-request-unit" className="text-xs font-semibold text-gray-700">
            Unidade *
          </label>
          <select
            id="service-request-unit"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">Selecione</option>
            {units.map((unit) => (
              <option key={unit.client_id} value={unit.client_id}>
                {unit.client_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="service-request-category" className="text-xs font-semibold text-gray-700">
            Categoria *
          </label>
          <select
            id="service-request-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ServiceRequestCategory)}
            className="w-full rounded-md border border-gray-200 bg-white p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">Selecione</option>
            {SERVICE_REQUEST_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {selectedCategory && <p className="text-[11px] text-gray-500">{selectedCategory.hint}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="service-request-subject" className="text-xs font-semibold text-gray-700">
          Assunto *
        </label>
        <input
          id="service-request-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={160}
          placeholder="Ex.: renovação do alvará sanitário"
          className="w-full rounded-md border border-gray-200 p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="service-request-description" className="text-xs font-semibold text-gray-700">
          O que você precisa *
        </label>
        <textarea
          id="service-request-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Conte o contexto: o que aconteceu, o que já tentaram e qual é a dúvida ou o pedido."
          className="w-full rounded-md border border-gray-200 p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={EVIDENCE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => chooseFile(e.target.files?.[0])}
        data-testid="service-request-file"
      />
      {file ? (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-700">
          <Paperclip className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-medium">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileRef.current) fileRef.current.value = '';
            }}
            className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
          >
            remover
          </button>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            <Paperclip className="h-3.5 w-3.5" /> Anexar arquivo (opcional)
          </button>
          <span className="text-[11px] text-gray-500">{EVIDENCE_LIMITS_LABEL}</span>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={author.byName}
          onChange={(e) => onAuthorChange({ ...author, byName: e.target.value })}
          maxLength={120}
          placeholder="Seu nome (opcional)"
          aria-label="Seu nome"
          className="w-full rounded-md border border-gray-200 p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <input
          type="text"
          value={author.byRole}
          onChange={(e) => onAuthorChange({ ...author, byRole: e.target.value })}
          maxLength={120}
          placeholder="Sua função (opcional)"
          aria-label="Sua função"
          className="w-full rounded-md border border-gray-200 p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {error && <p className="text-[11px] font-medium text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3 py-2 text-xs font-bold text-white hover:bg-primary-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Registrar solicitação
      </button>
      <p className="text-[11px] text-gray-500">
        A consultoria acompanha por aqui e responde nesta mesma solicitação. Este canal não é
        atendimento imediato — para urgência sanitária, ligue para a equipe.
      </p>
    </form>
  );
}

// ─── Resposta quando a consultoria pergunta ───────────────────────────────────

function ReplyForm({
  request,
  author,
  onAuthorChange,
  onReply,
}: {
  request: ClientPortalServiceRequest;
  author: { byName: string; byRole: string };
  onAuthorChange: (author: { byName: string; byRole: string }) => void;
  onReply: ReplyServiceRequestHandler;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (busy) return;
    if (message.trim().length < 2) {
      setError('Escreva sua resposta.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onReply({
        request,
        message: message.trim(),
        byName: author.byName.trim(),
        byRole: author.byRole.trim(),
      });
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível responder agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 border-t border-dashed border-amber-200 pt-2.5">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Responda o que a consultoria pediu"
        aria-label="Sua resposta"
        className="w-full rounded-md border border-gray-200 p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={author.byName}
          onChange={(e) => onAuthorChange({ ...author, byName: e.target.value })}
          maxLength={120}
          placeholder="Seu nome (opcional)"
          aria-label="Seu nome na resposta"
          className="w-full rounded-md border border-gray-200 p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <input
          type="text"
          value={author.byRole}
          onChange={(e) => onAuthorChange({ ...author, byRole: e.target.value })}
          maxLength={120}
          placeholder="Sua função (opcional)"
          aria-label="Sua função na resposta"
          className="w-full rounded-md border border-gray-200 p-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>
      {error && <p className="mt-2 text-[11px] font-medium text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={busy}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
        Enviar resposta
      </button>
    </div>
  );
}

// ─── Card de uma solicitação ──────────────────────────────────────────────────

function RequestCard({
  request,
  showUnitName,
  author,
  onAuthorChange,
  onReply,
}: {
  request: ClientPortalServiceRequest;
  showUnitName: boolean;
  author: { byName: string; byRole: string };
  onAuthorChange: (author: { byName: string; byRole: string }) => void;
  onReply?: ReplyServiceRequestHandler;
}) {
  const waitingClient = request.waiting_on === 'client';
  const closed = request.waiting_on === 'none';

  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        waitingClient ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
          Nº {request.request_number}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTheme[request.status]}`}>
          {SERVICE_REQUEST_CLIENT_STATUS_LABELS[request.status]}
        </span>
        <span className="text-[11px] text-gray-500">
          {SERVICE_REQUEST_CATEGORY_LABELS[request.category]}
        </span>
        {showUnitName && <span className="text-[11px] text-gray-500">· {request.unit_name}</span>}
      </div>

      <p className="mt-1.5 text-sm font-semibold text-gray-900">{request.subject}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{request.description}</p>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
        <span>Aberta em {formatDateBR(request.created_at)}</span>
        <span>· Última atualização em {formatDateBR(request.last_event_at)}</span>
        {request.assigned_to && (
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" /> {request.assigned_to}
          </span>
        )}
        {request.attachment_name && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> {request.attachment_name}
          </span>
        )}
      </p>

      {/*
        Prazo só aparece quando existe regra administrativa por trás. Sem configuração, o portal
        não estima, não diz "em breve" e não promete nada — é o ponto do card.
      */}
      {request.sla_hint_date && !closed && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
          <Clock3 className="h-3 w-3" />
          Retorno previsto até {formatDateBR(request.sla_hint_date)} · prazo informativo
        </p>
      )}

      {request.events.length > 1 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-gray-500 hover:text-gray-700">
            Histórico · {request.events.length} registro(s)
          </summary>
          <ul className="mt-1.5 space-y-1.5 border-l border-gray-200 pl-2.5">
            {request.events.map((event) => (
              <li key={event.id} className="text-[11px] text-gray-600">
                <span className="font-semibold text-gray-700">
                  {event.actor_kind === 'client' ? 'Você' : event.actor_name || 'Consultoria'}
                </span>
                <span className="text-gray-500"> · {formatDateBR(event.created_at)}</span>
                {event.note && <p className="whitespace-pre-wrap">{event.note}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {closed && request.status === 'resolved' && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Concluída{request.closed_at ? ` em ${formatDateBR(request.closed_at)}` : ''}. Precisa de mais
          alguma coisa? Registre uma solicitação nova.
        </p>
      )}

      {request.accepts_reply && onReply && (
        <ReplyForm request={request} author={author} onAuthorChange={onAuthorChange} onReply={onReply} />
      )}
    </li>
  );
}

// ─── Seção ────────────────────────────────────────────────────────────────────

export function PortalServiceRequests({
  requests,
  units,
  loading,
  error,
  onCreate,
  onReply,
  onRetry,
}: PortalServiceRequestsProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [author, setAuthor] = useState(readStoredAuthor);

  const handleAuthorChange = (next: { byName: string; byRole: string }) => {
    setAuthor(next);
    storeAuthor(next);
  };

  if (loading) {
    return <section className="mb-6 h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-50" aria-hidden="true" />;
  }

  if (error) {
    return (
      <section className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 sm:flex-row sm:items-center sm:justify-between">
        <p role="alert">
          Não foi possível carregar suas solicitações agora. Atualize a página ou fale com a equipe
          da consultoria.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        )}
      </section>
    );
  }

  const open = requests.filter((request) => request.waiting_on !== 'none');
  const closed = requests.filter((request) => request.waiting_on === 'none');
  const waitingClient = open.filter((request) => request.waiting_on === 'client').length;
  const showUnitName = units.length > 1;

  return (
    <section
      id="portal-service-requests"
      aria-labelledby="portal-service-requests-title"
      className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3
          id="portal-service-requests-title"
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700"
        >
          <Headset className="h-4 w-4 text-primary-700" /> Solicitações
        </h3>
        <span className="text-xs font-medium text-gray-500">
          {open.length} em andamento
          {waitingClient > 0 && (
            <span className="ml-1 font-bold text-amber-700">· {waitingClient} aguardando você</span>
          )}
          {closed.length > 0 && <span className="ml-1">· {closed.length} encerrada(s)</span>}
        </span>
      </div>

      {flash && (
        <p className="mb-3 flex items-start justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span>{flash}</span>
          <button type="button" onClick={() => setFlash(null)} aria-label="Fechar aviso">
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}

      {onCreate && (
        <>
          <button
            type="button"
            onClick={() => {
              setFormOpen((value) => !value);
              setFlash(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {formOpen ? 'Cancelar' : 'Nova solicitação'}
          </button>
          {formOpen && (
            <NewRequestForm
              units={units}
              author={author}
              onAuthorChange={handleAuthorChange}
              onCreate={onCreate}
              onDone={(message) => {
                setFormOpen(false);
                setFlash(message);
              }}
            />
          )}
        </>
      )}

      {requests.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          Você ainda não abriu nenhuma solicitação. Use este canal para pedir apoio da consultoria
          em documentação, licenciamento, obra, treinamento ou dúvida de rotina — cada pedido
          ganha um número e você acompanha o andamento por aqui.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {open.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              showUnitName={showUnitName}
              author={author}
              onAuthorChange={handleAuthorChange}
              onReply={onReply}
            />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700">
            Encerradas · {closed.length} solicitação(ões)
          </summary>
          <ul className="mt-2 space-y-2">
            {closed.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                showUnitName={showUnitName}
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
