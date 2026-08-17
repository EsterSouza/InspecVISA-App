import React, { useState, useEffect, memo } from 'react';
import { AlertTriangle, Check, ChevronDown, ExternalLink, FileCheck2, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { DEADLINE_OPTIONS, RESPONSIBLE_OPTIONS } from '../../utils/clientActionPlan';
import { PhotoCapture } from './PhotoCapture';
import { LinkCapture } from './LinkCapture';
import type { ChecklistItem as ItemType, InspectionResponse, InspectionPhoto } from '../../types';
import type { PreviousNCContext } from '../../utils/actionPlanContext';
import {
  ClientEvidenceService,
  type ClientDeclarationForItem,
  type ClientEvidenceForItem,
} from '../../services/clientEvidenceService';
import { getFieldSuggestions, type FieldSuggestions } from '../../utils/textSuggestions';
import { legislationUrlForItem } from '../../utils/legislationRefs';
import { VoiceDictationButton } from './VoiceDictationButton';
import { toast } from '../../store/useToastStore';

function isInlineImage(value?: string | null) {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value || '');
}

interface ChecklistItemProps {
  item: ItemType;
  response?: InspectionResponse;
  previousNC?: PreviousNCContext;
  /** REL-03 — o que o cliente alegou ter corrigido neste requisito, desde a última visita. */
  clientEvidence?: ClientEvidenceForItem[];
  /** PORT-03 — a situação que o cliente declarou, inclusive "ainda não fiz" com o motivo. */
  clientDeclaration?: ClientDeclarationForItem;
  onChange: (itemId: string, result: InspectionResponse['result']) => void;
  onUpdateDetails: (itemId: string, details: Partial<InspectionResponse>) => void;
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
  pending: 'bg-sky-100 text-sky-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-amber-100 text-amber-900',
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
    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/70 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-800">
        <FileCheck2 className="h-3.5 w-3.5" /> O que o cliente enviou ({evidence.length})
      </p>
      <div className="space-y-2">
        {evidence.map((row) => (
          <div key={row.evidenceId} className="rounded-md border border-sky-100 bg-white px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${EVIDENCE_THEME[row.status]}`}>
                {EVIDENCE_LABELS[row.status]}
              </span>
              <span className="text-[11px] text-gray-500">
                {new Date(row.submittedAt).toLocaleDateString('pt-BR')}
              </span>
              {row.byName && (
                <span className="text-[11px] font-medium text-gray-700">
                  {row.byName}
                  {row.byRole ? ` — ${row.byRole}` : ''}
                </span>
              )}
            </div>
            {row.clientNote && (
              <p className="mt-1 break-words text-xs text-gray-800">
                <span className="font-semibold">Alegação: </span>
                {row.clientNote}
              </p>
            )}
            {row.reviewNote && (
              <p className="mt-1 break-words text-[11px] text-gray-600">
                <span className="font-semibold">Sua orientação: </span>
                {row.reviewNote}
              </p>
            )}
            <button
              type="button"
              onClick={() => void open(row)}
              disabled={openingId === row.evidenceId}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 underline hover:text-sky-950 disabled:opacity-60"
            >
              <ExternalLink className="h-3 w-3" />
              {openingId === row.evidenceId ? 'Abrindo...' : row.fileName}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-sky-900/70">
        Receber a evidência não conclui a pendência — quem decide se foi cumprido é esta vistoria.
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
  done: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  in_progress: 'border-sky-300 bg-sky-50 text-sky-900',
  not_done: 'border-orange-300 bg-orange-50 text-orange-900',
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

export const ChecklistItem = memo(function ChecklistItem({
  item,
  response,
  previousNC,
  clientEvidence,
  clientDeclaration,
  onChange,
  onUpdateDetails,
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
  const getBorderColor = () => {
    if (!isSelected) return 'border-l-4 border-dashed border-l-amber border-gray-200';
    if (response.result === 'complies') return 'border-l-4 border-l-success border-gray-200';
    if (isNotCompliant) return 'border-l-4 border-l-danger border-gray-200';
    return 'border-l-4 border-l-navy-3 border-gray-200';
  };

  return (
    <div id={`item-${item.id}`} className={cn('scroll-mt-44 rounded-lg border bg-white p-5 shadow-sm', getBorderColor())}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 space-y-2 pr-4">
          {/* Header row with badges */}
          <div className="flex flex-wrap items-center gap-2">
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
              <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-xs font-medium text-navy-2">
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

          {/* A linha de leitura mora aqui, na pergunta — não na largura da página. */}
          <p className="mt-2 max-w-[68ch] text-[15px] font-medium leading-relaxed text-navy">
            {item.id.startsWith('extra|') ? (response?.customDescription || item.description) : item.description}
          </p>
        </div>
      </div>

      {previousNC && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">
              Plano de acao anterior
            </Badge>
            <span className="text-[11px] font-semibold text-amber-700">
              {new Date(previousNC.inspectionDate).toLocaleDateString('pt-BR')}
            </span>
            {canReuseTextoAnterior && (
              <button
                type="button"
                onClick={handleUseTextoAnterior}
                className="ml-auto rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100"
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
              <p className="text-amber-800">
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
                  className="aspect-square rounded-md border border-amber-200 object-cover"
                />
              ))}
            </div>
          )}

          {clientDeclaration && <ClientDeclarationPanel declaration={clientDeclaration} />}
          {!!clientEvidence?.length && <ClientEvidencePanel evidence={clientEvidence} />}
        </div>
      )}

      {/* Item que não era NC na visita anterior, mas o cliente respondeu: mostra assim mesmo. */}
      {!previousNC && clientDeclaration && <ClientDeclarationPanel declaration={clientDeclaration} />}
      {!previousNC && !!clientEvidence?.length && <ClientEvidencePanel evidence={clientEvidence} />}

      {/* Os quatro resultados do domínio. "Parcial" não existe (decisão 23).
          `aria-pressed` é o estado; a cor é consequência, não a informação. */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label={`Resultado do item ${item.order}`}>
        {([
          ['complies', 'Cumpre', 'border-success bg-success-soft text-success-soft-ink'],
          ['not_complies', 'Não cumpre', 'border-danger bg-danger-soft text-danger-soft-ink'],
          ['not_applicable', 'Não se aplica', 'border-navy-3 bg-gray-100 text-navy'],
          ['not_observed', 'Não observado', 'border-navy-3 bg-gray-100 text-navy'],
        ] as const).map(([value, label, selectedClasses]) => {
          const selected = response?.result === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(item.id, value)}
              className={cn(
                'flex h-[52px] items-center justify-center gap-1.5 rounded-md border px-2 text-[13px] font-semibold',
                selected
                  ? `${selectedClasses} ring-1`
                  : 'border-gray-300 bg-white text-navy-2 hover:bg-gray-50'
              )}
            >
              {value === 'complies' && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {value === 'not_complies' && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {label}
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
        <div className="mt-6 space-y-5 rounded-md border border-gray-200 bg-gray-50 p-5">
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
              className="rounded-md px-2 py-1 text-sm font-medium text-navy-2 hover:bg-gray-100 [@media(pointer:coarse)]:min-h-11"
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
                'min-h-[100px] resize-y',
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
            {!response?.situationDescription && hasError && (
              <p className="text-sm text-danger-soft-ink">
                Sem esta descrição o cliente recebe a pendência sem saber o que foi encontrado.
              </p>
            )}
            {!!suggestions?.situationDescription.length && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs font-medium text-navy-3">Já usado antes:</span>
                {(showAllSituationSuggestions ? suggestions.situationDescription : suggestions.situationDescription.slice(0, 4)).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      setLocalSituation(text);
                      onUpdateDetails(item.id, { situationDescription: text });
                    }}
                    title={text}
                    className="max-w-[220px] truncate rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-2 hover:bg-gray-50 [@media(pointer:coarse)]:min-h-11"
                  >
                    {text}
                  </button>
                ))}
                {!showAllSituationSuggestions && suggestions.situationDescription.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSituationSuggestions(true)}
                    className="rounded-md px-2 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 [@media(pointer:coarse)]:min-h-11"
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
              <div className="flex flex-wrap gap-1.5 pb-1">
                {['Providenciar', 'Substituir', 'Implementar', 'Abolir', 'Adequar'].map((verb) => (
                  <button
                    key={verb}
                    onClick={() => {
                      const current = actionValue.trim();
                      const prefix = current ? `${current} \n- ` : '- ';
                      const newVal = `${prefix}${verb} `;
                      setLocalAction(newVal);
                      onUpdateDetails(item.id, { correctiveAction: newVal });
                    }}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-2 hover:bg-gray-50 [@media(pointer:coarse)]:min-h-11"
                  >
                    {verb}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              id={`acao-${item.id}`}
              className={cn(
                'min-h-[100px] resize-y',
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
            {isNotCompliant && (
              <p className="text-xs text-navy-3">
                Sai assim, palavra por palavra, no portal do cliente e no PDF.
              </p>
            )}
            {!!suggestions?.correctiveAction.length && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs font-medium text-navy-3">Já usado antes:</span>
                {(showAllActionSuggestions ? suggestions.correctiveAction : suggestions.correctiveAction.slice(0, 4)).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      setLocalAction(text);
                      onUpdateDetails(item.id, { correctiveAction: text });
                    }}
                    title={text}
                    className="max-w-[220px] truncate rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-2 hover:bg-gray-50 [@media(pointer:coarse)]:min-h-11"
                  >
                    {text}
                  </button>
                ))}
                {!showAllActionSuggestions && suggestions.correctiveAction.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllActionSuggestions(true)}
                    className="rounded-md px-2 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 [@media(pointer:coarse)]:min-h-11"
                  >
                    +{suggestions.correctiveAction.length - 4} mais
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Responsável e prazo eram `<input list>`: aceitavam qualquer texto, e
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
              <p className="text-xs text-navy-3">É o setor, não a consultora.</p>
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
              <p className="text-xs text-navy-3">
                Vira data no plano de ação do cliente, contada a partir da visita.{' '}
                <strong>Sem prazo definido</strong> é uma escolha legítima — a pendência aparece no
                portal, mas nunca fica vencida.
              </p>
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
