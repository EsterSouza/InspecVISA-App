/**
 * Vocabulário de estado compartilhado pelas duas grades de agenda
 * (`WeekCalendar` e `MonthCalendar`): mesmas cores, mesmas palavras e mesma
 * legenda nas duas, porque é a mesma agenda vista de duas distâncias.
 *
 * Manual de Marca 2.0: estado nunca depende só da cor — vai em três canais
 * (cor de fundo, forma da borda esquerda e a palavra, na legenda e no nome
 * acessível do compromisso).
 */

export type CalendarEventState = 'confirmado' | 'a-confirmar' | 'atencao' | 'padrao';

export const STATE_LABELS: Record<CalendarEventState, string> = {
  confirmado: 'Confirmado',
  'a-confirmar': 'A confirmar',
  atencao: 'Precisa de atenção',
  padrao: 'Agendado',
};

export const STATE_EVENT_CLASSES: Record<CalendarEventState, string> = {
  confirmado: 'border-success-soft-border border-l-success bg-success-soft text-success-soft-ink',
  'a-confirmar': 'border-default border-l-control border-l-dashed bg-surface-sunken text-navy-2',
  atencao: 'border-amber-soft-border border-l-amber bg-amber-soft text-amber-soft-ink',
  padrao: 'border-primary-200 border-l-primary-700 bg-primary-50 text-primary-900',
};

export const STATE_BADGE_VARIANT: Record<CalendarEventState, 'success' | 'neutral' | 'warning' | 'default'> = {
  confirmado: 'success',
  'a-confirmar': 'neutral',
  atencao: 'warning',
  padrao: 'default',
};

export const STATE_DOT_CLASSES: Record<CalendarEventState, string> = {
  confirmado: 'border-success bg-success-soft',
  'a-confirmar': 'border-control border-dashed bg-surface-sunken',
  atencao: 'border-amber bg-amber-soft',
  padrao: 'border-primary-700 bg-primary-50',
};
