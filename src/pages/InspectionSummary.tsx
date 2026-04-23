import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileDown, ArrowLeft, Loader2, Save, Info } from 'lucide-react';
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

export function InspectionSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [currentInspection, setInspection] = useState<Inspection | null>(null);
  const [responses, setResponses] = useState<InspectionResponse[]>([]);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [legislations, setLegislations] = useState<Legislation[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    const inspectionId = location.state?.inspectionId;
    if (!inspectionId) {
      navigate('/inspections');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        // 1. Load inspection from Supabase
        const insp = await InspectionService.getInspectionById(inspectionId);

        if (!insp) {
          throw new Error('Inspection not found');
        }
        
        // 2. Load client data
        const client = await ClientService.getClientById(insp.clientId);
        if (client) {
          insp.clientName = client.name;
          insp.clientCategory = client.category;
          insp.city = client.city;
          insp.state = client.state;
        }

        const clients = await ClientService.getClients();
        setAllClients(clients);

        // 3. Load responses from Supabase
        const remoteResps = await InspectionService.getResponsesByInspectionId(inspectionId);
        
        // 4. Attach photos (photos are still in Dexie for now)
        for (const r of remoteResps) {
          r.photos = await db.photos.where('responseId').equals(r.id).toArray();
        }

        // 5. Resolve template
        let tpl = await db.templates.get(insp.templateId);
        if (!tpl) {
          tpl = getTemplateById(insp.templateId);
        }

        if (!tpl && navigator.onLine) {
          try {
            const { TemplateService } = await import('../services/templateService');
            tpl = await TemplateService.getFullTemplate(insp.templateId);
            if (tpl) await db.templates.put(tpl);
          } catch (e) {
            console.error('Failed to fetch template in Summary:', e);
          }
        }
        
        const legs = await LegislationService.listLegislations();

        setInspection(insp);
        setResponses(remoteResps);
        setLegislations(legs);
        setTemplate(tpl ? enrichTemplate(tpl, client || (insp as any)) : null);
      } catch (err) {
        console.error('[InspectionSummary] loadData error:', err);
        navigate('/inspections');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [location.state?.inspectionId]);

  const scoreArea = useMemo(() => {
    if (!currentInspection || !template) return null;
    return calculateScore(responses, template.sections);
  }, [currentInspection, responses, template]);

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

  const handleGeneratePDF = async () => {
    if (!currentInspection || !template || !scoreArea) return;
    setIsGenerating(true);
    try {
       // Allow React state update to show spinner
       await new Promise(resolve => setTimeout(resolve, 100));
       await generatePDF(currentInspection, responses, template, scoreArea, settings as any, legislations);
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
          <div className="flex space-x-2">
            <Button onClick={handleGeneratePDF} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4 hidden sm:block" />}
              PDF
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
                        value={currentInspection.dependencyLevel1 || 0}
                        onChange={(e) => setInspection({...currentInspection, dependencyLevel1: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Grau II</label>
                      <input 
                        type="number" 
                        value={currentInspection.dependencyLevel2 || 0}
                        onChange={(e) => setInspection({...currentInspection, dependencyLevel2: parseInt(e.target.value) || 0})}
                        className="w-full border-gray-300 rounded-lg text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Grau III</label>
                      <input 
                        type="number" 
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
          
          <div className="p-6 sm:p-8 bg-gray-50">
            <ScorePanel inspection={currentInspection} responses={responses} />
          </div>
        </div>
      </div>
      
      <div className="pb-10"></div>
    </div>
  );
}
