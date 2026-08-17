import React from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Minus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { calculateAreaScores, classificationBadgeClasses, classificationColor, classificationInk, classificationLabel } from '../../utils/scoring';
import type { PreviousVisitScore } from '../../utils/previousVisitScore';
import type { ChecklistTemplate, InspectionResponse } from '../../types';

/** Não conformidade sem texto: qual item e qual campo falta. */
export interface MissingText {
  itemId: string;
  order: number;
  description: string;
  missing: 'situation' | 'action' | 'both';
}

const MISSING_LABEL: Record<MissingText['missing'], React.ReactNode> = {
  situation: <>falta a <strong>situação</strong></>,
  action: <>falta a <strong>ação</strong></>,
  both: <>faltam <strong>situação e ação</strong></>,
};

/**
 * A diferença é em PONTOS percentuais, e vai em três canais: a seta (forma), a
 * cor e a palavra escrita. Decisão 29 do FE-23.
 */
function Delta({ current, previous, when, compact }: {
  current: number;
  previous: number;
  when?: string;
  compact?: boolean;
}) {
  const diff = Math.round(current) - Math.round(previous);
  const dir = diff > 0 ? 'sobe' : diff < 0 ? 'desce' : 'igual';
  const Icon = dir === 'sobe' ? ArrowUp : dir === 'desce' ? ArrowDown : Minus;
  const tone = dir === 'sobe' ? 'text-success-soft-ink' : dir === 'desce' ? 'text-danger-soft-ink' : 'text-navy-2';
  const palavra = dir === 'sobe' ? 'melhor que a visita anterior'
    : dir === 'desce' ? 'pior que a visita anterior'
    : 'igual à visita anterior';

  if (compact) {
    return (
      <p className={`mt-1 flex items-center gap-1.5 text-xs ${tone}`}>
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="font-semibold tabular-nums">
          {diff > 0 ? '+' : diff < 0 ? '−' : ''}{Math.abs(diff)}
        </span>
        <span className="text-navy-3">era {Math.round(previous)}%{when ? ` em ${when}` : ''}</span>
      </p>
    );
  }

  return (
    <p className={`mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm ${tone}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold tabular-nums">
        {diff > 0 ? '+' : diff < 0 ? '−' : ''}{Math.abs(diff)} {Math.abs(diff) === 1 ? 'ponto' : 'pontos'}
      </span>
      <span>{palavra}</span>
    </p>
  );
}

interface ExecutionScorePanelProps {
  template: ChecklistTemplate;
  responses: InspectionResponse[];
  previousVisit: PreviousVisitScore | null;
  isIlpi: boolean;
  isCompleted: boolean;
  missingText: MissingText[];
  photoQueueCount?: number;
  onGoToItem: (itemId: string) => void;
  onGoToFirstUnanswered: () => void;
}

export function ExecutionScorePanel({
  template,
  responses,
  previousVisit,
  isIlpi,
  isCompleted,
  missingText,
  photoQueueCount = 0,
  onGoToItem,
  onGoToFirstUnanswered,
}: ExecutionScorePanelProps) {
  const areas = calculateAreaScores(responses, template.sections);
  const score = areas.global;
  const pct = Math.round(score.scorePercentage);
  const tinta = classificationInk(score.classification);
  const unanswered = score.totalItems - score.evaluatedItems;
  const dateLabel = previousVisit?.inspectionDate.toLocaleDateString('pt-BR');

  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b border-gray-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-navy">
            {isCompleted ? 'Resultado' : 'Resultado parcial'}
          </h2>
        </div>
        <div className="px-5 pb-4 pt-5 text-center">
          <p className="font-title text-[2.75rem] font-semibold leading-none tabular-nums" style={{ color: tinta }}>
            {pct}<span className="text-xl">%</span>
          </p>
          <p className="mt-2">
            <Badge variant="neutral" className={`uppercase ${classificationBadgeClasses(score.classification)}`}>
              {classificationLabel(score.classification)}
            </Badge>
          </p>

          {previousVisit && (
            <>
              <Delta current={score.scorePercentage} previous={previousVisit.global} />
              <p className="mt-2 text-sm text-navy-3">
                Visita de <span className="tabular-nums">{dateLabel}</span>:{' '}
                <strong className="tabular-nums text-navy-2">{Math.round(previousVisit.global)}%</strong>
                {' '}— {previousVisit.classificationLabel}
              </p>
              {!isCompleted && (
                <p className="mt-3 text-xs text-navy-3">
                  {score.evaluatedItems} de {score.totalItems} itens respondidos.
                </p>
              )}
            </>
          )}
        </div>
        <div className="border-t border-gray-200">
          {[
            ['Cumpre', score.compliesCount, 'text-navy'],
            ['Não cumpre', score.notCompliesCount, 'text-danger-soft-ink'],
            ['Não se aplica', score.notApplicableCount, 'text-navy'],
            ['Não observado', score.notObservedCount, 'text-navy'],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="flex items-center justify-between border-b border-gray-100 px-5 py-2 last:border-b-0">
              <span className="text-sm text-navy-2">{label}</span>
              <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Por área — só em ILPI, a única categoria com nutrição interna. Cada área
          compara com a MESMA área da visita anterior. */}
      {isIlpi && areas.isSplit && (
        <Card>
          <div className="border-b border-gray-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-navy">Por área</h2>
          </div>
          <div className="space-y-4 p-5">
            {([
              [areas.sanitary, previousVisit?.sanitary] as const,
              [areas.nutrition, previousVisit?.nutrition] as const,
            ]).map(([area, previousPct]) => {
              const areaPct = Math.round(area.score.scorePercentage);
              return (
                <div key={area.area}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-navy-2">
                      {area.areaLabel}
                      {area.consultant && <span className="text-navy-3"> · {area.consultant.split(/\s+/)[0]}</span>}
                    </span>
                    <span className="font-semibold tabular-nums text-navy">{areaPct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${areaPct}%`, backgroundColor: classificationColor(area.score.classification) }}
                    />
                  </div>
                  {previousPct !== undefined && (
                    <Delta compact current={area.score.scorePercentage} previous={previousPct} when={dateLabel} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Falta escrever — lista clicável, não contagem (decisão 30). */}
      {missingText.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-navy">Falta escrever</h2>
            <Badge variant="danger" className="tabular-nums">{missingText.length}</Badge>
          </div>
          <div>
            {missingText.map((pend) => (
              <button
                key={pend.itemId}
                type="button"
                onClick={() => onGoToItem(pend.itemId)}
                className="flex w-full items-start gap-3 border-b border-gray-100 px-5 py-3 text-left last:border-b-0 hover:bg-gray-50"
                style={{ minHeight: 44 }}
              >
                <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 text-xs font-semibold tabular-nums text-navy-2">
                  {pend.order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-navy">{pend.description}</span>
                  <span className="block text-xs text-navy-3">{MISSING_LABEL[pend.missing]}</span>
                </span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-navy-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {!isCompleted && (unanswered > 0 || photoQueueCount > 0) && (
        <Card>
          <div className="border-b border-gray-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-navy">Falta responder</h2>
          </div>
          <div>
            {unanswered > 0 && (
              <p className="border-b border-gray-100 px-5 py-2 text-sm text-navy-2">
                {unanswered} {unanswered === 1 ? 'item ainda sem resposta' : 'itens ainda sem resposta'}
              </p>
            )}
            {photoQueueCount > 0 && (
              <p className="px-5 py-2 text-sm text-navy-2">
                {photoQueueCount} {photoQueueCount === 1 ? 'foto na fila de envio' : 'fotos na fila de envio'}
              </p>
            )}
          </div>
          {unanswered > 0 && (
            <div className="border-t border-gray-200 p-3">
              <Button variant="outline" size="sm" fullWidth onClick={onGoToFirstUnanswered}>
                Ir para o primeiro sem resposta
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
