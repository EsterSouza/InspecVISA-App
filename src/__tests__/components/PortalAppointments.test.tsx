import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { axe } from 'jest-axe';
import { describe, expect, test } from 'vitest';
import { PortalAppointments, type PortalAppointmentVisit } from '../../components/client/PortalAppointments';

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
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function renderAppointments(overrides: Partial<ComponentProps<typeof PortalAppointments>> = {}) {
  render(
    <MemoryRouter>
      <PortalAppointments
        visits={[]}
        schedulingSuspended={false}
        calendarMonth={new Date(2026, 7, 1)}
        onCalendarMonthChange={() => {}}
        {...overrides}
      />
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

describe('P360-014 — acessibilidade da agenda', () => {
  test('calendário com compromissos não tem violações críticas de WCAG A/AA', async () => {
    const { container } = render(
      <MemoryRouter>
        <PortalAppointments
          visits={[visit(), visit({ public_token: 'b', unitName: 'Unidade B', requested_date: '2026-08-20' })]}
          schedulingSuspended={false}
          calendarMonth={new Date(2026, 7, 1)}
          onCalendarMonthChange={() => {}}
        />
      </MemoryRouter>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  test('botões de navegação do mês têm nome acessível', () => {
    renderAppointments();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao mês atual' })).toBeInTheDocument();
  });
});
