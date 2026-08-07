import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PortalDocuments } from '../../components/client/PortalDocuments';
import type { ClientPortalVisit } from '../../services/clientPortalService';

function visit(overrides: Partial<ClientPortalVisit> = {}): ClientPortalVisit {
  return {
    public_token: 'tok',
    unit_name: 'Unidade',
    status: 'completed',
    appointment_type: 'inspection',
    requested_date: '2026-08-01',
    requested_time: null,
    report_due_at: null,
    report_count: 0,
    photo_count: 0,
    attachment_count: 0,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('P360-009 - PortalDocuments', () => {
  test('soma relatórios, fotos e anexos de todas as visitas', () => {
    render(
      <PortalDocuments
        visits={[
          visit({ report_count: 2, photo_count: 5, attachment_count: 1 }),
          visit({ report_count: 1, photo_count: 0, attachment_count: 3 }),
        ]}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('mostra estado vazio quando não há nenhum documento', () => {
    render(<PortalDocuments visits={[visit()]} />);
    expect(screen.getByText(/Nenhum relatório, foto ou anexo disponível ainda/)).toBeInTheDocument();
  });

  test('mostra estado vazio com lista de visitas vazia (conta sem unidades)', () => {
    render(<PortalDocuments visits={[]} />);
    expect(screen.getByText(/Nenhum relatório, foto ou anexo disponível ainda/)).toBeInTheDocument();
  });

  test('mostra skeleton durante o carregamento, sem contar nada', () => {
    const { container } = render(<PortalDocuments visits={[visit({ report_count: 4 })]} loading />);
    expect(screen.queryByText('4')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
