import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { PortalNextAction } from '../../components/client/PortalNextAction';

const paymentOverdue: ComponentProps<typeof PortalNextAction>['paymentOverdue'] = {
  type: 'payment_overdue',
  dueDate: '2026-08-01',
  links: [{ label: 'Pagar agora', url: 'https://pay.example.com/x' }],
};

const upcomingAppointment: ComponentProps<typeof PortalNextAction>['upcomingAppointment'] = {
  type: 'upcoming_appointment',
  unitName: 'Unidade A',
  date: '2026-08-10',
  time: '09:00',
  publicToken: 'tok-1',
};

const returnedEvidence: ComponentProps<typeof PortalNextAction>['returnedEvidence'] = {
  type: 'evidence_returned',
  unitName: 'Unidade B',
  itemLabel: 'Licença sanitária',
  href: '/cliente/plano/1',
};

const overdueItem: ComponentProps<typeof PortalNextAction>['overdueItem'] = {
  type: 'item_overdue',
  unitName: 'Unidade C',
  itemLabel: 'Treinamento de manipuladores',
  dueDate: '2026-07-20',
  href: '/cliente/plano/2',
};

const requestAwaitingClient: ComponentProps<typeof PortalNextAction>['requestAwaitingClient'] = {
  type: 'request_awaiting_client',
  unitName: 'Unidade D',
  subject: 'Confirmar endereço da nova filial',
  href: '/cliente/solicitacoes/3',
};

function renderNextAction(overrides: Partial<ComponentProps<typeof PortalNextAction>> = {}) {
  const onAudit = vi.fn();
  render(
    <MemoryRouter>
      <PortalNextAction onAudit={onAudit} {...overrides} />
    </MemoryRouter>
  );
  return onAudit;
}

describe('P360-009 - PortalNextAction', () => {
  test('não renderiza nada quando não há nenhum sinal', () => {
    const { container } = render(
      <MemoryRouter>
        <PortalNextAction onAudit={vi.fn()} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('mostra pagamento vencido isolado', () => {
    renderNextAction({ paymentOverdue: paymentOverdue });
    expect(screen.getByText('Pagamento pendente')).toBeInTheDocument();
    expect(screen.getByText(/Vencimento: 01\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pagar agora/ })).toHaveAttribute('href', 'https://pay.example.com/x');
  });

  test('mostra compromisso próximo isolado', () => {
    renderNextAction({ upcomingAppointment });
    expect(screen.getByText('Compromisso próximo')).toBeInTheDocument();
    expect(screen.getByText(/Unidade A · 10\/08\/2026 às 09:00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver detalhes/ })).toHaveAttribute('href', '/cliente/visita/tok-1');
  });

  test('mostra evidência devolvida isolada', () => {
    renderNextAction({ returnedEvidence });
    expect(screen.getByText('Evidência devolvida')).toBeInTheDocument();
    expect(screen.getByText(/Unidade B · Licença sanitária/)).toBeInTheDocument();
  });

  test('mostra item vencido isolado', () => {
    renderNextAction({ overdueItem });
    expect(screen.getByText('Item vencido no plano de ação')).toBeInTheDocument();
    expect(screen.getByText(/Unidade C · Treinamento de manipuladores · prazo 20\/07\/2026/)).toBeInTheDocument();
  });

  test('mostra solicitação aguardando cliente isolada', () => {
    renderNextAction({ requestAwaitingClient });
    expect(screen.getByText('Solicitação aguardando você')).toBeInTheDocument();
    expect(screen.getByText(/Unidade D · Confirmar endereço da nova filial/)).toBeInTheDocument();
  });

  test('respeita a ordem de prioridade quando vários sinais coexistem, sem contradição', () => {
    renderNextAction({
      paymentOverdue,
      upcomingAppointment,
      returnedEvidence,
      overdueItem,
      requestAwaitingClient,
    });
    expect(screen.getByText('Pagamento pendente')).toBeInTheDocument();
    expect(screen.queryByText('Compromisso próximo')).not.toBeInTheDocument();
    expect(screen.queryByText('Evidência devolvida')).not.toBeInTheDocument();
    expect(screen.queryByText('Item vencido no plano de ação')).not.toBeInTheDocument();
    expect(screen.queryByText('Solicitação aguardando você')).not.toBeInTheDocument();
  });

  test('sem pagamento vencido, mostra o próximo da fila (compromisso)', () => {
    renderNextAction({ upcomingAppointment, returnedEvidence, overdueItem, requestAwaitingClient });
    expect(screen.getByText('Compromisso próximo')).toBeInTheDocument();
  });

  test('sem pagamento nem compromisso, mostra evidência devolvida antes de item vencido e solicitação', () => {
    renderNextAction({ returnedEvidence, overdueItem, requestAwaitingClient });
    expect(screen.getByText('Evidência devolvida')).toBeInTheDocument();
  });

  test('item vencido tem prioridade sobre solicitação aguardando cliente', () => {
    renderNextAction({ overdueItem, requestAwaitingClient });
    expect(screen.getByText('Item vencido no plano de ação')).toBeInTheDocument();
  });

  test('audita o clique sem vazar a URL de pagamento', () => {
    const onAudit = renderNextAction({ paymentOverdue });
    fireEvent.click(screen.getByRole('link', { name: /Pagar agora/ }));
    expect(onAudit).toHaveBeenCalledWith('next_action_clicked', { action_type: 'payment_overdue' });
    expect(JSON.stringify(onAudit.mock.calls)).not.toContain('https://');
  });
});
