import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, PlusCircle, WifiOff, X, RefreshCw } from 'lucide-react';
import { db } from '../db/database';
import { getTemplateById, getEffectiveTemplate } from '../data/templates';
import { type ChecklistTemplate, type Inspection, type InspectionResponse, type InspectionPhoto } from '../types';
import { ILPIStaffCalculator } from '../components/inspection/ILPIStaffCalculator';
import { isRioState } from '../utils/state';
import { useInspectionStore } from '../store/useInspectionStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { generateId } from '../utils/imageUtils';
import { CollaborativeProgress } from '../components/inspection/CollaborativeProgress';
import { MobileScoreBar } from '../components/inspection/MobileScoreBar';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { InspectionBundleSyncService } from '../services/inspectionBundleSyncService';
import { ScheduleService } from '../services/scheduleService';
import { getLocalActor } from '../utils/localActor';
import { belongsToActiveTenant, filterByActiveTenant } from '../utils/localScope';
import { buildRecoveryTemplate } from '../utils/templateRecovery';
import { withClientLocation } from '../utils/inspectionLocation';
import { getPreviousNCContextByInspection, type PreviousNCContext } from '../utils/actionPlanContext';
import { ClientEvidenceService, type ClientEvidenceByItem } from '../services/clientEvidenceService';


import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SectionAccordion } from '../components/inspection/SectionAccordion';
import { ChecklistItem } from '../components/inspection/ChecklistItem';
import { ScorePanel } from '../components/inspection/ScorePanel';
import { TeamResponsesViewer } from '../components/inspection/TeamResponsesViewer';
import { SignaturePad } from '../components/ui/SignaturePad';

// Pré-preenche uma nova inspeção (modo plano de ação) com as NCs da visita
// anterior já marcadas como não conforme, copiando situação/ação/prazo/responsável.
// A consultora então só edita o texto ou troca o resultado para "conforme" quando a
// pendência foi sanada. As fotos antigas seguem visíveis apenas como referência
// (caixa "Plano de ação anterior"); não são copiadas como evidência nova.
async function seedActionPlanResponses(
  inspectionId: string,
  previousNCs: Map<string, PreviousNCContext>,
  tenantId?: string,
): Promise<InspectionResponse[]> {
  const actor = getLocalActor();
  const now = new Date();
  const seeded: InspectionResponse[] = [];

  for (const nc of previousNCs.values()) {
    const response: InspectionResponse = {
      id: generateId(),
      inspectionId,
      itemId: nc.itemId,
      result: 'not_complies',
      situationDescription: nc.situationDescription,
      correctiveAction: nc.correctiveAction,
      responsible: nc.responsible,
      deadline: nc.deadline,
      customDescription: nc.itemId.startsWith('extra|') ? nc.description : undefined,
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

export function InspectionExecution() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { inspectionId: string; previousInspectionId?: string; linkedScheduleId?: string; actionPlanMode?: boolean };
  const linkedScheduleId = state?.linkedScheduleId;
  const {
    currentInspection,
    responses,
    setCurrentInspection,
    setResponses,
  } = useInspectionStore();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previousNCs, setPreviousNCs] = useState<Map<string, PreviousNCContext>>(new Map());
  // REL-03 — o que o cliente alegou ter corrigido, por item do roteiro. Vem do servidor e é
  // best-effort: sem sinal, a vistoria segue igual, só sem a alegação na tela.
  const [clientEvidence, setClientEvidence] = useState<ClientEvidenceByItem>(new Map());
  const [expandedSectionIds] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hideClientInfo, setHideClientInfo] = useState(false);
  const [photoHydration, setPhotoHydration] = useState<{ total: number; completed: number; failed: number } | null>(null);
  const [showTeamResponses, setShowTeamResponses] = useState(false);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const [template, setTemplate] = useState<any>(null);

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
    try {
      const { inspectionId, previousInspectionId, actionPlanMode } = location.state || {};
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
        const tpl: any = getTemplateById(localInsp.templateId) || await db.templates.get(localInsp.templateId);
        
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
          let tpl: any = getTemplateById(enrichedInsp.templateId) || await db.templates.get(enrichedInsp.templateId);
          
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
          const resps = await InspectionService.getResponsesByInspectionId(id, true);
          const localPhotos = await InspectionService.getPhotosByResponseIds(resps.map(r => r.id), false, { remote: false });
          setResponses(attachPhotosToResponses(resps, localPhotos));
          setLoading(false);

          const photos = await InspectionService.getPhotosByResponseIds(resps.map(r => r.id), true);
          const respsWithPhotos = attachPhotosToResponses(resps, photos);

          setResponses(respsWithPhotos);
          hydratePhotosInBackground(resps.map(r => r.id));

          // Load previous inspection NCs if applicable. `previousInspectionId` só chega
          // via location.state na criação da inspeção; qualquer reabertura depois (lista,
          // dashboard, ficha do cliente, "voltar a editar") navega só com { inspectionId }
          // e perde esse dado. Sem isso a REINCIDÊNCIA some assim que a consultora sai e
          // volta pra continuar a visita — recalcula pelo cliente quando não veio no state.
          // REL-03: a evidência que o cliente mandou entre uma visita e outra. Fora do
          // `await` da vistoria de propósito — é rede, e nada aqui pode segurar a abertura
          // do roteiro dentro da casa.
          void ClientEvidenceService.byItemForClient(enrichedInsp.clientId)
            .then(setClientEvidence)
            .catch((err) => console.warn('[Inspection] Evidencia do cliente indisponivel:', err));

          const effectivePreviousInspectionId = previousInspectionId
            || await InspectionService.getLastCompletedInspectionId(enrichedInsp.clientId, enrichedInsp.id).catch(() => undefined);

          if (effectivePreviousInspectionId) {
            const prevNCs = await getPreviousNCContextByInspection(effectivePreviousInspectionId);
            setPreviousNCs(prevNCs);

            // Modo plano de ação: se a nova inspeção ainda está vazia, semeia as NCs
            // anteriores já preenchidas para a consultora só revisar/marcar como cumprida.
            if (actionPlanMode && prevNCs.size > 0 && resps.length === 0) {
              const seeded = await seedActionPlanResponses(id, prevNCs, enrichedInsp.tenantId);
              if (seeded.length > 0) {
                const seededPhotos = await InspectionService.getPhotosByResponseIds(seeded.map(r => r.id), false, { remote: false });
                setResponses(attachPhotosToResponses(seeded, seededPhotos));
              }
            }
          } else {
            setPreviousNCs(new Map());
          }
        } catch (err) {
          console.error('[loadData] Background enrichment error:', err);
          // Don't reset loading here — Phase 1 already showed data
        } finally {
          setLoading(false); // ensure loading clears even on first-ever load path
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

  // ─── TEMPLATE RESOLUTION ──────────────────────────────────────────────────
  const effectiveTemplate = useMemo(() => {
    if (!currentInspection) return null;
    if (!template) return buildRecoveryTemplate(currentInspection, responses);
    const role = useSettingsStore.getState().settings.consultantRole || 'saude';
    const ctx = { ...currentInspection, category: (currentInspection as any).clientCategory || (currentInspection as any).category };
    try { return getEffectiveTemplate(template, ctx as any, role, false); }
    catch (err) { console.error('getEffectiveTemplate error:', err); return template; }
  }, [currentInspection, responses, template]);

  const visibleSections = effectiveTemplate?.sections || [];
  // ILPI: a calculadora de dimensionamento mora na seção "Recursos Humanos".
  const isIlpiInspection = (currentInspection?.clientCategory === 'ilpi')
    || ((effectiveTemplate as any)?.category === 'ilpi');
  const collaborationTemplate = useMemo(() => {
    if (!currentInspection) return null;
    if (!template) return buildRecoveryTemplate(currentInspection, responses);
    const ctx = { ...currentInspection, category: (currentInspection as any).clientCategory || (currentInspection as any).category };
    try { return getEffectiveTemplate(template, ctx as any, 'ambos', true); }
    catch (err) { console.error('getEffectiveTemplate collaboration error:', err); return template; }
  }, [currentInspection, responses, template]);

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
    if (loading || !currentInspection) return;

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
  }, [currentInspection, loading]);

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
    
    let updated: InspectionResponse;
    if (existing) {
      updated = { ...existing, result, updatedAt: new Date(), localActorId: actor.id, lastEditedBy: actor.name };
      state.updateResponse(existing.id, { result, updatedAt: new Date(), localActorId: actor.id, lastEditedBy: actor.name });
    } else {
      updated = {
        id: generateId(),
        inspectionId: state.currentInspection!.id,
        itemId,
        result,
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
  }, [stampInspectionEditor]);


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


  const handleAddPhoto = useCallback(async (itemId: string, photoData: any) => {
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
      state.updateResponse(existing.id, { photos: (existing.photos || []).filter((p: any) => p.id !== photoId) });
      
      try {
        await InspectionService.deletePhoto(photoId);
      } catch (err) {
        console.error('[Execution] Failed to delete photo:', err);
      }
    }
  }, []);

  const handleEditDescription = useCallback(async (itemId: string, customDescription: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      const actor = getLocalActor();
      const updated = { ...existing, customDescription, updatedAt: new Date(), localActorId: actor.id, lastEditedBy: actor.name };
      state.updateResponse(existing.id, { customDescription, localActorId: actor.id, lastEditedBy: actor.name });
      void stampInspectionEditor(actor.name);

      try {
        await InspectionService.upsertResponse(updated);
      } catch (err) {
        console.error('Failed to sync custom description:', err);
      }
    }
  }, [stampInspectionEditor]);


  const handleAddExtraItem = useCallback(async (sectionId: string) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    const desc = window.prompt('Descrição do item extra:');
    if (!desc) return;
    const actor = getLocalActor();
    
    const newResponse: InspectionResponse = {
      id: generateId(), 
      inspectionId: state.currentInspection.id,
      itemId: `extra|${sectionId}|${generateId()}`,
      result: 'not_observed',
      customDescription: desc,
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
    } catch (err) {
      console.error('Failed to sync extra item:', err);
    }
  }, [stampInspectionEditor]);

  // Registra (ou atualiza) a não-conformidade de dimensionamento na seção de RH,
  // com situação/ação já preenchidas pela calculadora. Reaproveita o mesmo item
  // se já tiver sido gerado, evitando duplicar a cada clique.
  const handleAddStaffingNC = useCallback(async (sectionId: string, finding: { situation: string; action: string }) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    const actor = getLocalActor();
    const existing = state.responses.find(r => r.itemId.startsWith(`extra|${sectionId}|staffing`));

    if (existing) {
      const updated: InspectionResponse = {
        ...existing,
        result: 'not_complies',
        situationDescription: finding.situation,
        correctiveAction: finding.action,
        deadline: existing.deadline || 'Imediato',
        updatedAt: new Date(),
        localActorId: actor.id,
        lastEditedBy: actor.name,
      };
      state.updateResponse(existing.id, {
        result: 'not_complies',
        situationDescription: finding.situation,
        correctiveAction: finding.action,
        deadline: existing.deadline || 'Imediato',
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
    alert('Não-conformidade de dimensionamento registrada na seção, com situação e ação preenchidas. Revise e ajuste se necessário.');
  }, [stampInspectionEditor]);


  const updateStaffData = useCallback((field: string, value: number) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    const actor = getLocalActor();
    // Atualiza o currentInspection → dispara o auto-save (persiste no Dexie + Supabase).
    state.setCurrentInspection({ ...state.currentInspection, [field]: value, lastEditedBy: actor.name, updatedAt: new Date() });
  }, []);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const [isFinishing, setIsFinishing] = useState(false);

  const handleConfirmFinish = async () => {
    if (!currentInspection || !signature) return;
    if (!window.confirm('Encerrar Inspeção?')) return;
    if (!navigator.onLine) {
      alert('Para finalizar o relatório, conecte-se à internet. O rascunho local continua salvo.');
      return;
    }

    setIsFinishing(true);
    try {
      if (responses.length === 0) {
        const recovered = await InspectionService.getResponsesByInspectionId(currentInspection.id, true);
        if (recovered.length > 0) {
          setResponses(recovered);
          alert('Foram recuperadas respostas já salvas na nuvem. Revise o roteiro carregado antes de finalizar.');
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
          signatureDataUrl: signature,
          lastEditedBy: actor.name,
          status: 'in_progress',
        });
        setCurrentInspection({
          ...currentInspection,
          finalizedBy,
          signatureDataUrl: signature,
          lastEditedBy: actor.name,
          status: 'in_progress',
          updatedAt: new Date(),
          syncStatus: 'synced',
        });
        alert(
          `Sua finalização foi registrada (${actor.name}). A inspeção continua EM ANDAMENTO `
          + `até ${pending.join(' e ')} finalizar também. O relatório só é fechado e publicado `
          + `quando todas as consultoras finalizarem — assim a sua parte não é encerrada sem as suas respostas.`
        );
        setIsFinishing(false);
        setShowSignatureModal(false);
        return;
      }

      // 1. Build final inspection record updates
      const updates: Partial<Inspection> = {
        status: 'completed' as const,
        completedAt: new Date(),
        signatureDataUrl: signature,
        finalizedBy,
        lastEditedBy: actor.name,
      };
      const finalizedInspection: Inspection = {
        ...currentInspection,
        ...updates,
        // Snapshot do relatório DEVE ser o roteiro COMPLETO (todas as áreas:
        // sanitária + nutrição), não o filtrado pelo papel da consultora que
        // está finalizando. Senão, ao Ester (role 'saude') finalizar, a parte de
        // nutrição da Ana some do relatório. Ver ilpi-score-por-area-ester-ana.
        reportTemplateSnapshot: collaborationTemplate || effectiveTemplate || undefined,
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
      alert('Relatório salvo como rascunho local, mas ainda não foi finalizado na nuvem. Abra a Central de Sincronização e tente novamente.');
    } finally {
      setIsFinishing(false);
      setShowSignatureModal(false);
    }
  };


  // ─── RENDER STATES ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <p className="text-sm text-gray-500 font-medium">Carregando inspeção...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <p className="text-red-600 font-semibold">{loadError}</p>
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <div className="mb-4 rounded-full bg-amber-50 p-3">
          <RefreshCw className="h-8 w-8 text-amber-600" />
        </div>
        <p className="text-gray-600 font-semibold">O roteiro desta inspeção não pôde ser carregado.</p>
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

  return (
    <div className="flex h-screen flex-col bg-gray-50 pb-safe pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/inspections')} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate max-w-xs sm:max-w-sm md:max-w-lg">{displayClientName}</h1>
              <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-wider">
                {isCompleted && <Badge variant="neutral" className="bg-green-100 text-green-700 border-green-200">Finalizada</Badge>}
                {state?.actionPlanMode && <Badge variant="warning">Plano de Acao</Badge>}
                {usingRecoveryTemplate && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Modo Recuperação</Badge>}
                {!isOnline && <span className="text-amber-600 flex items-center bg-amber-50 px-2 py-0.5 rounded-md"><WifiOff className="mr-1 h-3 w-3" /> Offline</span>}
                {photoHydration && (
                  <span className="text-blue-600 flex items-center bg-blue-50 px-2 py-0.5 rounded-md">
                    Fotos {photoHydration.completed + photoHydration.failed}/{photoHydration.total}
                  </span>
                )}
                {saveStatus === 'saving' && <span className="text-primary-600 animate-pulse">Sincronizando...</span>}
                {saveStatus === 'saved' && <span className="text-green-600">Dados Protegidos</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted && (
              <Button
                variant="outline"
                onClick={() => setShowTeamResponses(true)}
                className="gap-2"
                title="Ver respostas e fotos já sincronizadas sem editar"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden md:inline">Ver preenchimento da equipe</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHideClientInfo((value) => !value)}
              title={hideClientInfo ? 'Mostrar dados do cliente' : 'Ocultar dados do cliente'}
            >
              {hideClientInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {!isCompleted && (
              <Button onClick={() => setShowSignatureModal(true)} className="shadow-lg shadow-primary-100">
                Finalizar Visita
              </Button>
            )}
            {isCompleted && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (window.confirm('Reabrir esta inspeção para edição?')) {
                    const updates: Partial<Inspection> = { status: 'in_progress' as const, completedAt: undefined };
                    try {
                      await InspectionService.updateInspection(currentInspection.id, updates);
                      setCurrentInspection({ ...currentInspection, ...updates });
                    } catch (err) {
                      alert('Erro ao reabrir inspeção: ' + err);
                    }
                  }
                }}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                Reabrir Inspeção
              </Button>
            )}
          </div>
        </div>
      </header>

      {currentInspection.templateId === 'tpl-ilpi-federal-v1' && <CollaborativeProgress />}

      {/* Mobile Score Bar - shown only on small screens */}
      <MobileScoreBar template={effectiveTemplate} />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:grid lg:grid-cols-12 lg:gap-8 overflow-y-auto">
        <div className="lg:col-span-8 space-y-6">
          {usingRecoveryTemplate && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong>Roteiro original indisponível.</strong>
              <p className="mt-1">
                O app carregou {responses.length} respostas/fotos salvas localmente para recuperação. Não limpe o cache.
              </p>
            </div>
          )}

          {/* Rastreabilidade: quem abriu, última modificação e co-finalização */}
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">Aberta por {currentInspection.consultantName || '—'}</span>
            {currentInspection.createdAt && (
              <span> · {new Date(currentInspection.createdAt).toLocaleString('pt-BR')}</span>
            )}
            {currentInspection.lastEditedBy && (
              <span className="ml-2 text-gray-400">| Última modificação: <span className="font-medium text-gray-700">{currentInspection.lastEditedBy}</span>
                {currentInspection.updatedAt ? ` (${new Date(currentInspection.updatedAt).toLocaleString('pt-BR')})` : ''}
              </span>
            )}
            {currentInspection.finalizedBy && currentInspection.finalizedBy.length > 0 && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-2 text-blue-800">
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
          </div>

          {visibleSections.map((section: any, idx: number) => {
            const sectionResponses = section.items
              .map((i: any) => responses.find(r => r.itemId === i.id))
              .filter(Boolean) as InspectionResponse[];

            return (
              <SectionAccordion
                key={section.id}
                title={`${idx + 1}. ${section.title}`}
                totalItems={section.items.length}
                evaluatedItems={sectionResponses.length}
                compliesCount={sectionResponses.filter(r => r.result === 'complies').length}
                notCompliesCount={sectionResponses.filter(r => r.result === 'not_complies').length}
                defaultExpanded={idx === 0 || expandedSectionIds.includes(section.id)}
              >
                <div className="space-y-4">
                  {/* ILPI Dimensioning Block — casa por id (roteiro estático) ou por
                      título "Recursos Humanos" (roteiros salvos no banco usam id UUID). */}
                  {(section.id === 'sec-fed-12'
                    || (isIlpiInspection && /recursos\s+humanos/i.test(section.title || ''))) && (
                    <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dimensionamento ILPI</label>
                        {isRioState(currentInspection.state) && (
                          <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50 font-bold">
                            Rio de Janeiro (Lei 8.049/18)
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {['Level1', 'Level2', 'Level3'].map((lvl, i) => (
                          <div key={lvl}>
                            <span className="text-[10px] text-slate-500 block mb-1 font-semibold uppercase tracking-tight">GRAU {i + 1}</span>
                            <input
                              type="number"
                              id={`dependencyLevel${i + 1}`}
                              name={`dependencyLevel${i + 1}`}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                              value={(currentInspection as any)[`dependencyLevel${i + 1}`] || 0}
                              onChange={(e) => updateStaffData(`dependencyLevel${i + 1}`, parseInt(e.target.value) || 0)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                        <div>
                          <span className="text-[10px] text-primary-600 font-bold block mb-1 uppercase tracking-tight">Cuidadores em Turno</span>
                          <input
                            type="number"
                            id="observedStaff"
                            name="observedStaff"
                            placeholder="Qtd. cuidadores..."
                            className="w-full bg-white border border-primary-100 rounded-lg p-2 font-bold text-primary-900 shadow-sm"
                            value={currentInspection.observedStaff || 0}
                            onChange={(e) => updateStaffData('observedStaff', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-primary-600 font-bold block mb-1 uppercase tracking-tight">Técnicos de Enfermagem em Turno</span>
                          <input
                            type="number"
                            id="observedNursingTechs"
                            name="observedNursingTechs"
                            placeholder="Técnicos de enfermagem..."
                            className="w-full bg-white border border-primary-100 rounded-lg p-2 font-bold text-primary-900 shadow-sm"
                            value={currentInspection.observedNursingTechs || 0}
                            onChange={(e) => updateStaffData('observedNursingTechs', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-tight">Area util aproximada (m2)</span>
                          <input
                            type="number"
                            id="usableAreaM2"
                            name="usableAreaM2"
                            placeholder="Area da licenca sanitaria..."
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold text-slate-900 shadow-sm"
                            value={currentInspection.usableAreaM2 || 0}
                            onChange={(e) => updateStaffData('usableAreaM2', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-tight">Profissionais de limpeza</span>
                          <input
                            type="number"
                            id="observedCleaningStaff"
                            name="observedCleaningStaff"
                            placeholder="Equipe de limpeza..."
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold text-slate-900 shadow-sm"
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
                  {section.items.map((item: any) => {
                    const resp = responses.find(r => r.itemId === item.id);
                    return (
                      <ChecklistItem
                        key={item.id}
                        item={item}
                        response={resp}
                        previousNC={previousNCs.get(item.id)}
                        clientEvidence={clientEvidence.get(item.id)}
                        onChange={handleResponseChange}
                        onUpdateDetails={handleUpdateDetails}
                        onAddPhoto={handleAddPhoto}
                        onRemovePhoto={handleRemovePhoto}
                      />
                    );
                  })}

                  {/* Extra Items */}
                  {responses
                    .filter(r => r.itemId?.startsWith(`extra|${section.id}|`))
                    .map((resp) => (
                      <ChecklistItem
                        key={resp.id}
                        item={{
                          id: resp.itemId,
                          description: resp.customDescription || 'Item Extra',
                          sectionId: section.id,
                          weight: 1,
                          isCritical: false,
                          order: 999,
                        }}
                        response={resp}
                        onChange={handleResponseChange}
                        onUpdateDetails={handleUpdateDetails}
                        onEditDescription={handleEditDescription}
                        onAddPhoto={handleAddPhoto}
                        onRemovePhoto={handleRemovePhoto}
                      />
                    ))}

                  <Button
                    variant="ghost"
                    className="w-full border-2 border-dashed border-gray-100 text-gray-400 hover:text-primary-600 hover:bg-white"
                    onClick={() => handleAddExtraItem(section.id)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Observação Extra
                  </Button>
                </div>
              </SectionAccordion>
            );
          })}
        </div>

        <div className="hidden lg:block lg:col-span-4 sticky top-24 h-fit">
          <ScorePanel template={effectiveTemplate as ChecklistTemplate} />
        </div>
      </div>

      <TeamResponsesViewer
        inspectionId={currentInspection.id}
        isOpen={showTeamResponses}
        onClose={() => setShowTeamResponses(false)}
        template={collaborationTemplate as ChecklistTemplate | null}
      />

      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-primary-600 p-6 text-white flex justify-between">
              <h3 className="font-bold text-lg">Assinatura de Encerramento</h3>
              <button onClick={() => setShowSignatureModal(false)}><X className="h-6 w-6" /></button>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="bg-primary-50 p-4 rounded-xl space-y-1">
                <p className="text-xs text-primary-400 font-bold uppercase">Acompanhante</p>
                <p className="text-primary-900 font-bold">{currentInspection.accompanistName || 'Não Informado'}</p>
              </div>
              <SignaturePad onSave={setSignature} onClear={() => setSignature(null)} />
              <Button className="w-full h-12 bg-primary-600 font-bold text-lg" disabled={!signature || isFinishing} onClick={handleConfirmFinish}>
                {isFinishing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {isFinishing ? 'FINALIZANDO...' : 'CONFIRMAR E FINALIZAR'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
