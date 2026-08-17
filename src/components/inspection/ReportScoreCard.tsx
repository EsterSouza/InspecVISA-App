import React from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { calculateAreaScores, classificationBadgeClasses, classificationColor, classificationInk, classificationLabel } from '../../utils/scoring';
import type { PreviousVisitScore } from '../../utils/previousVisitScore';
import type { ChecklistTemplate, InspectionResponse } from '../../types';

function DeltaChip({ current, previous, size = 'sm' }: { current: number; previous: number; size?: 'sm' | 'lg' }) {
  const diff = Math.round(current) - Math.round(previous);
  const dir = diff > 0 ? 'sobe' : diff < 0 ? 'desce' : 'igual';
  const Icon = dir === 'sobe' ? ArrowUp : dir === 'desce' ? ArrowDown : Minus;
  const tone = dir === 'sobe' ? 'text-success-soft-ink' : dir === 'desce' ? 'text-danger-soft-ink' : 'text-navy-2';
  return (
    <span className={`inline-flex items-center gap-1 ${tone} ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden="true" />
      <span className="font-semibold tabular-nums">
        {diff > 0 ? '+' : diff < 0 ? '−' : ''}{Math.abs(diff)}
      </span>
    </span>
  );
}

/**
 * Resultado do relatório concluído. Aqui a comparação é **final contra final** —
 * as duas visitas terminaram. A diferença continua em pontos percentuais, e a
 * linha some se o roteiro tiver mudado entre as duas (decisão 29).
 */
export function ReportScoreCard({ template, responses, previousVisit, isIlpi, recurringCount }: {
  template: ChecklistTemplate;
  responses: InspectionResponse[];
  previousVisit: PreviousVisitScore | null;
  isIlpi: boolean;
  recurringCount: number;
}) {
  const areas = calculateAreaScores(responses, template.sections);
  const score = areas.global;
  const tinta = classificationInk(score.classification);
  const split = isIlpi && areas.isSplit;
  const dateLabel = previousVisit?.inspectionDate.toLocaleDateString('pt-BR');

  return (
    <Card>
      <div className="border-b border-default px-5 py-3.5">
        <h2 className="text-sm font-semibold text-navy">Resultado</h2>
      </div>
      <div className="px-5 py-6 text-center">
        <p className="font-title text-[3.25rem] font-semibold leading-none tabular-nums" style={{ color: tinta }}>
          {Math.round(score.scorePercentage)}<span className="text-2xl">%</span>
        </p>
        <p className="mt-3">
          <Badge variant="neutral" className={`uppercase ${classificationBadgeClasses(score.classification)}`}>
            {classificationLabel(score.classification)}
          </Badge>
        </p>
        {previousVisit && (
          <p className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm text-navy-2">
            <DeltaChip size="lg" current={score.scorePercentage} previous={previousVisit.global} />
            <span>
              {Math.abs(Math.round(score.scorePercentage) - Math.round(previousVisit.global)) === 1 ? 'ponto' : 'pontos'}
              {' '}em relação a {dateLabel}, que fechou em{' '}
              <strong className="tabular-nums">{Math.round(previousVisit.global)}%</strong>
            </span>
          </p>
        )}
      </div>
      <div className="border-t border-default">
        {split && (
          <>
            <div className="flex items-center gap-3 border-b border-default px-5 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-navy-2">
                {areas.sanitary.areaLabel}
                {areas.sanitary.consultant && <span className="text-navy-3"> · {areas.sanitary.consultant.split(/\s+/)[0]}</span>}
              </span>
              <span className="font-semibold tabular-nums text-navy">{Math.round(areas.sanitary.score.scorePercentage)}%</span>
              {previousVisit?.sanitary !== undefined && (
                <DeltaChip current={areas.sanitary.score.scorePercentage} previous={previousVisit.sanitary} />
              )}
            </div>
            <div className="flex items-center gap-3 border-b border-default px-5 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-navy-2">
                {areas.nutrition.areaLabel}
                {areas.nutrition.consultant && <span className="text-navy-3"> · {areas.nutrition.consultant.split(/\s+/)[0]}</span>}
              </span>
              <span className="font-semibold tabular-nums text-navy">{Math.round(areas.nutrition.score.scorePercentage)}%</span>
              {previousVisit?.nutrition !== undefined && (
                <DeltaChip current={areas.nutrition.score.scorePercentage} previous={previousVisit.nutrition} />
              )}
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-b border-default px-5 py-2">
          <span className="text-sm text-navy-2">Não conformidades críticas</span>
          <span className="font-semibold tabular-nums text-danger-soft-ink">{score.criticalNotCompliesCount}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-2">
          <span className="text-sm text-navy-2">Reincidentes da visita anterior</span>
          <span className="font-semibold tabular-nums text-navy">{recurringCount}</span>
        </div>
      </div>
    </Card>
  );
}
