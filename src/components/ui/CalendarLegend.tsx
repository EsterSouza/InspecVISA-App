import React from 'react';
import { cn } from '../../lib/utils';
import { STATE_DOT_CLASSES, STATE_LABELS, type CalendarEventState } from './calendarEventState';

/**
 * Legenda de estado do compromisso, igual no mes e na semana: o canal "palavra"
 * do trio cor/forma/palavra exigido pelo Manual de Marca 2.0.
 */
export function CalendarLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-4 border-t border-default px-4 py-3 text-xs text-navy-2', className)}>
      {(['confirmado', 'a-confirmar', 'atencao'] as CalendarEventState[]).map((state) => (
        <span key={state} className="inline-flex items-center gap-2">
          <span className={cn('h-3 w-3 rounded-sm border', STATE_DOT_CLASSES[state])} />
          {STATE_LABELS[state]}
        </span>
      ))}
    </div>
  );
}
