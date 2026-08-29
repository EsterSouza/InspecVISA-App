import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ContractTimeline } from '../../components/portal/ContractTimeline';
import type { ClientPortalUnit, ClientPortalVisit } from '../../services/clientPortalService';

function visit(overrides: Partial<ClientPortalVisit> = {}): ClientPortalVisit {
  return {
    public_token: 'token-1',
    unit_name: 'Unidade A',
    status: 'confirmed',
    appointment_type: 'inspection',
    requested_date: '2026-08-15',
    requested_time: '10:00',
    report_due_at: null,
    report_delivered_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function unit(overrides: Partial<ClientPortalUnit> = {}): ClientPortalUnit {
  return {
    client_id: 'unit-a',
    client_name: 'Unidade A',
    city: null,
    state: null,
    has_personalized_sanitary_folder: false,
    has_audit_service: false,
    has_online_followup: false,
    visits: [],
    ...overrides,
  };
}

describe('ContractTimeline — P360-008', () => {
  test('marco de auditoria so aparece quando has_audit_service e true', () => {
    render(<ContractTimeline unit={unit({ has_audit_service: false })} />);
    expect(screen.queryByText('Auditoria')).not.toBeInTheDocument();

    render(<ContractTimeline unit={unit({ has_audit_service: true })} />);
    expect(screen.getByText('Auditoria')).toBeInTheDocument();
  });

  test('marco de acompanhamento online so aparece quando has_online_followup e true', () => {
    render(<ContractTimeline unit={unit({ has_online_followup: false })} />);
    expect(screen.queryByText('Acompanhamento online')).not.toBeInTheDocument();

    render(<ContractTimeline unit={unit({ has_online_followup: true })} />);
    expect(screen.getByText('Acompanhamento online')).toBeInTheDocument();
  });

  test('pasta sanitaria personalizada nao mostra data ficticia, so o estado concluido', () => {
    render(<ContractTimeline unit={unit({ has_personalized_sanitary_folder: true })} />);
    expect(screen.getByText('Pasta Sanitária Personalizada')).toBeInTheDocument();
    expect(screen.getByText('Concluída')).toBeInTheDocument();
  });

  test('inspecao sempre aparece e usa a proxima data prevista da visita ativa', () => {
    render(
      <ContractTimeline
        unit={unit({
          visits: [visit({ appointment_type: 'inspection', status: 'confirmed', requested_date: '2026-09-01' })],
        })}
      />
    );
    expect(screen.getByText('Inspeção')).toBeInTheDocument();
    expect(screen.getByText(/Previsto: 01\/09\/2026/)).toBeInTheDocument();
  });

  test('marco de auditoria contratado sem nenhuma visita ainda nao mostra data', () => {
    render(<ContractTimeline unit={unit({ has_audit_service: true, visits: [] })} />);
    expect(screen.getByText('Auditoria')).toBeInTheDocument();
    // Inspeção (sempre presente) também não tem data ainda — duas linhas "sem data prevista".
    expect(screen.getAllByText('Sem data prevista').length).toBeGreaterThanOrEqual(1);
  });

  test('PORT-07 — auditoria gera relatorio, e o marco do relatorio conta com ela', () => {
    render(
      <ContractTimeline
        unit={unit({
          has_audit_service: true,
          visits: [visit({
            appointment_type: 'audit',
            status: 'confirmed',
            requested_date: '2026-09-10',
            report_due_at: '2026-09-20',
          })],
        })}
      />
    );

    // Antes o marco do relatório filtrava a palavra 'inspection' e a auditoria ficava de fora:
    // a visita entregava relatório e o cronograma dizia que não havia nada previsto.
    expect(screen.getByText('Relatório')).toBeInTheDocument();
    expect(screen.getByText(/Previsto: 20\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Previsto: 10\/09\/2026/)).toBeInTheDocument();
  });

  test('cliente sem nenhum marco extra nao renderiza nada alem de inspecao/relatorio', () => {
    render(<ContractTimeline unit={unit()} />);
    expect(screen.queryByText('Auditoria')).not.toBeInTheDocument();
    expect(screen.queryByText('Acompanhamento online')).not.toBeInTheDocument();
    expect(screen.queryByText('Pasta Sanitária Personalizada')).not.toBeInTheDocument();
  });
});
