import { describe, expect, test } from 'vitest';
import { buildAppointmentUid, buildIcs } from '../../utils/ics';

const BASE_INPUT = {
  id: 'req-123',
  subject: 'Reunião de acompanhamento',
  startsAt: '2026-08-10T12:00:00.000Z',
  endsAt: '2026-08-10T13:00:00.000Z',
  updatedAt: '2026-08-06T10:00:00.000Z',
  status: 'confirmed' as const,
};

describe('ics.ts — P360-008', () => {
  test('UID e estavel para o mesmo appointment_request_id', () => {
    expect(buildAppointmentUid('req-123')).toBe(buildAppointmentUid('req-123'));
    expect(buildAppointmentUid('req-123')).not.toBe(buildAppointmentUid('req-456'));
  });

  test('SEQUENCE cresce quando updated_at avança (remarcação)', () => {
    const first = buildIcs(BASE_INPUT);
    const second = buildIcs({ ...BASE_INPUT, updatedAt: '2026-08-07T10:00:00.000Z' });
    const seqOf = (ics: string) => Number(ics.match(/SEQUENCE:(\d+)/)?.[1]);
    expect(seqOf(second)).toBeGreaterThan(seqOf(first));
  });

  test('mesmo UID em confirmação e remarcação subsequente do mesmo compromisso', () => {
    const confirmed = buildIcs(BASE_INPUT);
    const rescheduled = buildIcs({ ...BASE_INPUT, startsAt: '2026-08-11T12:00:00.000Z', endsAt: '2026-08-11T13:00:00.000Z', updatedAt: '2026-08-08T10:00:00.000Z' });
    const uidOf = (ics: string) => ics.match(/UID:(.+)/)?.[1];
    expect(uidOf(confirmed)).toBe(uidOf(rescheduled));
  });

  test('cancelamento gera METHOD:CANCEL e STATUS:CANCELLED', () => {
    const ics = buildIcs({ ...BASE_INPUT, status: 'cancelled' });
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
  });

  test('confirmação gera METHOD:REQUEST e STATUS:CONFIRMED', () => {
    const ics = buildIcs(BASE_INPUT);
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  test('escapa virgula e ponto-e-virgula no texto', () => {
    const ics = buildIcs({ ...BASE_INPUT, subject: 'Auditoria; revisão, geral' });
    expect(ics).toContain('SUMMARY:Auditoria\\; revisão\\, geral');
  });
});
