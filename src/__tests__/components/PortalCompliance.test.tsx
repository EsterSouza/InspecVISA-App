import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PortalCompliance } from '../../components/client/PortalCompliance';
import type { ClientPortalUnit } from '../../services/clientPortalService';

function unit(id: string, name: string, scores: number[]): ClientPortalUnit {
  return {
    client_id: id,
    client_name: name,
    city: null,
    state: null,
    visits: scores.map((score, index) => ({
      public_token: `${id}-${index}`,
      unit_name: name,
      status: 'completed',
      appointment_type: 'inspection',
      requested_date: `2026-0${index + 1}-01`,
      requested_time: null,
      report_due_at: null,
      report_delivered_at: null,
      compliance_score: score,
      created_at: '2026-01-01T00:00:00Z',
    })),
  };
}

describe('P360-009 - PortalCompliance', () => {
  test('não renderiza nada quando nenhuma visita tem score', () => {
    const { container } = render(<PortalCompliance units={[unit('a', 'Unidade A', [])]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('calcula a média geral e ordena unidades da pior para a melhor', () => {
    render(
      <PortalCompliance
        units={[unit('a', 'Unidade A', [90]), unit('b', 'Unidade B', [50])]}
      />
    );
    expect(screen.getByText(/Média 70%/)).toBeInTheDocument();
    const names = screen.getAllByText(/Unidade [AB]/).map((el) => el.textContent);
    expect(names).toEqual(['Unidade B', 'Unidade A']);
  });

  test('conta com uma única unidade ainda mostra a seção', () => {
    render(<PortalCompliance units={[unit('a', 'Unidade A', [80])]} />);
    expect(screen.getByText(/Conformidade da rede/)).toBeInTheDocument();
  });

  test('conta sem unidades não renderiza nada', () => {
    const { container } = render(<PortalCompliance units={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
