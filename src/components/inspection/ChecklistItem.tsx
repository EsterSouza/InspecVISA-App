import React, { useState, useEffect, useRef, memo } from 'react';
import { AlertTriangle, Check, CheckSquare, ChevronDown, ExternalLink, FileCheck2, ListChecks, MessageSquare, Pencil, Square, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import {
  DEADLINE_OPTIONS,
  RESPONSIBLE_OPTIONS,
  dueDateFor,
  resolveRecurringDueDate,
} from '../../utils/clientActionPlan';
import { PhotoCapture } from './PhotoCapture';
import { LinkCapture } from './LinkCapture';
import type { ChecklistItem as ItemType, InspectionResponse, InspectionPhoto } from '../../types';
import type { PreviousNCContext } from '../../utils/actionPlanContext';
import {
  ClientEvidenceService,
  type ClientCheckpointForItem,
  type ClientDeclarationForItem,
  type ClientEvidenceForItem,
} from '../../services/clientEvidenceService';
import { getFieldSuggestions, type FieldSuggestions } from '../../utils/textSuggestions';
import { parseCheckpoints, VERBOS_DE_ATALHO } from '../../utils/actionCheckpoints';
import { legislationUrlForItem } from '../../utils/legislationRefs';
import { VoiceDictationButton } from './VoiceDictationButton';
import { toast } from '../../store/useToastStore';

/**
 * O verbo de atalho que ela abriu por último e ainda não completou, no fim do texto.
 *
 * Só o último: um tópico já escrito acima nunca pode ser reescrito por um clique de
 * botão — o texto é a identidade do tópico no portal, e mudá-lo faria o cliente perder
 * o que já tivesse marcado ali.
 */
const ATALHO_PENDURADO = new RegExp(
  `(^|\\n)[ \\t]*-[ \\t]*(?:${VERBOS_DE_ATALHO.join('|')})[ \\t]*$`,
  'i'
);

function isInlineImage(value?: string | null) {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value || '');
}

/** `2026-09-21` → `21/09/2026`, sem passar por `new Date` (que puxaria fuso). */
function formatDay(key?: string | null): string {
  if (!key) return '';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}

interface ChecklistItemProps {
  item: ItemType;
  response?: InspectionResponse;
  previousNC?: PreviousNCContext;
  /** REL-03 — o que o cliente alegou ter corrigido neste requisito, desde a última visita. */
  clientEvidence?: ClientEvidenceForItem[];
  /** PORT-03 — a situação que o cliente declarou, inclusive "ainda não fiz" com o motivo. */
  clientDeclaration?: ClientDeclarationForItem;
  /** PORT-05 — cada tópico da ação anterior e se o cliente marcou como feito. */
  clientCheckpoints?: ClientCheckpointForItem[];
  /** Data desta visita: é dela que um prazo novo é contado. */
  visitDate?: Date;
  /** Prazo já pactuado e aberto no portal para este requisito (YYYY-MM-DD). */
  pactuatedDueDate?: string | null;
  onChange: (itemId: string, result: InspectionResponse['result']) => void;
  onUpdateDetails: (itemId: string, details: Partial<InspectionResponse>) => void;
  /** Avisa a página que o painel de detalhes está aberto: com filtro ligado, o
   *  item fica na lista enquanto ela escreve, mesmo já tendo saído do filtro. */
  onDetailsToggle?: (itemId: string, open: boolean) => void;
  onAddPhoto: (itemId: string, photo: Omit<InspectionPhoto, 'id'>) => void | Promise<void>;
  onRemovePhoto: (itemId: string, id: string) => void;
  onEdit?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
}

const EVIDENCE_LABELS: Record<ClientEvidenceForItem['status'], string> = {
  pending: 'Aguardando sua revisão',
  approved: 'Aprovada por você',
  changes_requested: 'Devolvida para ajuste',
};

const EVIDENCE_THEME: Record<ClientEvidenceForItem['status'], string> = {
  pending: 'bg-secondary-100 text-secondary-800',
  approved: 'bg-success-soft text-success-soft-ink',
  changes_requested: 'bg-amber-soft text-amber-soft-ink',
};

/**
 * REL-03 — o que o cliente alegou, aqui dentro da caixa do item.
 *
 * É esta a tela em que a consultora decide "cumpre" ou "não cumpre", dentro da casa. Sem isto
 * ela decidia sem saber que o cliente tinha mandado o protocolo em julho — a prova existia, mas
 * ficava no painel de Agendamentos, longe da decisão.
 *
 * O arquivo abre por URL temporária, assinada na hora do clique. Se a visita estiver sem sinal,
 * o texto (que é o que sustenta a decisão) continua na tela; só a imagem não abre.
 */
function ClientEvidencePanel({ evidence }: { evidence: ClientEvidenceForItem[] }) {
  const [openingId, setOpeningId] = useState<string | null>(null);

  const open = async (row: ClientEvidenceForItem) => {
    setOpeningId(row.evidenceId);
    try {
      const url = await ClientEvidenceService.signedUrl(row);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else toast.error('Não foi possível abrir o arquivo agora.', 'Confira a conexão.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-secondary-200 bg-secondary-50/70 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary-800">
        <FileCheck2 className="h-3.5 w-3.5" /> O que o cliente enviou ({evidence.length})
      </p>
      <div className="space-y-2">
        {evidence.map((row) => (
          <div key={row.evidenceId} className="rounded-md border border-secondary-100 bg-surface px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${EVIDENCE_THEME[row.status]}`}>
                {EVIDENCE_LABELS[row.status]}
              </span>
              <span className="text-[11px] text-navy-3">
                {new Date(row.submittedAt).toLocaleDateString('pt-BR')}
              </span>
              {row.byName && (
                <span className="text-[11px] font-medium text-navy-2">
                  {row.byName}
                  {row.byRole ? ` — ${row.byRole}` : ''}
                </span>
              )}
            </div>
            {row.clientNote && (
              <p className="mt-1 break-words text-xs text-navy">
                <span className="font-semibold">Alegação: </span>
                {row.clientNote}
              </p>
            )}
            {row.reviewNote && (
              <p className="mt-1 break-words text-[11px] text-navy-2">
                <span className="font-semibold">Sua orientação: </span>
                {row.reviewNote}
              </p>
            )}
            <button
              type="button"
              onClick={() => void open(row)}
              disabled={openingId === row.evidenceId}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-800 underline hover:text-secondary-900 disabled:opacity-60"
            >
              <ExternalLink className="h-3 w-3" />
              {openingId === row.evidenceId ? 'Abrindo...' : row.fileName}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * PORT-05 — ponto a ponto do que ela mandou fazer da última vez, com o que o cliente marcou.
 *
 * É o que muda a conversa na porta da casa. "O cliente disse que está providenciando" não diz
 * o que falta; isto diz: dois dos três feitos, e o que ficou é o POP. Ela chega sabendo por
 * onde começar a olhar.
 */
function PreviousCheckpoints({ checkpoints }: { checkpoints: ClientCheckpointForItem[] }) {
  const done = checkpoints.filter((checkpoint) => checkpoint.done).length;

  return (
    <div className="mt-3 rounded-lg border border-amber-soft-border bg-surface/70 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-soft-ink">
        <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
        O que o cliente marcou: {done} de {checkpoints.length}
      </p>
      <ul className="space-y-1">
        {checkpoints.map((checkpoint) => (
          <li key={checkpoint.checkpointId} className="flex items-start gap-1.5 text-xs leading-relaxed">
            {checkpoint.done
              ? <CheckSquare className="mt-px h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              : <Square className="mt-px h-3.5 w-3.5 shrink-0 text-navy-3" aria-hidden="true" />}
            <span className="min-w-0 break-words text-navy">
              {checkpoint.text}
              {checkpoint.done && (
                <span className="text-navy-3">
                  {' — diz que fez'}
                  {checkpoint.doneAt ? ` em ${new Date(checkpoint.doneAt).toLocaleDateString('pt-BR')}` : ''}
                  {checkpoint.doneByName ? `, por ${checkpoint.doneByName}` : ''}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10.5px] text-navy-2">
        É a versão do cliente. Quem confirma é a sua vistoria.
      </p>
    </div>
  );
}

const DECLARED_LABELS: Record<ClientDeclarationForItem['status'], string> = {
  done: 'Cliente diz que JÁ CORRIGIU',
  in_progress: 'Cliente diz que ESTÁ PROVIDENCIANDO',
  not_done: 'Cliente diz que AINDA NÃO FEZ',
};

const DECLARED_THEME: Record<ClientDeclarationForItem['status'], string> = {
  done: 'border-success-soft-border bg-success-soft text-success-soft-ink',
  in_progress: 'border-secondary-300 bg-secondary-50 text-secondary-900',
  not_done: 'border-amber-soft-border bg-amber-soft text-amber-soft-ink',
};

/**
 * PORT-03 — a resposta do cliente sobre esta pendência, na tela em que a consultora decide.
 *
 * O caso que motivou: *"não tem onde dizer que a pasta não foi feita"*. Quem não corrigiu ficava
 * calado, e calado é indistinguível de "nem abriu o portal". Agora a diferença chega até aqui:
 * chegar na casa sabendo que o responsável técnico está de licença muda a conversa.
 */
function ClientDeclarationPanel({ declaration }: { declaration: ClientDeclarationForItem }) {
  return (
    <div className={`mt-3 rounded-lg border p-3 text-sm ${DECLARED_THEME[declaration.status]}`}>
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
        <MessageSquare className="h-3.5 w-3.5" /> {DECLARED_LABELS[declaration.status]}
        {declaration.at && (
          <span className="font-normal normal-case opacity-80">
            · {new Date(declaration.at).toLocaleDateString('pt-BR')}
          </span>
        )}
      </p>
      {declaration.note && <p className="mt-1.5 break-words text-xs">{declaration.note}</p>}
      {declaration.byName && (
        <p className="mt-1 text-[11px] opacity-80">
          {declaration.byName}
          {declaration.byRole ? ` — ${declaration.byRole}` : ''}
        </p>
      )}
    </div>
  );
}

/**
 * O que os traços que ela acabou de escrever vão virar.
 *
 * O parser é conservador, mas conservador não basta: se ele decide calado, ela só
 * descobre o que saiu quando o relatório já foi. Aqui ela vê a divisão enquanto
 * digita — e, se não era isso que queria, tira o traço.
 */
function CheckpointPreview({ points, kind }: { points: string[]; kind: 'acao' | 'situacao' }) {
  if (points.length === 0) return null;
  const label = kind === 'acao'
    ? `${points.length} tarefa${points.length === 1 ? '' : 's'} — o cliente responde uma por uma`
    : `${points.length} ponto${points.length === 1 ? '' : 's'} em destaque no relatório`;

  return (
    <div className="rounded-md border border-dashed border-default bg-surface-sunken p-2">
      <p className="text-[11px] font-semibold text-navy-2">{label}</p>
      <ol className="mt-1 space-y-0.5">
        {points.map((point, index) => (
          <li key={index} className="flex gap-1.5 text-[11px] leading-[1.45] text-navy-2">
            <span className="shrink-0 tabular-nums text-navy-3">{index + 1}.</span>
            <span className="min-w-0 break-words">{point}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export const ChecklistItem = memo(function ChecklistItem({
  item,
  response,
  previousNC,
  clientEvidence,
  clientDeclaration,
  clientCheckpoints,
  visitDate,
  pactuatedDueDate,
  onChange,
  onUpdateDetails,
  onDetailsToggle,
  onAddPhoto,
  onRemovePhoto,
  onEdit,
  onDelete,
}: ChecklistItemProps) {
  const [showObs, setShowObs] = useState(!!response?.situationDescription || !!response?.correctiveAction || (response?.photos?.length ?? 0) > 0 || (response?.links?.length ?? 0) > 0);

  // Local buffers — prevent global re-render on every keystroke
  const [localSituation, setLocalSituation] = useState(response?.situationDescription || '');
  const [localAction, setLocalAction] = useState(response?.correctiveAction || '');

  const [isFocused, setIsFocused] = useState<string | null>(null);

  useEffect(() => {
    onDetailsToggle?.(item.id, showObs);
  }, [showObs, item.id, onDetailsToggle]);

  // Marcar NÃO CUMPRE abre o painel sozinho: situação e ação são obrigatórias, e
  // no celular um toque a mais para descobrir isso é um toque que ela não dá.
  // Só na transição — recolher o painel depois continua valendo.
  const previousResult = useRef(response?.result);
  // Texto de uma NC que virou CUMPRE (ou outro resultado) na mesma visita: some
  // da tela e do relatório (senão o PDF lista a antiga "situação encontrada"
  // como se fosse sugestão de melhoria, com responsável e prazo de uma pendência
  // que não existe mais) e volta se ela apertar NÃO CUMPRE de novo por engano.
  // Só dura enquanto o item segue montado na tela.
  const stashedNCTextRef = useRef<{
    situationDescription: string;
    correctiveAction: string;
    responsible: string;
    deadline: string;
  } | null>(null);
  useEffect(() => {
    const prev = previousResult.current;
    const curr = response?.result;
    if (curr === 'not_complies' && prev !== 'not_complies') {
      if (
        stashedNCTextRef.current
        && !response?.situationDescription && !response?.correctiveAction
        && !response?.responsible && !response?.deadline
      ) {
        onUpdateDetails(item.id, { ...stashedNCTextRef.current });
      }
      stashedNCTextRef.current = null;
    } else if (prev === 'not_complies' && curr && curr !== 'not_complies') {
      const situationDescription = response?.situationDescription || '';
      const correctiveAction = response?.correctiveAction || '';
      const responsible = response?.responsible || '';
      const deadline = response?.deadline || '';
      if (situationDescription || correctiveAction || responsible || deadline) {
        stashedNCTextRef.current = { situationDescription, correctiveAction, responsible, deadline };
        onUpdateDetails(item.id, { situationDescription: '', correctiveAction: '', responsible: '', deadline: '' });
      }
    }
    previousResult.current = curr;
  }, [
    response?.result,
    response?.situationDescription,
    response?.correctiveAction,
    response?.responsible,
    response?.deadline,
    item.id,
    onUpdateDetails,
  ]);

  // Sugestões do próprio histórico deste item: busca preguiçosa, só quando a
  // consultora abre a seção de observações — evita consultar o Dexie pra cada
  // um dos 100+ itens da tela toda de uma vez.
  const [suggestions, setSuggestions] = useState<FieldSuggestions | null>(null);
  const [showAllSituationSuggestions, setShowAllSituationSuggestions] = useState(false);
  const [showAllActionSuggestions, setShowAllActionSuggestions] = useState(false);
  useEffect(() => {
    if (!showObs || suggestions) return;
    let cancelled = false;
    getFieldSuggestions(item.id, item.description).then((result) => { if (!cancelled) setSuggestions(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, [showObs, suggestions, item.id, item.description]);

  // Outside an active edit, render the latest store value directly. This keeps
  // remote updates visible without synchronously copying props into state.
  const situationValue = isFocused === 'situation' ? localSituation : (response?.situationDescription || '');
  const actionValue = isFocused === 'action' ? localAction : (response?.correctiveAction || '');
  // Responsável e prazo são `Select`: gravam no `onChange`, sem buffer local.
  const responsibleValue = response?.responsible || '';
  const deadlineValue = response?.deadline || '';

  // ─── AUTO-SAVE WHILE TYPING (1.5s debounce) ───────────────────────────────
  // This guarantees data is saved even if the user never leaves the field.
  useEffect(() => {
    if (isFocused !== 'situation') return;
    if (localSituation === (response?.situationDescription || '')) return;
    const t = setTimeout(() => onUpdateDetails(item.id, { situationDescription: localSituation }), 1500);
    return () => clearTimeout(t);
  }, [isFocused, localSituation, response?.situationDescription, onUpdateDetails, item.id]);

  useEffect(() => {
    if (isFocused !== 'action') return;
    if (localAction === (response?.correctiveAction || '')) return;
    const t = setTimeout(() => onUpdateDetails(item.id, { correctiveAction: localAction }), 1500);
    return () => clearTimeout(t);
  }, [isFocused, localAction, response?.correctiveAction, onUpdateDetails, item.id]);

  // onBlur: save immediately (catches fast navigation)
  const handleBlur = (field: keyof InspectionResponse, value: string) => {
    setIsFocused(null);
    if ((response?.[field] || '') !== value) {
      onUpdateDetails(item.id, { [field]: value });
    }
  };

  const isSelected = !!response?.result;
  const isNotCompliant = response?.result === 'not_complies';

  // Prazo de pendência reincidente: a data combinada na primeira vez continua
  // valendo. Ela volta a ser negociável quando vence (ou está perto), e encurtar
  // sempre vale. Só faz sentido em NC, e só quando há prazo aberto no portal.
  const baseVisitDate = visitDate ?? new Date();
  const prazo = isNotCompliant && pactuatedDueDate
    ? resolveRecurringDueDate(pactuatedDueDate, dueDateFor(deadlineValue, baseVisitDate), baseVisitDate)
    : null;
  const hasError = isNotCompliant && (!response?.situationDescription || !response?.correctiveAction);

  // Preenche só os campos ainda vazios com o texto da visita anterior — nunca
  // sobrescreve o que a consultora já digitou. Só oferece o botão quando marcar
  // um resultado (não escolhe NÃO CUMPRE por ela) e quando sobrar algo a preencher.
  const canReuseTextoAnterior = isSelected && !!previousNC && (
    (!situationValue.trim() && !!previousNC.situationDescription) ||
    (!actionValue.trim() && !!previousNC.correctiveAction) ||
    (!responsibleValue.trim() && !!previousNC.responsible) ||
    (!deadlineValue.trim() && !!previousNC.deadline)
  );

  const handleUseTextoAnterior = () => {
    if (!previousNC) return;
    const details: Partial<InspectionResponse> = {};
    if (!situationValue.trim() && previousNC.situationDescription) {
      setLocalSituation(previousNC.situationDescription);
      details.situationDescription = previousNC.situationDescription;
    }
    if (!actionValue.trim() && previousNC.correctiveAction) {
      setLocalAction(previousNC.correctiveAction);
      details.correctiveAction = previousNC.correctiveAction;
    }
    if (!responsibleValue.trim() && previousNC.responsible) {
      details.responsible = previousNC.responsible;
    }
    if (!deadlineValue.trim() && previousNC.deadline) {
      details.deadline = previousNC.deadline;
    }
    if (Object.keys(details).length > 0) onUpdateDetails(item.id, details);
    setShowObs(true);
  };

  // Estado em três canais: a cor, a FORMA do traço da esquerda (contínuo para
  // resolvido, tracejado para pendente) e a palavra escrita nos selos.
  // `border-default` pinta os QUATRO lados e, no CSS gerado, vence o
  // `border-l-*` que vem depois na string de classes — a borda de estado saía
  // cinza desde o FE-23. As outras três bordas passam a ser nomeadas por lado.
  const OUTRAS_BORDAS = 'border-y-default border-r-default';
  const getBorderColor = () => {
    if (!isSelected) return `border-l-4 [border-left-style:dashed] border-l-amber ${OUTRAS_BORDAS}`;
    if (response.result === 'complies') return `border-l-4 border-l-success ${OUTRAS_BORDAS}`;
    if (isNotCompliant) return `border-l-4 border-l-danger ${OUTRAS_BORDAS}`;
    return `border-l-4 border-l-navy-3 ${OUTRAS_BORDAS}`;
  };

  return (
    <div
      id={`item-${item.id}`}
      className={cn(
        // No celular o item não é cartão: é uma faixa da lista, encostada nas
        // bordas. A borda esquerda de estado continua sendo a mesma nos dois.
        'scroll-mt-[97px] border-x-0 border-b border-t-0 bg-surface px-3 pb-[13px] pt-[11px]',
        'lg:scroll-mt-44 lg:rounded-lg lg:border lg:p-5 lg:shadow-sm',
        getBorderColor(),
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 space-y-1.5 lg:space-y-2 lg:pr-4">
          {/* Header row with badges — no celular esta linha desce para baixo do
              texto do requisito, que é o que ela precisa ler primeiro. */}
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <Badge variant="neutral" className="tabular-nums">{`Item ${item.order}`}</Badge>
            {item.isCritical && (
              <Badge variant="danger">
                <AlertTriangle className="mr-1 h-3 w-3" />
                crítico
              </Badge>
            )}
            {previousNC && (
              <Badge variant="warning">reincidência</Badge>
            )}
            {!isSelected && <Badge variant="warning">sem resposta</Badge>}
            {item.legislation && (
              <span className="inline-flex items-center rounded-full border border-control px-2 py-0.5 text-xs font-medium text-navy-2">
                {item.legislation}
                {legislationUrlForItem(item) && (
                  <a
                    href={legislationUrlForItem(item)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir a norma ${item.legislation} na biblioteca`}
                    // No dedo o alvo cresce para 44px sem esticar o selo: a área
                    // clicável sai para fora com margem negativa.
                    className="ml-1 inline-flex items-center justify-center text-primary-700 hover:text-primary-800 [@media(pointer:coarse)]:-my-4 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            )}
          </div>

          {/* Celular: número e requisito na mesma linha — o texto inteiro, sem
              clamp: é a pergunta que ela está respondendo. */}
          <div className="flex items-baseline gap-1.5 lg:block">
            <span
              className="shrink-0 text-[11px] font-bold leading-[1.4] tabular-nums text-navy-3 lg:hidden"
              aria-hidden="true"
            >
              {item.order}
            </span>
            <p className="text-[14.5px] font-medium leading-[1.45] text-navy [text-wrap:pretty] lg:mt-2 lg:text-[15px] lg:leading-relaxed">
              {item.id.startsWith('extra|') ? (response?.customDescription || item.description) : item.description}
            </p>
          </div>

          {/* Celular: selos e base legal descem para a linha de baixo, recuados
              para alinhar sob o texto (a largura do número + o gap). */}
          <div className="flex flex-wrap items-center gap-1.5 pl-[17px] lg:hidden">
            {item.isCritical && (
              <span className="rounded bg-danger-soft px-1.5 py-px text-[10px] font-bold leading-[1.5] text-danger-soft-ink">
                crítico
              </span>
            )}
            {previousNC && (
              <span className="rounded bg-amber-soft px-1.5 py-px text-[10px] font-bold leading-[1.5] text-amber-soft-ink">
                reincidência
              </span>
            )}
            {item.legislation && (
              legislationUrlForItem(item) ? (
                <a
                  href={legislationUrlForItem(item)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir a norma ${item.legislation} na biblioteca`}
                  // O alvo de 44px sai para fora com margem negativa, sem esticar a linha.
                  className="-my-3.5 inline-flex min-h-11 min-w-11 items-center gap-1 text-[10.5px] font-semibold text-primary-700"
                >
                  {item.legislation}
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-[10.5px] font-semibold text-navy-2">{item.legislation}</span>
              )
            )}
          </div>

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1 pl-[17px] lg:pl-0">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50"
                  aria-label={'Editar item extra ' + item.description}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                  aria-label={'Excluir item extra ' + item.description}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {previousNC && (
        <div className="mt-4 rounded-lg border border-amber-soft-border bg-amber-soft p-4 text-sm text-amber-soft-ink">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="warning" className="bg-amber-soft text-amber-soft-ink border-amber-soft-border">
              Plano de acao anterior
            </Badge>
            <span className="text-[11px] font-semibold text-amber-soft-ink">
              {new Date(previousNC.inspectionDate).toLocaleDateString('pt-BR')}
            </span>
            {canReuseTextoAnterior && (
              <button
                type="button"
                onClick={handleUseTextoAnterior}
                className="ml-auto rounded-full border border-amber-soft-border bg-surface px-2.5 py-0.5 text-[11px] font-bold text-amber-soft-ink shadow-sm transition-colors hover:bg-amber-soft"
              >
                Usar texto anterior
              </button>
            )}
          </div>
          <div className="space-y-2 text-xs leading-relaxed">
            {previousNC.situationDescription && (
              <p><span className="font-bold">Situacao encontrada: </span>{previousNC.situationDescription}</p>
            )}
            {previousNC.correctiveAction && (
              <p><span className="font-bold">Acao recomendada: </span>{previousNC.correctiveAction}</p>
            )}
            {(previousNC.responsible || previousNC.deadline) && (
              <p className="text-amber-soft-ink">
                {previousNC.responsible ? `Responsavel: ${previousNC.responsible}` : ''}
                {previousNC.responsible && previousNC.deadline ? ' | ' : ''}
                {previousNC.deadline ? `Prazo: ${previousNC.deadline}` : ''}
              </p>
            )}
          </div>
          {previousNC.photos.some(photo => isInlineImage(photo.dataUrl)) && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previousNC.photos.filter(photo => isInlineImage(photo.dataUrl)).slice(0, 4).map(photo => (
                <img
                  key={photo.id}
                  src={photo.dataUrl}
                  alt="Evidencia da visita anterior"
                  className="aspect-square rounded-md border border-amber-soft-border object-cover"
                />
              ))}
            </div>
          )}

          {!!clientCheckpoints?.length && <PreviousCheckpoints checkpoints={clientCheckpoints} />}
          {clientDeclaration && <ClientDeclarationPanel declaration={clientDeclaration} />}
          {!!clientEvidence?.length && <ClientEvidencePanel evidence={clientEvidence} />}
        </div>
      )}

      {/* Item que não era NC na visita anterior, mas o cliente respondeu: mostra assim mesmo. */}
      {!previousNC && clientDeclaration && <ClientDeclarationPanel declaration={clientDeclaration} />}
      {!previousNC && !!clientEvidence?.length && <ClientEvidencePanel evidence={clientEvidence} />}

      {/* Os quatro resultados do domínio. "Parcial" não existe (decisão 23).
          `aria-pressed` é o estado; a cor é consequência, não a informação. */}
      {/* No celular os quatro cabem numa faixa só de 46px, agrupados por uma
          borda comum. O rótulo NÃO encolhe para sigla: "Cumpre" e "Não" lado a
          lado leem como um par sim/não, e é justamente esse par que decide a
          nota. Quebra em duas linhas dentro do próprio botão. */}
      <div
        className="mt-2.5 flex overflow-hidden rounded-[9px] border border-control lg:mt-5 lg:grid lg:grid-cols-4 lg:gap-3 lg:overflow-visible lg:rounded-none lg:border-0"
        role="group"
        aria-label={`Resultado do item ${item.order}`}
      >
        {([
          ['complies', 'Cumpre', ['Cumpre'], 'bg-success-soft text-success-soft-ink', 'lg:border-success'],
          ['not_complies', 'Não cumpre', ['Não', 'cumpre'], 'bg-danger-soft text-danger-soft-ink', 'lg:border-danger'],
          ['not_applicable', 'Não se aplica', ['Não se', 'aplica'], 'bg-surface-sunken text-navy', 'lg:border-navy-3'],
          ['not_observed', 'Não observado', ['Não', 'observado'], 'bg-surface-sunken text-navy', 'lg:border-navy-3'],
        ] as const).map(([value, label, lines, selectedFill, selectedBorder]) => {
          const selected = response?.result === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              aria-label={label}
              onClick={() => {
                if (value === 'not_complies') setShowObs(true);
                if (response?.result === 'not_complies' && value !== 'not_complies') {
                  setLocalSituation('');
                  setLocalAction('');
                }
                onChange(item.id, value);
              }}
              className={cn(
                'flex h-[46px] flex-1 flex-col items-center justify-center rounded-none border-r border-default px-1 text-center text-xs font-bold leading-[1.15] last:border-r-0',
                'lg:h-[52px] lg:flex-row lg:gap-1.5 lg:rounded-md lg:border lg:px-2 lg:text-[13px] lg:font-semibold',
                selected
                  ? `${selectedFill} ${selectedBorder} lg:ring-1`
                  : 'bg-surface text-navy-2 lg:border-control lg:hover:bg-surface-hover'
              )}
            >
              {value === 'complies' && <Check className="hidden h-4 w-4 shrink-0 lg:block" aria-hidden="true" />}
              {value === 'not_complies' && <AlertTriangle className="hidden h-4 w-4 shrink-0 lg:block" aria-hidden="true" />}
              <span className="lg:hidden" aria-hidden="true">
                {lines.map((line) => <span key={line} className="block">{line}</span>)}
              </span>
              <span className="hidden lg:inline" aria-hidden="true">{label}</span>
            </button>
          );
        })}
      </div>

      {/* "Obs" com seta girada 90° e bolinha de notificação sai. Cumpre não exige
          texto — o campo abre quando a consultora quiser elogiar ou sugerir. */}
      {isSelected && !showObs && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowObs(true)}
            aria-expanded={false}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
            style={{ minHeight: 44 }}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
            {isNotCompliant ? 'Descrever a não conformidade' : 'Registrar observação'}
          </button>
          {hasError && (
            <span className="text-sm font-medium text-danger-soft-ink">
              {!response?.situationDescription && !response?.correctiveAction
                ? 'faltam situação e ação'
                : !response?.situationDescription ? 'falta a situação' : 'falta a ação'}
            </span>
          )}
          {!isNotCompliant && (
            <span className="text-xs text-navy-3">Cumpre não exige texto.</span>
          )}
        </div>
      )}

      {/* Expanded Details Section (For any status if toggled) */}
      {showObs && isSelected && (
        // O painel deixa de mudar de cor entre índigo e vermelho conforme o
        // resultado — a informação já está na borda esquerda do cartão.
        <div className="mt-2.5 space-y-3 rounded-[9px] border border-default bg-surface-hover p-2.5 lg:mt-6 lg:space-y-5 lg:rounded-md lg:bg-surface-sunken lg:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-navy">
              {isNotCompliant ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <FileCheck2 className="h-4 w-4" aria-hidden="true" />}
              <h4 className="text-sm font-semibold">
                {isNotCompliant ? 'Detalhes da não conformidade' : 'Observação'}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowObs(false)}
              aria-expanded
              className="rounded-md px-2 py-1 text-sm font-medium text-navy-2 hover:bg-surface-active [@media(pointer:coarse)]:min-h-11"
            >
              Recolher
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`situacao-${item.id}`} required={isNotCompliant}>
                {isNotCompliant ? 'Situação encontrada' : 'O que foi observado'}
              </Label>
              <VoiceDictationButton onTranscript={(text) => setLocalSituation((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
            <Textarea
              id={`situacao-${item.id}`}
              className={cn(
                'min-h-16 resize-y lg:min-h-[100px]',
                !response?.situationDescription && hasError && 'border-danger focus-visible:border-danger focus-visible:ring-danger'
              )}
              placeholder={isNotCompliant ? 'Descreva a falha observada…' : 'Descreva pontos positivos ou o que pode ser elevado para alto padrão…'}
              value={situationValue}
              onChange={(e) => setLocalSituation(e.target.value)}
              onFocus={() => {
                setLocalSituation(response?.situationDescription || '');
                setIsFocused('situation');
              }}
              onBlur={(e) => handleBlur('situationDescription', e.target.value)}
            />
            <CheckpointPreview points={parseCheckpoints(situationValue).points} kind="situacao" />
            {!!suggestions?.situationDescription.length && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
                <span className="shrink-0 text-xs font-medium text-navy-3">Já usado antes:</span>
                {(showAllSituationSuggestions ? suggestions.situationDescription : suggestions.situationDescription.slice(0, 4)).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      setLocalSituation(text);
                      onUpdateDetails(item.id, { situationDescription: text });
                    }}
                    title={text}
                    className="max-w-[220px] shrink-0 truncate rounded-md border border-control bg-surface px-2.5 py-1.5 text-xs font-medium text-navy-2 hover:bg-surface-hover [@media(pointer:coarse)]:min-h-11"
                  >
                    {text}
                  </button>
                ))}
                {!showAllSituationSuggestions && suggestions.situationDescription.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSituationSuggestions(true)}
                    className="shrink-0 rounded-md px-2 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 [@media(pointer:coarse)]:min-h-11"
                  >
                    +{suggestions.situationDescription.length - 4} mais
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`acao-${item.id}`} required={isNotCompliant}>
                {isNotCompliant ? 'O que precisa ser feito' : 'Sugestões de melhoria'}
              </Label>
              <VoiceDictationButton onTranscript={(text) => setLocalAction((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
            {isNotCompliant && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
                {VERBOS_DE_ATALHO.map((verb) => (
                  <button
                    key={verb}
                    onClick={() => {
                      // Clicar num segundo verbo troca o primeiro, que ficou pendurado
                      // esperando o complemento — antes ele sobrava sozinho na linha e
                      // virava uma tarefa chamada só "Abolir" no portal do cliente.
                      const current = actionValue.trim().replace(ATALHO_PENDURADO, '').trim();
                      const prefix = current ? `${current} \n- ` : '- ';
                      const newVal = `${prefix}${verb} `;
                      setLocalAction(newVal);
                      onUpdateDetails(item.id, { correctiveAction: newVal });
                    }}
                    className="shrink-0 rounded-md border border-control bg-surface px-2.5 py-1.5 text-xs font-medium text-navy-2 hover:bg-surface-hover [@media(pointer:coarse)]:min-h-11"
                  >
                    {verb}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              id={`acao-${item.id}`}
              className={cn(
                'min-h-16 resize-y lg:min-h-[100px]',
                !response?.correctiveAction && hasError && 'border-danger focus-visible:border-danger focus-visible:ring-danger'
              )}
              placeholder={isNotCompliant ? 'O que precisa ser feito para adequação…' : 'Dê sugestões para que o local atinja a nota máxima ou mantenha o brilho…'}
              value={actionValue}
              onChange={(e) => setLocalAction(e.target.value)}
              onFocus={() => {
                setLocalAction(response?.correctiveAction || '');
                setIsFocused('action');
              }}
              onBlur={(e) => handleBlur('correctiveAction', e.target.value)}
            />
            <CheckpointPreview points={parseCheckpoints(actionValue).points} kind="acao" />
            {!!suggestions?.correctiveAction.length && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
                <span className="shrink-0 text-xs font-medium text-navy-3">Já usado antes:</span>
                {(showAllActionSuggestions ? suggestions.correctiveAction : suggestions.correctiveAction.slice(0, 4)).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      setLocalAction(text);
                      onUpdateDetails(item.id, { correctiveAction: text });
                    }}
                    title={text}
                    className="max-w-[220px] shrink-0 truncate rounded-md border border-control bg-surface px-2.5 py-1.5 text-xs font-medium text-navy-2 hover:bg-surface-hover [@media(pointer:coarse)]:min-h-11"
                  >
                    {text}
                  </button>
                ))}
                {!showAllActionSuggestions && suggestions.correctiveAction.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllActionSuggestions(true)}
                    className="shrink-0 rounded-md px-2 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 [@media(pointer:coarse)]:min-h-11"
                  >
                    +{suggestions.correctiveAction.length - 4} mais
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Responsável e prazo eram campo de texto com sugestão: aceitavam qualquer texto, e
              "assim que possível" produzia pendência que nunca vence. Viram lista
              fechada (decisão 33), com "Sem prazo definido" dentro dela. Valor
              antigo fora da lista continua sendo exibido, para não sumir de
              relatório já preenchido. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`responsavel-${item.id}`}>Responsável pela correção</Label>
              <Select
                id={`responsavel-${item.id}`}
                className="h-11"
                value={responsibleValue}
                onChange={(e) => onUpdateDetails(item.id, { responsible: e.target.value })}
              >
                <option value="">— não definido —</option>
                {RESPONSIBLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                {responsibleValue && !RESPONSIBLE_OPTIONS.includes(responsibleValue as never) && (
                  <option value={responsibleValue}>{responsibleValue}</option>
                )}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`prazo-${item.id}`}>Prazo</Label>
              <Select
                id={`prazo-${item.id}`}
                className="h-11"
                value={deadlineValue}
                onChange={(e) => onUpdateDetails(item.id, { deadline: e.target.value })}
              >
                <option value="">— escolha um prazo —</option>
                {DEADLINE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                {deadlineValue && !DEADLINE_OPTIONS.includes(deadlineValue as never) && (
                  <option value={deadlineValue}>{deadlineValue}</option>
                )}
              </Select>
              {prazo ? (
                <p className={cn('text-xs', prazo.expired ? 'text-amber-soft-ink' : 'text-navy-3')}>
                  {prazo.kind === 'mantido' && (
                    <>Prazo em vigor no portal: vence <strong>{formatDay(pactuatedDueDate)}</strong>.
                    {' '}A reincidência não reinicia a contagem; escolher aqui só encurta.</>
                  )}
                  {prazo.kind === 'encurtado' && (
                    <>Vencia {formatDay(pactuatedDueDate)}. Sua escolha encurta para{' '}
                    <strong>{formatDay(prazo.effective)}</strong>.</>
                  )}
                  {prazo.kind === 'repactuado' && (
                    <>
                      Prazo em vigor {prazo.expired ? 'venceu' : 'vence'} em{' '}
                      {formatDay(pactuatedDueDate)}: o escolhido aqui passa a valer
                      {prazo.effective ? <>, vencendo <strong>{formatDay(prazo.effective)}</strong></> : ' sem data'}.
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs text-navy-3">Contado a partir da data da visita.</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <PhotoCapture
              inputId={`photo-upload-${item.id}`}
              photos={response?.photos || []}
              onAddPhoto={(p) => onAddPhoto(item.id, p)}
              onRemovePhoto={(pid) => onRemovePhoto(item.id, pid)}
            />
          </div>

          <div className="pt-2">
            <LinkCapture
              inputId={`link-input-${item.id}`}
              links={response?.links || []}
              onChange={(links) => onUpdateDetails(item.id, { links })}
            />
          </div>
        </div>
      )}
    </div>
  );
})
