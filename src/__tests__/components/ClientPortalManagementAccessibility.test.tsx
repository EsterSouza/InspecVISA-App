import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, test, vi } from 'vitest';
import { ClientPortalManagement } from '../../components/clients/ClientPortalManagement';
import type { ClientPortalAccountRow } from '../../services/appointmentAdminService';
import type { Client } from '../../types';

function account(overrides: Partial<ClientPortalAccountRow> = {}): ClientPortalAccountRow {
  return {
    id: 'acc-1',
    name: 'Rede Sênior — Matriz',
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

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Unidade Centro',
    category: 'ilpi',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    tenantId: 'tenant-1',
    localActorId: 'actor-1',
    syncStatus: 'synced',
    ...overrides,
  } as Client;
}

describe('P360-014 — decomposição e acessibilidade de ClientPortalManagement', () => {
  test('lista de acessos do portal não tem violações críticas de WCAG A/AA', async () => {
    const { container } = render(
      <ClientPortalManagement accounts={[account()]} clients={[client()]} onChanged={vi.fn()} />
    );
    expect(screen.getByText('Rede Sênior — Matriz')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('ícones de ação por conta têm nome acessível', () => {
    render(<ClientPortalManagement accounts={[account()]} clients={[client()]} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Acesso do portal de Rede Sênior/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pagamento de Rede Sênior/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remover acesso de Rede Sênior/ })).toBeInTheDocument();
  });

  test('estado vazio não tem violações críticas', async () => {
    const { container } = render(<ClientPortalManagement accounts={[]} clients={[]} onChanged={vi.fn()} />);
    expect(screen.getByText('Nenhum acesso criado ainda.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
