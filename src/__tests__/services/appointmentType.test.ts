import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AppointmentRequest } from '../../types';
import {
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_RULES,
  assertAppointmentDuration,
  assertInspectionAppointment,
  isAllowedAppointmentDuration,
  normalizeAppointmentType,
} from '../../utils/appointmentType';

const { scheduleGet, storageFrom } = vi.hoisted(() => ({
  scheduleGet: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: storageFrom },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../utils/localScope', () => ({
  getActiveTenantId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  belongsToActiveTenant: () => true,
  filterByActiveTenant: <T>(items: T[]) => items,
}));

vi.mock('../../db/database', () => ({
  db: { schedules: { get: scheduleGet } },
}));

import { AppointmentAdminService, mapAppointmentRequest } from '../../services/appointmentAdminService';
import { mapFromPostgres, ScheduleService } from '../../services/scheduleService';

function request(appointmentType: AppointmentRequest['appointment_type']): AppointmentRequest {
  return {
    id: 'request-a',
    appointment_type: appointmentType,
  } as AppointmentRequest;
}

describe('P360-004 - dominio de compromissos', () => {
  beforeEach(() => {
    scheduleGet.mockReset();
    storageFrom.mockReset();
  });

  test('aceita somente o vocabulario controlado e centraliza suas regras', () => {
    expect(APPOINTMENT_TYPES).toEqual([
      'inspection',
      'follow_up_meeting',
      'results_meeting',
      'document_guidance',
      'training',
      'other',
      'briefing',
      'audit',
      'online_followup',
    ]);
    for (const type of APPOINTMENT_TYPES) {
      expect(normalizeAppointmentType(type)).toBe(type);
      expect(APPOINTMENT_TYPE_RULES[type].label).not.toBe('');
    }
    expect(() => normalizeAppointmentType('unknown')).toThrow('Tipo de compromisso inválido');
  });

  test('le campos nulos ou ausentes do rollout como inspection', () => {
    expect(normalizeAppointmentType(null)).toBe('inspection');
    expect(mapAppointmentRequest({ id: 'legacy', appointment_type: null }).appointment_type)
      .toBe('inspection');
    expect(mapFromPostgres({
      id: 'legacy-schedule',
      client_id: 'client-a',
      scheduled_at: '2026-08-01T12:00:00Z',
      status: 'pending',
      appointment_type: null,
    }).appointmentType).toBe('inspection');
  });

  test('rejeita efeitos sanitarios antes de iniciar inspecao ou subir relatorio', async () => {
    const meeting = request('follow_up_meeting');

    expect(() => assertInspectionAppointment(meeting.appointment_type, 'iniciar uma inspeção'))
      .toThrow('Somente compromissos de inspeção');
    await expect(AppointmentAdminService.markInProgress(meeting))
      .rejects.toThrow('Somente compromissos de inspeção');
    await expect(AppointmentAdminService.publishReport(
      meeting,
      new File(['pdf'], 'relatorio.pdf', { type: 'application/pdf' })
    )).rejects.toThrow('Somente compromissos de inspeção');

    expect(storageFrom).not.toHaveBeenCalled();
  });

  test('schedule nao sanitario nao pode vincular ou concluir inspecao', async () => {
    scheduleGet.mockResolvedValue({ id: 'schedule-a', appointmentType: 'training' });

    await expect(ScheduleService.linkInspection('schedule-a', 'inspection-a'))
      .rejects.toThrow('Somente compromissos de inspeção');
    await expect(ScheduleService.completeWithInspection('schedule-a', 'inspection-a'))
      .rejects.toThrow('Somente compromissos de inspeção');
  });

  test('valida duracoes pelo tipo sem transformar reuniao curta em janela de quatro horas', () => {
    expect([45, 60, 90].every((minutes) =>
      isAllowedAppointmentDuration('follow_up_meeting', minutes))).toBe(true);
    expect(isAllowedAppointmentDuration('document_guidance', 75)).toBe(false);
    expect(isAllowedAppointmentDuration('training', 240)).toBe(true);
    expect(isAllowedAppointmentDuration('training', 245)).toBe(false);
    expect(isAllowedAppointmentDuration('inspection', 90)).toBe(true);
    expect(() => assertAppointmentDuration('results_meeting', 120))
      .toThrow('Duração inválida');
  });

  test('AGD-03 — nenhum tipo de compromisso aceita menos de 45 minutos', () => {
    // Pedido da Ester: nada de 15 ou 30 minutos, em tipo nenhum.
    for (const tipo of APPOINTMENT_TYPES) {
      expect(isAllowedAppointmentDuration(tipo, 15), `${tipo} aceitou 15 min`).toBe(false);
      expect(isAllowedAppointmentDuration(tipo, 30), `${tipo} aceitou 30 min`).toBe(false);
      expect(isAllowedAppointmentDuration(tipo, 44), `${tipo} aceitou 44 min`).toBe(false);
    }

    // 45 é o piso e passa em todo tipo, menos treinamento — que anda de 30 em 30 e começa em 60.
    for (const tipo of APPOINTMENT_TYPES.filter((t) => t !== 'training')) {
      expect(isAllowedAppointmentDuration(tipo, 45), `${tipo} recusou o piso de 45 min`).toBe(true);
    }
    expect(isAllowedAppointmentDuration('training', 45)).toBe(false);
    expect(isAllowedAppointmentDuration('training', 60)).toBe(true);

    // Os tetos não mudaram junto com o piso.
    expect(isAllowedAppointmentDuration('inspection', 720)).toBe(true);
    expect(isAllowedAppointmentDuration('audit', 721)).toBe(false);
    expect(isAllowedAppointmentDuration('other', 480)).toBe(true);
  });

  test('PORT-07 — auditoria e uma inspecao com outro nome, com a faixa de duracao dela', () => {
    // Se isto voltar a ser falso, a auditoria deixa de abrir roteiro, relatorio e plano de acao.
    expect(APPOINTMENT_TYPE_RULES.audit.isInspection).toBe(true);
    expect(APPOINTMENT_TYPE_RULES.audit.showsReportDueDate).toBe(true);
    expect(APPOINTMENT_TYPE_RULES.audit.usesSanitaryTimeline).toBe(true);
    expect(() => assertInspectionAppointment('audit', 'iniciar uma inspeção')).not.toThrow();

    // Uma fiscalizacao presencial nao cabe na faixa de reuniao.
    expect(isAllowedAppointmentDuration('audit', 180)).toBe(true);
    expect(isAllowedAppointmentDuration('audit', 720)).toBe(true);
    expect(isAllowedAppointmentDuration('audit', 721)).toBe(false);

    // Acompanhamento online continua sendo reuniao.
    expect(APPOINTMENT_TYPE_RULES.online_followup.isInspection).toBe(false);
    expect(isAllowedAppointmentDuration('online_followup', 180)).toBe(false);
    expect(isAllowedAppointmentDuration('online_followup', 90)).toBe(true);
  });

  test('briefing e um compromisso nao sanitario, de 45 a 60 minutos', () => {
    expect(APPOINTMENT_TYPE_RULES.briefing.isInspection).toBe(false);
    expect(APPOINTMENT_TYPE_RULES.briefing.usesSanitaryTimeline).toBe(false);
    expect([45, 60].every((minutes) =>
      isAllowedAppointmentDuration('briefing', minutes))).toBe(true);
    expect(isAllowedAppointmentDuration('briefing', 30)).toBe(false);
    expect(isAllowedAppointmentDuration('briefing', 20)).toBe(false);
    expect(isAllowedAppointmentDuration('briefing', 90)).toBe(false);
    expect(() => assertInspectionAppointment('briefing', 'iniciar uma inspeção'))
      .toThrow('Somente compromissos de inspeção');
  });
});
