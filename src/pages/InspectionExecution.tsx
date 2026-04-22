import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, PlusCircle, WifiOff, X, RefreshCw } from 'lucide-react';
import { db } from '../db/database';
import { supabase } from '../lib/supabase';
import { getTemplateById, getEffectiveTemplate } from '../data/templates';
import { type InspectionResponse, type InspectionPhoto } from '../types';
import { ILPIStaffCalculator } from '../components/inspection/ILPIStaffCalculator';
import { useInspectionStore } from '../store/useInspectionStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { generateId } from '../utils/imageUtils';
import { CollaborativeProgress } from '../components/inspection/CollaborativeProgress';
import { MobileScoreBar } from '../components/inspection/MobileScoreBar';
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
    updateResponse,
    addResponse,
    mergeResponses,
  } = useInspectionStore();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [prevNCIds, setPrevNCIds] = useState<string[]>([]);
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
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

      // 1. Try local Dexie first
      let insp = await db.inspections.get(id);

      // 2. Fallback: fetch from Supabase if not found locally (e.g., other device)
      if (!insp || insp.deletedAt) {
        if (navigator.onLine) {
          const { data: remoteInsp } = await withTimeout<any>(
            supabase
              .from('inspections')
              .select('*')
              .eq('id', id)
              .is('deleted_at', null)
              .single(),
            20000,
            'FetchInspection'
          ).catch(() => ({ data: null }));

          if (remoteInsp) {
            // Map snake_case → camelCase and cache locally
            insp = {
              id: remoteInsp.id,
              clientId: remoteInsp.client_id,
              templateId: remoteInsp.template_id,
              consultantName: remoteInsp.consultant_name,
              inspectionDate: remoteInsp.inspection_date ? new Date(remoteInsp.inspection_date) : new Date(),
              status: remoteInsp.status,
              observations: remoteInsp.observations,
              completedAt: remoteInsp.completed_at ? new Date(remoteInsp.completed_at) : undefined,
              accompanistName: remoteInsp.accompanist_name,
              accompanistRole: remoteInsp.accompanist_role,
              ilpiCapacity: remoteInsp.ilpi_capacity,
              residentsTotal: remoteInsp.residents_total,
              dependencyLevel1: remoteInsp.dependency_level1 ?? remoteInsp.dependency_level_1,
              dependencyLevel2: remoteInsp.dependency_level2 ?? remoteInsp.dependency_level_2,
              dependencyLevel3: remoteInsp.dependency_level3 ?? remoteInsp.dependency_level_3,
              observedStaff: remoteInsp.observed_staff,
              observedNursingTechs: remoteInsp.observed_nursing_techs,
              signatureDataUrl: remoteInsp.signature_data_url,
              tenantId: remoteInsp.tenant_id,
              createdAt: new Date(remoteInsp.created_at),
              updatedAt: new Date(remoteInsp.updated_at || remoteInsp.created_at),
              synced: 1,
            } as any;
            // Cache it
            await db.inspections.put(insp!);
          }
        }
      }

      if (!insp || insp.deletedAt) {
        setLoadError('Inspeção não encontrada. Verifique sua conexão e tente novamente.');
        setLoading(false);
        return;
      }

      // 2.5 LOAD TEMPLATE FROM DEXIE
      let tpl = await db.templates.get(insp.templateId);
      if (!tpl) {
        // FALLBACK: Last resort check static templates before giving up
        console.warn('Template missing in Dexie, checking statics:', insp.templateId);
        tpl = getTemplateById(insp.templateId);
      }

      if (!tpl && navigator.onLine) {
        console.warn('Template still missing, trying to fetch from Supabase:', insp.templateId);
        try {
          const { TemplateService } = await import('../services/templateService');
          tpl = await TemplateService.getFullTemplate(insp.templateId);
          if (tpl) {
            await db.templates.put(tpl);
          }
        } catch (e) {
          console.error('Failed to fetch template from Supabase:', e);
        }
      }

      if (tpl) {
        setTemplate(tpl);
      } else {
        console.error('CRITICAL: Template NOT found anywhere:', insp.templateId);
      }

      // 3. Enrich with client data
      const client = await db.clients.get(insp.clientId);
      if (client) {
        insp.clientName = client.name;
        insp.clientCategory = client.category;
        insp.foodTypes = client.foodTypes;
        insp.city = client.city;
        insp.state = client.state;
      } else if (navigator.onLine) {
        // Try fetching client from Supabase too
        const { data: remoteClient } = await withTimeout<any>(
          supabase
            .from('clients')
            .select('*')
            .eq('id', insp.clientId)
            .single(),
          15000,
          'FetchClient'
        ).catch(() => ({ data: null }));

        if (remoteClient) {
          insp.clientName = remoteClient.name;
          insp.clientCategory = remoteClient.category;
          insp.foodTypes = remoteClient.food_types;
          insp.city = remoteClient.city;
          insp.state = remoteClient.state;
        }
      }

      // 4. Load responses from Dexie
      let resps = await db.responses
        .where('inspectionId').equals(id)
        .filter(r => !r.deletedAt)
        .toArray();

      // 5. If no local responses, try Supabase fallback
      if (resps.length === 0 && navigator.onLine) {
        const { data: remoteResps } = await withTimeout<any>(
          supabase
            .from('responses')
            .select('*')
            .eq('inspection_id', id)
            .is('deleted_at', null),
          20000,
          'FetchResponses'
        ).catch(() => ({ data: [] }));

        if (remoteResps && remoteResps.length > 0) {
          resps = remoteResps.map((rr: any) => ({
            id: rr.id,
            inspectionId: rr.inspection_id,
            itemId: rr.item_id,
            result: rr.result,
            situationDescription: rr.situation_description,
            correctiveAction: rr.corrective_action,
            responsible: rr.responsible,
            deadline: rr.deadline,
            customDescription: rr.custom_description,
            createdAt: new Date(rr.created_at),
            updatedAt: new Date(rr.updated_at || rr.created_at),
            synced: 1,
            photos: [],
          }));
          // Cache locally
          await db.responses.bulkPut(resps);
        }
      }

      // 6. Attach photos
      for (const r of resps) {
        r.photos = await db.photos
          .where('responseId').equals(r.id)
          .filter(p => !p.deletedAt)
          .toArray();
      }

      setCurrentInspection(insp);
      setResponses(resps);

      // 7. Load previous inspection non-compliances (for recurrence detection)
      if (previousInspectionId) {
        const prevResps = await db.responses.where('inspectionId').equals(previousInspectionId).toArray();
        setPrevNCIds(prevResps.filter(r => r.result === 'not_complies').map(r => r.itemId));
      }
    } catch (err) {
      console.error('[loadData] Error:', err);
      setLoadError('Erro ao carregar inspeção. Tente novamente.');
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
              synced: 1, photos: [],
            };
            
            // Update local Dexie first to avoid flash of old data
            const local = await db.responses.get(mapped.id);
            if (!local || local.synced === 1 || new Date(mapped.updatedAt) > new Date(local.updatedAt)) {
              await db.responses.put({ ...mapped, photos: local?.photos || [] });
              mergeResponses([mapped]);
            }
          } else if (payload.eventType === 'DELETE') {
             // Handle delete if needed
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
          synced: 1, photos: [],
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
    // Immediate local save — strip UI-only fields that don't belong in schema
    const { clientName, clientCategory, foodTypes, city, state: st, ...persistable } = currentInspection as any;
    db.inspections.put({ ...persistable, updatedAt: new Date(), synced: 0 });

    // Debounced remote save
    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await db.onlineUpsert('inspections', persistable, db.inspections);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) { console.error('Remote save error', err); setSaveStatus('idle'); }
    }, 3000);
    return () => clearTimeout(timer);
  }, [currentInspection]);

  const handleResponseChange = useCallback((itemId: string, result: InspectionResponse['result']) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, { result, updatedAt: new Date() });
    } else {
      state.addResponse({
        id: generateId(),
        inspectionId: state.currentInspection!.id,
        itemId,
        result,
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }, []);

  const handleUpdateDetails = useCallback((itemId: string, details: Partial<InspectionResponse>) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, details);
    }
  }, []);

  const handleAddPhoto = useCallback((itemId: string, photo: any) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, { photos: [...existing.photos, { ...photo, id: generateId() }] });
    }
  }, []);

  const handleRemovePhoto = useCallback((itemId: string, photoId: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, { photos: existing.photos.filter((p: any) => p.id !== photoId) });
    }
  }, []);

  const handleEditDescription = useCallback((itemId: string, customDescription: string) => {
    const state = useInspectionStore.getState();
    const existing = state.responses.find(r => r.itemId === itemId);
    if (existing) {
      state.updateResponse(existing.id, { customDescription });
    }
  }, []);

  const handleAddExtraItem = useCallback(async (sectionId: string) => {
    const state = useInspectionStore.getState();
    if (!state.currentInspection) return;
    const desc = window.prompt('Descrição do item extra:');
    if (!desc) return;
    await state.addResponse({
      id: generateId(), inspectionId: state.currentInspection.id,
      itemId: `extra|${sectionId}|${generateId()}`,
      result: 'not_observed', customDescription: desc,
      photos: [], createdAt: new Date(), updatedAt: new Date(), synced: 0,
    });
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
      // 1. Flush all pending responses to Dexie immediately
      const currentResponses = useInspectionStore.getState().responses;
      for (const r of currentResponses) {
        if (r.synced === 0) {
          await db.responses.put(r);
        }
      }

      // 2. Build final inspection record
      const { clientName, clientCategory, foodTypes, city, state: st, ...baseInsp } = currentInspection as any;
      const finalData = {
        ...baseInsp,
        status: 'completed' as const,
        completedAt: new Date(),
        signatureDataUrl: signature,
        synced: 0,
      };

      // 3. Save locally first (never fails) then try remote
      await db.inspections.put({ ...finalData, updatedAt: new Date() });
      db.onlineUpsert('inspections', finalData, db.inspections).catch(err =>
        console.warn('[finish] Remote sync failed, data is safe in Dexie:', err)
      );

      // 4. Update the store so that /summary loads without a refresh
      setCurrentInspection({ ...currentInspection, ...finalData });

      // 5. Navigate
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
                  const updated = { ...currentInspection, status: 'in_progress' as const, completedAt: undefined };
                  await db.onlineUpsert('inspections', updated, db.inspections);
                  setCurrentInspection(updated);
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
