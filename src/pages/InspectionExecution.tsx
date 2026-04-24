import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, PlusCircle, WifiOff, X, RefreshCw } from 'lucide-react';
import { db } from '../db/database';
import { supabase } from '../lib/supabase';
import { getTemplateById, getEffectiveTemplate } from '../data/templates';
import { type Inspection, type InspectionResponse, type InspectionPhoto } from '../types';
import { ILPIStaffCalculator } from '../components/inspection/ILPIStaffCalculator';
import { useInspectionStore } from '../store/useInspectionStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { generateId } from '../utils/imageUtils';
import { CollaborativeProgress } from '../components/inspection/CollaborativeProgress';
import { MobileScoreBar } from '../components/inspection/MobileScoreBar';
import { ClientService } from '../services/clientService';
import { InspectionService } from '../services/inspectionService';
import { withTimeout } from '../utils/network';


import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SectionAccordion } from '../components/inspection/SectionAccordion';
import { ChecklistItem } from '../components/inspection/ChecklistItem';
import { ScorePanel } from '../components/inspection/ScorePanel';
import { SignaturePad } from '../components/ui/SignaturePad';

export function InspectionExecution() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentInspection,
    responses,
    setCurrentInspection,
    setResponses,
    mergeResponses,
  } = useInspectionStore();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [prevNCIds, setPrevNCIds] = useState<string[]>([]);
  const [expandedSectionIds] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const [template, setTemplate] = useState<any>(null);

  // ─── LOAD DATA ────────────────────────────────────────────────────────────
  // Runs when the page is opened, whether via navigation state or direct URL.
  // Falls back to Supabase if the inspection is not in the local Dexie cache.
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { inspectionId, previousInspectionId } = location.state || {};
      const id = inspectionId || currentInspection?.id;

      if (!id) {
        navigate('/inspections');
        return;
      }

      // 1. Fetch from Supabase
      const insp = await InspectionService.getInspectionById(id);

      if (!insp) {
        setLoadError('Inspeção não encontrada no servidor. Verifique sua conexão.');
        setLoading(false);
        return;
      }

      // 2. Load template (Static Memory -> Dexie Cache -> Supabase)
      let tpl = getTemplateById(insp.templateId); // Try static first (fastest)
      
      if (!tpl) {
        // Try Dexie cache next
        try {
          tpl = await withTimeout(Promise.resolve(db.templates.get(insp.templateId)), 2000, 'DexieTemplateGet');
        } catch (e) {
          console.warn('[Execution] Dexie template read failed/timeout, skipping.', e);
        }
      }
      
      if (!tpl && navigator.onLine) {
        // Fallback to Supabase
        try {
          const { TemplateService } = await import('../services/templateService');
          tpl = await withTimeout(TemplateService.getFullTemplate(insp.templateId), 5000, 'SupabaseTemplateGet');
          if (tpl) {
            // Save to Dexie for future offline use (non-blocking)
            db.templates.put(tpl).catch(() => {});
          }
        } catch (e) {
          console.error('[Execution] Failed to fetch remote template:', e);
        }
      }

      if (tpl) {
        setTemplate(tpl);
      }

      // 3. Enrich with client data
      const client = await ClientService.getClientById(insp.clientId);
      if (client) {
        insp.clientName = client.name;
        insp.clientCategory = client.category;
        insp.foodTypes = client.foodTypes;
        insp.city = client.city;
        insp.state = client.state;
      }

      // 4. Load responses from Supabase
      const resps = await InspectionService.getResponsesByInspectionId(id);

      // 5. Attach photos (photos are still in Dexie for now, or need a separate service)
      // For now, let's keep photos in Dexie as they are large blobs, but ideally they go to Supabase Storage.
      for (const r of resps) {
        r.photos = await db.photos
          .where('responseId').equals(r.id)
          .filter(p => !p.deletedAt)
          .toArray();
      }

      setCurrentInspection(insp);
      setResponses(resps);

      // 6. Load previous inspection non-compliances
      if (previousInspectionId) {
        const prevResps = await InspectionService.getResponsesByInspectionId(previousInspectionId);
        setPrevNCIds(prevResps.filter(r => r.result === 'not_complies').map(r => r.itemId));
      }
    } catch (err) {
      console.error('[loadData] Error:', err);
      setLoadError('Erro ao carregar dados da inspeção.');
    } finally {
      setLoading(false);
    }
  }, [location.state?.inspectionId, location.state?.previousInspectionId]);


  // Re-run loadData whenever the inspectionId in navigation state changes
  useEffect(() => { loadData(); }, [loadData]);

  // ─── TEMPLATE RESOLUTION ──────────────────────────────────────────────────
  const visibleSections = useMemo(() => {
    if (!template || !currentInspection) return [];
    const role = useSettingsStore.getState().settings.consultantRole || 'saude';
    const ctx = { ...currentInspection, category: (currentInspection as any).clientCategory || (currentInspection as any).category };
    try { return getEffectiveTemplate(template, ctx as any, role, false).sections; }
    catch (err) { console.error('getEffectiveTemplate error:', err); return template.sections; }
  }, [template, currentInspection?.templateId, currentInspection?.state]);

  // ─── REALTIME SYNC: Listen for updates from Supabase ─────────────────────
  useEffect(() => {
    if (!currentInspection || loading) return;

    // 1. Initial subscription
    const channel = supabase
      .channel(`inspection-responses:${currentInspection.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'responses',
          filter: `inspection_id=eq.${currentInspection.id}`,
        },
        async (payload) => {
          console.log('[Realtime] Change detected:', payload.eventType);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const rr = payload.new as any;
            const mapped: InspectionResponse = {
              id: rr.id, inspectionId: rr.inspection_id, itemId: rr.item_id,
              result: rr.result, situationDescription: rr.situation_description,
              correctiveAction: rr.corrective_action, responsible: rr.responsible,
              deadline: rr.deadline, customDescription: rr.custom_description,
              createdAt: new Date(rr.created_at), updatedAt: new Date(rr.updated_at || rr.created_at),
              syncStatus: 'synced', photos: [],
            };
            
            mergeResponses([mapped]);
          }

        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status:', status);
      });

    // 2. Keep a slower polling interval as fallback (every 30s)
    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const { data: remoteResps, error } = await supabase
          .from('responses').select('*')
          .eq('inspection_id', currentInspection.id).is('deleted_at', null);
        if (error || !remoteResps) return;
        const mapped: InspectionResponse[] = remoteResps.map(rr => ({
          id: rr.id, inspectionId: rr.inspection_id, itemId: rr.item_id,
          result: rr.result, situationDescription: rr.situation_description,
          correctiveAction: rr.corrective_action, responsible: rr.responsible,
          deadline: rr.deadline, customDescription: rr.custom_description,
          createdAt: new Date(rr.created_at), updatedAt: new Date(rr.updated_at || rr.created_at),
          syncStatus: 'synced', photos: [],
        }));
        mergeResponses(mapped);
      } catch (err) { console.warn('[Sync] fallback pull failed:', err); }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentInspection?.id, loading]);

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
  }, [currentInspection]);


  const handleResponseChange = useCallback(async (itemId: string, result: InspectionResponse['result']) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    
    let updated: InspectionResponse;
    if (existing) {
      updated = { ...existing, result, updatedAt: new Date() };
      state.updateResponse(existing.id, { result, updatedAt: new Date() });
    } else {
      updated = {
        id: generateId(),
        inspectionId: state.currentInspection!.id,
        itemId,
        result,
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
      };
      state.addResponse(updated);
    }
    
    try {
      await InspectionService.upsertResponse(updated);
    } catch (err) {
      console.error('Failed to sync response:', err);
    }
  }, []);


  const handleUpdateDetails = useCallback(async (itemId: string, details: Partial<InspectionResponse>) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      const updated = { ...existing, ...details, updatedAt: new Date() };
      state.updateResponse(existing.id, details);
      
      try {
        await InspectionService.upsertResponse(updated);
      } catch (err) {
        console.error('Failed to sync response details:', err);
      }
    }
  }, []);


  const handleAddPhoto = useCallback((itemId: string, photo: any) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, { photos: [...(existing.photos || []), { ...photo, id: generateId() }] });
    }
  }, []);

  const handleRemovePhoto = useCallback((itemId: string, photoId: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, { photos: (existing.photos || []).filter((p: any) => p.id !== photoId) });
    }
  }, []);

  const handleEditDescription = useCallback(async (itemId: string, customDescription: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      const updated = { ...existing, customDescription, updatedAt: new Date() };
      state.updateResponse(existing.id, { customDescription });
      
      try {
        await InspectionService.upsertResponse(updated);
      } catch (err) {
        console.error('Failed to sync custom description:', err);
      }
    }
  }, []);


  const handleAddExtraItem = useCallback(async (sectionId: string) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    const desc = window.prompt('Descrição do item extra:');
    if (!desc) return;
    
    const newResponse: InspectionResponse = {
      id: generateId(), 
      inspectionId: state.currentInspection.id,
      itemId: `extra|${sectionId}|${generateId()}`,
      result: 'not_observed', 
      customDescription: desc,
      photos: [], 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      syncStatus: 'pending',
    };
    
    await state.addResponse(newResponse);
    
    try {
      await InspectionService.upsertResponse(newResponse);
    } catch (err) {
      console.error('Failed to sync extra item:', err);
    }
  }, []);


  const updateStaffData = useCallback((field: string, value: number) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    state.setCurrentInspection({ ...state.currentInspection, [field]: value });
  }, []);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const [isFinishing, setIsFinishing] = useState(false);

  const handleConfirmFinish = async () => {
    if (!currentInspection || !signature) return;
    if (!window.confirm('Encerrar Inspeção?')) return;

    setIsFinishing(true);
    try {
      // 1. Build final inspection record updates
      const updates: Partial<Inspection> = {
        status: 'completed' as const,
        completedAt: new Date(),
        signatureDataUrl: signature,
      };

      // 2. Save to Supabase
      await InspectionService.updateInspection(currentInspection.id, updates);

      // 3. Update the store
      setCurrentInspection({ ...currentInspection, ...updates });

      // 4. Navigate
      navigate('/summary', { state: { inspectionId: currentInspection.id } });
    } catch (err) {
      console.error('[handleConfirmFinish] Error:', err);
      alert('Erro ao finalizar a inspeção. Tente novamente.');
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

  if (!currentInspection || !template) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <p className="text-gray-600 font-semibold">Template não encontrado para esta inspeção.</p>
        <Button variant="ghost" onClick={() => navigate('/inspections')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Inspeções
        </Button>
      </div>
    );
  }

  const isCompleted = currentInspection.status === 'completed';

  return (
    <div className="flex h-screen flex-col bg-gray-50 pb-safe pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/inspections')} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate max-w-xs sm:max-w-sm md:max-w-lg">{currentInspection.clientName}</h1>
              <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-wider">
                {isCompleted && <Badge variant="neutral" className="bg-green-100 text-green-700 border-green-200">Finalizada</Badge>}
                {!isOnline && <span className="text-amber-600 flex items-center bg-amber-50 px-2 py-0.5 rounded-md"><WifiOff className="mr-1 h-3 w-3" /> Offline</span>}
                {saveStatus === 'saving' && <span className="text-primary-600 animate-pulse">Sincronizando...</span>}
                {saveStatus === 'saved' && <span className="text-green-600">Dados Protegidos</span>}
              </div>
            </div>
          </div>
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
      </header>

      {currentInspection.templateId === 'tpl-ilpi-federal-v1' && <CollaborativeProgress />}

      {/* Mobile Score Bar - shown only on small screens */}
      <MobileScoreBar template={template} />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:grid lg:grid-cols-12 lg:gap-8 overflow-y-auto">
        <div className="lg:col-span-8 space-y-6">
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
                  {/* ILPI Dimensioning Block */}
                  {section.id === 'sec-fed-12' && (
                    <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dimensionamento ILPI</label>
                        {currentInspection.state === 'RJ' && (
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
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                              value={(currentInspection as any)[`dependencyLevel${i + 1}`] || 0}
                              onChange={(e) => updateStaffData(`dependencyLevel${i + 1}`, parseInt(e.target.value) || 0)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                        <div>
                          <span className="text-[10px] text-primary-600 font-bold block mb-1 uppercase tracking-tight">Equipe Cuidadores Atual</span>
                          <input
                            type="number"
                            placeholder="Qtd. Cuidadores..."
                            className="w-full bg-white border border-primary-100 rounded-lg p-2 font-bold text-primary-900 shadow-sm"
                            value={currentInspection.observedStaff || 0}
                            onChange={(e) => updateStaffData('observedStaff', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-primary-600 font-bold block mb-1 uppercase tracking-tight">Equipe Técnica Atual</span>
                          <input
                            type="number"
                            placeholder="Técnicos/Enf..."
                            className="w-full bg-white border border-primary-100 rounded-lg p-2 font-bold text-primary-900 shadow-sm"
                            value={currentInspection.observedNursingTechs || 0}
                            onChange={(e) => updateStaffData('observedNursingTechs', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <ILPIStaffCalculator
                        level1={currentInspection.dependencyLevel1 || 0}
                        level2={currentInspection.dependencyLevel2 || 0}
                        level3={currentInspection.dependencyLevel3 || 0}
                        currentCaregivers={currentInspection.observedStaff || 0}
                        currentNursingTechs={currentInspection.observedNursingTechs || 0}
                        isRJ={currentInspection.state === 'RJ'}
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
                        wasNonCompliant={prevNCIds.includes(item.id)}
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
          <ScorePanel template={template} />
        </div>
      </div>

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
