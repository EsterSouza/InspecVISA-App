import React from 'react';
import { cn } from '../../lib/utils';
import { STATE_DOT_CLASSES, STATE_LABELS, type CalendarEventState } from './calendarEventState';

export interface CalendarLegendExtraItem {
  key: string;
  label: string;
  dotClassName: string;
}

/**
 * Legenda de estado do compromisso, igual no mes e na semana: o canal "palavra"
 * do trio cor/forma/palavra exigido pelo Manual de Marca 2.0.
 *
 * `extraItems` (AGD-02) acrescenta categorias de evento fora do vocabulário de estado (hoje só
 * "Marco") — só passado por quem já tem esse tipo de evento na grade, nunca incondicional.
 */
export function CalendarLegend({ className, extraItems }: { className?: string; extraItems?: CalendarLegendExtraItem[] }) {
  return (
    <div className={cn('flex flex-wrap gap-4 border-t border-default px-4 py-3 text-xs text-navy-2', className)}>
      {(['confirmado', 'a-confirmar', 'atencao'] as CalendarEventState[]).map((state) => (
        <span key={state} className="inline-flex items-center gap-2">
          <span className={cn('h-3 w-3 rounded-sm border', STATE_DOT_CLASSES[state])} />
          {STATE_LABELS[state]}
        </span>
      ))}
      {extraItems?.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-2">
          <span className={cn('h-3 w-3 rounded-sm border', item.dotClassName)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
