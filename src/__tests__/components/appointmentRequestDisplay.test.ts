import { describe, expect, test } from 'vitest';
import type { AppointmentRequest, Client } from '../../types';
import { shouldShowIlpiAreaScores } from '../../utils/clientCategory';

const request = { client_id: 'client-a', appointment_type: 'inspection' } as AppointmentRequest;

describe('painel de solicitacoes por categoria do cliente', () => {
  test('mostra score por area somente para cliente ILPI vinculado', () => {
    expect(shouldShowIlpiAreaScores(request, [
      { id: 'client-a', category: 'ilpi' } as Client,
    ])).toBe(true);

    expect(shouldShowIlpiAreaScores(request, [
      { id: 'client-a', category: 'estetica' } as Client,
    ])).toBe(false);

    expect(shouldShowIlpiAreaScores(request, [])).toBe(false);

    expect(shouldShowIlpiAreaScores(
      { ...request, appointment_type: 'follow_up_meeting' },
      [{ id: 'client-a', category: 'ilpi' } as Client]
    )).toBe(false);
  });
});
