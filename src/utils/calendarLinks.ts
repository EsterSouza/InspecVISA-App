/**
 * Links de "adicionar ao calendário" (Google/Outlook) para o portal do cliente.
 * Título/descrição só podem carregar dado voltado ao cliente — nunca NC, score,
 * prazo de relatório ou qualquer campo sanitário interno.
 */

export interface CalendarLinkInput {
  subject: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  meetingUrl?: string | null;
}

function toGoogleUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildDescription(meetingUrl?: string | null): string {
  return meetingUrl ? `Link da reunião: ${meetingUrl}` : '';
}

export function buildGoogleCalendarLink(input: CalendarLinkInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.subject,
    dates: `${toGoogleUtc(input.startsAt)}/${toGoogleUtc(input.endsAt)}`,
    details: buildDescription(input.meetingUrl),
    location: input.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarLink(input: CalendarLinkInput): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: input.subject,
    startdt: new Date(input.startsAt).toISOString(),
    enddt: new Date(input.endsAt).toISOString(),
    body: buildDescription(input.meetingUrl),
    location: input.location || '',
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
