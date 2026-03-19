import React from 'react';
import { calculateScore, classificationLabel, classificationColor } from '../../utils/scoring';
import { useInspectionStore } from '../../store/useInspectionStore';
import { getTemplateById } from '../../data/templates';
import { ProgressBar } from '../ui/ProgressBar';

export function ScorePanel() {
  const { currentInspection, responses } = useInspectionStore();
  
  if (!currentInspection) return null;
  const template = getTemplateById(currentInspection.templateId);
  if (!template) return null;

  const score = calculateScore(responses, template.sections);
  const color = classificationColor(score.classification);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Pontuação Atual
      </h3>
      
      <div className="flex flex-col items-center justify-center py-2 text-center">
        <div 
          className="text-5xl font-extrabold tracking-tight transition-colors duration-500"
          style={{ color }}
        >
          {Math.round(score.scorePercentage)}%
        </div>
        <div 
          className="mt-2 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white transition-colors duration-500"
          style={{ backgroundColor: color }}
        >
          {classificationLabel(score.classification)}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Avaliados</span>
          <span className="font-medium text-gray-900">{score.evaluatedItems} / {score.totalItems}</span>
        </div>
        <ProgressBar value={(score.evaluatedItems / score.totalItems) * 100} colorClass="bg-blue-500" />
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div className="rounded-lg bg-green-50 p-3 text-center border border-green-100">
            <span className="block text-2xl font-bold text-green-600">{score.compliesCount}</span>
            <span className="text-xs font-medium text-green-800 uppercase">Cumpre</span>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center border border-red-100">
            <span className="block text-2xl font-bold text-red-600">{score.notCompliesCount}</span>
            <span className="text-xs font-medium text-red-800 uppercase">Não Cumpre</span>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center border border-gray-200 col-span-2">
            <span className="block text-xl font-bold text-gray-600">{score.notApplicableCount}</span>
            <span className="text-xs font-medium text-gray-500 uppercase">Não se Aplica</span>
          </div>
        </div>
      </div>
    </div>
  );
}
