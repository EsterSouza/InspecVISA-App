import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, FileDown, ArrowLeft, Loader2, Save, Info, AlertTriangle } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { InspectionBundleSyncService } from '../services/inspectionBundleSyncService';
import { AppointmentAdminService } from '../services/appointmentAdminService';
import { LegislationService, type Legislation } from '../services/legislationService';
import { getTemplateById } from '../data/templates';
import { calculateScore, calculateAreaScores, getLatestResponsesByItem } from '../utils/scoring';
import { isRioState } from '../utils/state';
import { useSettingsStore } from '../store/useSettingsStore';
import { db } from '../db/database';
import type { Inspection, InspectionResponse, ChecklistTemplate, ReferenceSource } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { formatDateTime } from '../utils/imageUtils';
import { DeliveryReceipt } from '../components/inspection/DeliveryReceipt';
import { ReportScoreCard } from '../components/inspection/ReportScoreCard';
import { CorrectiveActionsTable } from '../components/inspection/CorrectiveActionsTable';
import { hydrateAndGetPreviousVisitScore, type PreviousVisitScore } from '../utils/previousVisitScore';
import { getRecurringItemIdsForClient } from '../utils/actionPlanContext';
import { PdfPreviewModal } from '../components/inspection/PdfPreviewModal';
import { checkReportReadiness, type ReadinessResult } from '../utils/syncCheck';
import { InspectionIntegrityPanel } from '../components/inspection/InspectionIntegrityPanel';
import { belongsToActiveTenant, filterByActiveTenant } from '../utils/localScope';
import { buildRecoveryTemplate } from '../utils/templateRecovery';
import { resolveReportTemplate } from '../utils/reportTemplate';
import { withClientLocation } from '../utils/inspectionLocation';
import { composeChecklistTemplate } from '../utils/customItems';
import { toast } from '../store/useToastStore';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';

const PDF_PHOTO_HYDRATION_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

export function InspectionSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
  
  const [currentInspection, setInspection] = useState<Inspection | null>(null);
  const [responses, setResponses] = useState<InspectionResponse[]>([]);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [legislations, setLegislations] = useState<Legislation[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [hideClientInfo, setHideClientInfo] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [photoHydration, setPhotoHydration] = useState<{ total: number; completed: number; failed: number } | null>(null);
  const [pdfPhotoProgress, setPdfPhotoProgress] = useState<{ total: number; completed: number; failed: number } | null>(null);
  // Comparação final contra final e reincidência — decisões 29 e 26 do FE-23.
  const [previousVisit, setPreviousVisit] = useState<PreviousVisitScore | null>(null);
  const [recurringItemIds, setRecurringItemIds] = useState<Set<string>>(new Set());

  const attachPhotosToResponses = (baseResponses: InspectionResponse[], photos: any[]) => {
    return baseResponses.map(response => ({
      ...response,
      photos: photos.filter(photo => photo.responseId === response.id),
    }));
  };

  const mergePhotosIntoResponses = useCallback((photos: any[]) => {
    if (photos.length === 0) return;

    setResponses(current => current.map(response => {
      const incoming = photos.filter(photo => photo.responseId === response.id);
      if (incoming.length === 0) return response;

      const byId = new Map((response.photos || []).map(photo => [photo.id, photo]));
      for (const photo of incoming) byId.set(photo.id, photo);
      return { ...response, photos: Array.from(byId.values()) };
    }));
  }, []);

  const hydratePhotosInBackground = useCallback((responseIds: string[]) => {
    if (responseIds.length === 0 || !navigator.onLine) return;

    void InspectionService.hydratePhotosByResponseIds(responseIds, {
      onProgress: (progress, photo) => {
        setPhotoHydration(progress.total > 0 ? progress : null);
        if (photo) mergePhotosIntoResponses([photo]);
      },
    }).then(result => {
      mergePhotosIntoResponses(result.photos);
      setPhotoHydration(result.total > 0 ? {
        total: result.total,
        completed: result.completed,
        failed: result.failed,
      } : null);
      window.setTimeout(() => setPhotoHydration(null), 2500);
    }).catch(err => {
      console.warn('[Summary] Photo hydration failed:', err);
      setPhotoHydration(null);
    });
  }, [mergePhotosIntoResponses]);

  useEffect(() => {
    const inspectionId = location.state?.inspectionId;
    if (!inspectionId) {
      navigate('/inspections');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);

        // ── PHASE 1: Render from Dexie immediately ─────────────────────────
        const localCandidate = await db.inspections.get(inspectionId);
        const localInsp = belongsToActiveTenant(localCandidate)
          ? await withClientLocation(localCandidate as Inspection)
          : null;

        if (localInsp) {
          const localResps = filterByActiveTenant(await db.responses
            .where('inspectionId').equals(inspectionId)
            .filter(r => !r.deletedAt)
            .toArray());
          const localPhotos = await InspectionService.getPhotosByResponseIds(localResps.map(r => r.id), false, { remote: false });
          const localWithPhotos = attachPhotosToResponses(localResps, localPhotos);

          let tpl: ChecklistTemplate | undefined = getTemplateById(localInsp.templateId);
          if (!tpl) tpl = await db.templates.get(localInsp.templateId);

          setInspection(localInsp);
          setResponses(localWithPhotos);
          if (tpl) setTemplate(resolveReportTemplate(tpl, localInsp, localResps));
          setLoading(false); // ← unblock UI immediately
          hydratePhotosInBackground(localResps.map(r => r.id));
        }

        // ── PHASE 2: Background enrichment from Supabase ───────────────────
        void (async () => {
          try {
            const insp = await InspectionService.getInspectionById(inspectionId);
            if (!insp) {
              if (!localInsp) navigate('/inspections');
              return;
            }

            // Client data
            const client = await ClientService.getClientById(insp.clientId);
            if (client) {
              insp.clientName = client.name;
              insp.clientCategory = client.category;
              insp.city = client.city;
              insp.state = client.state;
            }

            const clients = await ClientService.getClients();
            setAllClients(clients);

            // Responses
            const remoteResps = await InspectionService.getResponsesByInspectionId(inspectionId, true);
            const localPhotosForRemote = await InspectionService.getPhotosByResponseIds(remoteResps.map(r => r.id), false, { remote: false });
            setResponses(attachPhotosToResponses(remoteResps, localPhotosForRemote));
            setLoading(false);

            const remotePhotos = await InspectionService.getPhotosByResponseIds(remoteResps.map(r => r.id), true);
            const remoteWithPhotos = attachPhotosToResponses(remoteResps, remotePhotos);

            // Template (static → Dexie → Supabase)
            let tpl: ChecklistTemplate | undefined | null = getTemplateById(insp.templateId);
            if (!tpl) tpl = await db.templates.get(insp.templateId);
            if (!tpl && navigator.onLine) {
              try {
                const { TemplateService } = await import('../services/templateService');
                tpl = await TemplateService.getFullTemplate(insp.templateId);
                if (tpl) await db.templates.put(tpl);
              } catch (e) {
                console.error('[Summary] Failed to fetch template remotely:', e);
              }
            }

            if (insp.status === 'completed' && navigator.onLine) {
              try {
                const version = await InspectionBundleSyncService.getLatestReportVersion(inspectionId);
                const frozenTemplate = version?.snapshot_json?.reportSnapshot?.template as ChecklistTemplate | undefined;
                if (frozenTemplate) insp.reportTemplateSnapshot = frozenTemplate;
              } catch (e) {
                console.warn('[Summary] Failed to load final report template snapshot:', e);
              }
            }

            setInspection(insp);
            if (remoteResps && remoteResps.length > 0) {
              setResponses(remoteWithPhotos);
              hydratePhotosInBackground(remoteResps.map(r => r.id));
            }
            setTemplate(tpl ? resolveReportTemplate(tpl, insp, remoteResps) : insp.reportTemplateSnapshot || null);

            LegislationService.listLegislations()
              .then(setLegislations)
              .catch(err => console.warn('[Summary] Failed to load legislations:', err));
          } catch (err) {
            console.error('[InspectionSummary] Background enrichment error:', err);
          } finally {
            setLoading(false);
          }
        })();

      } catch (err) {
        console.error('[InspectionSummary] loadData error:', err);
        navigate('/inspections');
      }
    };

    loadData();
  }, [hydratePhotosInBackground, location.state?.inspectionId, navigate]);

  const displayTemplate = useMemo(() => {
    if (!currentInspection) return null;
    const baseTemplate = template || buildRecoveryTemplate(currentInspection, responses);
    return composeChecklistTemplate(baseTemplate, responses);
  }, [currentInspection, responses, template]);

  const scoreArea = useMemo(() => {
    if (!currentInspection || !displayTemplate) return null;
    return calculateScore(responses, displayTemplate.sections);
  }, [currentInspection, responses, displayTemplate]);

  const reportResponses = useMemo(() => {
    if (!displayTemplate) return responses.filter(response => !response.deletedAt);
    const itemIds = new Set(displayTemplate.sections.flatMap(section => section.items.map(item => item.id)));
    return getLatestResponsesByItem(responses, itemIds);
  }, [displayTemplate, responses]);

  const nonCompliantResponses = useMemo(
    () => reportResponses.filter(response => response.result === 'not_complies'),
    [reportResponses]
  );

  const isInspectionCompleted = currentInspection?.status === 'completed';
  const isPdfFinalReady = Boolean(isInspectionCompleted && readiness?.isReady);
  const needsProvisionalPdfNotice = Boolean(currentInspection && (!isInspectionCompleted || (readiness && !readiness.isReady)));

  useEffect(() => {
    if (currentInspection) {
      checkReportReadiness(currentInspection.id, { verifyRemote: false }).then(setReadiness);
    }
  }, [currentInspection, responses]);

  // Nota da visita anterior e reincidências: alimentam a comparação final contra
  // final e a coluna de reincidência da tabela de ações corretivas.
  const inspectionId = currentInspection?.id;
  const inspectionClientId = currentInspection?.clientId;
  const inspectionTemplateId = currentInspection?.templateId;
  useEffect(() => {
    if (!inspectionId || !inspectionClientId || !inspectionTemplateId) return;
    let active = true;
    void hydrateAndGetPreviousVisitScore(inspectionClientId, inspectionId, inspectionTemplateId)
      .then((result) => { if (active) setPreviousVisit(result); })
      .catch((err) => console.warn('[Summary] Nota da visita anterior indisponivel:', err));
    // O roteiro entra na conta: pendência de visita feita em outro roteiro só é
    // reconhecida como reincidente pelo id equivalente no roteiro deste relatório.
    void getRecurringItemIdsForClient(inspectionClientId, inspectionId, displayTemplate || undefined)
      .then((ids) => { if (active) setRecurringItemIds(ids); })
      .catch(() => {});
    return () => { active = false; };
  }, [inspectionId, inspectionClientId, inspectionTemplateId, displayTemplate]);

  const handleSaveMetadata = async () => {
    if (!currentInspection) return;
    setSavingMeta(true);
    try {
      // 1. Update in Supabase
      await InspectionService.updateInspection(currentInspection.id, currentInspection);

      // 2. Re-enrich the local state if client changed
      const client = allClients.find(c => c.id === currentInspection.clientId);
      if (client) {
        setInspection({
          ...currentInspection,
          clientName: client.name,
          clientCategory: client.category,
          city: client.city,
          state: client.state,
        } as any);
      }

      setIsEditing(false);
    } catch (err) {
      toast.error('Erro ao salvar', String(err));
    } finally {
      setSavingMeta(false);
    }
  };

  const handleGeneratePDF = async (opts: { selectedLegislations: string[]; referenceSources?: ReferenceSource[]; signatureDataUrl?: string }) => {
    if (!currentInspection) return;
    if (!displayTemplate || !scoreArea) {
      toast.error(
        'Não foi possível gerar o PDF.',
        'O roteiro ou a pontuação ainda não carregou. Aguarde alguns segundos e tente novamente.'
      );
      return;
    }
    setIsGenerating(true);
    setPdfPhotoProgress(null);
    try {
    // Persistir as fontes antes de gerar, para que reabrir o relatório mantenha a lista.
    if (opts.referenceSources) {
      setInspection({ ...currentInspection, referenceSources: opts.referenceSources });
      InspectionService.updateInspection(currentInspection.id, { referenceSources: opts.referenceSources })
        .catch(err => console.warn('[Summary] Falha ao salvar fontes consultadas:', err));
    }
    const currentReadiness = await checkReportReadiness(currentInspection.id);
    setReadiness(currentReadiness);
    if (currentReadiness.conflictCount > 0) {
      toast.error('Existem conflitos abertos nesta inspeção.', 'Resolva os conflitos antes de gerar o PDF.');
      return;
    }
    if (currentInspection.status !== 'completed') {
      const ok = await confirm({
        title: 'Esta inspeção ainda está em andamento.',
        description: 'Gerar um PDF de rascunho mesmo assim?',
        confirmLabel: 'Gerar PDF de rascunho',
        tone: 'default',
      });
      if (!ok) {
        setIsGenerating(false);
        setPdfPhotoProgress(null);
        return;
      }
    }
    if (!currentReadiness.isReady) {
      const ok = await confirm({
        title: 'Existem dados pendentes ou falhas de sincronização.',
        description: 'Gerar PDF provisório mesmo assim?',
        confirmLabel: 'Gerar PDF provisório',
        tone: 'default',
      });
      if (!ok) {
        setIsGenerating(false);
        setPdfPhotoProgress(null);
        return;
      }
    }
       let pdfResponses = reportResponses;
       const responseIds = reportResponses.map(response => response.id);
       if (navigator.onLine && responseIds.length > 0) {
         try {
           const hydration = await withTimeout(
             InspectionService.hydratePhotosByResponseIds(responseIds, {
               forceRefresh: true,
               timeoutMs: 5000,
               concurrency: 3,
               onProgress: (progress, photo) => {
                 setPdfPhotoProgress(progress.total > 0 ? progress : null);
                 if (photo) mergePhotosIntoResponses([photo]);
               },
             }),
             PDF_PHOTO_HYDRATION_TIMEOUT_MS,
             'PDF photo hydration'
           );

           if (hydration.total > 0) {
             pdfResponses = attachPhotosToResponses(reportResponses, hydration.photos);
             setResponses(pdfResponses);
           }

           if (hydration.failed > 0) {
             const ok = await confirm({
               title: `Não foi possível baixar ${hydration.failed} foto(s) para este dispositivo agora.`,
               description: 'Gerar o PDF sem essas imagens? Cancele para tentar novamente depois.',
               confirmLabel: 'Gerar sem essas fotos',
               tone: 'default',
             });
             if (!ok) return;
           }
         } catch (err) {
           console.warn('[Summary] PDF photo hydration failed; generating with local photos only:', err);
           const ok = await confirm({
             title: 'As fotos da nuvem não terminaram de baixar agora.',
             description: 'Gerar o PDF com as fotos que já aparecem nesta tela?',
             confirmLabel: 'Gerar com fotos atuais',
             tone: 'default',
           });
           if (!ok) return;
         }
       }

       const shouldSyncFinalSnapshot = currentInspection.status === 'completed' && currentReadiness.isReady && navigator.onLine;
       // Buscado aqui (antes de gerar) para poder desenhar o botão do portal na
       // capa do PDF; reaproveitado abaixo na publicação, sem buscar de novo.
       const linkedRequest = navigator.onLine
         ? await AppointmentAdminService.getRequestByInspectionId(currentInspection.id).catch(() => null)
         : null;
       await new Promise(resolve => setTimeout(resolve, 100));
       const { generatePDF } = await import('../utils/pdfGenerator');
       const recurringItemIds = await getRecurringItemIdsForClient(currentInspection.clientId, currentInspection.id, displayTemplate)
         .catch(() => new Set<string>());
       // Evidência confirmada pela consultora precisa ser recarregada como aprovada antes
       // do relatório; assim a finalização nunca omite silenciosamente uma prova aceita.
       const { ClientEvidenceService } = await import('../services/clientEvidenceService');
       const confirmedEvidenceIds = new Set(pdfResponses.flatMap(response => response.confirmedClientEvidenceIds || []));
       const clientEvidenceByItemId = confirmedEvidenceIds.size > 0
         ? await ClientEvidenceService.prepareForReport(currentInspection.clientId)
         : await ClientEvidenceService.prepareForReport(currentInspection.clientId).catch((err) => {
             console.warn('[Summary] Evidencia do cliente indisponivel para o relatorio:', err);
             return undefined;
           });
       if (confirmedEvidenceIds.size > 0) {
         const approvedEvidence = new Map(
           [...(clientEvidenceByItemId?.evidence.values() || [])]
             .flat()
             .filter(evidence => evidence.status === 'approved')
             .map(evidence => [evidence.evidenceId, evidence]),
         );
         for (const evidenceId of confirmedEvidenceIds) {
           const evidence = approvedEvidence.get(evidenceId);
           if (!evidence) throw new Error('A evidência confirmada ainda não foi aprovada no servidor. Tente finalizar novamente.');
           if (evidence.mimeType.startsWith('image/') && !evidence.imageDataUrl) {
             throw new Error('A imagem de evidência aprovada não pôde ser carregada. Tente gerar o PDF novamente com conexão.');
           }
         }
       }
       const generatedPdf = await generatePDF(
         currentInspection,
         pdfResponses,
         displayTemplate,
         scoreArea,
         settings as any,
         legislations,
         {
           selectedLegislations: opts.selectedLegislations,
           referenceSources: opts.referenceSources,
           signatureDataUrl: opts.signatureDataUrl,
           portalUrl: linkedRequest ? `${window.location.origin}/cliente/visita/${linkedRequest.public_token}` : undefined,
           recurringItemIds,
           clientEvidenceByItemId: clientEvidenceByItemId?.evidence,
           clientDeclarationByItemId: clientEvidenceByItemId?.declarations,
         }
       );
       if (shouldSyncFinalSnapshot) {
         const snapshotInspection = { ...currentInspection, reportTemplateSnapshot: displayTemplate, referenceSources: opts.referenceSources ?? currentInspection.referenceSources };
         await InspectionBundleSyncService.syncInspectionBundle(currentInspection.id, {
           finalizeReport: true,
           inspectionOverride: snapshotInspection,
         });
         if (linkedRequest) {
           const file = new File([generatedPdf.blob], generatedPdf.filename, { type: 'application/pdf' });
           await AppointmentAdminService.publishReport(linkedRequest, file);
           // Preenche os scores do portal automaticamente (global + por área),
           // evitando digitação manual. Em não-ILPI grava só o global. Não bloqueia
           // a publicação se falhar. Ver ilpi-score-por-area-ester-ana.
           try {
             const areaScores = calculateAreaScores(pdfResponses, displayTemplate.sections);
             const clamp = (p: number) => Math.max(0, Math.min(100, Math.round(p)));
             const split = displayTemplate.category === 'ilpi' && areaScores.isSplit;
             await AppointmentAdminService.setComplianceScore(linkedRequest, clamp(areaScores.global.scorePercentage));
             await AppointmentAdminService.setAreaScores(
               linkedRequest,
               split ? clamp(areaScores.sanitary.score.scorePercentage) : null,
               split ? clamp(areaScores.nutrition.score.scorePercentage) : null,
             );

             // Estatísticas de NC para o resumo executivo de rede no portal do cliente
             // (críticos, importantes, imediatos, reincidentes + itens para detectar
             // padrões recorrentes entre unidades). Ver franchiseReport.ts.
             const allItemsList = displayTemplate.sections.flatMap(section => section.items);
             const itemById = new Map(allItemsList.map(item => [item.id, item]));
             const ncItems = nonCompliantResponses.map(response => {
               const item = itemById.get(response.itemId);
               return {
                 id: response.itemId,
                 d: (item?.description || response.customDescription || 'Item avaliado').slice(0, 160),
                 c: !!item?.isCritical,
               };
             });
             await AppointmentAdminService.setInspectionStats(linkedRequest, {
               criticalNcCount: nonCompliantResponses.filter(r => itemById.get(r.itemId)?.isCritical).length,
               importantNcCount: nonCompliantResponses.filter(r => {
                 const item = itemById.get(r.itemId);
                 return !item?.isCritical && (item?.weight || 0) >= 5;
               }).length,
               totalNcCount: nonCompliantResponses.length,
               recurringNcCount: nonCompliantResponses.filter(r => recurringItemIds.has(r.itemId)).length,
               immediateNcCount: nonCompliantResponses.filter(r => (r.deadline || '').trim() === 'Imediato').length,
               ncItems,
             });

             // Projeção do plano de ação para o portal (P360-010). Cópia separada das NCs:
             // o cliente acompanha a pendência sem nunca tocar em `responses`. Republicar o
             // mesmo relatório é idempotente e item já resolvido não é sobrescrito.
             const { buildClientActionItems } = await import('../utils/clientActionPlan');
             // Pendência reincidente não reinicia o prazo: a data já pactuada continua,
             // exceto se venceu (ou está vencendo) ou se a nova é mais curta. A mesma
             // regra está no `on conflict` da RPC — aqui é para o PDF e o portal
             // publicarem a mesma data.
             // A lista também é o que reencontra a pendência quando o roteiro trocou
             // de id entre as visitas: sem isso o portal ganharia uma segunda
             // pendência do mesmo requisito.
             const openActionItems = await AppointmentAdminService
               .listOpenActionItems(currentInspection.clientId)
               .catch(() => []);
             await AppointmentAdminService.publishActionItems(
               linkedRequest,
               buildClientActionItems(
                 nonCompliantResponses,
                 allItemsList,
                 currentInspection.inspectionDate,
                 openActionItems,
               )
             );
           } catch (scoreErr) {
             console.warn('[Summary] Falha ao gravar scores/plano de acao do portal automaticamente:', scoreErr);
           }
         } else {
           // Bug #4: sem vínculo, a publicação ao portal falha em silêncio — a consultora
           // achava que tinha entregado. Torna a falha visível em vez de só logar.
           console.warn('[Summary] PDF final gerado, mas nao ha solicitacao/agendamento vinculado para publicar no portal.');
           toast.warning(
             'PDF gerado, mas não publicado no portal',
             'Esta inspeção não está vinculada a um agendamento/solicitação, então o relatório, os scores e o plano de ação não foram enviados ao portal do cliente. Vincule a inspeção a um agendamento para publicar.'
           );
         }
       }
    } catch (err) {
       console.error('PDF Error:', err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao gerar PDF', message);
    } finally {
      setIsGenerating(false);
      setPdfPhotoProgress(null);
    }
  };

  const handleOpenPdfModal = async () => {
    if (!displayTemplate || !scoreArea) {
      toast.error(
        'Não foi possível preparar o PDF.',
        'O roteiro ou a pontuação ainda não carregou. Aguarde alguns segundos e tente novamente.'
      );
      return;
    }

    if (readiness?.conflictCount) {
      toast.error('Existem conflitos abertos nesta inspeção.', 'Resolva os conflitos antes de gerar o PDF.');
      return;
    }

    if (currentInspection?.status !== 'completed') {
      const ok = await confirm({
        title: 'Esta inspeção ainda está em andamento.',
        description: 'O PDF será um rascunho. Continuar?',
        confirmLabel: 'Continuar',
        tone: 'default',
      });
      if (!ok) return;
    }

    if (readiness && !readiness.isReady) {
      const ok = await confirm({
        title: 'Existem dados pendentes ou falhas de sincronização.',
        description: 'O PDF será provisório. Continuar?',
        confirmLabel: 'Continuar',
        tone: 'default',
      });
      if (!ok) return;
    }

    setShowPdfModal(true);
  };

  // Show spinner only if we have absolutely no data yet
  if (loading && !currentInspection) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Guard: no inspection at all
  if (!currentInspection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
        <p className="text-navy-2 font-semibold">Inspeção não encontrada.</p>
        <button onClick={() => navigate('/inspections')} className="text-primary-600 underline text-sm">Voltar para Inspeções</button>
      </div>
    );
  }

  const displayClientName = hideClientInfo ? 'Cliente oculto' : (currentInspection.clientName || 'Inspeção');

  // Template missing: show summary with warning, don't block!
  if (!displayTemplate) {
    return (
      <div className="flex h-screen flex-col bg-canvas pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-default bg-surface px-4 py-3 shadow-sm sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <button onClick={() => navigate('/inspections')} className="flex items-center text-navy-3 hover:text-navy text-sm font-medium gap-2">
              ← Voltar
            </button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHideClientInfo((value) => !value)}
              title={hideClientInfo ? 'Mostrar cliente' : 'Ocultar cliente'}
            >
              {hideClientInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </header>
        <PageShell className="space-y-6 flex-1 overflow-y-auto">
          <div className="bg-amber-soft border border-amber-soft-border rounded-xl p-4 text-amber-soft-ink text-sm">
            <strong>⚠️ Roteiro original não encontrado</strong>
            <p className="mt-1">O modelo de inspeção usado neste relatório não está disponível neste dispositivo. Os dados brutos foram preservados ({reportResponses.length} respostas registradas).</p>
          </div>
          <div className="bg-surface rounded-2xl shadow-sm border border-default p-8 text-center">
            <h1 className="text-2xl font-extrabold text-navy">{displayClientName}</h1>
            <p className="mt-1 text-navy-3">Template ID: <code className="text-xs">{currentInspection?.templateId}</code></p>
            <p className="text-sm text-navy-3 mt-1 mb-6">Concluída em {formatDateTime(currentInspection?.completedAt || currentInspection?.createdAt || new Date())}</p>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="bg-success-soft rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-success-soft-ink">{reportResponses.filter(r => r.result === 'complies').length}</p>
                <p className="text-xs text-success font-semibold mt-1">Cumpre</p>
              </div>
              <div className="bg-danger-soft rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-danger-soft-ink">{nonCompliantResponses.length}</p>
                <p className="text-xs text-danger font-semibold mt-1">Não Cumpre</p>
              </div>
              <div className="bg-surface-sunken rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-navy-2">{reportResponses.length}</p>
                <p className="text-xs text-navy-3 font-semibold mt-1">Total</p>
              </div>
            </div>
          </div>
        </PageShell>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-canvas pb-safe pb-16 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-default bg-surface px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/inspections')}>
              <ArrowLeft className="h-5 w-5 text-navy-2" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(!isEditing)} 
              className={isEditing ? 'bg-primary-50 border-primary-200' : ''}
            >
              {isEditing ? 'Cancelar' : 'Editar Info'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/execute', { state: { inspectionId: currentInspection.id }})} 
              className="text-primary-600 border-primary-200 hover:bg-primary-50"
            >
              Editar Respostas
            </Button>
          </div>
          <div className="flex space-x-2 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHideClientInfo((value) => !value)}
              title={hideClientInfo ? 'Mostrar cliente' : 'Ocultar cliente'}
            >
              {hideClientInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {needsProvisionalPdfNotice && (
              <div className="text-[10px] text-amber-strong font-bold bg-amber-soft px-2 py-1 rounded-md border border-amber-soft-border hidden md:flex items-center gap-1">
                <AlertTriangle size={10} />
                PDF provisorio
              </div>
            )}
            <Button 
              onClick={handleOpenPdfModal} 
              disabled={isGenerating}
              variant={isPdfFinalReady ? 'default' : 'outline'}
              className={!isPdfFinalReady ? 'border-amber-soft-border text-amber-soft-ink' : ''}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4 hidden sm:block" />}
              {pdfPhotoProgress
                ? `Fotos ${pdfPhotoProgress.completed + pdfPhotoProgress.failed}/${pdfPhotoProgress.total}`
                : isPdfFinalReady ? 'PDF Final' : 'PDF Provisorio'}
            </Button>
          </div>
        </div>
      </header>
      
      <PageShell className="space-y-6 overflow-y-auto flex-1">
        {isEditing && (
          <Card className="mb-6 border-primary-100 bg-primary-50/30 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary-900 uppercase tracking-wider">
                <Info className="h-4 w-4" />
                Editar Dados da Inspeção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientId" className="mb-1.5">Cliente</Label>
                  <Select
                    id="clientId"
                    name="clientId"
                    className="h-11"
                    value={currentInspection.clientId}
                    onChange={(e) => setInspection({...currentInspection, clientId: e.target.value})}
                  >
                    {allClients.map((c, index) => (
                      <option key={c.id} value={c.id}>
                        {hideClientInfo ? (c.id === currentInspection.clientId ? 'Cliente atual' : `Cliente ${index + 1}`) : c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="accompanistName" className="mb-1.5">Acompanhante</Label>
                  <Input
                    id="accompanistName"
                    name="accompanistName"
                    className="h-11"
                    value={currentInspection.accompanistName || ''}
                    onChange={(e) => setInspection({...currentInspection, accompanistName: e.target.value})}
                    placeholder="Nome de quem recebeu a visita"
                  />
                </div>
              </div>

              {currentInspection.clientCategory === 'ilpi' && (
                <div className="pt-4 border-t border-primary-100 space-y-3">
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Dados Tecnicos ILPI</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="ilpiCapacity" className="mb-1.5">Capacidade</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="ilpiCapacity"
                          name="ilpiCapacity"
                          className="h-11"
                          value={currentInspection.ilpiCapacity || 0}
                          onChange={(e) => setInspection({...currentInspection, ilpiCapacity: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    <div>
                        <Label htmlFor="residentsTotal" className="mb-1.5">Número de residentes</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="residentsTotal"
                          name="residentsTotal"
                          className="h-11"
                          value={currentInspection.residentsTotal || 0}
                          onChange={(e) => setInspection({...currentInspection, residentsTotal: parseInt(e.target.value) || 0})}
                        />
                      </div>
                  </div>
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Residentes por Grau de Dependência</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                        <Label htmlFor="dependencyLevel1" className="mb-1.5">Grau I</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="dependencyLevel1"
                          name="dependencyLevel1"
                          className="h-11"
                          value={currentInspection.dependencyLevel1 || 0}
                          onChange={(e) => setInspection({...currentInspection, dependencyLevel1: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    <div>
                        <Label htmlFor="dependencyLevel2" className="mb-1.5">Grau II</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="dependencyLevel2"
                          name="dependencyLevel2"
                          className="h-11"
                          value={currentInspection.dependencyLevel2 || 0}
                          onChange={(e) => setInspection({...currentInspection, dependencyLevel2: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    <div>
                        <Label htmlFor="dependencyLevel3" className="mb-1.5">Grau III</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="dependencyLevel3"
                          name="dependencyLevel3"
                          className="h-11"
                          value={currentInspection.dependencyLevel3 || 0}
                          onChange={(e) => setInspection({...currentInspection, dependencyLevel3: parseInt(e.target.value) || 0})}
                        />
                      </div>
                  </div>
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Equipe em Turno</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="observedStaff" className="mb-1.5">Cuidadores em turno</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="observedStaff"
                          name="observedStaff"
                          className="h-11"
                          value={currentInspection.observedStaff || 0}
                          onChange={(e) => setInspection({...currentInspection, observedStaff: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    {isRioState(currentInspection.state) && (
                      <div>
                        <Label htmlFor="observedNursingTechs" className="mb-1.5">Técnicos de enfermagem</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="observedNursingTechs"
                          name="observedNursingTechs"
                          className="h-11"
                          value={currentInspection.observedNursingTechs || 0}
                          onChange={(e) => setInspection({...currentInspection, observedNursingTechs: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Limpeza</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="usableAreaM2" className="mb-1.5">Área útil aproximada (m²)</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="usableAreaM2"
                          name="usableAreaM2"
                          className="h-11"
                          value={currentInspection.usableAreaM2 || 0}
                          onChange={(e) => setInspection({...currentInspection, usableAreaM2: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    <div>
                        <Label htmlFor="observedCleaningStaff" className="mb-1.5">Profissionais de limpeza observados</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          id="observedCleaningStaff"
                          name="observedCleaningStaff"
                          className="h-11"
                          value={currentInspection.observedCleaningStaff || 0}
                          onChange={(e) => setInspection({...currentInspection, observedCleaningStaff: parseInt(e.target.value) || 0})}
                        />
                      </div>
                  </div>
                </div>
              )}

              <Button onClick={handleSaveMetadata} disabled={savingMeta} className="w-full shadow-lg h-10">
                {savingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {savingMeta ? 'Processando...' : 'Salvar Alterações'}
              </Button>
            </CardContent>
          </Card>
        )}

        <InspectionIntegrityPanel inspectionId={currentInspection.id} />

        {needsProvisionalPdfNotice && (
          <div className="rounded-lg border border-amber-soft-border bg-amber-soft px-4 py-3 text-sm text-amber-soft-ink">
            <strong>PDF provisorio.</strong>
            <p className="mt-1">
              {isInspectionCompleted
                ? 'Ainda existem dados pendentes de sincronizacao ou verificacao. O PDF final fica liberado quando a fila concluir.'
                : 'Esta inspecao ainda esta em andamento. Voce pode gerar um rascunho para revisar, mas o PDF final fica para depois da finalizacao.'}
            </p>
          </div>
        )}

        {photoHydration && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-accent-ink">
            <strong>Carregando fotos em segundo plano.</strong>
            <p className="mt-1">
              Fotos baixadas: {photoHydration.completed + photoHydration.failed} de {photoHydration.total}
              {photoHydration.failed > 0 ? ` (${photoHydration.failed} com falha temporaria)` : ''}.
            </p>
          </div>
        )}

        {pdfPhotoProgress && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-accent-ink">
            <strong>Preparando fotos para o PDF.</strong>
            <p className="mt-1">Baixando fotos {pdfPhotoProgress.completed + pdfPhotoProgress.failed} de {pdfPhotoProgress.total}.</p>
          </div>
        )}

        {!template && (
          <div className="rounded-xl border border-amber-soft-border bg-amber-soft p-4 text-sm text-amber-soft-ink">
            <strong>Roteiro original indisponível.</strong>
            <p className="mt-1">
              O relatório foi aberto em modo recuperação com {reportResponses.length} respostas/fotos locais. Não limpe o cache.
            </p>
          </div>
        )}

        <PageHeader
          className="mt-6"
          title={displayClientName}
          description={
            <>
              {displayTemplate?.name}
              {isInspectionCompleted && ` · concluída em ${formatDateTime(currentInspection.completedAt || new Date())}`}
              {currentInspection.consultantNames?.length ? ` · ${currentInspection.consultantNames.join(' e ')}` : ''}
            </>
          }
        />

        {/* Recibo de entrega ao lado do resultado: o que chegou ao portal e o que
            não chegou fica escrito, permanentemente (decisões 26 e 32). */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {isInspectionCompleted
            ? <DeliveryReceipt inspection={currentInspection} />
            : (
              <div className="rounded-md border border-amber-soft-border bg-amber-soft p-4 text-sm text-amber-soft-ink">
                <strong>Esta inspeção ainda está em andamento.</strong>
                <p className="mt-1">
                  Nada foi publicado no portal. Volte ao roteiro e use <strong>Encerrar e entregar</strong>{' '}
                  quando o relatório estiver pronto.
                </p>
              </div>
            )}
          <ReportScoreCard
            template={displayTemplate}
            responses={reportResponses}
            previousVisit={previousVisit}
            isIlpi={displayTemplate.category === 'ilpi'}
            recurringCount={nonCompliantResponses.filter(r => recurringItemIds.has(r.itemId)).length}
          />
        </div>

        <CorrectiveActionsTable
          responses={nonCompliantResponses}
          template={displayTemplate}
          recurringItemIds={recurringItemIds}
        />

      </PageShell>

      <div className="pb-10"></div>

      {/* PDF Pre-generation Modal */}
      {displayTemplate && (
        <PdfPreviewModal
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          template={displayTemplate}
          responses={reportResponses}
          inspection={currentInspection}
          legislationLibrary={legislations}
          onGenerate={handleGeneratePDF}
          isGenerating={isGenerating}
          progressLabel={pdfPhotoProgress ? `Fotos ${pdfPhotoProgress.completed + pdfPhotoProgress.failed}/${pdfPhotoProgress.total}` : undefined}
        />
      )}
      {confirmDialog}
    </div>
  );
}
