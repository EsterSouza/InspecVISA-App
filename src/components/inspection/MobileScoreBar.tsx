import React from 'react';
import { calculateScore, classificationColor } from '../../utils/scoring';
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

  // Mesma classificação do painel do desktop — a barra do celular não pode
  // discordar dele. Tons da marca; faixa lima descontinuada (decisão 27).
  const TONS = {
    critical: { text: 'text-danger-soft-ink', bg: 'bg-danger-soft' },
    regular: { text: 'text-amber-soft-ink', bg: 'bg-amber-soft' },
    good: { text: 'text-success-soft-ink', bg: 'bg-success-soft' },
    excellent: { text: 'text-success-soft-ink', bg: 'bg-success-soft' },
  } as const;

  const colors = { bar: classificationColor(score.classification), ...TONS[score.classification] };

  return (
    <div className={`lg:hidden border-b border-gray-100 px-4 py-2 ${colors.bg}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Score */}
        <div className="flex items-baseline gap-1 shrink-0">
          <span className={`text-2xl font-black ${colors.text}`}>
            {Math.round(score.scorePercentage)}%
          </span>
          <span className="text-[10px] font-bold text-navy-3 uppercase">Adequação</span>
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
          <span className="text-danger">
            {score.urgentActionsCount} <span className="text-navy-3 font-normal">NC</span>
          </span>
          <span className="text-navy-3">
            {score.evaluatedItems}/{score.totalItems}
          </span>
        </div>
      </div>
    </div>
  );
}
