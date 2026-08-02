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
    expect([30, 60, 90].every((minutes) =>
      isAllowedAppointmentDuration('follow_up_meeting', minutes))).toBe(true);
    expect(isAllowedAppointmentDuration('document_guidance', 45)).toBe(false);
    expect(isAllowedAppointmentDuration('training', 240)).toBe(true);
    expect(isAllowedAppointmentDuration('training', 245)).toBe(false);
    expect(isAllowedAppointmentDuration('inspection', 90)).toBe(true);
    expect(() => assertAppointmentDuration('results_meeting', 120))
      .toThrow('Duração inválida');
  });
});
