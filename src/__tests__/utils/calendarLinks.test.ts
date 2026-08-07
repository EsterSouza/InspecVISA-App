import { describe, expect, test } from 'vitest';
import { buildGoogleCalendarLink, buildOutlookCalendarLink } from '../../utils/calendarLinks';

const INPUT = {
  subject: 'Inspeção',
  startsAt: '2026-08-10T12:00:00.000Z',
  endsAt: '2026-08-10T13:00:00.000Z',
  location: 'Barra da Tijuca',
  meetingUrl: 'https://meet.example.com/abc',
};

const SANITARY_TERMS = ['nc_items', 'compliance_score', 'report_due_at', 'sanitary_score', 'nutrition_score', 'internal_notes'];

describe('calendarLinks.ts — P360-008', () => {
  test('link do Google Calendar aponta para o dominio correto e carrega assunto/local', () => {
    const url = buildGoogleCalendarLink(INPUT);
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    const params = new URL(url).searchParams;
    expect(params.get('text')).toBe('Inspeção');
    expect(params.get('location')).toBe('Barra da Tijuca');
  });

  test('link do Outlook aponta para o dominio correto e carrega assunto/local', () => {
    const url = buildOutlookCalendarLink(INPUT);
    expect(url).toMatch(/^https:\/\/outlook\.office\.com\/calendar\/0\/deeplink\/compose\?/);
    expect(url).toContain(encodeURIComponent('Inspeção'));
  });

  test('nenhum link carrega campo sanitario interno', () => {
    for (const url of [buildGoogleCalendarLink(INPUT), buildOutlookCalendarLink(INPUT)]) {
      for (const term of SANITARY_TERMS) {
        expect(url).not.toContain(term);
      }
    }
  });
});
