import React from 'react';
import { calculateScore } from '../../utils/scoring';
import { useInspectionStore } from '../../store/useInspectionStore';
import { getTemplateById } from '../../data/templates';
import type { Inspection, InspectionResponse } from '../../types';

interface ScorePanelProps {
  inspection?: Inspection;
  responses?: InspectionResponse[];
}

export function ScorePanel({ inspection, responses: propResponses }: ScorePanelProps) {
  const store = useInspectionStore();
  
  const currentInspection = inspection || store.currentInspection;
  const responses = propResponses || store.responses;
  
  if (!currentInspection) return null;
  const template = getTemplateById(currentInspection.templateId);
  if (!template) return null;

  const score = calculateScore(responses, template.sections);
  
  // Dynamic color based on score percentage
  const getScoreColor = (percent: number) => {
    if (percent >= 85) return '#22C55E'; // Success
    if (percent >= 70) return '#F59E0B'; // Warning
    return '#EF4444'; // Danger
  };

  const scoreColor = getScoreColor(score.scorePercentage);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Block 1: Score Metric */}
      <div className="p-6 sm:p-8 space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black transition-colors duration-500" style={{ color: scoreColor }}>
            {Math.round(score.scorePercentage)}%
          </span>
          <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">Adequação</span>
        </div>
        
        <div className="space-y-2">
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-1000 ease-out" 
              style={{ 
                width: `${score.scorePercentage}%`,
                backgroundColor: scoreColor 
              }} 
            />
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
            {score.evaluatedItems} de {score.totalItems} itens avaliados
          </p>
        </div>
      </div>

      <div className="h-[1px] bg-gray-100 mx-6 sm:mx-8" />

      {/* Block 2: Actions Summary */}
      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xl font-black text-gray-900">{score.urgentActionsCount}</span>
            </div>
            <p className="text-[9px] font-bold text-gray-500 uppercase leading-none">Ações<br/>Urgentes</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xl font-black text-gray-900">{score.importantActionsCount}</span>
            </div>
            <p className="text-[9px] font-bold text-gray-500 uppercase leading-none">Ações<br/>Importantes</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-xl font-black text-gray-900">{score.compliesCount}</span>
            </div>
            <p className="text-[9px] font-bold text-gray-500 uppercase leading-none">Itens<br/>Conformes</p>
          </div>
        </div>
        <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em]">ações identificadas</p>
      </div>

      <div className="h-[1px] bg-gray-100 mx-6 sm:mx-8" />

      {/* Block 3: Section Grid */}
      <div className="p-6 sm:p-8 bg-gray-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {score.scoreBySection.map((section) => {
            const hasUrgent = section.urgentActionsCount > 0;
            const hasImportant = section.importantActionsCount > 0;
            const dotColor = hasUrgent ? '#EF4444' : hasImportant ? '#F59E0B' : '#22C55E';
            
            return (
              <div 
                key={section.sectionId}
                className="flex items-center justify-between py-0.5 border-b border-gray-100 md:border-none"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                  <span className="text-xs font-semibold text-gray-600 truncate">
                    {section.sectionTitle}
                  </span>
                </div>
                {section.notCompliesCount > 0 && (
                  <span className="text-[10px] font-black text-gray-400 whitespace-nowrap ml-2">
                    {section.notCompliesCount} NC
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Compact Legend */}
        <div className="mt-8 flex items-center gap-6 text-[8px] font-black uppercase tracking-widest text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            <span>Crítico / Urgente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            <span>Atenção</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span>Conforme</span>
          </div>
        </div>
      </div>
    </div>
  );
}
