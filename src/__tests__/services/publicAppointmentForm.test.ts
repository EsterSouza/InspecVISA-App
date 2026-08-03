import { describe, expect, test } from 'vitest';
import {
  appointmentTypeOptionsFor,
  buildAppointmentNotes,
  defaultPublicAppointmentDuration,
  publicAppointmentDurations,
} from '../../utils/publicAppointmentForm';

describe('public appointment form rules', () => {
  test('visitante anonimo so agenda briefing, de ate 45 minutos', () => {
    expect(appointmentTypeOptionsFor(false).map((option) => option.value)).toEqual(['briefing']);
    expect(publicAppointmentDurations('briefing')).toEqual([15, 30, 45]);
  });

  test('portal autenticado mantem inspecao e as demais finalidades', () => {
    expect(appointmentTypeOptionsFor(true).map((option) => option.value)).toEqual([
      'inspection',
      'follow_up_meeting',
      'results_meeting',
      'document_guidance',
      'training',
      'other',
    ]);
  });

  test('meetings and guidance offer only 30, 60 or 90 minutes', () => {
    expect(publicAppointmentDurations('follow_up_meeting')).toEqual([30, 60, 90]);
    expect(publicAppointmentDurations('results_meeting')).toEqual([30, 60, 90]);
    expect(publicAppointmentDurations('document_guidance')).toEqual([30, 60, 90]);
  });

  test('training has configurable durations allowed by the domain', () => {
    expect(publicAppointmentDurations('training')).toContain(480);
    expect(defaultPublicAppointmentDuration('training')).toBe(30);
  });

  test('objective and observations remain distinguishable in the persisted note', () => {
    expect(buildAppointmentNotes('Alinhar pendências', 'Participação da gerente')).toBe(
      'Objetivo: Alinhar pendências\nObservações: Participação da gerente'
    );
  });
});
