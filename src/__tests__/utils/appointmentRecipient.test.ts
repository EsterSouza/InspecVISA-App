import { describe, expect, it } from 'vitest';
import { resolveAppointmentRecipient } from '../../../supabase/functions/_shared/appointmentRecipient';

describe('resolveAppointmentRecipient', () => {
  it('usa somente clients.email quando existe cliente vinculado', () => {
    expect(resolveAppointmentRecipient({
      clientId: 'client-1',
      clientEmail: 'cadastro@cliente.com',
      requestEmail: 'antigo@solicitacao.com',
    })).toEqual({ email: 'cadastro@cliente.com', source: 'client' });
  });

  it('nao faz fallback para a solicitacao quando o cliente esta sem email valido', () => {
    expect(resolveAppointmentRecipient({
      clientId: 'client-1',
      clientEmail: null,
      requestEmail: 'antigo@solicitacao.com',
    })).toEqual({ email: null, source: 'client' });
  });

  it('usa o contato provisório somente quando ainda nao existe cliente vinculado', () => {
    expect(resolveAppointmentRecipient({
      clientId: null,
      clientEmail: 'nao-deve@ser-usado.com',
      requestEmail: 'lead@solicitacao.com',
    })).toEqual({ email: 'lead@solicitacao.com', source: 'request' });
  });
});
