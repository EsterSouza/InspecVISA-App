import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    report_delivered_at: null,
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
      <MemoryRouter>
        <PortalDocuments
          visits={[
            visit({ public_token: 'tok-1', report_count: 2, photo_count: 5, attachment_count: 1 }),
            visit({ public_token: 'tok-2', report_count: 1, photo_count: 0, attachment_count: 3 }),
          ]}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('mostra estado vazio quando não há nenhum documento', () => {
    render(
      <MemoryRouter>
        <PortalDocuments visits={[visit()]} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Nenhum relatório, foto ou anexo disponível ainda/)).toBeInTheDocument();
  });

  test('mostra estado vazio com lista de visitas vazia (conta sem unidades)', () => {
    render(
      <MemoryRouter>
        <PortalDocuments visits={[]} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Nenhum relatório, foto ou anexo disponível ainda/)).toBeInTheDocument();
  });

  test('mostra skeleton durante o carregamento, sem contar nada', () => {
    const { container } = render(
      <MemoryRouter>
        <PortalDocuments visits={[visit({ report_count: 4 })]} loading />
      </MemoryRouter>
    );
    expect(screen.queryByText('4')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  test('lista visitas com documento publicado, com link para a visita, ordenadas da mais recente', () => {
    render(
      <MemoryRouter>
        <PortalDocuments
          visits={[
            visit({
              public_token: 'tok-antigo',
              unit_name: 'Centro',
              report_count: 1,
              report_delivered_at: '2026-07-01T00:00:00Z',
            }),
            visit({
              public_token: 'tok-recente',
              unit_name: 'Tijuca',
              report_count: 1,
              report_delivered_at: '2026-08-01T00:00:00Z',
            }),
          ]}
        />
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link', { name: /Ver detalhes/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/cliente/visita/tok-recente');
    expect(links[1]).toHaveAttribute('href', '/cliente/visita/tok-antigo');
    expect(screen.getByText('Centro')).toBeInTheDocument();
    expect(screen.getByText('Tijuca')).toBeInTheDocument();
  });

  test('lista visita que só tem foto ou só anexo publicado, sem relatório', () => {
    render(
      <MemoryRouter>
        <PortalDocuments
          visits={[
            visit({ public_token: 'tok-fotos', unit_name: 'Só fotos', report_count: 0, photo_count: 3 }),
            visit({ public_token: 'tok-anexo', unit_name: 'Só anexo', report_count: 0, attachment_count: 1 }),
          ]}
        />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('link', { name: /Ver detalhes/ })).toHaveLength(2);
    expect(screen.getByText('Só fotos')).toBeInTheDocument();
    expect(screen.getByText('3 fotos')).toBeInTheDocument();
    expect(screen.getByText('Só anexo')).toBeInTheDocument();
    expect(screen.getByText('1 anexo')).toBeInTheDocument();
  });

  test('não lista visita sem nenhum documento publicado', () => {
    render(
      <MemoryRouter>
        <PortalDocuments visits={[visit({ report_count: 0, photo_count: 0, attachment_count: 0 })]} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('link', { name: /Ver detalhes/ })).not.toBeInTheDocument();
  });
});
