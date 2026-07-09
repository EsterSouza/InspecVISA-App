import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, FileDown, ArrowLeft, Loader2, Save, Info, AlertTriangle } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { InspectionBundleSyncService } from '../services/inspectionBundleSyncService';
import { AppointmentAdminService } from '../services/appointmentAdminService';
import { LegislationService, type Legislation } from '../services/legislationService';
import { getTemplateById } from '../data/templates';
import { calculateScore, calculateAreaScores, classificationColor, getLatestResponsesByItem } from '../utils/scoring';
import { useSettingsStore } from '../store/useSettingsStore';
import { db } from '../db/database';
import type { Inspection, InspectionResponse, ChecklistTemplate } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatDateTime } from '../utils/imageUtils';
import { ScorePanel } from '../components/inspection/ScorePanel';
import { PdfPreviewModal } from '../components/inspection/PdfPreviewModal';
import { checkReportReadiness, type ReadinessResult } from '../utils/syncCheck';
import { InspectionIntegrityPanel } from '../components/inspection/InspectionIntegrityPanel';
import { belongsToActiveTenant, filterByActiveTenant } from '../utils/localScope';
import { buildRecoveryTemplate } from '../utils/templateRecovery';
import { resolveReportTemplate } from '../utils/reportTemplate';

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

  const attachPhotosToResponses = (baseResponses: InspectionResponse[], photos: any[]) => {
    return baseResponses.map(response => ({
      ...response,
      photos: photos.filter(photo => photo.responseId === response.id),
    }));
  };

  const mergePhotosIntoResponses = (photos: any[]) => {
    if (photos.length === 0) return;

    setResponses(current => current.map(response => {
      const incoming = photos.filter(photo => photo.responseId === response.id);
      if (incoming.length === 0) return response;

      const byId = new Map((response.photos || []).map(photo => [photo.id, photo]));
      for (const photo of incoming) byId.set(photo.id, photo);
      return { ...response, photos: Array.from(byId.values()) };
    }));
  };

  const hydratePhotosInBackground = (responseIds: string[]) => {
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
  };

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
        const localInsp = belongsToActiveTenant(localCandidate) ? localCandidate : null;

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
  }, [location.state?.inspectionId]);

  const displayTemplate = useMemo(() => {
    if (!currentInspection) return null;
    return template || buildRecoveryTemplate(currentInspection, responses);
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
      alert('Erro ao salvar: ' + err);
    } finally {
      setSavingMeta(false);
    }
  };

  const handleGeneratePDF = async (opts: { selectedLegislations: string[]; signatureDataUrl?: string }) => {
    if (!currentInspection) return;
    if (!displayTemplate || !scoreArea) {
      alert('Nao foi possivel gerar o PDF porque o roteiro ou a pontuacao ainda nao carregou. Aguarde alguns segundos e tente novamente.');
      return;
    }
    setIsGenerating(true);
    setPdfPhotoProgress(null);
    try {
    const currentReadiness = await checkReportReadiness(currentInspection.id);
    setReadiness(currentReadiness);
    if (currentReadiness.conflictCount > 0) {
      alert('Existem conflitos abertos nesta inspeção. Resolva os conflitos antes de gerar o PDF.');
      return;
    }
    if (currentInspection.status !== 'completed') {
      const ok = window.confirm('Esta inspecao ainda esta em andamento. Gerar um PDF de rascunho mesmo assim?');
      if (!ok) {
        setIsGenerating(false);
        setPdfPhotoProgress(null);
        return;
      }
    }
    if (!currentReadiness.isReady) {
      const ok = window.confirm('Existem dados pendentes ou falhas de sincronização. Gerar PDF provisório mesmo assim?');
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
             const ok = window.confirm(
               `Nao foi possivel baixar ${hydration.failed} foto(s) para este dispositivo agora. Gerar o PDF sem essas imagens? Cancele para tentar novamente depois.`
             );
             if (!ok) return;
           }
         } catch (err) {
           console.warn('[Summary] PDF photo hydration failed; generating with local photos only:', err);
           const ok = window.confirm('As fotos da nuvem nao terminaram de baixar agora. Gerar o PDF com as fotos que ja aparecem nesta tela?');
           if (!ok) return;
         }
       }

       const shouldSyncFinalSnapshot = currentInspection.status === 'completed' && currentReadiness.isReady && navigator.onLine;
       await new Promise(resolve => setTimeout(resolve, 100));
       const { generatePDF } = await import('../utils/pdfGenerator');
       const { getRecurringItemIdsForClient } = await import('../utils/actionPlanContext');
       const recurringItemIds = await getRecurringItemIdsForClient(currentInspection.clientId, currentInspection.id)
         .catch(() => new Set<string>());
       const generatedPdf = await generatePDF(
         currentInspection,
         pdfResponses,
         displayTemplate,
         scoreArea,
         settings as any,
         legislations,
         { selectedLegislations: opts.selectedLegislations, signatureDataUrl: opts.signatureDataUrl, recurringItemIds }
       );
       if (shouldSyncFinalSnapshot) {
         const snapshotInspection = { ...currentInspection, reportTemplateSnapshot: displayTemplate };
         await InspectionBundleSyncService.syncInspectionBundle(currentInspection.id, {
           finalizeReport: true,
           inspectionOverride: snapshotInspection,
         });
         const linkedRequest = await AppointmentAdminService.getRequestByInspectionId(currentInspection.id);
         if (linkedRequest) {
           const file = new File([generatedPdf.blob], generatedPdf.filename, { type: 'application/pdf' });
           await AppointmentAdminService.publishReport(linkedRequest, file);
           // Preenche os scores do portal automaticamente (global + por área),
           // evitando digitação manual. Em não-ILPI grava só o global. Não bloqueia
           // a publicação se falhar. Ver ilpi-score-por-area-ester-ana.
           try {
             const areaScores = calculateAreaScores(responses, displayTemplate.sections);
             const clamp = (p: number) => Math.max(0, Math.min(100, Math.round(p)));
             const split = displayTemplate.category === 'ilpi' && areaScores.isSplit;
             await AppointmentAdminService.setComplianceScore(linkedRequest.id, clamp(areaScores.global.scorePercentage));
             await AppointmentAdminService.setAreaScores(
               linkedRequest.id,
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
             await AppointmentAdminService.setInspectionStats(linkedRequest.id, {
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
           } catch (scoreErr) {
             console.warn('[Summary] Falha ao gravar scores do portal automaticamente:', scoreErr);
           }
         } else {
           console.warn('[Summary] PDF final gerado, mas nao ha solicitacao/agendamento vinculado para publicar no portal.');
         }
       }
    } catch (err) {
       console.error('PDF Error:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Erro ao gerar PDF: ${message}`);
    } finally {
      setIsGenerating(false);
      setPdfPhotoProgress(null);
    }
  };

  const handleOpenPdfModal = () => {
    if (!displayTemplate || !scoreArea) {
      alert('Nao foi possivel preparar o PDF porque o roteiro ou a pontuacao ainda nao carregou. Aguarde alguns segundos e tente novamente.');
      return;
    }

    if (readiness?.conflictCount) {
      alert('Existem conflitos abertos nesta inspeção. Resolva os conflitos antes de gerar o PDF.');
      return;
    }

    if (currentInspection?.status !== 'completed') {
      const ok = window.confirm('Esta inspecao ainda esta em andamento. O PDF sera um rascunho. Continuar?');
      if (!ok) return;
    }

    if (readiness && !readiness.isReady) {
      const ok = window.confirm('Existem dados pendentes ou falhas de sincronização. O PDF será provisório. Continuar?');
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <p className="text-gray-600 font-semibold">Inspeção não encontrada.</p>
        <button onClick={() => navigate('/inspections')} className="text-primary-600 underline text-sm">Voltar para Inspeções</button>
      </div>
    );
  }

  const displayClientName = hideClientInfo ? 'Cliente oculto' : (currentInspection.clientName || 'Inspeção');

  // Template missing: show summary with warning, don't block!
  if (!displayTemplate) {
    return (
      <div className="flex h-screen flex-col bg-gray-50 pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <button onClick={() => navigate('/inspections')} className="flex items-center text-gray-500 hover:text-gray-900 text-sm font-medium gap-2">
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
        <div className="mx-auto max-w-4xl p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
            <strong>⚠️ Roteiro original não encontrado</strong>
            <p className="mt-1">O modelo de inspeção usado neste relatório não está disponível neste dispositivo. Os dados brutos foram preservados ({reportResponses.length} respostas registradas).</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-2xl font-extrabold text-gray-900">{displayClientName}</h1>
            <p className="mt-1 text-gray-500">Template ID: <code className="text-xs">{currentInspection?.templateId}</code></p>
            <p className="text-sm text-gray-400 mt-1 mb-6">Concluída em {formatDateTime(currentInspection?.completedAt || currentInspection?.createdAt || new Date())}</p>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{reportResponses.filter(r => r.result === 'complies').length}</p>
                <p className="text-xs text-green-600 font-semibold mt-1">Cumpre</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{nonCompliantResponses.length}</p>
                <p className="text-xs text-red-600 font-semibold mt-1">Não Cumpre</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-700">{reportResponses.length}</p>
                <p className="text-xs text-gray-500 font-semibold mt-1">Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // const scoreColor = scoreArea ? classificationColor(scoreArea.classification) : '#94a3b8';

  return (
    <div className="flex h-screen flex-col bg-gray-50 pb-safe pb-16 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/inspections')}>
              <ArrowLeft className="h-5 w-5 text-gray-600" />
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
              <div className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md border border-amber-100 hidden md:flex items-center gap-1">
                <AlertTriangle size={10} />
                PDF provisorio
              </div>
            )}
            <Button 
              onClick={handleOpenPdfModal} 
              disabled={isGenerating}
              variant={isPdfFinalReady ? 'default' : 'outline'}
              className={!isPdfFinalReady ? 'border-amber-200 text-amber-700' : ''}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4 hidden sm:block" />}
              {pdfPhotoProgress
                ? `Fotos ${pdfPhotoProgress.completed + pdfPhotoProgress.failed}/${pdfPhotoProgress.total}`
                : isPdfFinalReady ? 'PDF Final' : 'PDF Provisorio'}
            </Button>
          </div>
        </div>
      </header>
      
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto flex-1">
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
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Cliente</label>
                  <select 
                    id="clientId"
                    name="clientId"
                    value={currentInspection.clientId}
                    onChange={(e) => setInspection({...currentInspection, clientId: e.target.value})}
                    className="w-full border-gray-300 rounded-lg text-sm shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    {allClients.map((c, index) => (
                      <option key={c.id} value={c.id}>
                        {hideClientInfo ? (c.id === currentInspection.clientId ? 'Cliente atual' : `Cliente ${index + 1}`) : c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Acompanhante</label>
                  <input 
                    type="text" 
                    id="accompanistName"
                    name="accompanistName"
                    value={currentInspection.accompanistName || ''}
                    onChange={(e) => setInspection({...currentInspection, accompanistName: e.target.value})}
                    className="w-full border-gray-300 rounded-lg text-sm shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Nome do acompanhante..."
                  />
                </div>
              </div>

              {currentInspection.clientCategory === 'ilpi' && (
                <div className="pt-4 border-t border-primary-100 space-y-3">
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Dados Tecnicos ILPI</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Capacidade</label>
                      <input
                        type="number"
                        id="ilpiCapacity"
                        name="ilpiCapacity"
                        value={currentInspection.ilpiCapacity || 0}
                        onChange={(e) => setInspection({...currentInspection, ilpiCapacity: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Numero de Residentes</label>
                      <input
                        type="number"
                        id="residentsTotal"
                        name="residentsTotal"
                        value={currentInspection.residentsTotal || 0}
                        onChange={(e) => setInspection({...currentInspection, residentsTotal: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Residentes por Grau de Dependência</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Grau I</label>
                      <input 
                        type="number" 
                        id="dependencyLevel1"
                        name="dependencyLevel1"
                        value={currentInspection.dependencyLevel1 || 0}
                        onChange={(e) => setInspection({...currentInspection, dependencyLevel1: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Grau II</label>
                      <input 
                        type="number" 
                        id="dependencyLevel2"
                        name="dependencyLevel2"
                        value={currentInspection.dependencyLevel2 || 0}
                        onChange={(e) => setInspection({...currentInspection, dependencyLevel2: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Grau III</label>
                      <input 
                        type="number" 
                        id="dependencyLevel3"
                        name="dependencyLevel3"
                        value={currentInspection.dependencyLevel3 || 0}
                        onChange={(e) => setInspection({...currentInspection, dependencyLevel3: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Equipe em Turno</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Cuidadores em turno</label>
                      <input
                        type="number"
                        id="observedStaff"
                        name="observedStaff"
                        value={currentInspection.observedStaff || 0}
                        onChange={(e) => setInspection({...currentInspection, observedStaff: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                    {['RJ', 'RIO DE JANEIRO'].includes((currentInspection.state || '').toUpperCase()) && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 font-semibold uppercase">Tecnicos de Enfermagem</label>
                        <input
                          type="number"
                          id="observedNursingTechs"
                          name="observedNursingTechs"
                          value={currentInspection.observedNursingTechs || 0}
                          onChange={(e) => setInspection({...currentInspection, observedNursingTechs: parseInt(e.target.value) || 0})}
                          className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-primary-700 uppercase">Limpeza</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Area util aproximada (m2)</label>
                      <input
                        type="number"
                        id="usableAreaM2"
                        name="usableAreaM2"
                        value={currentInspection.usableAreaM2 || 0}
                        onChange={(e) => setInspection({...currentInspection, usableAreaM2: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Profissionais de limpeza observados</label>
                      <input
                        type="number"
                        id="observedCleaningStaff"
                        name="observedCleaningStaff"
                        value={currentInspection.observedCleaningStaff || 0}
                        onChange={(e) => setInspection({...currentInspection, observedCleaningStaff: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
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
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>PDF provisorio.</strong>
            <p className="mt-1">
              {isInspectionCompleted
                ? 'Ainda existem dados pendentes de sincronizacao ou verificacao. O PDF final fica liberado quando a fila concluir.'
                : 'Esta inspecao ainda esta em andamento. Voce pode gerar um rascunho para revisar, mas o PDF final fica para depois da finalizacao.'}
            </p>
          </div>
        )}

        {photoHydration && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <strong>Carregando fotos em segundo plano.</strong>
            <p className="mt-1">
              Fotos baixadas: {photoHydration.completed + photoHydration.failed} de {photoHydration.total}
              {photoHydration.failed > 0 ? ` (${photoHydration.failed} com falha temporaria)` : ''}.
            </p>
          </div>
        )}

        {pdfPhotoProgress && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <strong>Preparando fotos para o PDF.</strong>
            <p className="mt-1">Baixando fotos {pdfPhotoProgress.completed + pdfPhotoProgress.failed} de {pdfPhotoProgress.total}.</p>
          </div>
        )}

        {!template && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>Roteiro original indisponível.</strong>
            <p className="mt-1">
              O relatório foi aberto em modo recuperação com {reportResponses.length} respostas/fotos locais. Não limpe o cache.
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="p-8 sm:p-12 text-center border-b border-gray-100 pb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{displayClientName}</h1>
            <p className="mt-2 text-gray-500 font-medium">{displayTemplate?.name}</p>
            <p className="text-sm text-gray-400 mt-1">Concluída em {formatDateTime(currentInspection.completedAt || new Date())}</p>
          </div>
          
          <div className="p-6 sm:p-8 bg-gray-50 space-y-8">
            <ScorePanel inspection={currentInspection} responses={reportResponses} template={displayTemplate} />

            {/* List of Non-Conformities */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Ações Corretivas Necessárias ({nonCompliantResponses.length})
              </h3>
              
              <div className="space-y-3">
                {nonCompliantResponses
                  .map((nc) => {
                    const it = displayTemplate?.sections.flatMap(s => s.items).find(i => i.id === nc.itemId);
                    return (
                      <div key={nc.id} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <p className="text-sm font-bold text-gray-800">
                            {it?.description || nc.customDescription || 'Item sem descrição'}
                          </p>
                          {it?.isCritical && (
                            <span className="shrink-0 bg-red-100 text-red-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Crítico</span>
                          )}
                        </div>
                        
                        {(nc.situationDescription || nc.correctiveAction) ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-50">
                            {nc.situationDescription && (
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Situação</p>
                                <p className="text-xs text-gray-600 italic leading-relaxed">{nc.situationDescription}</p>
                              </div>
                            )}
                            {nc.correctiveAction && (
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Ação Recomenda</p>
                                <p className="text-xs text-gray-700 font-medium leading-relaxed">{nc.correctiveAction}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic">Nenhuma descrição ou ação preenchida localmente.</p>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex gap-4">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-gray-400 uppercase">Prazo</span>
                              <span className="text-[10px] font-bold text-gray-700">{nc.deadline || 'A definir'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-gray-400 uppercase">Responsável</span>
                              <span className="text-[10px] font-bold text-gray-700">{nc.responsible || 'RT / Gestor'}</span>
                            </div>
                          </div>
                          {nc.photos && nc.photos.length > 0 && (
                            <div className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                              {nc.photos.length} {nc.photos.length === 1 ? 'foto' : 'fotos'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                
                {nonCompliantResponses.length === 0 && (
                  <div className="py-12 text-center bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">Nenhuma não conformidade registrada.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
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
    </div>
  );
}
