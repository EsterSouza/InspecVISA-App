import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, test } from 'vitest';
import { ClientPortal } from '../../pages/ClientPortal';

// Tela de login: `getStoredToken()` sem token salvo cai direto no formulário
// não-autenticado, sem precisar mockar `clientPortalService`.
describe('P360-014 — acessibilidade do login do portal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('formulário de login não tem violações críticas de WCAG A/AA', async () => {
    const { container } = render(
      <MemoryRouter>
        <ClientPortal />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Portal do Cliente' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('campos de login têm rótulo associado via htmlFor/id', () => {
    render(
      <MemoryRouter>
        <ClientPortal />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/E-mail ou usuario/)).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });
});
