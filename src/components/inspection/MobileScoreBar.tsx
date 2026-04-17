import React from 'react';
import { calculateScore } from '../../utils/scoring';
import { useInspectionStore } from '../../store/useInspectionStore';
import { getTemplateById } from '../../data/templates';

interface MobileScoreBarProps {
  template?: any;
}

export function MobileScoreBar({ template: propTemplate }: MobileScoreBarProps) {
  const { currentInspection, responses } = useInspectionStore();

  if (!currentInspection) return null;

  const template = propTemplate || getTemplateById(currentInspection.templateId);
  if (!template) return null;

  const score = calculateScore(responses, template.sections);

  const getColor = (pct: number) => {
    if (pct >= 85) return { bar: '#22C55E', text: 'text-green-600', bg: 'bg-green-50' };
    if (pct >= 70) return { bar: '#F59E0B', text: 'text-amber-600', bg: 'bg-amber-50' };
    return { bar: '#EF4444', text: 'text-red-600', bg: 'bg-red-50' };
  };

  const colors = getColor(score.scorePercentage);

  return (
    <div className={`lg:hidden border-b border-gray-100 px-4 py-2 ${colors.bg}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Score */}
        <div className="flex items-baseline gap-1 shrink-0">
          <span className={`text-2xl font-black ${colors.text}`}>
            {Math.round(score.scorePercentage)}%
          </span>
          <span className="text-[10px] font-bold text-gray-400 uppercase">Adequação</span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score.scorePercentage}%`, backgroundColor: colors.bar }}
          />
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
          <span className="text-red-500">
            {score.urgentActionsCount} <span className="text-gray-400 font-normal">NC</span>
          </span>
          <span className="text-gray-400">
            {score.evaluatedItems}/{score.totalItems}
          </span>
        </div>
      </div>
    </div>
  );
}
