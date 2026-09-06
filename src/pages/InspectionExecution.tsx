import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CloudOff, CheckCircle2, Eye, EyeOff, Loader2, MoreVertical, PlusCircle, RefreshCw } from 'lucide-react';
import { db } from '../db/database';
import { getTemplateById, composeCanonicalTemplate, filterSectionsByRoleForDisplay } from '../data/templates';
import { type ChecklistTemplate, type Client, type ClientCategory, type Inspection, type InspectionResponse, type InspectionPhoto } from '../types';

/** Inspecao antiga guardava a categoria do cliente em `category`; a de hoje, em `clientCategory`. */
function legacyCategory(inspection: Inspection): ClientCategory | undefined {
  return (inspection as Inspection & { category?: ClientCategory }).category;
}
import { ILPIStaffCalculator } from '../components/inspection/ILPIStaffCalculator';
import { isRioState } from '../utils/state';
import { contextFromInspection } from '../utils/inspectionContext';
import { aplicarAtualizacao, compararRoteiro, contextoDaInspecao, temAtualizacao } from '../utils/atualizacaoDoRoteiro';
import {
  answerChangeImpact,
  executionQuestions,
  pendingBlockers,
  gateByPilot,
  resolveExecutionTree,
  stampRoutingAnswer,
} from '../domain/applicability';
import type { RoutingAnswer } from '../domain/applicability';
import {
  ApplicabilityRevisionService,
  freezeRevisionIntoTemplate,
  needsRevisionFreeze,
} from '../services/applicabilityRevisionService';
import { calculateScore, classificationInk, getLatestResponsesByItem } from '../utils/scoring';
import { useInspectionStore } from '../store/useInspectionStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { generateId } from '../utils/imageUtils';
import { CollaborativeProgress } from '../components/inspection/CollaborativeProgress';
import { RoutingQuestionsBlock } from '../components/inspection/RoutingQuestionsBlock';
import { ExcludedByRulePanel } from '../components/inspection/ExcludedByRulePanel';
import { MobileExecutionSheet } from '../components/inspection/MobileExecutionSheet';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { InspectionBundleSyncService } from '../services/inspectionBundleSyncService';
import { ScheduleService } from '../services/scheduleService';
import { AppointmentAdminService } from '../services/appointmentAdminService';
import { getLocalActor } from '../utils/localActor';
import { belongsToActiveTenant, filterByActiveTenant } from '../utils/localScope';
import { buildRecoveryTemplate } from '../utils/templateRecovery';
import { withClientLocation } from '../utils/inspectionLocation';
import { getOpenPendingHistory, type PreviousNCContext } from '../utils/actionPlanContext';
import { hydrateAndGetPreviousVisitScore, type PreviousVisitScore } from '../utils/previousVisitScore';
import { filterMissingPendingItems, filterPendingItemsForTemplate } from '../utils/actionPlanState';
import { remapItemsToTemplate } from '../utils/itemIdentity';
import {
  findOpenActionItem,
  indexOpenActionItems,
  type OpenActionItemRef,
} from '../utils/clientActionPlan';
import {
  composeChecklistTemplate,
  customItemMeta,
  CUSTOM_ITEM_WEIGHTS,
  nextCustomItemOrder,
  normalizeCustomItems,
} from '../utils/customItems';
import {
  ClientEvidenceService,
  type ClientCheckpointByItem,
  type ClientDeclarationByItem,
  type ClientEvidenceByItem,
} from '../services/clientEvidenceService';


import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionAccordion } from '../components/inspection/SectionAccordion';
import { ChecklistItem } from '../components/inspection/ChecklistItem';
import { ExecutionScorePanel, type MissingText } from '../components/inspection/ExecutionScorePanel';
import { ExecutionSectionIndex } from '../components/inspection/ExecutionSectionIndex';
import { TeamResponsesViewer } from '../components/inspection/TeamResponsesViewer';
import { InspectionFinishScreen } from '../components/inspection/InspectionFinishScreen';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Checkbox } from '../components/ui/Checkbox';
import { Select } from '../components/ui/Select';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from '../store/useToastStore';
import { cn } from '../lib/utils';

// Pré-preenche uma nova inspeção (modo plano de ação) com as NCs da visita
// anterior já marcadas como não conforme, copiando situação/ação/prazo/responsável.
// A consultora então só edita o texto ou troca o resultado para "conforme" quando a
// pendência foi sanada. As fotos antigas seguem visíveis apenas como referência
// (caixa "Plano de ação anterior"); não são copiadas como evidência nova.
async function seedPendingResponses(
  inspectionId: string,
  previousNCs: Map<string, PreviousNCContext>,
  existingItemIds: Set<string>,
  tenantId?: string,
): Promise<InspectionResponse[]> {
  const actor = getLocalActor();
  const now = new Date();
  const seeded: InspectionResponse[] = [];

  for (const nc of filterMissingPendingItems(previousNCs.values(), existingItemIds)) {
    const response: InspectionResponse = {
      id: generateId(),
      inspectionId,
      itemId: nc.itemId,
      result: 'not_complies',
      situationDescription: nc.situationDescription,
      correctiveAction: nc.correctiveAction,
      responsible: nc.responsible,
      deadline: nc.deadline,
      customDescription: nc.description,
      customItemMeta: nc.customItemMeta,
      confirmedClientEvidenceIds: [],
      photos: [],
      createdAt: now,
      updatedAt: now,
      tenantId,
      localActorId: actor.id,
      lastEditedBy: actor.name,
      syncStatus: 'pending',
    };
    try {
      await InspectionService.upsertResponse(response);
      seeded.push(response);
    } catch (err) {
      console.error('[ActionPlan] Falha ao semear NC anterior:', err);
    }
  }

  return seeded;
}

type ItemFilter = 'todos' | 'sem-resposta' | 'nao-cumpre' | 'reincidentes' | 'falta-escrever';

/** Os cinco filtros do roteiro. Mesma ordem no chip do celular e no botão do desktop. */
const FILTER_TABS = [
  ['todos', 'Todos'],
  ['sem-resposta', 'Sem resposta'],
  ['nao-cumpre', 'Não cumpre'],
  ['reincidentes', 'Reincidentes'],
  ['falta-escrever', 'Falta escrever'],
] as const satisfies ReadonlyArray<readonly [ItemFilter, string]>;

export function InspectionExecution() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { inspectionId: string; linkedScheduleId?: string };
  const linkedScheduleId = state?.linkedScheduleId;
  // O encerramento é uma etapa com URL própria (`?etapa=encerrar`), não um modal:
  // decisão irreversível merece a tela inteira, a rolagem inteira e o botão voltar.
  const [searchParams, setSearchParams] = useSearchParams();
  const isFinishStep = searchParams.get('etapa') === 'encerrar';
  const {
    currentInspection,
    responses,
    setCurrentInspection,
    setResponses,
  } = useInspectionStore();
  const { confirm, confirmDialog } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previousNCs, setPreviousNCs] = useState<Map<string, PreviousNCContext>>(new Map());
  // REL-03 — o que o cliente alegou ter corrigido, por item do roteiro. Vem do servidor e é
  // best-effort: sem sinal, a vistoria segue igual, só sem a alegação na tela.
  const [clientEvidence, setClientEvidence] = useState<ClientEvidenceByItem>(new Map());
  const [clientDeclarations, setClientDeclarations] = useState<ClientDeclarationByItem>(new Map());
  // PORT-05 — os tópicos da ação anterior e o que o cliente marcou em cada um.
  const [clientCheckpoints, setClientCheckpoints] = useState<ClientCheckpointByItem>(new Map());
  const [previousVisit, setPreviousVisit] = useState<PreviousVisitScore | null>(null);
  /** Pendências já abertas no portal desta unidade — prazo pactuado e título. */
  const [openActionItems, setOpenActionItems] = useState<OpenActionItemRef[]>([]);
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<ItemFilter>('todos');
  // Item em que ela está trabalhando agora: não sai da lista filtrada quando
  // deixa de casar com o filtro. Zera ao trocar de filtro.
  const [stickyItemIds, setStickyItemIds] = useState<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hideClientInfo, setHideClientInfo] = useState(false);
  const [photoHydration, setPhotoHydration] = useState<{ total: number; completed: number; failed: number } | null>(null);
  const [showTeamResponses, setShowTeamResponses] = useState(false);
  /** Folha do ⋮ — no celular ela é o lugar de todas as ações (opção 3a). */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [historyComplete, setHistoryComplete] = useState(navigator.onLine);
  const [extraItemSectionId, setExtraItemSectionId] = useState<string | null>(null);
  const [editingExtraItemId, setEditingExtraItemId] = useState<string | null>(null);
  const [extraDescription, setExtraDescription] = useState('');
  const [extraCritical, setExtraCritical] = useState(false);
  const [extraWeight, setExtraWeight] = useState<1 | 2 | 5 | 10>(1);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);

  const attachPhotosToResponses = useCallback((baseResponses: InspectionResponse[], photos: InspectionPhoto[]) => {
    return baseResponses.map(response => ({
      ...response,
      photos: photos.filter(photo => photo.responseId === response.id),
    }));
  }, []);

  const mergePhotosIntoCurrentResponses = useCallback((photos: InspectionPhoto[]) => {
    const currentResponses = useInspectionStore.getState().responses;
    if (currentResponses.length === 0 || photos.length === 0) return;

    const photosByResponse = new Map<string, InspectionPhoto[]>();
    for (const photo of photos) {
      const list = photosByResponse.get(photo.responseId) || [];
      list.push(photo);
      photosByResponse.set(photo.responseId, list);
    }

    setResponses(currentResponses.map(response => {
      const incoming = photosByResponse.get(response.id);
      if (!incoming?.length) return response;

      const byId = new Map((response.photos || []).map(photo => [photo.id, photo]));
      for (const photo of incoming) byId.set(photo.id, photo);
      return { ...response, photos: Array.from(byId.values()) };
    }));
  }, [setResponses]);

  const hydratePhotosInBackground = useCallback((responseIds: string[]) => {
    if (responseIds.length === 0 || !navigator.onLine) return;

    void InspectionService.hydratePhotosByResponseIds(responseIds, {
      onProgress: (progress, photo) => {
        setPhotoHydration(progress.total > 0 ? progress : null);
        if (photo) mergePhotosIntoCurrentResponses([photo]);
      },
    }).then(result => {
      mergePhotosIntoCurrentResponses(result.photos);
      setPhotoHydration(result.total > 0 ? {
        total: result.total,
        completed: result.completed,
        failed: result.failed,
      } : null);
      window.setTimeout(() => setPhotoHydration(null), 2500);
    }).catch(err => {
      console.warn('[Execution] Photo hydration failed:', err);
      setPhotoHydration(null);
    });
  }, [mergePhotosIntoCurrentResponses]);

  // ─── LOAD DATA ────────────────────────────────────────────────────────────
  // Runs when the page is opened, whether via navigation state or direct URL.
  // Falls back to Supabase if the inspection is not in the local Dexie cache.
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setRemoteHydrated(false);
    try {
      const { inspectionId } = location.state || {};
      const id = inspectionId || currentInspection?.id;

      if (!id) {
        navigate('/inspections');
        return;
      }

      // ── PHASE 1: Load from Dexie immediately (< 5ms) ──────────────────────
      const localCandidate = await db.inspections.get(id);
      // Sem city/state o suplemento regional não é aplicado — ver withClientLocation.
      const localInsp = belongsToActiveTenant(localCandidate)
        ? await withClientLocation(localCandidate as Inspection)
        : null;

      if (localInsp) {
        // Resolve template from cache right away
        const tpl = getTemplateById(localInsp.templateId) || await db.templates.get(localInsp.templateId);
        
        if (tpl) setTemplate(tpl);

        // Load local responses immediately
        const localResps = filterByActiveTenant(await db.responses
          .where('inspectionId').equals(id)
          .filter(r => !r.deletedAt)
          .toArray());
        const localPhotos = await InspectionService.getPhotosByResponseIds(localResps.map(r => r.id), false, { remote: false });
        const localWithPhotos = attachPhotosToResponses(localResps, localPhotos);

        setCurrentInspection(localInsp);
        setResponses(localWithPhotos);
        setLoading(false); // ← render now with local data
        hydratePhotosInBackground(localResps.map(r => r.id));
      }

      // ── PHASE 2: Background enrichment from Supabase ──────────────────────
      // (runs whether or not we had local data — also handles first-ever load)
      void (async () => {
        try {
          // Fetch canonical inspection from service (already non-blocking internally)
          const insp = await InspectionService.getInspectionById(id);

          if (!insp) {
            if (!localInsp) {
              setLoadError('Inspeção não encontrada. Verifique sua conexão.');
              setLoading(false);
            }
            return;
          }

          // Create a clean enriched object instead of mutating 'insp' directly
          // to prevent successive triggers of auto-save routines.
          const client = await ClientService.getClientById(insp.clientId);
          const enrichedInsp = { 
            ...insp, 
            clientName: client?.name,
            clientCategory: client?.category,
            foodTypes: client?.foodTypes,
            city: client?.city,
            state: client?.state 
          };

          // Resolve template (fallback chain: static → Dexie → Supabase)
          // No category fallback allowed as per directive.
          let tpl = getTemplateById(enrichedInsp.templateId) || await db.templates.get(enrichedInsp.templateId);
          
          if (!tpl && navigator.onLine) {
            // Keep loading UI visible during remote fetch
            if (!localInsp) setLoading(true);
            try {
              const { TemplateService } = await import('../services/templateService');
              // getFullTemplate now uses AbortController internally (no external race needed)
              tpl = await TemplateService.getFullTemplate(enrichedInsp.templateId);
              if (tpl) db.templates.put(tpl).catch(() => {});
            } catch (e) {
              // Do NOT fall back to syncAllTemplatesToDexie here: a full sync creates multiple
              // zombie connections that saturate the Supabase pool and block inspection pushes.
              // Recovery mode (templateRecovery.ts) handles the missing template case below.
              console.warn('[Execution] Remote template fetch failed, using local recovery:', e);
            }
          }

          if (tpl) setTemplate(tpl);
          setCurrentInspection(enrichedInsp);

          // Editing must await cloud reconciliation so a fresh/empty cache cannot show a completed report as blank.
          const remoteResponses = await InspectionService.getResponsesByInspectionId(id, true);
          let workingResponses = remoteResponses;
          if (enrichedInsp.status === 'in_progress') {
            const allResponses = await InspectionService.getResponsesIncludingDeleted(id);
            const normalizedResponses = normalizeCustomItems(allResponses, tpl?.sections || []);
            for (const normalizedResponse of normalizedResponses) {
              const original = allResponses.find(response => response.id === normalizedResponse.id);
              if (!original?.customItemMeta && normalizedResponse.customItemMeta) {
                await InspectionService.upsertResponse(normalizedResponse);
              }
            }
            workingResponses = normalizedResponses.filter(response => !response.deletedAt);

            const history = await getOpenPendingHistory(enrichedInsp.clientId, enrichedInsp.id);
            // COND-03: reincidência remapeia contra a MESMA árvore congelada da
            // inspeção (completa), não recompõe do roteiro vivo filtrado por papel.
            const pendingBase = enrichedInsp.reportTemplateSnapshot
              ?? (tpl
                ? composeCanonicalTemplate(
                    tpl,
                    { ...enrichedInsp, category: enrichedInsp.clientCategory || legacyCategory(enrichedInsp) } as unknown as Client,
                    enrichedInsp.createdAt,
                  )
                : null);
            // A pendência de uma visita antiga carrega o id do roteiro daquela
            // visita. Remapeia para o id equivalente no roteiro de agora, senão o
            // filtro abaixo descarta tudo e a reincidência não aparece.
            const visiblePendingItems = pendingBase
              ? filterPendingItemsForTemplate(remapItemsToTemplate(history.items.values(), pendingBase), pendingBase)
              : [];
            const visibleHistory = new Map(visiblePendingItems.map(item => [item.itemId, item]));
            setPreviousNCs(visibleHistory);
            setHistoryComplete(history.historyComplete);
            const seeded = await seedPendingResponses(
              id,
              visibleHistory,
              new Set(workingResponses.map(response => response.itemId)),
              enrichedInsp.tenantId,
            );
            workingResponses = [...workingResponses, ...seeded];
          } else {
            setPreviousNCs(new Map());
            setHistoryComplete(true);
          }

          const localPhotos = await InspectionService.getPhotosByResponseIds(
            workingResponses.map(response => response.id),
            false,
            { remote: false },
          );
          setResponses(attachPhotosToResponses(workingResponses, localPhotos));
          setLoading(false);
          hydratePhotosInBackground(workingResponses.map(response => response.id));

          // Nota da visita anterior, para a comparação em pontos (decisão 29).
          // Lê o mesmo cache que o histórico de pendências já hidratou.
          void hydrateAndGetPreviousVisitScore(enrichedInsp.clientId, id, enrichedInsp.templateId)
            .then(setPreviousVisit)
            .catch((err) => console.warn('[Inspection] Nota da visita anterior indisponivel:', err));

          // Prazos que já estão valendo no portal desta unidade: reincidência não
          // reinicia a contagem, e a tela precisa mostrar a data que vale.
          void AppointmentAdminService.listOpenActionItems(enrichedInsp.clientId)
            .then(setOpenActionItems)
            .catch((err) => console.warn('[Inspection] Prazos pactuados indisponiveis:', err));

          // Evidências são carregadas sem bloquear a abertura do roteiro em campo.
          void ClientEvidenceService.byItemForClient(enrichedInsp.clientId)
            .then((result) => {
              setClientEvidence(result.evidence);
              setClientDeclarations(result.declarations);
              setClientCheckpoints(result.checkpoints);
            })
            .catch((err) => console.warn('[Inspection] Evidencia do cliente indisponivel:', err));

        } catch (err) {
          console.error('[loadData] Background enrichment error:', err);
          // Don't reset loading here — Phase 1 already showed data
        } finally {
          setLoading(false); // ensure loading clears even on first-ever load path
          // Libera o autosave: reconciliou (ou desistiu, offline/erro) — dado
          // local deixou de ser potencialmente mais velho que o servidor sem
          // que ninguém tenha verificado.
          setRemoteHydrated(true);
        }
      })();

    } catch (err) {
      console.error('[loadData] Critical error:', err);
      setLoadError('Erro ao carregar dados da inspeção.');
      setLoading(false);
    }
  }, [
    attachPhotosToResponses,
    currentInspection?.id,
    hydratePhotosInBackground,
    location.state,
    navigate,
    setCurrentInspection,
    setResponses,
  ]);


  // Re-run loadData whenever the inspectionId in navigation state changes
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (isOnline && !historyComplete) void loadData();
  }, [historyComplete, isOnline, loadData]);

  // ─── TEMPLATE RESOLUTION ──────────────────────────────────────────────────
  // COND-03 · UMA árvore só (contrato § 6.6). A inspeção não recompõe do roteiro
  // vivo: lê a REVISÃO CONGELADA (`reportTemplateSnapshot`), fixada na criação ou
  // na primeira abertura (lazy freeze, efeito abaixo). O papel deixou de compor
  // roteiro — virou filtro de exibição em `visibleSections`.
  const role = useSettingsStore(state => state.settings.consultantRole) || 'saude';

  // Revisão congelada = árvore canônica completa, SEM itens ad-hoc. Inspeção
  // legada em andamento sem snapshot compõe do vivo uma vez; o lazy-freeze abaixo
  // persiste esse resultado, e daí em diante ela para de seguir o roteiro vivo.
  const frozenBase = useMemo(() => {
    if (!currentInspection) return null;
    if (currentInspection.reportTemplateSnapshot) return currentInspection.reportTemplateSnapshot;
    if (!template) return null;
    // A inspeção carrega a categoria do cliente (`clientCategory`, e `category`
    // em registro antigo). O `as unknown as Client` deixa a ponte visível.
    const ctx = { ...currentInspection, category: currentInspection.clientCategory || legacyCategory(currentInspection) } as unknown as Client;
    try { return composeCanonicalTemplate(template, ctx, currentInspection.createdAt); }
    catch (err) { console.error('composeCanonicalTemplate error:', err); return template; }
  }, [currentInspection, template]);

  // COND-03 · a árvore VIVA, só para comparar. A inspeção continua lendo a
  // congelada; esta existe para a tela poder dizer "o roteiro mudou desde que
  // você começou" e oferecer a atualização — nunca para aplicá-la sozinha.
  const arvoreViva = useMemo(() => {
    if (!currentInspection || !template) return null;
    try { return composeCanonicalTemplate(template, contextoDaInspecao(currentInspection), currentInspection.createdAt); }
    catch { return null; }
  }, [currentInspection, template]);

  const atualizacaoDoRoteiro = useMemo(() => {
    if (!currentInspection || currentInspection.status !== 'in_progress') return null;
    if (!frozenBase || !arvoreViva || frozenBase === arvoreViva) return null;
    const diff = compararRoteiro(frozenBase, arvoreViva);
    return temAtualizacao(diff) ? diff : null;
  }, [arvoreViva, currentInspection, frozenBase]);

  // A árvore completa da inspeção = revisão congelada + itens ad-hoc das respostas.
  const effectiveTemplate = useMemo(() => {
    if (!currentInspection) return null;
    if (!frozenBase) return buildRecoveryTemplate(currentInspection, responses);
    return composeChecklistTemplate(frozenBase, responses);
  }, [currentInspection, frozenBase, responses]);

  // "Uma árvore só": colaboração e nota usam a MESMA árvore completa — não há mais
  // uma segunda composição por papel. Mantido como nome para os consumidores.
  const collaborationTemplate = effectiveTemplate;

  // ─── COND-08 · A ÁRVORE ADAPTATIVA ────────────────────────────────────────
  // O motor roda AQUI, local e puro: mostrar ou esconder item nunca depende de
  // rede (contrato § 6.5, caso obrigatório 10). Ele lê a revisão que viaja dentro
  // da árvore congelada, o contexto congelado e as respostas de roteamento — três
  // coisas que moram na própria inspeção, no Dexie.
  const answeredItemIds = useMemo(
    () => new Set(responses.filter((response) => !response.deletedAt).map((response) => response.itemId)),
    [responses],
  );

  // COND-10 - a arvore que o MOTOR le. Fora do piloto ela vem sem regra e sem
  // pergunta, mesmo que o snapshot congelado no Dexie carregue as duas: e assim
  // que o rollback alcanca inspecao ja congelada, sem apagar resposta nenhuma.
  const arvoreDoMotor = useMemo(
    () => (effectiveTemplate ? gateByPilot(effectiveTemplate) : undefined),
    [effectiveTemplate],
  );

  const applicability = useMemo(
    () => resolveExecutionTree({
      sections: arvoreDoMotor?.sections || [],
      rules: arvoreDoMotor?.rules,
      routingQuestions: arvoreDoMotor?.routingQuestions,
      context: currentInspection?.applicabilityContext,
      answers: currentInspection?.routingAnswers,
      answeredItemIds,
    }),
    [arvoreDoMotor, currentInspection?.applicabilityContext, currentInspection?.routingAnswers, answeredItemIds],
  );

  // A ordem importa: aplicabilidade decide o ROTEIRO, papel recorta a EXIBIÇÃO
  // (contrato § 6.6). Nota, snapshot e resumo seguem na árvore completa.
  const visibleSections = useMemo(
    () => filterSectionsByRoleForDisplay(applicability.sections, role),
    [applicability, role],
  );

  // As perguntas respondidas em campo, e onde cada uma aparece: dentro da seção
  // que ela declarou (`sectionId`), ou no bloco do topo quando não declarou
  // nenhuma. Pergunta que decide seção não pode morar dentro da seção que ela
  // esconde — por isso o alvo tem de estar visível para ela ficar lá.
  const fieldQuestions = useMemo(
    () => executionQuestions(
      { rules: arvoreDoMotor?.rules, routingQuestions: arvoreDoMotor?.routingQuestions },
      currentInspection?.routingAnswers,
      currentInspection?.routingAnswersMeta,
    ),
    [arvoreDoMotor, currentInspection?.routingAnswers, currentInspection?.routingAnswersMeta],
  );

  const questionsBySection = useMemo(() => {
    const visiveis = new Set(visibleSections.map((section) => section.id));
    const porSecao = new Map<string, typeof fieldQuestions>();
    const soltas: typeof fieldQuestions = [];
    for (const entry of fieldQuestions) {
      const alvo = entry.question.sectionId;
      if (alvo && visiveis.has(alvo)) {
        porSecao.set(alvo, [...(porSecao.get(alvo) || []), entry]);
      } else {
        soltas.push(entry);
      }
    }
    return { porSecao, soltas };
  }, [fieldQuestions, visibleSections]);
  // ILPI: a calculadora de dimensionamento mora na seção "Recursos Humanos".
  const isIlpiInspection = (currentInspection?.clientCategory === 'ilpi')
    || (effectiveTemplate?.category === 'ilpi');

  const atualizarRoteiroDaInspecao = useCallback(async () => {
    if (!currentInspection || !frozenBase || !arvoreViva || !atualizacaoDoRoteiro) return;
    const { itensNovos, itensComTextoNovo, secoesNovas } = atualizacaoDoRoteiro;
    const ok = await confirm({
      title: 'Atualizar o roteiro desta inspeção?',
      description:
        'As respostas já dadas continuam como estão. Item que você já respondeu nunca sai, mesmo que tenha saído do roteiro. As condições desta inspeção também não mudam.',
      consequences: [
        ...(itensNovos.length ? [`Entram ${itensNovos.length} requisito(s) novo(s)`] : []),
        ...secoesNovas.map((titulo) => `Entra a seção «${titulo}»`),
        ...(itensComTextoNovo.length ? [`${itensComTextoNovo.length} requisito(s) ganham texto novo — orientação e ação pela norma`] : []),
      ],
      confirmLabel: 'Atualizar',
      tone: 'default',
    });
    if (!ok) return;

    const idsComResposta = new Set(
      responses.filter((response) => !response.deletedAt).map((response) => response.itemId)
    );
    setCurrentInspection({
      ...currentInspection,
      reportTemplateSnapshot: aplicarAtualizacao(frozenBase, arvoreViva, idsComResposta),
    });
  }, [arvoreViva, atualizacaoDoRoteiro, confirm, currentInspection, frozenBase, responses, setCurrentInspection]);

  // COND-03 · Lazy freeze. Inspeção EM ANDAMENTO criada antes deste recurso não
  // tem revisão congelada — na primeira abertura, persiste a árvore canônica como
  // a revisão desta inspeção. setCurrentInspection dispara o auto-save; o snapshot
  // fica no Dexie local (mapToPostgres não tem a coluna — formato físico é COND-04)
  // e sobrevive a merges remotos porque mapFromPostgres não emite a chave.
  useEffect(() => {
    if (loading || !currentInspection || !frozenBase) return;
    if (currentInspection.reportTemplateSnapshot) return;
    if (currentInspection.status !== 'in_progress') return;
    setCurrentInspection({ ...currentInspection, reportTemplateSnapshot: frozenBase });
  }, [currentInspection, frozenBase, loading, setCurrentInspection]);

  // COND-05 · Lazy freeze do CONTEXTO, pelo mesmo motivo e no mesmo momento.
  // Inspeção em andamento criada antes deste card não tem `applicabilityContext`:
  // congela agora a partir do que ela própria guardou (cidade, UF, categoria,
  // capacidade, residentes) — nunca do cadastro vivo. Uma vez só; da segunda
  // abertura em diante o campo já existe e ninguém recalcula.
  useEffect(() => {
    if (loading || !currentInspection) return;
    if (currentInspection.applicabilityContext) return;
    if (currentInspection.status !== 'in_progress') return;
    setCurrentInspection({
      ...currentInspection,
      applicabilityContext: contextFromInspection(currentInspection),
    });
  }, [currentInspection, loading, setCurrentInspection]);

  // COND-08 · Lazy freeze da REVISÃO. Inspeção criada antes deste card tem árvore
  // congelada sem `rules`/`routingQuestions` — e é por elas que o motor decide.
  // Quando a inspeção declara a revisão que usou (`applicabilityRevisionId`), a
  // primeira abertura ONLINE busca essa revisão **por id** (revisão publicada é
  // imutável: as duas consultoras leem exatamente a mesma) e grava dentro do
  // snapshot. A partir daí, offline.
  //
  // Sem vínculo, congela vazio: inspeção que nasceu sem regra não passa a ter
  // regra hoje só porque o roteiro-mestre ganhou uma (contrato § 6.2).
  const [revisionUnavailable, setRevisionUnavailable] = useState(false);
  useEffect(() => {
    if (loading || !currentInspection || currentInspection.status !== 'in_progress') return;
    const snapshot = currentInspection.reportTemplateSnapshot;
    if (!snapshot || !needsRevisionFreeze(snapshot)) return;

    const revisionId = currentInspection.applicabilityRevisionId;
    if (!revisionId) {
      setCurrentInspection({
        ...currentInspection,
        reportTemplateSnapshot: freezeRevisionIntoTemplate(snapshot, null),
      });
      return;
    }

    let active = true;
    void ApplicabilityRevisionService.getRevisionById(revisionId)
      .then((revisao) => {
        if (!active) return;
        if (!revisao) {
          // Vínculo sem revisão do outro lado é erro de dado, não licença para
          // esconder requisito: a tela avisa e o roteiro segue inteiro.
          setRevisionUnavailable(true);
          return;
        }
        setRevisionUnavailable(false);
        const atual = useInspectionStore.getState().currentInspection;
        if (!atual || !atual.reportTemplateSnapshot) return;
        setCurrentInspection({
          ...atual,
          reportTemplateSnapshot: freezeRevisionIntoTemplate(atual.reportTemplateSnapshot, revisao),
        });
      })
      .catch((err) => {
        // Offline é o caso normal aqui. Nada é gravado torto: a próxima abertura
        // com rede congela. Enquanto isso o roteiro aparece inteiro — nunca a menos.
        console.warn('[COND-08] Revisão de condições indisponível agora:', err);
        if (active) setRevisionUnavailable(true);
      });
    return () => { active = false; };
  }, [currentInspection, loading, setCurrentInspection]);

  // COND-08 · Gravar resposta de roteamento.
  //
  // Antes de aplicar, mede o que a mudança RETIRA de itens já respondidos e pede
  // confirmação com número (contrato § 6.1). A resposta sai carimbada com hora e
  // autoria: é o carimbo que faz o merge entre dois dispositivos convergir por
  // pergunta, em vez de o registro inteiro de uma apagar o da outra.
  const answerRoutingQuestion = useCallback(async (questionId: string, answer: RoutingAnswer | null) => {
    const state = useInspectionStore.getState();
    const inspection = state.currentInspection;
    if (!inspection) return;

    const impacto = answerChangeImpact({
      sections: effectiveTemplate?.sections || [],
      rules: effectiveTemplate?.rules,
      routingQuestions: effectiveTemplate?.routingQuestions,
      context: inspection.applicabilityContext,
      answers: inspection.routingAnswers,
      answeredItemIds,
      questionId,
      nextAnswer: answer,
    });

    if (impacto.needsConfirmation) {
      const ok = await confirm({
        title: `${impacto.leaving.length} requisito(s) já respondido(s) deixam de ser aplicáveis`,
        description:
          'As respostas existentes são preservadas no histórico, mas não participam do resultado enquanto esta condição permanecer. Se a condição voltar, elas voltam com ela.',
        consequences: [
          ...impacto.leavingSections.map((alvo) => `Sai a seção «${alvo.label}»`),
          ...impacto.leaving.slice(0, 6).map((alvo) => `Sai «${alvo.label}»`),
          ...(impacto.leaving.length > 6 ? [`… e mais ${impacto.leaving.length - 6} exigência(s)`] : []),
        ],
        confirmLabel: 'Aplicar mesmo assim',
        tone: 'default',
      });
      if (!ok) return;
    }

    const actor = getLocalActor();
    const merged = stampRoutingAnswer(
      { answers: inspection.routingAnswers || {}, meta: inspection.routingAnswersMeta || {} },
      questionId,
      answer,
      { at: new Date().toISOString(), by: actor.name },
    );

    state.setCurrentInspection({
      ...inspection,
      routingAnswers: merged.answers,
      routingAnswersMeta: merged.meta,
      lastEditedBy: actor.name,
      updatedAt: new Date(),
    });

    if (impacto.returning.length > 0) {
      toast.success(
        `${impacto.returning.length} requisito(s) voltaram ao roteiro`,
        'As respostas que já existiam voltaram a valer.',
      );
    }
  }, [answeredItemIds, confirm, effectiveTemplate]);

  const openActionItemIndex = useMemo(() => indexOpenActionItems(openActionItems), [openActionItems]);

  // ─── ÍNDICE, FILTRO E "FALTA ESCREVER" ────────────────────────────────────
  // Precisa desempatar por "mais recente" (não pelo último do array): uma
  // resposta duplicada e vazia para o mesmo item pode aparecer depois da
  // resposta real no array e apagar o texto/prazo já preenchidos na tela.
  const responseByItemId = useMemo(
    () => new Map(getLatestResponsesByItem(responses).map(response => [response.itemId, response])),
    [responses],
  );

  const sectionIndex = useMemo(() => visibleSections.map((section, idx: number) => ({
    id: section.id,
    label: `${idx + 1} · ${section.title}`,
    total: section.items.length,
    answered: section.items.filter((item) => responseByItemId.has(item.id)).length,
    // COND-08 · seção que depende de pergunta ainda sem resposta se anuncia no
    // índice: quem está em campo precisa achar o que falta resolver sem rolar.
    pending: applicability.sectionState[section.id]?.state === 'pendente_de_condicao',
  })), [visibleSections, responseByItemId, applicability]);

  // O que impede fechar: exigência pendente de condição esperando resposta.
  const pendingByCondition = useMemo(() => pendingBlockers(applicability), [applicability]);

  // Quantas condições estão quebradas na revisão congelada. Erro do motor vira
  // aviso na tela, nunca requisito escondido (regra inegociável 10).
  const applicabilityErrors = useMemo(
    () => applicability.validation.filter((issue) => issue.severity === 'error').length,
    [applicability],
  );

  // O `hasError` que o ChecklistItem calcula por dentro deixa de morar só lá:
  // NC sem situação e/ou ação vira uma linha clicável, não uma contagem (decisão 30).
  const missingText = useMemo<MissingText[]>(() => {
    const out: MissingText[] = [];
    let order = 0;
    for (const section of visibleSections) {
      for (const item of section.items) {
        order += 1;
        const response = responseByItemId.get(item.id);
        if (response?.result !== 'not_complies') continue;
        const semSituacao = !response.situationDescription?.trim();
        const semAcao = !response.correctiveAction?.trim();
        if (!semSituacao && !semAcao) continue;
        out.push({
          itemId: item.id,
          order,
          description: response.customDescription || item.description,
          missing: semSituacao && semAcao ? 'both' : semSituacao ? 'situation' : 'action',
        });
      }
    }
    return out;
  }, [visibleSections, responseByItemId]);

  const missingTextItemIds = useMemo(() => new Set(missingText.map(m => m.itemId)), [missingText]);

  const filterCounts = useMemo(() => {
    const all = visibleSections.flatMap(section => section.items);
    return {
      todos: all.length,
      'sem-resposta': all.filter((item) => !responseByItemId.has(item.id)).length,
      'nao-cumpre': all.filter((item) => responseByItemId.get(item.id)?.result === 'not_complies').length,
      reincidentes: all.filter((item) => previousNCs.has(item.id)).length,
      'falta-escrever': missingText.length,
    };
  }, [visibleSections, responseByItemId, missingText, previousNCs]);

  const matchesFilter = useCallback((filter: ItemFilter, itemId: string) => {
    switch (filter) {
      case 'sem-resposta': return !responseByItemId.has(itemId);
      case 'nao-cumpre': return responseByItemId.get(itemId)?.result === 'not_complies';
      case 'reincidentes': return previousNCs.has(itemId);
      case 'falta-escrever': return missingTextItemIds.has(itemId);
      default: return true;
    }
  }, [responseByItemId, missingTextItemIds, previousNCs]);

  // Responder o item faz ele deixar de casar com o filtro — mas quem está
  // escrevendo ainda precisa dele na tela para marcar prazo e responsável. O
  // cartão só sai quando ela recolhe o painel ou troca de filtro.
  const itemMatchesFilter = useCallback(
    (itemId: string) => matchesFilter(itemFilter, itemId) || stickyItemIds.has(itemId),
    [matchesFilter, itemFilter, stickyItemIds],
  );

  const applyFilter = useCallback((next: ItemFilter) => {
    setItemFilter(next);
    setStickyItemIds(new Set());
    if (next === 'todos') {
      // Um filtro sem resultado fecha todas as seções. Voltar para "todos"
      // devolvia a lista inteira recolhida — parece roteiro vazio, não roteiro
      // sem filtro. Reabre pelo menos a seção em que ela estava.
      setOpenSectionIds(prev => {
        if (prev.size > 0) return prev;
        const alvo = activeSectionId || visibleSections[0]?.id;
        return alvo ? new Set([alvo]) : prev;
      });
      return;
    }
    setOpenSectionIds(new Set(
      visibleSections
        .filter(section => section.items.some((item) => matchesFilter(next, item.id)))
        .map(section => section.id),
    ));
  }, [visibleSections, matchesFilter, activeSectionId]);

  const handleDetailsToggle = useCallback((itemId: string, open: boolean) => {
    setStickyItemIds(prev => {
      if (open === prev.has(itemId)) return prev;
      const copy = new Set(prev);
      if (open) copy.add(itemId); else copy.delete(itemId);
      return copy;
    });
  }, []);

  // A primeira seção nasce aberta — uma vez só. Antes isto rodava a cada
  // recálculo de `visibleSections`, e reabria a seção que ela tinha acabado de
  // recolher.
  // O autosave (linha ~854) sobrescreve a inspeção INTEIRA no servidor, sem
  // checar timestamp remoto. A Fase 1 do loadData mostra o Dexie local (que
  // pode estar atrasado em relação a outro aparelho) antes de `loading` virar
  // false — sem esta trava, um autosave disparado nessa janela grava esse
  // estado velho por cima do que o celular já tinha salvo (calculadora de
  // dimensionamento some, por exemplo). Só libera depois que a Fase 2
  // reconciliou com o servidor (ou desistiu, ex.: offline).
  const [remoteHydrated, setRemoteHydrated] = useState(false);
  const sectionsSeeded = useRef(false);
  useEffect(() => {
    if (sectionsSeeded.current || visibleSections.length === 0) return;
    sectionsSeeded.current = true;
    setOpenSectionIds(new Set([visibleSections[0].id]));
    setActiveSectionId(visibleSections[0].id);
  }, [visibleSections]);

  const goToSection = useCallback((sectionId: string) => {
    setOpenSectionIds(prev => new Set(prev).add(sectionId));
    setActiveSectionId(sectionId);
    window.requestAnimationFrame(() => {
      document.getElementById(`secao-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Recolher tudo de uma vez é o que torna 92 itens em 5 seções navegáveis no
  // celular: recolhido, o roteiro inteiro cabe numa tela.
  const allSectionsCollapsed = openSectionIds.size === 0;
  const toggleCollapseAll = useCallback(() => {
    setOpenSectionIds(prev => (prev.size === 0 ? new Set(visibleSections.map(s => s.id)) : new Set()));
  }, [visibleSections]);

  const goToItem = useCallback((itemId: string) => {
    const section = visibleSections.find(s => s.items.some((i) => i.id === itemId));
    if (section) {
      setOpenSectionIds(prev => new Set(prev).add(section.id));
      setActiveSectionId(section.id);
    }
    setItemFilter('todos');
    setStickyItemIds(new Set());
    window.requestAnimationFrame(() => {
      document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [visibleSections]);

  const goToFirstUnanswered = useCallback(() => {
    for (const section of visibleSections) {
      const item = section.items.find((i) => !responseByItemId.has(i.id));
      if (item) { goToItem(item.id); return; }
    }
  }, [visibleSections, responseByItemId, goToItem]);

  // ─── REALTIME SYNC: Listen for updates from Supabase ─────────────────────
  useEffect(() => {
    const inspectionId = state?.inspectionId;
    if (!inspectionId) return;

    return InspectionService.subscribeToResponseChanges(inspectionId, (accepted) => {
      useInspectionStore.getState().mergeResponses(accepted);
    });
  }, [state?.inspectionId]);

  // ─── AUTO-SAVE: immediate Dexie + debounced Supabase ─────────────────────
  useEffect(() => {
    if (loading || !currentInspection || !remoteHydrated) return;

    // Debounced remote save
    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await InspectionService.updateInspection(currentInspection.id, currentInspection);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Remote save error', err);
        setSaveStatus('idle');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [currentInspection, loading, remoteHydrated]);

  // Carimba quem fez a última modificação na inspeção. Atualizar o
  // currentInspection dispara o auto-save acima (que persiste last_edited_by).
  const stampInspectionEditor = useCallback((name: string) => {
    const state = useInspectionStore.getState();
    const insp = state.currentInspection;
    if (!insp || insp.lastEditedBy === name) return;
    state.setCurrentInspection({ ...insp, lastEditedBy: name, updatedAt: new Date() });
  }, []);


  const handleResponseChange = useCallback(async (itemId: string, result: InspectionResponse['result']) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    const actor = getLocalActor();
    // Responder é o que tira o item do filtro "sem resposta": ele fica.
    setStickyItemIds(prev => prev.has(itemId) ? prev : new Set(prev).add(itemId));
    const alreadyConfirmed = new Set(existing?.confirmedClientEvidenceIds || []);
    const pendingEvidence = (clientEvidence.get(itemId) || [])
      .filter(evidence => evidence.status === 'pending' && !alreadyConfirmed.has(evidence.evidenceId));
    if (result === 'complies' && pendingEvidence.length > 0) {
      const confirmed = await confirm({
        title: 'Aprovar evidências pendentes junto com CUMPRE?',
        description: 'Ao confirmar CUMPRE, estas evidências pendentes serão aprovadas na finalização:',
        consequences: pendingEvidence.map(evidence => evidence.fileName),
        confirmLabel: 'Confirmar CUMPRE',
        tone: 'default',
      });
      if (!confirmed) return;
      pendingEvidence.forEach(evidence => alreadyConfirmed.add(evidence.evidenceId));
    }
    const confirmedClientEvidenceIds = [...alreadyConfirmed];
    
    let updated: InspectionResponse;
    if (existing) {
      updated = { ...existing, result, confirmedClientEvidenceIds, updatedAt: new Date(), localActorId: actor.id, lastEditedBy: actor.name };
      state.updateResponse(existing.id, { result, confirmedClientEvidenceIds, updatedAt: new Date(), localActorId: actor.id, lastEditedBy: actor.name });
    } else {
      updated = {
        id: generateId(),
        inspectionId: state.currentInspection!.id,
        itemId,
        result,
        confirmedClientEvidenceIds,
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        localActorId: actor.id,
        lastEditedBy: actor.name,
        syncStatus: 'pending',
      };
      state.addResponse(updated);
    }
    void stampInspectionEditor(actor.name);
    
    try {
      await InspectionService.upsertResponse(updated);
    } catch (err) {
      console.error('Failed to sync response:', err);
    }
  }, [clientEvidence, confirm, stampInspectionEditor]);


  const handleUpdateDetails = useCallback(async (itemId: string, details: Partial<InspectionResponse>) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      const actor = getLocalActor();
      const updated = { ...existing, ...details, updatedAt: new Date(), localActorId: actor.id, lastEditedBy: actor.name };
      state.updateResponse(existing.id, { ...details, localActorId: actor.id, lastEditedBy: actor.name });
      void stampInspectionEditor(actor.name);

      try {
        await InspectionService.upsertResponse(updated);
      } catch (err) {
        console.error('Failed to sync response details:', err);
      }
    }
  }, [stampInspectionEditor]);


  const handleAddPhoto = useCallback(async (itemId: string, photoData: Omit<InspectionPhoto, 'id' | 'responseId'> & { id?: string }) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      const actor = getLocalActor();
      const newPhoto: InspectionPhoto = { 
        ...photoData, 
        id: generateId(), 
        responseId: existing.id,
        tenantId: state.currentInspection?.tenantId,
        localActorId: actor.id
      };
      
      state.updateResponse(existing.id, { photos: [...(existing.photos || []), newPhoto] });
      void stampInspectionEditor(actor.name);

      try {
        await InspectionService.upsertPhoto(newPhoto);
      } catch (err) {
        console.error('[Execution] Failed to persist photo:', err);
      }
    }
  }, [stampInspectionEditor]);

  const handleRemovePhoto = useCallback(async (itemId: string, photoId: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, { photos: (existing.photos || []).filter((p) => p.id !== photoId) });
      
      try {
        await InspectionService.deletePhoto(photoId);
      } catch (err) {
        console.error('[Execution] Failed to delete photo:', err);
      }
    }
  }, []);

  const closeExtraItemModal = useCallback(() => {
    setExtraItemSectionId(null);
    setEditingExtraItemId(null);
  }, []);

  const handleEditExtraItem = useCallback((itemId: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (!existing?.customItemMeta || existing.customItemMeta.state !== 'active') return;
    setEditingExtraItemId(itemId);
    setExtraItemSectionId(existing.customItemMeta.sectionId);
    setExtraDescription(existing.customDescription || '');
    setExtraCritical(existing.customItemMeta.isCritical);
    setExtraWeight(existing.customItemMeta.weight);
  }, []);


  const handleAddExtraItem = useCallback((sectionId: string) => {
    setEditingExtraItemId(null);
    setExtraItemSectionId(sectionId);
    setExtraDescription('');
    setExtraCritical(false);
    setExtraWeight(1);
  }, []);

  const handleCreateExtraItem = useCallback(async () => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection || !extraItemSectionId || !extraDescription.trim()) return;
    const baseTemplate = collaborationTemplate || effectiveTemplate;
    if (!baseTemplate) return;
    const actor = getLocalActor();
    const allResponses = await db.responses
      .where('inspectionId')
      .equals(state.currentInspection.id)
      .toArray();
    const order = nextCustomItemOrder(extraItemSectionId, baseTemplate, allResponses);
    const newResponse: InspectionResponse = {
      id: generateId(),
      inspectionId: state.currentInspection.id,
      itemId: `extra|${extraItemSectionId}|${generateId()}`,
      result: 'not_observed',
      customDescription: extraDescription.trim(),
      customItemMeta: customItemMeta(extraItemSectionId, order, extraCritical, extraWeight),
      confirmedClientEvidenceIds: [],
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      localActorId: actor.id,
      lastEditedBy: actor.name,
      syncStatus: 'pending',
    };

    await state.addResponse(newResponse);
    void stampInspectionEditor(actor.name);
    try {
      await InspectionService.upsertResponse(newResponse);
      closeExtraItemModal();
    } catch (err) {
      console.error('Failed to sync extra item:', err);
    }
  }, [
    collaborationTemplate,
    closeExtraItemModal,
    effectiveTemplate,
    extraCritical,
    extraDescription,
    extraItemSectionId,
    extraWeight,
    stampInspectionEditor,
  ]);

  const handleUpdateExtraItem = useCallback(async () => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(response => response.itemId === editingExtraItemId);
    if (!existing?.customItemMeta || !extraDescription.trim()) return;
    const actor = getLocalActor();
    const updated: InspectionResponse = {
      ...existing,
      customDescription: extraDescription.trim(),
      customItemMeta: customItemMeta(
        existing.customItemMeta.sectionId,
        existing.customItemMeta.order,
        extraCritical,
        extraWeight,
      ),
      updatedAt: new Date(),
      localActorId: actor.id,
      lastEditedBy: actor.name,
      syncStatus: 'pending',
    };
    await state.updateResponse(existing.id, updated);
    void stampInspectionEditor(actor.name);
    try {
      await InspectionService.upsertResponse(updated);
      closeExtraItemModal();
    } catch (err) {
      console.error('Failed to sync edited extra item:', err);
    }
  }, [closeExtraItemModal, editingExtraItemId, extraCritical, extraDescription, extraWeight, stampInspectionEditor]);

  const handleRemoveExtraItem = useCallback(async (itemId: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(response => response.itemId === itemId);
    if (!existing?.customItemMeta) return;
    const ok = await confirm({
      title: 'Excluir este item extra?',
      description: 'Remove da inspeção e interrompe sua recorrência futura.',
      confirmLabel: 'Excluir item extra',
    });
    if (!ok) return;
    const actor = getLocalActor();
    const now = new Date();
    const discontinued: InspectionResponse = {
      ...existing,
      customItemMeta: { ...existing.customItemMeta, state: 'discontinued' },
      deletedAt: now,
      updatedAt: now,
      localActorId: actor.id,
      lastEditedBy: actor.name,
      syncStatus: 'pending',
    };
    await db.responses.put(discontinued);
    setResponses(state.responses.filter(response => response.id !== existing.id));
    void stampInspectionEditor(actor.name);
    try {
      await InspectionService.upsertResponse(discontinued);
    } catch (err) {
      console.error('Failed to discontinue extra item:', err);
    }
  }, [confirm, setResponses, stampInspectionEditor]);

  // Registra (ou atualiza) a não-conformidade de dimensionamento na seção de RH,
  // com situação/ação já preenchidas pela calculadora. Reaproveita o mesmo item
  // se já tiver sido gerado, evitando duplicar a cada clique.
  const handleAddStaffingNC = useCallback(async (sectionId: string, finding: { situation: string; action: string }) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    const actor = getLocalActor();
    const existing = state.responses.find(r => r.itemId.startsWith(`extra|${sectionId}|staffing`));
    const baseTemplate = collaborationTemplate || effectiveTemplate;
    const allResponses = await db.responses.where('inspectionId').equals(state.currentInspection.id).toArray();
    const meta = existing?.customItemMeta || customItemMeta(
      sectionId,
      baseTemplate ? nextCustomItemOrder(sectionId, baseTemplate, allResponses) : 1,
      false,
      1,
    );

    if (existing) {
      const updated: InspectionResponse = {
        ...existing,
        result: 'not_complies',
        situationDescription: finding.situation,
        correctiveAction: finding.action,
        deadline: existing.deadline || 'Imediato',
        customItemMeta: meta,
        updatedAt: new Date(),
        localActorId: actor.id,
        lastEditedBy: actor.name,
      };
      state.updateResponse(existing.id, {
        result: 'not_complies',
        situationDescription: finding.situation,
        correctiveAction: finding.action,
        deadline: existing.deadline || 'Imediato',
        customItemMeta: meta,
        localActorId: actor.id,
        lastEditedBy: actor.name,
      });
      try { await InspectionService.upsertResponse(updated); } catch (err) { console.error('Falha ao salvar NC de dimensionamento:', err); }
    } else {
      const newResponse: InspectionResponse = {
        id: generateId(),
        inspectionId: state.currentInspection.id,
        itemId: `extra|${sectionId}|staffing-${generateId()}`,
        result: 'not_complies',
        customDescription: 'Dimensionamento de pessoal (RDC 502/2021) — quadro mínimo por turno',
        situationDescription: finding.situation,
        correctiveAction: finding.action,
        deadline: 'Imediato',
        responsible: 'RT / Gestor',
        customItemMeta: meta,
        confirmedClientEvidenceIds: [],
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        localActorId: actor.id,
        lastEditedBy: actor.name,
        syncStatus: 'pending',
      };
      await state.addResponse(newResponse);
      try { await InspectionService.upsertResponse(newResponse); } catch (err) { console.error('Falha ao criar NC de dimensionamento:', err); }
    }
    void stampInspectionEditor(actor.name);
    toast.success(
      'Não-conformidade de dimensionamento registrada na seção.',
      'Situação e ação já preenchidas — revise e ajuste se necessário.'
    );
  }, [collaborationTemplate, effectiveTemplate, stampInspectionEditor]);


  const updateStaffData = useCallback((field: string, value: number) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    const actor = getLocalActor();
    // Atualiza o currentInspection → dispara o auto-save (persiste no Dexie + Supabase).
    state.setCurrentInspection({ ...state.currentInspection, [field]: value, lastEditedBy: actor.name, updatedAt: new Date() });
  }, []);

  // Decisão 31: a assinatura do acompanhante sai do encerramento. O campo
  // `signatureDataUrl` continua no tipo e no banco — relatório antigo que já tem
  // assinatura continua imprimindo a dele —, mas nada mais a exige aqui.
  const [isFinishing, setIsFinishing] = useState(false);

  const handleConfirmFinish = async () => {
    if (!currentInspection) return;
    const ok = await confirm({ title: 'Encerrar inspeção?', confirmLabel: 'Encerrar inspeção', tone: 'default' });
    if (!ok) return;
    if (!navigator.onLine) {
      toast.error('Para finalizar o relatório, conecte-se à internet.', 'O rascunho local continua salvo.');
      return;
    }

    setIsFinishing(true);
    try {
      if (responses.length === 0) {
        const recovered = await InspectionService.getResponsesByInspectionId(currentInspection.id, true);
        if (recovered.length > 0) {
          setResponses(recovered);
          toast.warning('Foram recuperadas respostas já salvas na nuvem.', 'Revise o roteiro carregado antes de finalizar.');
          return;
        }
      }

      // ── Co-finalização ILPI ────────────────────────────────────────────
      // Em inspeção ILPI com mais de uma consultora, a finalização de UMA não
      // fecha o relatório: registra a finalização dela e mantém EM ANDAMENTO
      // até todas finalizarem. Assim ninguém fecha a inspeção da outra "sem as
      // minhas respostas". Fluxo normal (1 consultora ou não-ILPI) é inalterado.
      const actor = getLocalActor();
      const expectedConsultants = (currentInspection.consultantNames && currentInspection.consultantNames.length > 0)
        ? currentInspection.consultantNames
        : ([currentInspection.consultantName].filter(Boolean) as string[]);
      const isCoInspection = isIlpiInspection && expectedConsultants.length > 1;
      const finalizedBy = [
        ...(currentInspection.finalizedBy || []).filter(f => f.name !== actor.name),
        { name: actor.name, at: new Date().toISOString() },
      ];
      const allFinalized = expectedConsultants.every(name => finalizedBy.some(f => f.name === name));

      if (isCoInspection && !allFinalized) {
        const pending = expectedConsultants.filter(name => !finalizedBy.some(f => f.name === name));
        await InspectionService.updateInspection(currentInspection.id, {
          finalizedBy,
          lastEditedBy: actor.name,
          status: 'in_progress',
        });
        setCurrentInspection({
          ...currentInspection,
          finalizedBy,
          lastEditedBy: actor.name,
          status: 'in_progress',
          updatedAt: new Date(),
          syncStatus: 'synced',
        });
        toast.warning(
          `Sua finalização foi registrada (${actor.name}).`,
          `A inspeção continua EM ANDAMENTO até ${pending.join(' e ')} finalizar também. O relatório só é `
          + 'fechado e publicado quando todas as consultoras finalizarem — assim a sua parte não é encerrada '
          + 'sem as suas respostas.'
        );
        setIsFinishing(false);
        return;
      }

      // Persist the draft first. The transactional reconciliation must succeed
      // before the inspection is allowed to become completed.
      const reportTemplateSnapshot = collaborationTemplate || effectiveTemplate || undefined;
      const draftInspection: Inspection = {
        ...currentInspection,
        status: 'in_progress',
        finalizedBy,
        lastEditedBy: actor.name,
        reportTemplateSnapshot,
        updatedAt: new Date(),
        syncStatus: 'pending',
        syncError: undefined,
      };
      await db.inspections.put(draftInspection);
      const draftSync = await InspectionBundleSyncService.syncInspectionBundle(currentInspection.id, {
        inspectionOverride: draftInspection,
      });
      if (draftSync.status !== 'completed') {
        throw new Error('Rascunho enfileirado no servidor, mas ainda não concluído.');
      }

      const confirmedEvidenceIds = [...new Set(
        useInspectionStore.getState().responses.flatMap(response => response.confirmedClientEvidenceIds || []),
      )];
      await ClientEvidenceService.reconcileInspection(currentInspection.id, confirmedEvidenceIds);
      if (confirmedEvidenceIds.length > 0) {
        const refreshed = await ClientEvidenceService.byItemForClient(currentInspection.clientId);
        const statuses = new Map(
          [...refreshed.evidence.values()].flat().map(evidence => [evidence.evidenceId, evidence.status]),
        );
        if (confirmedEvidenceIds.some(id => statuses.get(id) !== 'approved')) {
          throw new Error('A aprovação das evidências não foi confirmada pelo servidor.');
        }
      }

      // 1. Build final inspection record updates
      const updates: Partial<Inspection> = {
        status: 'completed' as const,
        completedAt: new Date(),
        finalizedBy,
        lastEditedBy: actor.name,
      };
      const finalizedInspection: Inspection = {
        ...draftInspection,
        ...updates,
        // Snapshot do relatório DEVE ser o roteiro COMPLETO (todas as áreas:
        // sanitária + nutrição), não o filtrado pelo papel da consultora que
        // está finalizando. Senão, ao Ester (role 'saude') finalizar, a parte de
        // nutrição da Ana some do relatório. Ver ilpi-score-por-area-ester-ana.
        reportTemplateSnapshot,
        updatedAt: new Date(),
        syncStatus: 'pending',
        syncError: undefined,
      };

      // 2. Save locally, then confirm the whole report bundle in Supabase.
      await db.inspections.put(finalizedInspection);
      const syncResult = await InspectionBundleSyncService.syncInspectionBundle(currentInspection.id, {
        finalizeReport: true,
        inspectionOverride: finalizedInspection,
      });
      if (syncResult.status !== 'completed') {
        throw new Error('Relatorio enfileirado no servidor, mas ainda nao concluido.');
      }

      // 2b. If linked to a schedule, complete it too
      if (linkedScheduleId) {
        await ScheduleService.completeWithInspection(linkedScheduleId, currentInspection.id);
      }

      // 3. Update the store
      setCurrentInspection({ ...finalizedInspection, syncStatus: 'synced' });

      // 4. Navigate
      navigate('/summary', { state: { inspectionId: currentInspection.id } });
    } catch (err) {
      console.error('[handleConfirmFinish] Error:', err);
      toast.error(
        'Relatório salvo como rascunho local, mas ainda não foi finalizado na nuvem.',
        'Abra a Central de Sincronização e tente novamente.'
      );
    } finally {
      setIsFinishing(false);
    }
  };


  // ─── RENDER STATES ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <p className="text-sm text-navy-3 font-medium">Carregando inspeção...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
        <p className="text-danger font-semibold">{loadError}</p>
        <Button onClick={loadData} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Tentar Novamente
        </Button>
        <Button variant="ghost" onClick={() => navigate('/inspections')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Inspeções
        </Button>
      </div>
    );
  }

  if (!currentInspection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
        <div className="mb-4 rounded-full bg-amber-soft p-3">
          <RefreshCw className="h-8 w-8 text-amber-strong" />
        </div>
        <p className="text-navy-2 font-semibold">O roteiro desta inspeção não pôde ser carregado.</p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button 
            variant="default"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar recarregar
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/inspections')}
          >
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  const isCompleted = currentInspection.status === 'completed';
  const usingRecoveryTemplate = !template;
  const displayClientName = hideClientInfo ? 'Cliente oculto' : currentInspection.clientName;

  // ─── ENCERRAR E ENTREGAR ──────────────────────────────────────────────────
  if (isFinishStep && !isCompleted && effectiveTemplate) {
    const voltarAoRoteiro = () => setSearchParams({}, { state: location.state });
    return (
      <>
        <InspectionFinishScreen
          inspection={currentInspection}
          // O roteiro COMPLETO (todas as áreas), o mesmo que vira
          // `reportTemplateSnapshot`: a nota e a contagem de pendências
          // anunciadas aqui têm de ser as que o cliente vai ver, não as
          // filtradas pelo papel de quem está encerrando.
          template={(collaborationTemplate || effectiveTemplate) as ChecklistTemplate}
          responses={responses}
          missingText={missingText}
          // COND-08 · o que ficou pendente de condição bloqueia o encerramento
          // (contrato § 6.4). "Não foi possível determinar" não entra aqui: é
          // resposta legítima de campo e libera a entrega.
          pendingByCondition={pendingByCondition}
          isIlpi={isIlpiInspection}
          isFinishing={isFinishing}
          accompanistName={currentInspection.accompanistName || ''}
          accompanistRole={currentInspection.accompanistRole || ''}
          onAccompanistChange={(field, value) => setCurrentInspection({
            ...currentInspection,
            [field]: value,
            updatedAt: new Date(),
          })}
          onGoToItem={(itemId) => { voltarAoRoteiro(); goToItem(itemId); }}
          onBack={voltarAoRoteiro}
          onFinish={handleConfirmFinish}
          // Nunca bloqueado: gerar o PDF para conferência não publica nada — o
          // `shouldSyncFinalSnapshot` do relatório só dispara com a inspeção concluída.
          onPdfOnly={() => navigate('/summary', { state: { inspectionId: currentInspection.id } })}
        />
        {confirmDialog}
      </>
    );
  }

  // Reabrir a inspeção: o mesmo caminho no botão do desktop e na folha do celular.
  const handleReopenInspection = async () => {
    const ok = await confirm({
      title: 'Reabrir esta inspeção para edição?',
      confirmLabel: 'Reabrir inspeção',
      tone: 'default',
    });
    if (!ok) return;
    try {
      await InspectionService.reopenInspection(currentInspection.id);
      setCurrentInspection({ ...currentInspection, status: 'in_progress', completedAt: undefined });
    } catch (err) {
      toast.error('Erro ao reabrir inspeção', String(err));
    }
  };

  const totalItems = filterCounts.todos;
  const answeredItems = totalItems - filterCounts['sem-resposta'];
  const progressPct = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;
  const criticalNotComplies = visibleSections
    .flatMap(section => section.items)
    .filter((item) => item.isCritical && responseByItemId.get(item.id)?.result === 'not_complies')
    .length;
  // A nota que o cabeçalho compacto do celular mostra é a mesma do painel do
  // desktop — a `MobileScoreBar` foi absorvida por ele, não duplicada.
  // COND-09 - a nota corre sobre os APLICAVEIS, nao sobre a arvore congelada
  // inteira: item que saiu por regra tem a resposta preservada no historico, mas
  // nao entra no denominador (contrato 6.1). `applicability.sections` e a mesma
  // arvore que o resumo, o PDF e o plano de acao recebem -- papel so recorta a
  // exibicao (`visibleSections`), nunca o resultado.
  const score = effectiveTemplate ? calculateScore(responses, applicability.sections) : null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas pb-safe lg:pb-0">
      {/* ── celular: 46px de cabeçalho + 39px de chips ─────────────────────
          Substitui o cabeçalho de desktop e a MobileScoreBar, que juntos comiam
          quase meia tela antes do primeiro item. Sem barra inferior e sem FAB:
          todas as ações moram na folha do ⋮. */}
      <header className="sticky top-0 z-30 border-b border-default bg-surface lg:hidden">
        <div className="flex h-[46px] items-center gap-1.5 px-1.5">
          <button
            type="button"
            onClick={() => navigate('/inspections')}
            aria-label="Voltar para inspeções"
            // Caixa de 44px pela régua de toque (decisão 7); a margem negativa
            // devolve ao layout os 8px que o desenho de 36px não usa.
            className="-mx-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-navy hover:bg-surface-hover"
          >
            <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-title text-[13px] font-bold leading-tight text-navy">{displayClientName}</p>
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-navy-3">
              <span
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isOnline ? 'bg-success' : 'bg-amber')}
                aria-hidden="true"
              />
              {/* A frase inteira num `<span>` só: texto solto ao lado de um valor
                  dentro de um flex com `gap` abre buraco no meio da frase. */}
              <span className="truncate">
                {isOnline
                  ? `Salvo · ${answeredItems}/${totalItems}`
                  : 'Sem conexão · salvo no aparelho'}
              </span>
            </span>
          </div>
          {score && (
            <>
              <span
                className="shrink-0 text-[14px] font-black tabular-nums"
                style={{ color: classificationInk(score.classification) }}
              >
                {Math.round(score.scorePercentage)}%
                <span className="sr-only"> de adequação</span>
              </span>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-danger">
                {score.urgentActionsCount} <span className="sr-only">não conformidades</span>
                <span aria-hidden="true">NC</span>
              </span>
            </>
          )}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Ações da inspeção"
            aria-haspopup="dialog"
            className="-mx-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-default text-navy-2"
          >
            <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div
          className="flex items-center gap-1.5 overflow-x-auto px-3 pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filtrar itens do roteiro"
        >
          {/* O botão é a área de toque de 44px; o chip pintado é o `span` de 32px
              dentro dele. Faixa de rolagem não conta como alvo (decisão 7). */}
          {FILTER_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={itemFilter === value}
              onClick={() => applyFilter(value)}
              className="group flex h-11 shrink-0 items-center bg-transparent"
            >
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-default bg-surface px-[11px] text-xs font-semibold text-navy-2 group-aria-pressed:border-primary-700 group-aria-pressed:bg-primary-700 group-aria-pressed:text-on-accent">
                {label}
                <span className="font-bold tabular-nums opacity-65">{filterCounts[value]}</span>
              </span>
            </button>
          ))}
        </div>
      </header>

      <header className="sticky top-0 z-30 hidden border-b border-default bg-surface px-4 py-3 sm:px-6 lg:block">
        <div className="mx-auto w-full max-w-[1600px] space-y-3">
          {/* Trilha: a execução não é uma ilha sem volta. */}
          <nav aria-label="Trilha" className="flex items-center gap-1.5 text-xs text-navy-3">
            <button
              type="button"
              className="hover:text-navy-2 hover:underline [@media(pointer:coarse)]:py-3.5"
              onClick={() => navigate('/inspections')}
            >
              Inspeções
            </button>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="truncate text-navy-2">{displayClientName}</span>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="whitespace-nowrap">
              Visita de {new Date(currentInspection.inspectionDate).toLocaleDateString('pt-BR')}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            {/* No celular a identificação toma a linha inteira (`basis-full`) e empurra o
                estado e as ações para a linha de baixo. Sem isso o `flex-wrap` não quebra:
                como este bloco pode encolher até 0 (`min-w-0`), a linha "cabia" com o nome
                da unidade espremido em 11px — ou seja, só a reticência. */}
            <div className="flex min-w-0 basis-full items-center gap-3 sm:flex-1 sm:basis-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/inspections')} aria-label="Voltar para inspeções">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold text-navy">{displayClientName}</h1>
                <p className="truncate text-sm text-navy-3">
                  {effectiveTemplate?.name || 'Roteiro'}
                  {currentInspection.consultantName && ` · aberta por ${currentInspection.consultantName}`}
                  {currentInspection.lastEditedBy && currentInspection.lastEditedBy !== currentInspection.consultantName
                    && ` · última edição de ${currentInspection.lastEditedBy}`}
                </p>
              </div>
            </div>

            {/* Estado em três canais: cor, ícone (forma) e a palavra escrita.
                "Dados Protegidos" sai — é jargão, e verde sozinho não é informação. */}
            {!isOnline ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-soft-border bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber-soft-ink">
                <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Sem conexão — salvo no aparelho
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-secondary-200 bg-secondary-100 px-2.5 py-1 text-xs font-medium text-secondary-700">
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                Salvando na nuvem
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-success-soft-border bg-success-soft px-2.5 py-1 text-xs font-medium text-success-soft-ink">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Salvo no aparelho e na nuvem
              </span>
            )}

            {isCompleted && <Badge variant="success">Finalizada</Badge>}
            {usingRecoveryTemplate && <Badge variant="warning">Modo recuperação</Badge>}
            {photoHydration && (
              <Badge variant="neutral">
                Fotos {photoHydration.completed + photoHydration.failed}/{photoHydration.total}
              </Badge>
            )}

            {!isCompleted && (
              <Button
                variant="outline"
                onClick={() => setShowTeamResponses(true)}
                className="gap-2"
                title="Ver respostas e fotos já sincronizadas sem editar"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden md:inline">Ver o que a equipe preencheu</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHideClientInfo((value) => !value)}
              aria-label={hideClientInfo ? 'Mostrar dados do cliente' : 'Ocultar dados do cliente'}
            >
              {hideClientInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {!isCompleted && (
              <Button onClick={() => setSearchParams({ etapa: 'encerrar' }, { state: location.state })}>
                Encerrar e entregar
              </Button>
            )}
            {isCompleted && (
              <Button
                variant="outline"
                onClick={handleReopenInspection}
                className="border-amber-soft-border text-amber-soft-ink hover:bg-amber-soft"
              >
                Reabrir inspeção
              </Button>
            )}
          </div>

          {/* Progresso: quanto falta, e o que já está errado. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-navy">
              {answeredItems} de {totalItems} respondidos
            </span>
            <span className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span className="block h-full rounded-full bg-primary-700" style={{ width: `${progressPct}%` }} />
            </span>
            {criticalNotComplies > 0 && (
              <Badge variant="danger">{criticalNotComplies} críticos não cumprem</Badge>
            )}
            {missingText.length > 0 && (
              <Badge variant="warning">{missingText.length} sem texto</Badge>
            )}
          </div>
        </div>
      </header>

      {currentInspection.templateId === 'tpl-ilpi-federal-v1' && <CollaborativeProgress />}

      {/* Decisão 24: a largura entra na regra única. `max-w-7xl` sai; quem
          controla a linha de leitura é a coluna do meio, não a página. */}
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-0 px-0 py-0 lg:gap-6 lg:px-4 lg:py-6 lg:grid-cols-[minmax(0,1fr)_340px] 3col:grid-cols-[248px_minmax(0,1fr)_340px]">
        {/* ── índice de seções ──────────────────────────────────────────── */}
        <div className="hidden 3col:block 3col:sticky 3col:top-40 3col:self-start">
          <ExecutionSectionIndex
            sections={sectionIndex}
            activeId={activeSectionId}
            onSelect={goToSection}
          />
        </div>

        {/* ── roteiro ───────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-0 lg:space-y-6">
          {usingRecoveryTemplate && (
            <div className="mx-3 mt-3 rounded-md border border-amber-soft-border bg-amber-soft p-4 text-sm text-amber-soft-ink lg:mx-0 lg:mt-0">
              <strong>Roteiro original indisponível.</strong>
              <p className="mt-1">
                O app carregou {responses.length} respostas/fotos salvas localmente para recuperação. Não limpe o cache.
              </p>
            </div>
          )}

          {!historyComplete && (
            <div className="mx-3 mt-3 rounded-md border border-secondary-200 bg-secondary-100 p-4 text-sm text-secondary-700 lg:mx-0 lg:mt-0">
              <strong>Histórico offline possivelmente incompleto.</strong>
              <p className="mt-1">As pendências em cache foram preservadas e serão reconciliadas automaticamente quando a conexão voltar.</p>
            </div>
          )}

          {/* Co-finalização: quem já fechou a sua parte e quem falta. Quem abriu e
              quem editou por último já está escrito no cabeçalho. */}
          {currentInspection.finalizedBy && currentInspection.finalizedBy.length > 0 && (
            <div className="mx-3 mt-3 rounded-md border border-secondary-200 bg-secondary-100 p-3 text-sm text-secondary-700 lg:mx-0 lg:mt-0">
              {currentInspection.finalizedBy.map((f) => (
                <div key={f.name}>✓ <strong>{f.name}</strong> finalizou sua parte em {new Date(f.at).toLocaleString('pt-BR')}.</div>
              ))}
              {(() => {
                const expected = (currentInspection.consultantNames && currentInspection.consultantNames.length > 0)
                  ? currentInspection.consultantNames
                  : [currentInspection.consultantName].filter(Boolean) as string[];
                const pending = expected.filter(n => !(currentInspection.finalizedBy || []).some(f => f.name === n));
                return pending.length > 0
                  ? <div className="mt-1 font-semibold">Aguardando finalização de: {pending.join(' e ')}. A inspeção segue editável até lá.</div>
                  : null;
              })()}
            </div>
          )}

          {/* Filtro do roteiro. "Falta escrever" também é filtro, não só painel. */}
          <div className="hidden flex-wrap gap-2 lg:flex" role="group" aria-label="Filtrar itens do roteiro">
            {FILTER_TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={itemFilter === value}
                onClick={() => applyFilter(value)}
                className="inline-flex items-center gap-1.5 rounded-md border border-control bg-surface px-3 py-2 text-sm text-navy-2 hover:bg-surface-hover aria-[pressed=true]:border-primary-700 aria-[pressed=true]:bg-primary-50 aria-[pressed=true]:font-semibold aria-[pressed=true]:text-primary-800"
                style={{ minHeight: 44 }}
              >
                {label}
                <span className="tabular-nums text-navy-3">{filterCounts[value]}</span>
              </button>
            ))}
          </div>

          {/* COND-03 · o roteiro mudou depois que esta inspeção começou. A tela
              avisa e oferece; quem decide é a consultora, porque atualizar no
              meio de uma vistoria é decisão dela e não do sistema. */}
          {atualizacaoDoRoteiro && (
            <div className="mx-3 mt-3 rounded-md border border-primary-300 bg-primary-50 p-3 text-sm text-navy-2 lg:mx-0">
              <strong className="text-primary-800">O roteiro mudou depois que esta inspeção começou.</strong>
              <p className="mt-1">
                {[
                  atualizacaoDoRoteiro.itensNovos.length
                    ? `${atualizacaoDoRoteiro.itensNovos.length} requisito(s) novo(s)`
                    : null,
                  atualizacaoDoRoteiro.itensComTextoNovo.length
                    ? `${atualizacaoDoRoteiro.itensComTextoNovo.length} com orientação ou ação pela norma nova`
                    : null,
                ].filter(Boolean).join(' · ')}
                . Suas respostas não mudam, e item já respondido não sai.
              </p>
              <button
                type="button"
                onClick={() => { void atualizarRoteiroDaInspecao(); }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary-700 bg-surface px-3 py-2 font-semibold text-primary-800 hover:bg-primary-100"
                style={{ minHeight: 44 }}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Atualizar o roteiro desta inspeção
              </button>
            </div>
          )}

          {/* COND-08 · erro de condição NUNCA esconde requisito (regra inegociável
              10): quando a revisão não pôde ser lida ou tem regra quebrada, a
              tela avisa e o roteiro continua inteiro. */}
          {revisionUnavailable && (
            <div className="mx-3 mt-3 rounded-md border border-amber-soft-border bg-amber-soft p-3 text-sm text-amber-soft-ink lg:mx-0">
              <strong>Condições do roteiro ainda não carregadas.</strong>
              <p className="mt-1">
                O roteiro está sendo mostrado por inteiro, sem esconder nada. Abra a inspeção com conexão
                uma vez para as condições valerem também neste aparelho.
              </p>
            </div>
          )}

          {applicabilityErrors > 0 && (
            <div className="mx-3 mt-3 rounded-md border border-amber-soft-border bg-amber-soft p-3 text-sm text-amber-soft-ink lg:mx-0">
              <strong>{applicabilityErrors} condição(ões) do roteiro com erro de configuração.</strong>
              <p className="mt-1">
                O que dependia delas ficou <strong>pendente e visível</strong> — nada foi escondido. Avise a
                consultora responsável pelo roteiro.
              </p>
            </div>
          )}

          <RoutingQuestionsBlock questions={questionsBySection.soltas} onAnswer={answerRoutingQuestion} />

          {visibleSections.map((section, idx: number) => {
            const sectionResponses = section.items
              .map((i) => responses.find(r => r.itemId === i.id))
              .filter(Boolean) as InspectionResponse[];
            const visibleItems = section.items.filter((item) => itemMatchesFilter(item.id));
            // Com filtro ligado e nenhum item correspondente: no desktop a seção
            // sai da tela (são 11 cartões grandes); no celular ela fica, com uma
            // linha dizendo por quê — a lista é contínua e uma seção que some
            // sem aviso parece seção que deixou de existir.
            const emptyUnderFilter = itemFilter !== 'todos' && visibleItems.length === 0;
            const isOpen = openSectionIds.has(section.id);

            const sectionDecision = applicability.sectionState[section.id];
            const sectionPending = sectionDecision?.state === 'pendente_de_condicao';

            return (
              <div
                key={section.id}
                id={`secao-${section.id}`}
                className={cn('scroll-mt-[97px] lg:scroll-mt-44', emptyUnderFilter && 'lg:hidden')}
              >
              <SectionAccordion
                title={sectionPending ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {`${idx + 1}. ${section.title}`}
                    <Badge variant="warning">Pendente de condição</Badge>
                  </span>
                ) : `${idx + 1}. ${section.title}`}
                totalItems={section.items.length}
                evaluatedItems={sectionResponses.length}
                compliesCount={sectionResponses.filter(r => r.result === 'complies').length}
                notCompliesCount={sectionResponses.filter(r => r.result === 'not_complies').length}
                expanded={isOpen}
                onExpandedChange={(next) => setOpenSectionIds(prev => {
                  const copy = new Set(prev);
                  if (next) { copy.add(section.id); setActiveSectionId(section.id); } else copy.delete(section.id);
                  return copy;
                })}
              >
                {emptyUnderFilter ? (
                  <p className="bg-surface px-3 py-3 text-[12.5px] text-navy-3">
                    Nenhum item nesta seção com o filtro atual.
                  </p>
                ) : (
                <div className="space-y-0 lg:space-y-4">
                  {/* COND-08 · a seção pendente diz por quê, com a frase do motor. */}
                  {sectionPending && sectionDecision && (
                    <p className="mx-3 mt-3 rounded-md bg-amber-soft px-3 py-2 text-[12.5px] text-amber-soft-ink lg:mx-0 lg:mt-0">
                      {sectionDecision.explanation}
                    </p>
                  )}

                  <RoutingQuestionsBlock
                    questions={questionsBySection.porSecao.get(section.id) || []}
                    onAnswer={answerRoutingQuestion}
                    title="Perguntas que definem esta seção"
                  />

                  {/* ILPI Dimensioning Block — casa por id (roteiro estático) ou por
                      título "Recursos Humanos" (roteiros salvos no banco usam id UUID). */}
                  {(section.id === 'sec-fed-12'
                    || (isIlpiInspection && /recursos\s+humanos/i.test(section.title || ''))) && (
                    <div className="m-3 space-y-4 rounded-md border border-default bg-surface p-4 lg:mx-0 lg:mb-6 lg:mt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-navy">Dimensionamento ILPI</h3>
                        {isRioState(currentInspection.state) && (
                          <Badge variant="neutral">Rio de Janeiro (Lei 8.049/18)</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {['Level1', 'Level2', 'Level3'].map((lvl, i) => (
                          <div key={lvl}>
                            <Label htmlFor={`dependencyLevel${i + 1}`} className="mb-1.5">Grau {i + 1}</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              id={`dependencyLevel${i + 1}`}
                              name={`dependencyLevel${i + 1}`}
                              className="h-11"
                              value={[currentInspection.dependencyLevel1, currentInspection.dependencyLevel2, currentInspection.dependencyLevel3][i] || 0}
                              onChange={(e) => updateStaffData(`dependencyLevel${i + 1}`, parseInt(e.target.value) || 0)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 gap-4 border-b border-default pb-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="observedStaff" className="mb-1.5">Cuidadores em turno</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            id="observedStaff"
                            name="observedStaff"
                            className="h-11"
                            value={currentInspection.observedStaff || 0}
                            onChange={(e) => updateStaffData('observedStaff', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="observedNursingTechs" className="mb-1.5">Técnicos de enfermagem em turno</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            id="observedNursingTechs"
                            name="observedNursingTechs"
                            className="h-11"
                            value={currentInspection.observedNursingTechs || 0}
                            onChange={(e) => updateStaffData('observedNursingTechs', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 border-b border-default pb-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="usableAreaM2" className="mb-1.5">Área útil aproximada (m²)</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            id="usableAreaM2"
                            name="usableAreaM2"
                            className="h-11"
                            value={currentInspection.usableAreaM2 || 0}
                            onChange={(e) => updateStaffData('usableAreaM2', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="observedCleaningStaff" className="mb-1.5">Profissionais de limpeza</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            id="observedCleaningStaff"
                            name="observedCleaningStaff"
                            className="h-11"
                            value={currentInspection.observedCleaningStaff || 0}
                            onChange={(e) => updateStaffData('observedCleaningStaff', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <ILPIStaffCalculator
                        level1={currentInspection.dependencyLevel1 || 0}
                        level2={currentInspection.dependencyLevel2 || 0}
                        level3={currentInspection.dependencyLevel3 || 0}
                        currentCaregivers={currentInspection.observedStaff || 0}
                        currentNursingTechs={currentInspection.observedNursingTechs || 0}
                        usableAreaM2={currentInspection.usableAreaM2 || 0}
                        currentCleaningStaff={currentInspection.observedCleaningStaff || 0}
                        isRJ={isRioState(currentInspection.state)}
                        residentsTotal={currentInspection.residentsTotal || 0}
                        onRegisterFinding={(f) => handleAddStaffingNC(section.id, f)}
                      />
                    </div>
                  )}

                  {/* Template Items */}
                  {visibleItems.map((item) => {
                    const resp = responses.find(r => r.itemId === item.id);
                    const itemDecision = applicability.itemState[item.id];
                    const itemPending = !sectionPending && itemDecision?.state === 'pendente_de_condicao';
                    return (
                      <div key={item.id}>
                        {/* Pendente continua respondível: pendência é do ROTEIRO,
                            não do requisito — e some em silêncio é o que o
                            contrato § 6.4 proíbe. */}
                        {itemPending && itemDecision && (
                          <p className="mx-3 mt-3 rounded-md bg-amber-soft px-3 py-2 text-[12.5px] text-amber-soft-ink lg:mx-0">
                            {itemDecision.explanation}
                          </p>
                        )}
                        <ChecklistItem
                          item={item}
                          response={resp}
                          previousNC={previousNCs.get(item.id)}
                          clientEvidence={clientEvidence.get(item.id)}
                          clientDeclaration={clientDeclarations.get(item.id)}
                          clientCheckpoints={clientCheckpoints.get(item.id)}
                          visitDate={currentInspection.inspectionDate}
                          pactuatedDueDate={findOpenActionItem(openActionItemIndex, { itemId: item.id, description: item.description })?.due_date}
                          onChange={handleResponseChange}
                          onUpdateDetails={handleUpdateDetails}
                          onDetailsToggle={handleDetailsToggle}
                          onEdit={item.id.startsWith('extra|') ? handleEditExtraItem : undefined}
                          onDelete={item.id.startsWith('extra|') ? handleRemoveExtraItem : undefined}
                          onAddPhoto={handleAddPhoto}
                          onRemovePhoto={handleRemovePhoto}
                        />
                      </div>
                    );
                  })}

                  <Button
                    variant="outline"
                    fullWidth
                    className="mb-3 mt-3 w-[calc(100%-1.5rem)] self-center lg:m-0 lg:w-full"
                    onClick={() => handleAddExtraItem(section.id)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Acrescentar um item que o roteiro não prevê
                  </Button>
                </div>
                )}
              </SectionAccordion>
              </div>
            );
          })}

          <ExcludedByRulePanel
            excluded={applicability.excluded}
            answeredCount={applicability.counts.foraComResposta}
          />

          {itemFilter !== 'todos' && filterCounts[itemFilter] === 0 && (
            <div className="m-3 rounded-md border border-default bg-surface p-6 text-center lg:m-0">
              <p className="text-sm text-navy-2">Nenhum item neste filtro.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => applyFilter('todos')}>
                Ver todos os itens
              </Button>
            </div>
          )}

          {/* Fim do roteiro: no celular o "Encerrar e entregar" não fica no
              cabeçalho nem num rodapé fixo — ele espera no fim da rolagem, que é
              onde a visita de fato termina. */}
          {!isCompleted && (
            <div className="m-3 rounded-xl border border-default bg-surface p-3.5 lg:hidden">
              <h2 className="font-title text-[13px] font-bold leading-tight text-navy">Fim do roteiro</h2>
              <p className="mb-[11px] mt-1 text-[12.5px] leading-[1.45] text-navy-2">
                {answeredItems} de {totalItems} respondidos · {filterCounts['nao-cumpre']} não conformidades
                {missingText.length > 0 && ` · ${missingText.length} sem texto`}
              </p>
              <Button
                fullWidth
                className="h-12"
                onClick={() => setSearchParams({ etapa: 'encerrar' }, { state: location.state })}
              >
                Encerrar e entregar
              </Button>
            </div>
          )}
        </div>

        {/* ── nota ──────────────────────────────────────────────────────── */}
        <div className="hidden lg:block lg:sticky lg:top-40 lg:self-start">
          {effectiveTemplate && (
            <ExecutionScorePanel
              template={effectiveTemplate as ChecklistTemplate}
              responses={responses}
              previousVisit={previousVisit}
              isIlpi={isIlpiInspection}
              isCompleted={isCompleted}
              missingText={missingText}
              photoQueueCount={photoHydration ? photoHydration.total - photoHydration.completed - photoHydration.failed : 0}
              onGoToItem={goToItem}
              onGoToFirstUnanswered={goToFirstUnanswered}
            />
          )}
        </div>
      </div>

      <MobileExecutionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isOnline={isOnline}
        isSaving={saveStatus === 'saving'}
        answered={answeredItems}
        total={totalItems}
        sections={sectionIndex}
        activeSectionId={activeSectionId}
        onSelectSection={goToSection}
        allCollapsed={allSectionsCollapsed}
        onToggleCollapseAll={toggleCollapseAll}
        onPreviewReport={() => navigate('/summary', { state: { inspectionId: currentInspection.id } })}
        onTeamResponses={() => setShowTeamResponses(true)}
        onAddExtraItem={() => handleAddExtraItem(activeSectionId || visibleSections[0]?.id || '')}
        onSaveAndExit={() => navigate('/inspections')}
        hideClientInfo={hideClientInfo}
        onToggleHideClient={() => setHideClientInfo((value) => !value)}
        isCompleted={isCompleted}
        onFinish={() => setSearchParams({ etapa: 'encerrar' }, { state: location.state })}
        onReopen={handleReopenInspection}
      />

      <TeamResponsesViewer
        inspectionId={currentInspection.id}
        isOpen={showTeamResponses}
        onClose={() => setShowTeamResponses(false)}
        template={collaborationTemplate as ChecklistTemplate | null}
      />

      <Modal
        isOpen={extraItemSectionId !== null}
        onClose={closeExtraItemModal}
        title={editingExtraItemId ? "Editar item extra" : "Adicionar item extra"}
        footer={(
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeExtraItemModal}>Cancelar</Button>
            <Button
              disabled={!extraDescription.trim()}
              onClick={editingExtraItemId ? handleUpdateExtraItem : handleCreateExtraItem}
            >
              {editingExtraItemId ? 'Salvar alterações' : 'Adicionar'}
            </Button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div>
            <Label htmlFor="extra-description" required>Descrição</Label>
            <Input
              id="extra-description"
              className="mt-2"
              value={extraDescription}
              onChange={event => setExtraDescription(event.target.value)}
              autoFocus
            />
          </div>
          <Checkbox
            checked={extraCritical}
            onChange={event => {
              setExtraCritical(event.target.checked);
              if (event.target.checked) setExtraWeight(10);
            }}
            className="min-h-11 items-center gap-3 rounded-lg border border-default px-3 font-medium text-navy"
            boxClassName="mt-0"
            label="Item crítico"
          />
          <div>
            <Label htmlFor="extra-weight">Peso na pontuação</Label>
            <Select
              id="extra-weight"
              className="mt-2"
              value={extraCritical ? 10 : extraWeight}
              disabled={extraCritical}
              onChange={event => setExtraWeight(Number(event.target.value) as 1 | 2 | 5 | 10)}
            >
              {CUSTOM_ITEM_WEIGHTS.map(weight => <option key={weight} value={weight}>{weight}</option>)}
            </Select>
            <p className="mt-2 text-xs text-navy-3">Itens críticos usam peso 10. Itens originais do roteiro continuam valendo 1 ponto.</p>
          </div>
        </div>
      </Modal>

      {confirmDialog}
    </div>
  );
}
