import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileDown, ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { db } from '../db/database';
import { getTemplateById, enrichTemplate } from '../data/templates';
import { calculateScore, classificationLabel, classificationColor } from '../utils/scoring';
import { generatePDF } from '../utils/pdfGenerator';
import { useSettingsStore } from '../store/useSettingsStore';
import type { Inspection, InspectionResponse, ChecklistTemplate } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatDateTime } from '../utils/imageUtils';

export function InspectionSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [currentInspection, setInspection] = useState<Inspection | null>(null);
  const [responses, setResponses] = useState<InspectionResponse[]>([]);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);

  useEffect(() => {
    const inspectionId = location.state?.inspectionId;
    if (!inspectionId) {
      navigate('/inspections');
      return;
    }

    const loadData = async () => {
      try {
        const insp = await db.inspections.get(inspectionId);
        if (!insp) throw new Error('Inspection not found');
        
        const client = await db.clients.get(insp.clientId);
        if (client) {
          insp.clientName = client.name;
          insp.clientCategory = client.category;
          insp.city = client.city;
          insp.state = client.state;
        }

        const resps = await db.responses.where('inspectionId').equals(inspectionId).toArray();
        for (const r of resps) {
          r.photos = await db.photos.where('responseId').equals(r.id).toArray();
        }

        const tpl = getTemplateById(insp.templateId);

        setInspection(insp);
        setResponses(resps);
        setTemplate(tpl ? enrichTemplate(tpl, client || (insp as any)) : null);
      } catch (err) {
        console.error(err);
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

  const handleGeneratePDF = async () => {
    if (!currentInspection || !template || !scoreArea) return;
    setIsGenerating(true);
    try {
       // Allow React state update to show spinner
       await new Promise(resolve => setTimeout(resolve, 100));
       await generatePDF(currentInspection, responses, template, scoreArea, settings);
    } catch (err) {
       console.error('PDF Error:', err);
      alert('Erro ao gerar PDF. Verifique os dados e tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading || !currentInspection || !template || !scoreArea) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const scoreColor = classificationColor(scoreArea.classification);

  return (
    <div className="flex h-screen flex-col bg-gray-50 pb-safe pb-16 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/inspections')}>
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Button>
            <h1 className="text-sm font-bold leading-tight text-gray-900 sm:text-lg">
              Resumo da Inspeção
            </h1>
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleGeneratePDF} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4 hidden sm:block" />}
              Gerar PDF
            </Button>
          </div>
        </div>
      </header>
      
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="text-center bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-12 mt-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{currentInspection.clientName}</h1>
          <p className="mt-2 text-gray-500 font-medium">{template.name}</p>
          <p className="text-sm text-gray-400 mt-1">Concluída em {formatDateTime(currentInspection.completedAt || new Date())}</p>
          
          <div className="mt-8 flex flex-col items-center justify-center space-y-2">
              <div 
                className="text-6xl sm:text-7xl font-black tracking-tighter"
                style={{ color: scoreColor }}
              >
                {Math.round(scoreArea.scorePercentage)}<span className="text-4xl text-gray-400 font-bold ml-1">%</span>
              </div>
              <div 
                className="px-4 py-1.5 rounded-full text-sm font-bold tracking-widest text-white uppercase mt-4"
                style={{ backgroundColor: scoreColor }}
              >
                {classificationLabel(scoreArea.classification)}
              </div>
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto border-t border-gray-100 pt-8">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-gray-900">{scoreArea.evaluatedItems}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase mt-1">Itens Avaliados</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-green-600">{scoreArea.compliesCount}</span>
                <span className="text-xs font-semibold text-green-800 uppercase mt-1">Conformes</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-red-600">{scoreArea.notCompliesCount}</span>
                <span className="text-xs font-semibold text-red-800 uppercase mt-1">Nãos Conf.</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-slate-500">{scoreArea.notObservedCount}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase mt-1">N. Obs (NO)</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-gray-400">{scoreArea.notApplicableCount}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase mt-1">N/A</span>
              </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo por Seção</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scoreArea.scoreBySection.map((s) => (
                <div key={s.sectionId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{s.sectionTitle}</h4>
                      <div className="text-xs text-gray-500 mt-1 flex gap-3">
                        <span>{Math.round(s.scorePercentage)}% Conforme</span>
                        <span className="text-red-500">{s.notCompliesCount} Irreg.</span>
                        {s.notObservedCount > 0 && <span className="text-slate-500">{s.notObservedCount} Não Obs.</span>}
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-0 w-full sm:w-48 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                      <div style={{ width: `${s.totalItems > 0 ? (s.compliesCount/s.totalItems)*100 : 0}%` }} className="bg-green-500 h-full" />
                      <div style={{ width: `${s.totalItems > 0 ? (s.notCompliesCount/s.totalItems)*100 : 0}%` }} className="bg-red-500 h-full" />
                      <div style={{ width: `${s.totalItems > 0 ? (s.notObservedCount/s.totalItems)*100 : 0}%` }} className="bg-slate-400 h-full" />
                      <div style={{ width: `${s.totalItems > 0 ? (s.notApplicableCount/s.totalItems)*100 : 0}%` }} className="bg-gray-300 h-full" />
                    </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="pb-10"></div>
    </div>
  );
}
