import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileDown, ArrowLeft, Loader2, Save, Info, AlertTriangle } from 'lucide-react';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { LegislationService, type Legislation } from '../services/legislationService';
import { getTemplateById, enrichTemplate } from '../data/templates';
import { calculateScore, classificationColor } from '../utils/scoring';
import { generatePDF } from '../utils/pdfGenerator';
import { useSettingsStore } from '../store/useSettingsStore';
import { db } from '../db/database';
import type { Inspection, InspectionResponse, ChecklistTemplate } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatDateTime } from '../utils/imageUtils';
import { ScorePanel } from '../components/inspection/ScorePanel';
import { PdfPreviewModal } from '../components/inspection/PdfPreviewModal';
import { checkReportReadiness, type ReadinessResult } from '../utils/syncCheck';

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
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);

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
        const localInsp = await db.inspections.get(inspectionId);

        if (localInsp) {
          const localResps = await db.responses
            .where('inspectionId').equals(inspectionId)
            .filter(r => !r.deletedAt)
            .toArray();
          for (const r of localResps) {
            r.photos = await db.photos.where('responseId').equals(r.id).toArray();
          }

          let tpl: ChecklistTemplate | undefined = await db.templates.get(localInsp.templateId);
          if (!tpl) tpl = getTemplateById(localInsp.templateId) as any;

          setInspection(localInsp);
          setResponses(localResps);
          if (tpl) setTemplate(enrichTemplate(tpl, localInsp as any) as any);
          setLoading(false); // ← unblock UI immediately
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
            for (const r of remoteResps) {
              r.photos = await db.photos.where('responseId').equals(r.id).toArray();
            }

            // Template (static → Dexie → Supabase)
            let tpl: ChecklistTemplate | undefined | null = await db.templates.get(insp.templateId);
            if (!tpl) tpl = getTemplateById(insp.templateId) as any;
            if (!tpl && navigator.onLine) {
              try {
                const { TemplateService } = await import('../services/templateService');
                tpl = await TemplateService.getFullTemplate(insp.templateId);
                if (tpl) await db.templates.put(tpl);
              } catch (e) {
                console.error('[Summary] Failed to fetch template remotely:', e);
              }
            }

            const legs = await LegislationService.listLegislations();

            setInspection(insp);
            setResponses(remoteResps);
            setLegislations(legs);
            setTemplate(tpl ? enrichTemplate(tpl, client || (insp as any)) as any : null);
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

  const scoreArea = useMemo(() => {
    if (!currentInspection || !template) return null;
    return calculateScore(responses, template.sections);
  }, [currentInspection, responses, template]);

  useEffect(() => {
    if (currentInspection) {
      checkReportReadiness(currentInspection.id).then(setReadiness);
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
    if (!currentInspection || !template || !scoreArea) return;
    setIsGenerating(true);
    try {
       await new Promise(resolve => setTimeout(resolve, 100));
       await generatePDF(
         currentInspection,
         responses,
         template,
         scoreArea,
         settings as any,
         legislations,
         { selectedLegislations: opts.selectedLegislations, signatureDataUrl: opts.signatureDataUrl }
       );
    } catch (err) {
       console.error('PDF Error:', err);
      alert('Erro ao gerar PDF. Verifique os dados e tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Show spinner only while truly loading
  if (loading) {
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

  // Template missing: show summary with warning, don't block!
  if (!template) {
    return (
      <div className="flex h-screen flex-col bg-gray-50 pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <button onClick={() => navigate('/inspections')} className="flex items-center text-gray-500 hover:text-gray-900 text-sm font-medium gap-2">
              ← Voltar
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-4xl p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
            <strong>⚠️ Roteiro original não encontrado</strong>
            <p className="mt-1">O modelo de inspeção usado neste relatório não está disponível neste dispositivo. Os dados brutos foram preservados ({responses.length} respostas registradas).</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-2xl font-extrabold text-gray-900">{currentInspection.clientName || 'Inspeção'}</h1>
            <p className="mt-1 text-gray-500">Template ID: <code className="text-xs">{currentInspection.templateId}</code></p>
            <p className="text-sm text-gray-400 mt-1 mb-6">Concluída em {formatDateTime(currentInspection.completedAt || currentInspection.createdAt)}</p>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{responses.filter(r => r.result === 'complies').length}</p>
                <p className="text-xs text-green-600 font-semibold mt-1">Cumpre</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{responses.filter(r => r.result === 'not_complies').length}</p>
                <p className="text-xs text-red-600 font-semibold mt-1">Não Cumpre</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-700">{responses.length}</p>
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
            {readiness && !readiness.isReady && (
              <div className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md border border-amber-100 hidden md:flex items-center gap-1">
                <AlertTriangle size={10} />
                Dados Pendentes (Offline)
              </div>
            )}
            <Button 
              onClick={() => setShowPdfModal(true)} 
              disabled={isGenerating}
              variant={readiness?.isReady ? 'default' : 'outline'}
              className={!readiness?.isReady ? 'border-amber-200 text-amber-700' : ''}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4 hidden sm:block" />}
              {readiness?.isReady ? 'PDF Final' : 'PDF Provisório'}
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
                    {allClients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
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
                </div>
              )}

              <Button onClick={handleSaveMetadata} disabled={savingMeta} className="w-full shadow-lg h-10">
                {savingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {savingMeta ? 'Processando...' : 'Salvar Alterações'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="p-8 sm:p-12 text-center border-b border-gray-100 pb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{currentInspection.clientName || 'Inspeção'}</h1>
            <p className="mt-2 text-gray-500 font-medium">{template.name}</p>
            <p className="text-sm text-gray-400 mt-1">Concluída em {formatDateTime(currentInspection.completedAt || new Date())}</p>
          </div>
          
          <div className="p-6 sm:p-8 bg-gray-50 space-y-8">
            <ScorePanel inspection={currentInspection} responses={responses} />

            {/* List of Non-Conformities */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Ações Corretivas Necessárias ({responses.filter(r => r.result === 'not_complies').length})
              </h3>
              
              <div className="space-y-3">
                {responses
                  .filter(r => r.result === 'not_complies')
                  .map((nc) => {
                    const it = template.sections.flatMap(s => s.items).find(i => i.id === nc.itemId);
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
                
                {responses.filter(r => r.result === 'not_complies').length === 0 && (
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
      {template && (
        <PdfPreviewModal
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          template={template}
          responses={responses}
          onGenerate={handleGeneratePDF}
          isGenerating={isGenerating}
        />
      )}
    </div>
  );
}
