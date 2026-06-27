import React from 'react';
import { calculateScore, calculateAreaScores, classificationLabel, classificationColor } from '../../utils/scoring';
import type { AreaScore } from '../../utils/scoring';
import { useInspectionStore } from '../../store/useInspectionStore';
import { getTemplateById } from '../../data/templates';
import type { Inspection, InspectionResponse, ChecklistTemplate } from '../../types';

function firstName(name?: string) {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** Cartão compacto de uma área (Sanitária / Nutrição) com %, classificação e autora. */
function AreaScoreCard({ area }: { area: AreaScore }) {
  const pct = Math.round(area.score.scorePercentage);
  const riskColor = classificationColor(area.score.classification);
  const who = firstName(area.consultant);
  return (
    <div className="flex-1 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{area.areaLabel}</p>
          {who && <p className="truncate text-xs font-semibold text-gray-600">{who}</p>}
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase text-white"
          style={{ backgroundColor: riskColor }}
        >
          {classificationLabel(area.score.classification)}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-black text-gray-900">{pct}%</span>
        {area.score.criticalNotCompliesCount > 0 && (
          <span className="text-[10px] font-bold text-red-600">
            {area.score.criticalNotCompliesCount} NC crítica(s)
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-tight text-gray-400">
        {area.score.evaluatedItems} itens · {area.score.notCompliesCount} NC
      </p>
    </div>
  );
}

interface ScorePanelProps {
  inspection?: Inspection;
  responses?: InspectionResponse[];
  template?: ChecklistTemplate | any;
}

export function ScorePanel({ inspection, responses: propResponses, template: propTemplate }: ScorePanelProps) {
  const store = useInspectionStore();
  
  const currentInspection = inspection || store.currentInspection;
  const responses = propResponses || store.responses;
  
  if (!currentInspection) return null;
  // Use prop template first, then try static lookup as fallback
  const template = propTemplate || getTemplateById(currentInspection.templateId);
  if (!template) return null;

  const score = calculateScore(responses, template.sections);
  const areaScores = calculateAreaScores(responses, template.sections);

  // Dynamic color based on score percentage
  const getScoreColor = (percent: number) => {
    if (percent >= 85) return '#22C55E'; // Success
    if (percent >= 70) return '#F59E0B'; // Warning
    return '#EF4444'; // Danger
  };

  const scoreColor = getScoreColor(score.scorePercentage);
  const riskColor = classificationColor(score.classification);
  const riskLabel = classificationLabel(score.classification);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Block 1: Score Metric */}
      <div className="p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black transition-colors duration-500" style={{ color: scoreColor }}>
              {Math.round(score.scorePercentage)}%
            </span>
            <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">Conformidade</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Classificação de risco (MARP)</span>
            <span
              className="rounded-full px-3 py-1 text-sm font-black uppercase text-white shadow-sm"
              style={{ backgroundColor: riskColor }}
            >
              {riskLabel}
            </span>
          </div>
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

        {/* Separação por área: sanitária (ex.: Ester) e nutrição (ex.: Ana).
            O número grande acima é o GLOBAL da casa (soma das duas áreas).
            Só faz sentido em ILPI (única categoria com nutrição interna). */}
        {areaScores.isSplit && template.category === 'ilpi' && (
          <div className="space-y-2 pt-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
              Conformidade por área de avaliação
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <AreaScoreCard area={areaScores.sanitary} />
              <AreaScoreCard area={areaScores.nutrition} />
            </div>
          </div>
        )}
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
