import React, { useState, useEffect, memo } from 'react';
import { AlertTriangle, ExternalLink, LogIn, FileCheck2, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
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
      else alert('Nao foi possivel abrir o arquivo agora. Confira a conexao.');
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
  const [localResponsible, setLocalResponsible] = useState(response?.responsible || '');
  const [localDeadline, setLocalDeadline] = useState(response?.deadline || '');
  
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
  const responsibleValue = isFocused === 'responsible' ? localResponsible : (response?.responsible || '');
  const deadlineValue = isFocused === 'deadline' ? localDeadline : (response?.deadline || '');

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

  useEffect(() => {
    if (isFocused !== 'responsible') return;
    if (localResponsible === (response?.responsible || '')) return;
    const t = setTimeout(() => onUpdateDetails(item.id, { responsible: localResponsible }), 1500);
    return () => clearTimeout(t);
  }, [isFocused, localResponsible, response?.responsible, onUpdateDetails, item.id]);

  useEffect(() => {
    if (isFocused !== 'deadline') return;
    if (localDeadline === (response?.deadline || '')) return;
    const t = setTimeout(() => onUpdateDetails(item.id, { deadline: localDeadline }), 1500);
    return () => clearTimeout(t);
  }, [isFocused, localDeadline, response?.deadline, onUpdateDetails, item.id]);

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
      setLocalResponsible(previousNC.responsible);
      details.responsible = previousNC.responsible;
    }
    if (!deadlineValue.trim() && previousNC.deadline) {
      setLocalDeadline(previousNC.deadline);
      details.deadline = previousNC.deadline;
    }
    if (Object.keys(details).length > 0) onUpdateDetails(item.id, details);
    setShowObs(true);
  };

  const getBorderColor = () => {
    if (!isSelected) return 'border-l-4 border-l-yellow-400 border-gray-200';
    if (response.result === 'complies') return 'border-l-4 border-l-green-500 border-green-200 bg-green-50/30';
    if (isNotCompliant) return 'border-l-4 border-l-red-500 border-red-200 bg-red-50/30';
    return 'border-l-4 border-l-gray-400 border-gray-200 bg-gray-50';
  };

  return (
    <div id={`item-${item.id}`} className={cn("rounded-xl border bg-white p-5 shadow-sm transition-all", getBorderColor())}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 pr-4 flex-1">
          {/* Header row with badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="font-mono">{`Item ${item.order}`}</Badge>
            {item.isCritical && (
              <Badge variant="danger" className="animate-pulse">
                <AlertTriangle className="mr-1 h-3 w-3" />
                CRÍTICO
              </Badge>
            )}
            {previousNC && (
              <Badge variant="warning" className="border-amber-200 bg-amber-50 text-amber-800">
                <AlertTriangle className="mr-1 h-3 w-3" />
                REINCIDÊNCIA
              </Badge>
            )}
            {item.legislation && (
              <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {item.legislation}
                {legislationUrlForItem(item) && (
                  <a href={legislationUrlForItem(item)} target="_blank" rel="noreferrer" className="ml-1 text-primary-600 hover:text-primary-800">
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
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                aria-label={'Excluir item extra ' + item.description}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mt-2 text-[15px] font-medium leading-relaxed text-gray-900">
            {item.id.startsWith('extra|') ? (response?.customDescription || item.description) : item.description}
          </p>
        </div>

        {/* Observation Toggle Button */}
        {isSelected && (
          <button
            onClick={() => setShowObs(!showObs)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all shrink-0 ml-2",
              showObs
                ? "bg-primary-600 border-primary-600 text-white shadow-lg"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-primary-300 hover:text-primary-600"
            )}
          >
            <div className="relative">
              <LogIn className={cn("h-5 w-5 rotate-90", showObs ? "text-white" : "text-gray-400")} />
              {((response?.photos?.length ?? 0) > 0 || (response?.links?.length ?? 0) > 0 || response?.situationDescription) && !showObs && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-primary-500 ring-2 ring-white"></span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">Obs</span>
          </button>
        )}
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

      {/* Action Buttons */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onChange(item.id, 'complies')}
          className={cn(
            "flex h-[52px] items-center justify-center rounded-lg border-2 text-[13px] font-semibold transition-all active:scale-95",
            response?.result === 'complies'
              ? "border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500 ring-offset-1"
              : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50"
          )}
        >
          CUMPRE
        </button>
        <button
          onClick={() => onChange(item.id, 'not_complies')}
          className={cn(
            "flex h-[52px] items-center justify-center rounded-lg border-2 text-[13px] font-semibold transition-all active:scale-95",
            response?.result === 'not_complies'
              ? "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500 ring-offset-1"
              : "border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50"
          )}
        >
          NÃO CUMPRE
        </button>
        <button
          onClick={() => onChange(item.id, 'not_applicable')}
          className={cn(
            "flex h-[52px] items-center justify-center rounded-lg border-2 text-[13px] font-semibold transition-all active:scale-95",
            response?.result === 'not_applicable'
              ? "border-gray-500 bg-gray-100 text-gray-700 ring-2 ring-gray-400 ring-offset-1"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-100"
          )}
        >
          N/A
        </button>
        <button
          onClick={() => onChange(item.id, 'not_observed')}
          className={cn(
            "flex h-[52px] items-center justify-center rounded-lg border-2 border-dashed font-semibold transition-all active:scale-95 text-[13px]",
            response?.result === 'not_observed'
              ? "border-slate-500 bg-slate-100 text-slate-700 ring-2 ring-slate-400 ring-offset-1"
              : "border-gray-300 bg-white text-gray-400 hover:border-slate-300 hover:bg-slate-50"
          )}
        >
          NO
        </button>
      </div>

      {/* Expanded Details Section (For any status if toggled) */}
      {showObs && isSelected && (
        <div className={cn(
          "mt-6 space-y-5 rounded-lg border p-5 shadow-inner animate-in slide-in-from-top-2 duration-200",
          isNotCompliant ? "border-red-100 bg-red-50/10" : "border-indigo-100 bg-indigo-50/10"
        )}>
          <div className={cn(
            "flex items-center space-x-2",
            isNotCompliant ? "text-red-700" : "text-indigo-700"
          )}>
            {isNotCompliant ? <AlertTriangle className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}
            <h4 className="font-semibold text-sm">
              {isNotCompliant ? 'Detalhes da Não Conformidade' : 'Observações de Alto Padrão / Melhoria'}
            </h4>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-gray-700">
                {isNotCompliant ? 'Situação encontrada' : 'O que foi observado (Pontos de Excelência)'}
                {isNotCompliant && <span className="text-red-500"> *</span>}
              </label>
              <VoiceDictationButton onTranscript={(text) => setLocalSituation((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
            <div className="relative">
              <textarea
                className={cn(
                  "w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 min-h-[100px] resize-y shadow-sm",
                  !response?.situationDescription && hasError
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500 ring-1 ring-red-100"
                    : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                )}
                placeholder={isNotCompliant ? "Descreva a falha observada..." : "Descreva pontos positivos ou o que pode ser elevado para alto padrão..."}
                value={situationValue}
                onChange={(e) => setLocalSituation(e.target.value)}
                onFocus={() => {
                  setLocalSituation(response?.situationDescription || '');
                  setIsFocused('situation');
                }}
                onBlur={(e) => handleBlur('situationDescription', e.target.value)}
              />

            </div>
            {!!suggestions?.situationDescription.length && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-tight text-gray-400">Já usado antes:</span>
                {(showAllSituationSuggestions ? suggestions.situationDescription : suggestions.situationDescription.slice(0, 4)).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      setLocalSituation(text);
                      onUpdateDetails(item.id, { situationDescription: text });
                    }}
                    title={text}
                    className="max-w-[220px] truncate text-[11px] font-medium bg-white hover:bg-primary-50 text-gray-600 hover:text-primary-700 border border-gray-200 hover:border-primary-200 rounded-full px-2 py-0.5 transition-colors shadow-sm"
                  >
                    {text}
                  </button>
                ))}
                {!showAllSituationSuggestions && suggestions.situationDescription.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSituationSuggestions(true)}
                    className="text-[11px] font-bold text-primary-600 hover:text-primary-800"
                  >
                    +{suggestions.situationDescription.length - 4} mais
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-gray-700">
                {isNotCompliant ? 'Ação corretiva necessária' : 'Sugestões de melhoria profissional'}
                {isNotCompliant && <span className="text-red-500"> *</span>}
              </label>
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
                    className="text-[11px] font-medium bg-white hover:bg-primary-50 text-gray-600 hover:text-primary-700 border border-gray-200 hover:border-primary-200 rounded-full px-2 py-0.5 transition-colors shadow-sm"
                  >
                    {verb}
                  </button>
                ))}
              </div>
            )}
            <textarea
              className={cn(
                "w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 min-h-[100px] resize-y shadow-sm",
                !response?.correctiveAction && hasError
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500 ring-1 ring-red-100"
                  : "border-gray-300 focus:border-primary-500 focus:ring-primary-500"
              )}
              placeholder={isNotCompliant ? "O que precisa ser feito para adequação..." : "Dê sugestões para que o local atinja a nota máxima ou mantenha o brilho..."}
              value={actionValue}
              onChange={(e) => setLocalAction(e.target.value)}
              onFocus={() => {
                setLocalAction(response?.correctiveAction || '');
                setIsFocused('action');
              }}
              onBlur={(e) => handleBlur('correctiveAction', e.target.value)}
            />
            {!!suggestions?.correctiveAction.length && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-tight text-gray-400">Já usado antes:</span>
                {(showAllActionSuggestions ? suggestions.correctiveAction : suggestions.correctiveAction.slice(0, 4)).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      setLocalAction(text);
                      onUpdateDetails(item.id, { correctiveAction: text });
                    }}
                    title={text}
                    className="max-w-[220px] truncate text-[11px] font-medium bg-white hover:bg-primary-50 text-gray-600 hover:text-primary-700 border border-gray-200 hover:border-primary-200 rounded-full px-2 py-0.5 transition-colors shadow-sm"
                  >
                    {text}
                  </button>
                ))}
                {!showAllActionSuggestions && suggestions.correctiveAction.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllActionSuggestions(true)}
                    className="text-[11px] font-bold text-primary-600 hover:text-primary-800"
                  >
                    +{suggestions.correctiveAction.length - 4} mais
                  </button>
                )}
              </div>
            )}
          </div>

          <datalist id="responsables-list">
            <option value="Responsável Técnico (RT)" />
            <option value="Gerência / Administração" />
            <option value="Equipe de Manutenção" />
            <option value="Equipe de Limpeza / Higiene" />
            <option value="Manipulador / Funcionário" />
            <option value="Proprietário" />
            <option value="Empresa Terceirizada" />
          </datalist>

          <datalist id="deadlines-list">
            <option value="Imediato" />
            <option value="24 horas" />
            <option value="7 dias" />
            <option value="15 dias" />
            <option value="30 dias" />
            <option value="45 dias" />
            <option value="60 dias" />
            <option value="90 dias" />
          </datalist>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Responsável{isNotCompliant ? ' p/ Correção' : ''}</label>
              <input
                type="text"
                list="responsables-list"
                className="w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
                placeholder="Ex: Gerente, RT..."
                value={responsibleValue}
                onChange={(e) => setLocalResponsible(e.target.value)}
                onFocus={() => {
                  setLocalResponsible(response?.responsible || '');
                  setIsFocused('responsible');
                }}
                onBlur={(e) => handleBlur('responsible', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">{isNotCompliant ? 'Prazo Sugerido' : 'Prazo de Implantação'}</label>
              <input
                type="text"
                list="deadlines-list"
                className="w-full rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
                placeholder="Ex: Imediato, 15 dias..."
                value={deadlineValue}
                onChange={(e) => setLocalDeadline(e.target.value)}
                onFocus={() => {
                  setLocalDeadline(response?.deadline || '');
                  setIsFocused('deadline');
                }}
                onBlur={(e) => handleBlur('deadline', e.target.value)}
              />
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
