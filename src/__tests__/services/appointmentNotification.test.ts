import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentRequest } from '../../types';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    storage: { from: vi.fn() },
    functions: { invoke },
  },
}));

vi.mock('../../utils/localScope', () => ({
  getActiveTenantId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}));

import { AppointmentAdminService } from '../../services/appointmentAdminService';

describe('EMAIL-01 - notificacao de compromisso', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({
      data: {
        ok: true,
        deliveryStatus: 'sent',
        emailSent: true,
        recipientMasked: 'c•••••@example.com',
        whatsappSent: false,
      },
      error: null,
    });
  });

  it('nao permite que o navegador escolha destinatario nem URL do portal', async () => {
    await AppointmentAdminService.notifyAppointmentEvent('request-1', 'confirmed');

    expect(invoke).toHaveBeenCalledWith('notify-appointment-event', {
      body: {
        appointmentRequestId: 'request-1',
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        eventType: 'confirmed',
      },
    });
    expect(JSON.stringify(invoke.mock.calls)).not.toMatch(/portalUrl|recipient|email/i);
  });

  it('reenvia pelo mesmo evento e deixa a deduplicacao para o servidor', async () => {
    await AppointmentAdminService.retryAppointmentConfirmation({
      id: 'request-2',
      status: 'rescheduled',
    } as AppointmentRequest);

    expect(invoke.mock.calls[0][1].body).toMatchObject({
      appointmentRequestId: 'request-2',
      eventType: 'rescheduled',
    });
  });
});
