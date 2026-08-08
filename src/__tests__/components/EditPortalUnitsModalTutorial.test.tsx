import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach } from 'vitest';

const { updatePortalAccount, setPortalAccountClients } = vi.hoisted(() => ({
  updatePortalAccount: vi.fn(),
  setPortalAccountClients: vi.fn(),
}));

vi.mock('../../services/appointmentAdminService', () => ({
  AppointmentAdminService: { updatePortalAccount, setPortalAccountClients },
}));

import { EditPortalUnitsModal } from '../../components/clients/portal/EditPortalUnitsModal';
import type { ClientPortalAccountRow } from '../../services/appointmentAdminService';
import type { Client } from '../../types';

function account(overrides: Partial<ClientPortalAccountRow> = {}): ClientPortalAccountRow {
  return {
    id: 'acc-1',
    name: 'Rede Sênior',
    email: 'contato@redesenior.com.br',
    username: null,
    portal_token: 'portal-token-1',
    access_code_plain: null,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    client_ids: ['client-1'],
    payment_type: 'monthly',
    payment_status: 'paid',
    payment_link: null,
    payment_links: [],
    payment_due_date: null,
    scheduling_suspended: false,
    scheduling_suspension_mode: 'auto',
    main_drive_folder_url: null,
    tutorial_pdf_url: null,
    ...overrides,
  };
}

const clients = [{
  id: 'client-1',
  name: 'Unidade Centro',
  category: 'ilpi',
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  tenantId: 'tenant-1',
  localActorId: 'actor-1',
  syncStatus: 'synced',
} as unknown as Client];

describe('PORT-04 — tutorial por conta do portal', () => {
  beforeEach(() => {
    updatePortalAccount.mockReset().mockResolvedValue(undefined);
    setPortalAccountClients.mockReset().mockResolvedValue(undefined);
  });

  test('o campo existe com rótulo associado, para leitor de tela', () => {
    render(<EditPortalUnitsModal account={account()} clients={clients} onClose={vi.fn()} onSaved={vi.fn()} />);
    // `getByLabelText` só acha se `htmlFor`/`id` estiverem ligados de verdade.
    expect(screen.getByLabelText('Tutorial do portal desta conta')).toBeInTheDocument();
  });

  test('conta que já tem tutorial abre com o link preenchido', () => {
    render(
      <EditPortalUnitsModal
        account={account({ tutorial_pdf_url: 'https://exemplo.com/tutorial-rede-senior.pdf' })}
        clients={clients}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Tutorial do portal desta conta')).toHaveValue(
      'https://exemplo.com/tutorial-rede-senior.pdf'
    );
  });

  test('salvar leva o tutorial da conta junto', async () => {
    const usuario = userEvent.setup();
    render(<EditPortalUnitsModal account={account()} clients={clients} onClose={vi.fn()} onSaved={vi.fn()} />);

    await usuario.type(
      screen.getByLabelText('Tutorial do portal desta conta'),
      'https://exemplo.com/novo-tutorial.pdf'
    );
    await usuario.click(screen.getByRole('button', { name: 'Salvar acesso' }));

    expect(updatePortalAccount).toHaveBeenCalledWith('acc-1', expect.objectContaining({
      tutorialPdfUrl: 'https://exemplo.com/novo-tutorial.pdf',
    }));
  });

  test('deixar em branco salva vazio, que no banco vira herdar o padrão do tenant', async () => {
    const usuario = userEvent.setup();
    render(
      <EditPortalUnitsModal
        account={account({ tutorial_pdf_url: 'https://exemplo.com/antigo.pdf' })}
        clients={clients}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await usuario.clear(screen.getByLabelText('Tutorial do portal desta conta'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar acesso' }));

    expect(updatePortalAccount).toHaveBeenCalledWith('acc-1', expect.objectContaining({
      tutorialPdfUrl: '',
    }));
  });
});
