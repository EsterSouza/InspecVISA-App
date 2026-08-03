import { describe, expect, test } from 'vitest';
import {
  buildAppointmentNotes,
  defaultPublicAppointmentDuration,
  publicAppointmentDurations,
} from '../../utils/publicAppointmentForm';

describe('public appointment form rules', () => {
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
