import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ActionPlan } from '../../pages/ActionPlan';
import type { ClientActionItem } from '../../types';
import type { ActionItemResponseSummary } from '../../services/appointmentAdminService';

/**
 * ACT-01 — a fila "Para analisar" e a continuidade do modal.
 *
 * O que este teste protege é a regra de entrada da fila: ela só carrega o que o cliente
 * **entregou** (arquivo pendente, "já corrigiu", todos os tópicos marcados). "Providenciando"
 * é cobrança e fica de fora — se voltar a entrar, a fila deixa de esvaziar e vira o painel de
 * antes, que era exatamente a queixa.
 */

vi.mock('../../services/clientService', () => ({
  ClientService: {
    getClients: vi.fn().mockResolvedValue([
      { id: 'cli-1', name: 'Clínica Botafogo' },
      { id: 'cli-2', name: 'ILPI Ilha' },
    ]),
  },
}));

const listAllActionItems = vi.fn();
const listActionResponseSummary = vi.fn();
const listActionItemEvidence = vi.fn();
const listActionItemCheckpoints = vi.fn();
const setActionItemStatus = vi.fn();

vi.mock('../../services/appointmentAdminService', () => ({
  AppointmentAdminService: {
    listAllActionItems: (...args: unknown[]) => listAllActionItems(...args),
    listActionResponseSummary: (...args: unknown[]) => listActionResponseSummary(...args),
    listActionItemEvidence: (...args: unknown[]) => listActionItemEvidence(...args),
    listActionItemCheckpoints: (...args: unknown[]) => listActionItemCheckpoints(...args),
    setActionItemStatus: (...args: unknown[]) => setActionItemStatus(...args),
    evidenceSignedUrl: vi.fn().mockResolvedValue('https://exemplo/assinada'),
  },
}));

function item(overrides: Partial<ClientActionItem> = {}): ClientActionItem {
  return {
    id: 'item-1',
    tenant_id: 'tenant-1',
    client_id: 'cli-1',
    appointment_request_id: null,
    inspection_id: null,
    source_item_id: 'src-1',
    title: 'Alvará sanitário vigente',
    situation: 'Alvará vencido.',
    recommended_action: 'Protocolar a renovação.',
    priority: 'urgent',
    responsible: 'Direção técnica',
    due_date: '2026-08-30',
    status: 'published',
    occurrence_count: 1,
    first_detected_on: '2026-08-01',
    last_detected_on: '2026-08-01',
    published_at: '2026-08-01',
    resolved_at: null,
    client_status: null,
    client_status_note: null,
    client_status_at: null,
    client_status_by_name: null,
    client_status_by_role: null,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
    ...overrides,
  } as ClientActionItem;
}

function summary(overrides: Partial<ActionItemResponseSummary> = {}): ActionItemResponseSummary {
  return {
    pendingEvidence: 0,
    totalEvidence: 0,
    lastEvidenceAt: null,
    checkpointsDone: 0,
    checkpointsTotal: 0,
    ...overrides,
  };
}

const COM_ARQUIVO = item({ id: 'com-arquivo', title: 'Mandou foto do reparo' });
const DECLAROU_FEITO = item({ id: 'declarou-feito', title: 'Disse que já corrigiu', client_status: 'done' });
const PROVIDENCIANDO = item({ id: 'providenciando', title: 'Está providenciando', client_status: 'in_progress' });
const TOPICOS_TODOS = item({ id: 'topicos-todos', title: 'Marcou os três tópicos', client_status: 'in_progress' });

function montarBanco() {
  listAllActionItems.mockResolvedValue([COM_ARQUIVO, DECLAROU_FEITO, PROVIDENCIANDO, TOPICOS_TODOS]);
  listActionResponseSummary.mockResolvedValue(
    new Map<string, ActionItemResponseSummary>([
      ['com-arquivo', summary({ pendingEvidence: 1, totalEvidence: 1, lastEvidenceAt: '2026-08-25' })],
      ['declarou-feito', summary()],
      ['providenciando', summary({ checkpointsDone: 1, checkpointsTotal: 3 })],
      ['topicos-todos', summary({ checkpointsDone: 3, checkpointsTotal: 3 })],
    ])
  );
  listActionItemEvidence.mockResolvedValue([]);
  listActionItemCheckpoints.mockResolvedValue([]);
  setActionItemStatus.mockResolvedValue(undefined);
}

function renderizar() {
  return render(
    <MemoryRouter>
      <ActionPlan />
    </MemoryRouter>
  );
}

describe('Plano de ação — fila "Para analisar"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    montarBanco();
  });

  test('abre na fila de análise com o que o cliente entregou, sem o que ele só prometeu', async () => {
    renderizar();

    const aba = await screen.findByRole('button', { name: /Para analisar/ });
    expect(aba).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => expect(screen.getByText('Mandou foto do reparo')).toBeInTheDocument());
    expect(screen.getByText('Disse que já corrigiu')).toBeInTheDocument();
    expect(screen.getByText('Marcou os três tópicos')).toBeInTheDocument();
    expect(screen.queryByText('Está providenciando')).not.toBeInTheDocument();
    expect(within(aba).getByText('3')).toBeInTheDocument();
  });

  test('a linha anuncia o arquivo a revisar e o progresso dos tópicos', async () => {
    renderizar();

    await waitFor(() => expect(screen.getByText('Mandou foto do reparo')).toBeInTheDocument());
    expect(screen.getByText(/1 para revisar/)).toBeInTheDocument();
    expect(screen.getByText('3/3 tópicos')).toBeInTheDocument();
  });

  test('o filtro de resposta do cliente reduz a lista sem trocar de aba', async () => {
    const user = userEvent.setup();
    renderizar();
    await waitFor(() => expect(screen.getByText('Mandou foto do reparo')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText('Resposta do cliente'), 'aguardando');

    expect(screen.getByText('Mandou foto do reparo')).toBeInTheDocument();
    expect(screen.queryByText('Disse que já corrigiu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Para analisar/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('o detalhe diz a posição na fila e "Próxima" entrega o item seguinte', async () => {
    const user = userEvent.setup();
    renderizar();
    await waitFor(() => expect(screen.getByText('Mandou foto do reparo')).toBeInTheDocument());

    await user.click(screen.getByText('Mandou foto do reparo'));
    expect(await screen.findByText('1 de 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima pendência da fila' }));
    expect(await screen.findByText('2 de 3')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Disse que já corrigiu')).toBeInTheDocument();
  });

  test('resolver avança sozinho para a próxima em vez de fechar o modal', async () => {
    const user = userEvent.setup();
    renderizar();
    await waitFor(() => expect(screen.getByText('Mandou foto do reparo')).toBeInTheDocument());

    await user.click(screen.getByText('Mandou foto do reparo'));
    await screen.findByText('1 de 3');

    // Depois de resolver, a fila já não tem a primeira: o modal continua aberto na seguinte.
    listAllActionItems.mockResolvedValue([DECLAROU_FEITO, PROVIDENCIANDO, TOPICOS_TODOS]);
    await user.click(screen.getByRole('button', { name: /Resolver/ }));

    await waitFor(() => expect(setActionItemStatus).toHaveBeenCalledWith('com-arquivo', 'resolved'));
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByText('Disse que já corrigiu')).toBeInTheDocument()
    );
  });

  test('os tópicos marcados pelo cliente aparecem no detalhe', async () => {
    const user = userEvent.setup();
    listActionItemCheckpoints.mockResolvedValue([
      { id: 'cp-1', text: 'Protocolar a renovação', ordinal: 1, done: true, doneAt: '2026-08-20', doneByName: 'Marina' },
      { id: 'cp-2', text: 'Afixar o alvará', ordinal: 2, done: false, doneAt: null, doneByName: null },
    ]);
    renderizar();
    await waitFor(() => expect(screen.getByText('Mandou foto do reparo')).toBeInTheDocument());

    await user.click(screen.getByText('Mandou foto do reparo'));

    expect(await screen.findByText(/Tópicos marcados pelo cliente/)).toBeInTheDocument();
    expect(screen.getByText('Protocolar a renovação')).toBeInTheDocument();
    expect(screen.getByText(/Marina/)).toBeInTheDocument();
    expect(screen.getByText('Afixar o alvará')).toBeInTheDocument();
  });
});
