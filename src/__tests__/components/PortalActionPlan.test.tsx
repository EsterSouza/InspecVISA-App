import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { PortalActionPlan } from '../../components/client/PortalActionPlan';
import type { ClientPortalActionItem } from '../../services/clientPortalService';

function actionItem(overrides: Partial<ClientPortalActionItem> = {}): ClientPortalActionItem {
  return {
    id: 'item-1',
    client_id: 'client-1',
    unit_name: 'Unidade Centro',
    title: 'Possuir alvará sanitário vigente',
    situation: 'Alvará vencido desde janeiro.',
    recommended_action: 'Protocolar a renovação na vigilância municipal.',
    priority: 'urgent',
    responsible: 'Direção técnica',
    due_date: '2026-03-25',
    status: 'published',
    is_overdue: false,
    occurrence_count: 1,
    first_detected_on: '2026-03-10',
    last_detected_on: '2026-03-10',
    resolved_at: null,
    visit_token: 'visit-token',
    ...overrides,
  };
}

describe('P360-010 - PortalActionPlan', () => {
  test('mostra situação, ação recomendada, responsável, prazo e prioridade', () => {
    render(<PortalActionPlan items={[actionItem()]} />);
    expect(screen.getByText('Possuir alvará sanitário vigente')).toBeInTheDocument();
    expect(screen.getByText('Alvará vencido desde janeiro.')).toBeInTheDocument();
    expect(screen.getByText(/Protocolar a renovação/)).toBeInTheDocument();
    expect(screen.getByText('Direção técnica')).toBeInTheDocument();
    expect(screen.getByText('Prazo 25/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Urgente')).toBeInTheDocument();
  });

  test('destaca prazo vencido e conta as pendências vencidas', () => {
    render(<PortalActionPlan items={[actionItem({ is_overdue: true })]} />);
    expect(screen.getByText('Prazo vencido')).toBeInTheDocument();
    expect(screen.getByText(/1 vencida/)).toBeInTheDocument();
  });

  test('marca item reincidente com a contagem de ocorrências', () => {
    render(<PortalActionPlan items={[actionItem({ occurrence_count: 3 })]} />);
    expect(screen.getByText('Reincidente (3x)')).toBeInTheDocument();
  });

  test('separa o histórico do que já foi concluído sem apagá-lo', () => {
    render(
      <PortalActionPlan
        items={[
          actionItem(),
          actionItem({ id: 'item-2', title: 'Lavatório instalado', status: 'resolved', resolved_at: '2026-05-02' }),
        ]}
      />
    );
    expect(screen.getByText('1 pendente')).toBeInTheDocument();
    expect(screen.getByText(/1 concluída/)).toBeInTheDocument();
    expect(screen.getByText(/Histórico/)).toBeInTheDocument();
    expect(screen.getByText('Lavatório instalado')).toBeInTheDocument();
  });

  test('recolhe a lista quando há muitos itens e expande sob demanda', async () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      actionItem({ id: `item-${index}`, title: `Pendência ${index}` })
    );
    render(<PortalActionPlan items={items} />);

    expect(screen.queryByText('Pendência 7')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ver todas as 8 pendências/ }));
    expect(screen.getByText('Pendência 7')).toBeInTheDocument();
  });

  test('avisa quando tudo foi concluído em vez de sumir com a seção', () => {
    render(<PortalActionPlan items={[actionItem({ status: 'resolved' })]} />);
    expect(screen.getByText(/Nenhuma pendência em aberto/)).toBeInTheDocument();
  });

  test('falha de carregamento não esconde a seção nem finge lista vazia', () => {
    render(<PortalActionPlan items={[]} error />);
    expect(screen.getByText(/Não foi possível carregar o plano de ação/)).toBeInTheDocument();
  });

  test('sem itens e sem erro a seção não aparece', () => {
    const { container } = render(<PortalActionPlan items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('só rotula a unidade quando o cliente enxerga mais de uma', () => {
    const { rerender } = render(<PortalActionPlan items={[actionItem()]} />);
    expect(screen.queryByText('Unidade Centro')).not.toBeInTheDocument();

    rerender(<PortalActionPlan items={[actionItem()]} showUnitName />);
    expect(screen.getByText('Unidade Centro')).toBeInTheDocument();
  });
});
