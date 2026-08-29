import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PortalActionPlan } from '../../components/client/PortalActionPlan';
import type {
  ClientPortalActionCheckpoint,
  ClientPortalActionItem,
} from '../../services/clientPortalService';

function checkpoint(overrides: Partial<ClientPortalActionCheckpoint> = {}): ClientPortalActionCheckpoint {
  return {
    id: 'cp-1',
    text: 'Protocolar a renovação na vigilância municipal',
    ordinal: 1,
    done: false,
    done_at: null,
    done_by_name: null,
    ...overrides,
  };
}

function actionItem(overrides: Partial<ClientPortalActionItem> = {}): ClientPortalActionItem {
  return {
    id: 'item-1',
    client_id: 'client-1',
    unit_name: 'Unidade Centro',
    title: 'Possuir alvará sanitário vigente',
    situation: 'Alvará vencido desde janeiro.',
    recommended_action: 'Protocolar a renovação. Afixar o alvará. Atualizar o contrato.',
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
    evidence_count: 0,
    evidence_status: null,
    evidence_file_name: null,
    evidence_submitted_at: null,
    evidence_reviewed_at: null,
    evidence_review_note: null,
    evidence_by_name: null,
    evidence_by_role: null,
    checkpoints: [],
    accepts_evidence: true,
    accepts_file_evidence: true,
    ...overrides,
  };
}

const tresTopicos = [
  checkpoint({ id: 'cp-1', text: 'Protocolar a renovação', ordinal: 1 }),
  checkpoint({ id: 'cp-2', text: 'Afixar o alvará na recepção', ordinal: 2 }),
  checkpoint({ id: 'cp-3', text: 'Atualizar o contrato social', ordinal: 3 }),
];

async function assinar() {
  await userEvent.type(screen.getByLabelText('Seu nome'), 'Joana Prado');
  await userEvent.type(screen.getByLabelText('Sua função'), 'Gestora da unidade');
}

describe('PORT-05 — o cliente marca cada tópico da ação', () => {
  beforeEach(() => localStorage.clear());

  test('mostra os tópicos e quantos já foram concluídos', () => {
    render(
      <PortalActionPlan
        items={[actionItem({ checkpoints: [{ ...tresTopicos[0], done: true }, tresTopicos[1], tresTopicos[2]] })]}
        onToggleCheckpoint={vi.fn()}
      />
    );

    expect(screen.getByText('1 de 3 tarefas concluídas')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Protocolar a renovação/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Afixar o alvará/ })).not.toBeChecked();
  });

  test('um clique marca o tópico, e só aquele', async () => {
    const onToggleCheckpoint = vi.fn().mockResolvedValue(undefined);
    render(
      <PortalActionPlan items={[actionItem({ checkpoints: tresTopicos })]} onToggleCheckpoint={onToggleCheckpoint} />
    );

    await assinar();
    await userEvent.click(screen.getByRole('checkbox', { name: /Afixar o alvará/ }));

    expect(onToggleCheckpoint).toHaveBeenCalledTimes(1);
    expect(onToggleCheckpoint.mock.calls[0][0]).toMatchObject({
      checkpoint: expect.objectContaining({ id: 'cp-2' }),
      done: true,
      byName: 'Joana Prado',
      byRole: 'Gestora da unidade',
    });
  });

  test('clicar num tópico já marcado desmarca', async () => {
    const onToggleCheckpoint = vi.fn().mockResolvedValue(undefined);
    render(
      <PortalActionPlan
        items={[actionItem({ checkpoints: [{ ...tresTopicos[0], done: true, done_at: '2026-04-02T12:00:00Z' }] })]}
        onToggleCheckpoint={onToggleCheckpoint}
      />
    );

    await assinar();
    await userEvent.click(screen.getByRole('checkbox', { name: /Protocolar a renovação/ }));

    expect(onToggleCheckpoint.mock.calls[0][0]).toMatchObject({ done: false });
  });

  test('pede nome e função uma vez, no topo — não a cada tópico', async () => {
    const onToggleCheckpoint = vi.fn();
    render(
      <PortalActionPlan items={[actionItem({ checkpoints: tresTopicos })]} onToggleCheckpoint={onToggleCheckpoint} />
    );

    expect(screen.getByText('Quem está respondendo?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Protocolar a renovação/ }));
    expect(onToggleCheckpoint).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Preencha seu nome e sua função/);

    // Assinou uma vez: daí em diante é um clique por tarefa, sem formulário nenhum.
    await assinar();
    expect(screen.getByLabelText('Sua função')).toHaveValue('Gestora da unidade');

    await userEvent.click(screen.getByRole('checkbox', { name: /Protocolar a renovação/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Atualizar o contrato/ }));
    expect(onToggleCheckpoint).toHaveBeenCalledTimes(2);
  });

  test('falha no servidor não deixa a tarefa parecer marcada', async () => {
    const onToggleCheckpoint = vi.fn().mockRejectedValue(new Error('tarefa nao esta mais no plano'));
    render(
      <PortalActionPlan items={[actionItem({ checkpoints: tresTopicos })]} onToggleCheckpoint={onToggleCheckpoint} />
    );

    await assinar();
    await userEvent.click(screen.getByRole('checkbox', { name: /Protocolar a renovação/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('tarefa nao esta mais no plano');
    expect(screen.getByRole('checkbox', { name: /Protocolar a renovação/ })).not.toBeChecked();
  });

  test('pendência concluída mostra os tópicos sem clique', () => {
    render(
      <PortalActionPlan
        items={[actionItem({
          status: 'resolved',
          resolved_at: '2026-05-02',
          accepts_evidence: false,
          checkpoints: [{ ...tresTopicos[0], done: true }, tresTopicos[1]],
        })]}
        onToggleCheckpoint={vi.fn()}
      />
    );

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Quem está respondendo?')).not.toBeInTheDocument();
    expect(screen.getByText('1 de 2 tarefas concluídas')).toBeInTheDocument();
  });

  test('sem tópicos, a ação continua sendo o parágrafo de sempre', () => {
    render(<PortalActionPlan items={[actionItem()]} onToggleCheckpoint={vi.fn()} />);

    expect(screen.getByText(/Protocolar a renovação\. Afixar o alvará\./)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Quem está respondendo?')).not.toBeInTheDocument();
  });

  test('a lista de tarefas passa na auditoria de acessibilidade', async () => {
    const { container } = render(
      <PortalActionPlan
        items={[actionItem({ checkpoints: [{ ...tresTopicos[0], done: true }, tresTopicos[1]] })]}
        onToggleCheckpoint={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
