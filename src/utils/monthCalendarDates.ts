// Matemática de mês (grade de segunda a sexta) para o MonthCalendar
// (src/components/ui/MonthCalendar.tsx) — irmã de weekCalendarDates.ts, e
// reaproveita dela a semana que começa na segunda.

import { addDays, mondayOf } from './weekCalendarDates';

export function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(month: Date, amount: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Dias da grade do mês, **de segunda a sexta** — a agenda da consultoria não
 * tem fim de semana, decisão que já valia no `WeekCalendar` (régua seg-sex).
 * Semana cujos cinco dias caem todos fora do mês exibido não entra.
 */
export function buildMonthGrid(month: Date): Date[] {
  const first = firstOfMonth(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let weekStart = mondayOf(first); weekStart <= last; weekStart = addDays(weekStart, 7)) {
    const week = Array.from({ length: 5 }, (_, index) => addDays(weekStart, index));
    if (week.some((day) => isSameMonth(day, month))) days.push(...week);
  }
  return days;
}

export function formatMonthLabel(month: Date): string {
  return month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function formatDayLong(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}
