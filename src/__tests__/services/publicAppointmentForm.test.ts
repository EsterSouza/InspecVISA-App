import { describe, expect, test } from 'vitest';
import { APPOINTMENT_TYPES, isAllowedAppointmentDuration } from '../../utils/appointmentType';
import {
  appointmentTypeOptionsFor,
  buildAppointmentNotes,
  defaultPublicAppointmentDuration,
  publicAppointmentDurations,
} from '../../utils/publicAppointmentForm';

describe('public appointment form rules', () => {
  test('visitante anonimo so agenda briefing, de 45 a 60 minutos', () => {
    expect(appointmentTypeOptionsFor(false).map((option) => option.value)).toEqual(['briefing']);
    expect(publicAppointmentDurations('briefing')).toEqual([45, 60]);
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

  test('PORT-07 — auditoria e acompanhamento online so entram na lista com o contrato', () => {
    // Sem contrato, a lista é a de sempre — nada de opção que o servidor vai recusar.
    expect(appointmentTypeOptionsFor(true).map((option) => option.value)).not.toContain('audit');
    expect(appointmentTypeOptionsFor(true, { has_audit_service: false }).map((o) => o.value))
      .not.toContain('audit');

    // Com a auditoria contratada, ela aparece logo depois da inspeção: é a mesma visita.
    expect(appointmentTypeOptionsFor(true, { has_audit_service: true }).map((o) => o.value))
      .toEqual(['inspection', 'audit', 'follow_up_meeting', 'results_meeting', 'document_guidance', 'training', 'other']);

    expect(appointmentTypeOptionsFor(true, { has_online_followup: true }).map((o) => o.value))
      .toContain('online_followup');

    // O canal público continua só com briefing, contrato nenhum muda isso.
    expect(appointmentTypeOptionsFor(false, { has_audit_service: true }).map((o) => o.value))
      .toEqual(['briefing']);
  });

  test('PORT-07 — auditoria herda as duracoes da inspecao', () => {
    expect(publicAppointmentDurations('audit')).toEqual(publicAppointmentDurations('inspection'));
    expect(publicAppointmentDurations('online_followup')).toEqual([45, 60, 90]);
  });

  test('meetings and guidance offer only 45, 60 or 90 minutes', () => {
    expect(publicAppointmentDurations('follow_up_meeting')).toEqual([45, 60, 90]);
    expect(publicAppointmentDurations('results_meeting')).toEqual([45, 60, 90]);
    expect(publicAppointmentDurations('document_guidance')).toEqual([45, 60, 90]);
  });

  test('training has configurable durations allowed by the domain', () => {
    expect(publicAppointmentDurations('training')).toContain(480);
    expect(defaultPublicAppointmentDuration('training')).toBe(60);
  });

  test('AGD-03 — nenhuma lista de duração oferece menos de 45 minutos', () => {
    // A tela e a regra têm de concordar: oferecer 30 min para o servidor recusar é pior do que
    // não oferecer. Por isso o teste cruza as duas.
    for (const tipo of APPOINTMENT_TYPES) {
      const opcoes = publicAppointmentDurations(tipo);
      expect(Math.min(...opcoes), `${tipo} oferece menos de 45 min`).toBeGreaterThanOrEqual(45);
      for (const minutos of opcoes) {
        expect(
          isAllowedAppointmentDuration(tipo, minutos),
          `${tipo} oferece ${minutos} min, que a regra recusa`
        ).toBe(true);
      }
    }
  });

  test('objective and observations remain distinguishable in the persisted note', () => {
    expect(buildAppointmentNotes('Alinhar pendências', 'Participação da gerente')).toBe(
      'Objetivo: Alinhar pendências\nObservações: Participação da gerente'
    );
  });
});
