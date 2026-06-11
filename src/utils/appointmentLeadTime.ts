export const MIN_APPOINTMENT_LEAD_MS = 24 * 60 * 60 * 1000;

export function getMinAppointmentDateTime(now = new Date()): Date {
  return new Date(now.getTime() + MIN_APPOINTMENT_LEAD_MS);
}

export function isAppointmentAtLeast24hAhead(value: Date | string, now = new Date()): boolean {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() >= getMinAppointmentDateTime(now).getTime();
}

export function formatAppointmentLeadTimeMessage(): string {
  return 'O agendamento precisa ter pelo menos 24 horas de antecedencia.';
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
