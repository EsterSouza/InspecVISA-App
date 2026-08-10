import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { PortalQuickActions } from '../../components/client/PortalQuickActions';

const unit = (id: string, name: string, url: string | null) => ({
  client_id: id,
  client_name: name,
  city: null,
  state: null,
  has_personalized_sanitary_folder: true,
  personalized_sanitary_folder_url: url,
  visits: [],
});

function renderActions(overrides: Partial<ComponentProps<typeof PortalQuickActions>> = {}) {
  const onAudit = vi.fn();
  render(
    <MemoryRouter>
      <PortalQuickActions
        enabled
        mainDriveFolderUrl="https://drive.google.com/main"
        tutorialPdfUrl="https://example.com/tutorial.pdf"
        supportWhatsapp="+55 21 99999-9999"
        schedulingSuspended={false}
        units={[unit('unit-a', 'Unidade A', 'https://drive.google.com/unit-a'), unit('unit-b', 'Unidade B', 'https://drive.google.com/unit-b')]}
        onAudit={onAudit}
        {...overrides}
      />
    </MemoryRouter>
  );
  return onAudit;
}

describe('P360-003 - PortalQuickActions', () => {
  test('mostra as ações na ordem definida e leva as pastas por unidade para a página dedicada', () => {
    renderActions();
    const labels = screen.getAllByRole('link').map((link) => link.textContent);
    expect(labels).toEqual([
      expect.stringContaining('Abrir pasta principal completa'),
      expect.stringContaining('Pastas sanitárias personalizadas (2 unidades)'),
      expect.stringContaining('Abrir tutorial do portal (PDF)'),
      expect.stringContaining('Agendar horário com as consultoras'),
      expect.stringContaining('Falar com a consultoria'),
    ]);
    const pastasLink = screen.getByText(/Pastas sanitárias personalizadas/).closest('a');
    expect(pastasLink).toHaveAttribute('href', '/cliente/pastas');
    for (const link of screen.getAllByRole('link').filter((link) => link.getAttribute('target') === '_blank')) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('unidade única leva direto ao nome da unidade, sem a página de lista', () => {
    renderActions({ units: [unit('unit-a', 'Unidade A', 'https://drive.google.com/unit-a')] });
    const pastasLink = screen.getByText(/Abrir Pasta Sanitária Personalizada — Unidade A/).closest('a');
    expect(pastasLink).toHaveAttribute('href', '/cliente/pastas');
  });

  test('oculta configurações inválidas sem criar auditoria negativa', () => {
    const onAudit = renderActions({
      mainDriveFolderUrl: 'http://example.com/main',
      tutorialPdfUrl: 'not-a-url',
      supportWhatsapp: 'inválido',
      units: [unit('unit-a', 'Unidade A', 'javascript:alert(1)')],
    });
    expect(screen.queryByText(/Abrir pasta principal completa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pasta Sanitária Personalizada/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tutorial do portal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Falar com a consultoria/)).not.toBeInTheDocument();
    expect(screen.getByText('Agendar horário com as consultoras')).toBeInTheDocument();
    expect(onAudit).not.toHaveBeenCalled();
  });

  test('não mostra um CTA de agendamento quando a conta está suspensa', () => {
    renderActions({ schedulingSuspended: true });
    expect(screen.queryByText('Agendar horário com as consultoras')).not.toBeInTheDocument();
  });

  test('audita cliques sem incluir URLs completas', () => {
    const onAudit = renderActions();
    fireEvent.click(screen.getByText(/Abrir pasta principal completa/));
    fireEvent.click(screen.getByText(/Pastas sanitárias personalizadas/));
    fireEvent.click(screen.getByText(/tutorial do portal/));
    fireEvent.click(screen.getByText('Agendar horário com as consultoras'));
    fireEvent.click(screen.getByText('Falar com a consultoria'));

    expect(onAudit).toHaveBeenNthCalledWith(1, 'main_drive_folder_opened');
    expect(onAudit).toHaveBeenNthCalledWith(2, 'sanitary_folders_page_opened', { unit_count: 2 });
    expect(onAudit).toHaveBeenNthCalledWith(3, 'portal_tutorial_opened');
    expect(onAudit).toHaveBeenNthCalledWith(4, 'schedule_cta_clicked', { source: 'quick_actions' });
    expect(onAudit).toHaveBeenNthCalledWith(5, 'support_whatsapp_clicked');
    expect(JSON.stringify(onAudit.mock.calls)).not.toContain('https://');
  });
});
