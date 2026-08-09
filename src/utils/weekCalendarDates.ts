// Matemática de semana (seg a sex) compartilhada por qualquer agenda que usa
// o WeekCalendar (src/components/ui/WeekCalendar.tsx) — admin e portal.

export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatWeekPeriod(weekStart: Date): string {
  const friday = addDays(weekStart, 4);
  const sameMonth = weekStart.getMonth() === friday.getMonth();
  if (sameMonth) {
    return `${weekStart.getDate()} a ${friday.getDate()} de ${friday.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
  }
  return `${weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${friday.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
