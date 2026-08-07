/**
 * Geração de arquivo .ics (RFC 5545) para o compromisso do portal do cliente.
 * Horários em UTC (sufixo Z) — evita a necessidade de um bloco VTIMEZONE e
 * representa o mesmo instante corretamente em qualquer cliente de calendário.
 */

export interface IcsAppointmentInput {
  /** appointment_requests.id — nunca muda em remarcação/cancelamento, vira o UID. */
  id: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  meetingUrl?: string | null;
  /** appointment_requests.updated_at — avança a cada update, vira o SEQUENCE. */
  updatedAt: string;
  status: 'confirmed' | 'cancelled';
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function icsSequence(updatedAtIso: string): number {
  return Math.floor(new Date(updatedAtIso).getTime() / 1000);
}

export function buildAppointmentUid(appointmentRequestId: string): string {
  return `appointment-${appointmentRequestId}@consultorasanitaria.com.br`;
}

export function buildIcs(input: IcsAppointmentInput): string {
  const isCancelled = input.status === 'cancelled';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Consultora Sanitaria//Portal do Cliente//PT-BR',
    'CALSCALE:GREGORIAN',
    `METHOD:${isCancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${buildAppointmentUid(input.id)}`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(input.startsAt)}`,
    `DTEND:${toIcsUtc(input.endsAt)}`,
    `SEQUENCE:${icsSequence(input.updatedAt)}`,
    `SUMMARY:${escapeIcsText(input.subject)}`,
    `STATUS:${isCancelled ? 'CANCELLED' : 'CONFIRMED'}`,
  ];
  if (input.location) lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  if (input.meetingUrl) lines.push(`URL:${escapeIcsText(input.meetingUrl)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
