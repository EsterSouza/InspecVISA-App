import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { axe } from 'jest-axe';
import { describe, expect, test } from 'vitest';
import { PortalAppointments, type PortalAppointmentVisit } from '../../components/client/PortalAppointments';
import type { ClientPortalUnit } from '../../services/clientPortalService';

function visit(overrides: Partial<PortalAppointmentVisit> = {}): PortalAppointmentVisit {
  return {
    public_token: 'tok-1',
    unit_name: 'Unidade A',
    unitName: 'Unidade A',
    city: 'Niterói',
    status: 'confirmed',
    appointment_type: 'inspection',
    requested_date: '2026-08-15',
    requested_time: '10:00',
    report_due_at: null,
    report_delivered_at: null,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function unit(overrides: Partial<ClientPortalUnit> = {}): ClientPortalUnit {
  return {
    client_id: 'unit-a',
    client_name: 'Unidade A',
    city: null,
    state: null,
    has_personalized_sanitary_folder: true,
    visits: [],
    ...overrides,
  };
}

function renderAppointments(overrides: Partial<ComponentProps<typeof PortalAppointments>> = {}) {
  render(
    <MemoryRouter>
      <PortalAppointments visits={[]} schedulingSuspended={false} {...overrides} />
    </MemoryRouter>
  );
}

describe('P360-009 - PortalAppointments', () => {
  test('mostra estado vazio quando não há compromissos', () => {
    renderAppointments();
    expect(screen.getByText('Nenhum compromisso registrado ainda.')).toBeInTheDocument();
  });

  test('lista uma única visita corretamente', () => {
    renderAppointments({ visits: [visit()] });
    expect(screen.getByText('1 visita')).toBeInTheDocument();
    expect(screen.getByText('Unidade A')).toBeInTheDocument();
  });

  test('mostra o link da videoconferência no agendamento online', () => {
    renderAppointments({
      visits: [visit({ attendance_mode: 'online', meeting_url: 'https://meet.example.com/sala' })],
    });
    expect(screen.getByRole('link', { name: /Entrar na reunião/i })).toHaveAttribute(
      'href',
      'https://meet.example.com/sala'
    );
  });

  test('lista muitas visitas de unidades diferentes', () => {
    renderAppointments({
      visits: [visit({ public_token: 'a' }), visit({ public_token: 'b', unitName: 'Unidade B', requested_date: '2026-08-20' })],
    });
    expect(screen.getByText('2 visitas')).toBeInTheDocument();
  });

  test('mostra "Suspenso" no lugar do status quando a conta está com agendamento suspenso', () => {
    renderAppointments({ visits: [visit({ status: 'confirmed' })], schedulingSuspended: true });
    expect(screen.getByText('Agendamentos suspensos')).toBeInTheDocument();
    expect(screen.getByText('Suspenso')).toBeInTheDocument();
  });

  test('mostra skeleton durante o carregamento', () => {
    const { container } = render(
      <MemoryRouter>
        <PortalAppointments
          visits={[visit()]}
          schedulingSuspended={false}
          calendarMonth={new Date(2026, 7, 1)}
          onCalendarMonthChange={() => {}}
          loading
        />
      </MemoryRouter>
    );
    expect(screen.queryByText('Unidade A')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

describe('Datas de serviço na agenda do portal', () => {
  test('mostra o prazo de entrega do relatório quando ainda não foi publicado', () => {
    renderAppointments({ visits: [visit({ report_due_at: '2026-08-20' })] });
    expect(screen.getByText('Prazo de entrega do relatório')).toBeInTheDocument();
  });

  test('troca o prazo por "Relatório entregue" quando report_delivered_at está preenchido', () => {
    renderAppointments({
      visits: [visit({ report_due_at: '2026-08-20', report_delivered_at: '2026-08-18T14:00:00Z' })],
    });
    expect(screen.getByText('Relatório entregue')).toBeInTheDocument();
    expect(screen.queryByText('Prazo de entrega do relatório')).not.toBeInTheDocument();
  });

  test('mostra a previsão de entrega da pasta sanitária quando a unidade ainda não tem o link', () => {
    renderAppointments({
      visits: [],
      units: [unit({ personalized_sanitary_folder_expected_delivery_date: '2026-08-25' })],
    });
    expect(screen.getByText('Pasta sanitária personalizada — previsão de entrega')).toBeInTheDocument();
  });

  test('não mostra a previsão da pasta quando o link já foi preenchido (pasta entregue)', () => {
    renderAppointments({
      visits: [],
      units: [
        unit({
          personalized_sanitary_folder_expected_delivery_date: '2026-08-25',
          personalized_sanitary_folder_url: 'https://drive.google.com/personalizada',
        }),
      ],
    });
    expect(screen.queryByText('Pasta sanitária personalizada — previsão de entrega')).not.toBeInTheDocument();
  });

  test('marcos de prazo/entrega não entram na contagem de "N visita(s)"', () => {
    renderAppointments({
      visits: [visit({ report_due_at: '2026-08-20' })],
      units: [unit({ personalized_sanitary_folder_expected_delivery_date: '2026-08-25' })],
    });
    expect(screen.getByText('1 visita')).toBeInTheDocument();
  });
});

describe('P360-014 — acessibilidade da agenda', () => {
  test('calendário com compromissos não tem violações críticas de WCAG A/AA', async () => {
    const { container } = render(
      <MemoryRouter>
        <PortalAppointments
          visits={[visit(), visit({ public_token: 'b', unitName: 'Unidade B', requested_date: '2026-08-20' })]}
          schedulingSuspended={false}
        />
      </MemoryRouter>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  test('botões de navegação da semana têm nome acessível', () => {
    renderAppointments();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeInTheDocument();
  });
});
