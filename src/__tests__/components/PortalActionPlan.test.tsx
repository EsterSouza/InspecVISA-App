import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
    evidence_count: 0,
    evidence_status: null,
    evidence_file_name: null,
    evidence_submitted_at: null,
    evidence_reviewed_at: null,
    evidence_review_note: null,
    evidence_by_name: null,
    evidence_by_role: null,
    accepts_evidence: true,
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

  test('agrupa por unidade em "Todas as unidades" e mostra um cabeçalho por grupo', () => {
    render(
      <PortalActionPlan
        items={[
          actionItem(),
          actionItem({ id: 'item-2', client_id: 'client-2', unit_name: 'Unidade Zona Sul', title: 'Extintor vencido' }),
        ]}
        groupByUnit
      />
    );
    expect(screen.getByText('Unidade Centro')).toBeInTheDocument();
    expect(screen.getByText('Unidade Zona Sul')).toBeInTheDocument();
  });

  test('unidade única não agrupa mesmo com groupByUnit', () => {
    render(<PortalActionPlan items={[actionItem()]} groupByUnit />);
    expect(screen.queryByText('Unidade Centro')).not.toBeInTheDocument();
  });

  test('grupo com mais de 3 pendências oferece abrir a unidade inteira', async () => {
    const onSelectUnit = vi.fn();
    const items = [
      ...Array.from({ length: 4 }, (_, index) =>
        actionItem({ id: `centro-${index}`, title: `Pendência Centro ${index}` })
      ),
      actionItem({ id: 'zona-sul-1', client_id: 'client-2', unit_name: 'Unidade Zona Sul', title: 'Extintor vencido' }),
    ];
    render(<PortalActionPlan items={items} groupByUnit onSelectUnit={onSelectUnit} />);

    expect(screen.queryByText('Pendência Centro 3')).not.toBeInTheDocument();
    const openUnitButton = screen.getByRole('button', { name: /Ver todas as 4 pendências de Unidade Centro/ });
    await userEvent.click(openUnitButton);
    expect(onSelectUnit).toHaveBeenCalledWith('client-1');
  });
});

describe('P360-011 - evidência no plano de ação do cliente', () => {
  // `applyAccept: false` para o teste exercitar a checagem do app, e não o filtro que o
  // atributo `accept` já faz no seletor de arquivos do sistema.
  function pickFile(item: ClientPortalActionItem, file: File) {
    const input = screen.getByTestId(`evidence-input-${item.id}`) as HTMLInputElement;
    return userEvent.setup({ applyAccept: false }).upload(input, file);
  }

  const pdf = () => new File(['%PDF-1.4 conteudo'], 'Protocolo Vigilância.pdf', { type: 'application/pdf' });

  // FE-10: a assinatura deixou de ser obrigatória — o campo só pré-preenche pra não forçar
  // digitação, mas o envio sai mesmo em branco.
  async function signAs(name = 'Joana Prado', role = 'Gestora da unidade') {
    await userEvent.type(screen.getByLabelText('Seu nome'), name);
    await userEvent.type(screen.getByLabelText('Sua função'), role);
  }

  // O ambiente de teste roda com `--no-experimental-webstorage` e entrega um `localStorage`
  // capenga (o mesmo que já quebrou o `zustand/persist` aqui). Como a assinatura guardada é
  // parte do comportamento, o teste instala um armazenamento de verdade em memória.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('sem handler de envio o cliente não vê botão de evidência', () => {
    render(<PortalActionPlan items={[actionItem()]} />);
    expect(screen.queryByRole('button', { name: /Enviar evidência/ })).not.toBeInTheDocument();
  });

  test('item que não aceita evidência não oferece envio', () => {
    render(
      <PortalActionPlan
        items={[actionItem({ accepts_evidence: false })]}
        onSubmitEvidence={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Enviar evidência/ })).not.toBeInTheDocument();
  });

  test('envia o arquivo com uma chave de idempotência e o comentário do cliente', async () => {
    const onSubmitEvidence = vi.fn().mockResolvedValue(undefined);
    const item = actionItem();
    render(<PortalActionPlan items={[item]} onSubmitEvidence={onSubmitEvidence} />);

    await pickFile(item, pdf());
    await userEvent.type(screen.getByPlaceholderText(/Quer explicar o que foi feito/), 'Protocolo em anexo');
    await signAs();
    await userEvent.click(screen.getByRole('button', { name: /Enviar para a consultoria/ }));

    expect(onSubmitEvidence).toHaveBeenCalledTimes(1);
    const call = onSubmitEvidence.mock.calls[0][0];
    expect(call.item.id).toBe('item-1');
    expect(call.file.name).toBe('Protocolo Vigilância.pdf');
    expect(call.note).toBe('Protocolo em anexo');
    expect(call.byName).toBe('Joana Prado');
    expect(call.byRole).toBe('Gestora da unidade');
    expect(call.uploadKey).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('arquivo grande demais é barrado antes de subir', async () => {
    const onSubmitEvidence = vi.fn();
    const item = actionItem();
    render(<PortalActionPlan items={[item]} onSubmitEvidence={onSubmitEvidence} />);

    const huge = new File([new Uint8Array(11 * 1024 * 1024)], 'enorme.pdf', { type: 'application/pdf' });
    await pickFile(item, huge);

    expect(screen.getByText(/o limite é 10 MB/)).toBeInTheDocument();
    expect(onSubmitEvidence).not.toHaveBeenCalled();
  });

  test('formato fora da lista é barrado antes de subir', async () => {
    const onSubmitEvidence = vi.fn();
    const item = actionItem();
    render(<PortalActionPlan items={[item]} onSubmitEvidence={onSubmitEvidence} />);

    await pickFile(item, new File(['MZ'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' }));

    expect(screen.getByText(/Formato não aceito/)).toBeInTheDocument();
    expect(onSubmitEvidence).not.toHaveBeenCalled();
  });

  test('falha no envio mantém o arquivo escolhido e explica o erro', async () => {
    const onSubmitEvidence = vi.fn().mockRejectedValue(new Error('arquivo acima do limite de 10 MB'));
    const item = actionItem();
    render(<PortalActionPlan items={[item]} onSubmitEvidence={onSubmitEvidence} />);

    await pickFile(item, pdf());
    await signAs();
    await userEvent.click(screen.getByRole('button', { name: /Enviar para a consultoria/ }));

    expect(screen.getByText('arquivo acima do limite de 10 MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar para a consultoria/ })).toBeInTheDocument();
  });

  test('cliente acompanha o estado da evidência e a orientação da consultora', () => {
    render(
      <PortalActionPlan
        items={[
          actionItem({
            evidence_count: 2,
            evidence_status: 'changes_requested',
            evidence_file_name: 'protocolo.pdf',
            evidence_submitted_at: '2026-08-05',
            evidence_review_note: 'O protocolo está ilegível. Reenvie o PDF original.',
          }),
        ]}
        onSubmitEvidence={vi.fn()}
      />
    );

    expect(screen.getByText(/Evidência devolvida para ajuste/)).toBeInTheDocument();
    expect(screen.getByText(/O protocolo está ilegível/)).toBeInTheDocument();
    expect(screen.getByText(/2 arquivos enviados/)).toBeInTheDocument();
    // Depois da devolução o cliente reenvia; o botão muda de rótulo, não some.
    expect(screen.getByRole('button', { name: /Enviar outra evidência/ })).toBeInTheDocument();
  });

  test('sem nome e função o envio sai mesmo assim (FE-10: assinatura deixou de ser obrigatória)', async () => {
    const onSubmitEvidence = vi.fn().mockResolvedValue(undefined);
    const item = actionItem();
    render(<PortalActionPlan items={[item]} onSubmitEvidence={onSubmitEvidence} />);

    await pickFile(item, pdf());
    await userEvent.click(screen.getByRole('button', { name: /Enviar para a consultoria/ }));

    expect(onSubmitEvidence).toHaveBeenCalledTimes(1);
    const call = onSubmitEvidence.mock.calls[0][0];
    expect(call.byName).toBe('');
    expect(call.byRole).toBe('');
  });

  test('pré-preenche "Seu nome" com o nome padrão quando não há assinatura salva', async () => {
    const item = actionItem();
    render(
      <PortalActionPlan items={[item]} onSubmitEvidence={vi.fn()} defaultAuthorName="Rede Sênior" />
    );
    await pickFile(item, pdf());
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Rede Sênior');
  });

  test('a assinatura volta preenchida no envio seguinte', async () => {
    const onSubmitEvidence = vi.fn().mockResolvedValue(undefined);
    const item = actionItem();
    const { unmount } = render(<PortalActionPlan items={[item]} onSubmitEvidence={onSubmitEvidence} />);

    await pickFile(item, pdf());
    await signAs();
    await userEvent.click(screen.getByRole('button', { name: /Enviar para a consultoria/ }));
    unmount();

    // Quem envia é a mesma pessoa a visita inteira; digitar de novo a cada pendência faria
    // ela desistir na segunda.
    render(<PortalActionPlan items={[item]} onSubmitEvidence={onSubmitEvidence} />);
    await pickFile(item, pdf());
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Joana Prado');
    expect(screen.getByLabelText('Sua função')).toHaveValue('Gestora da unidade');
  });

  test('quem assinou o envio aparece junto do estado', () => {
    render(
      <PortalActionPlan
        items={[
          actionItem({
            evidence_count: 1,
            evidence_status: 'pending',
            evidence_submitted_at: '2026-08-05',
            evidence_by_name: 'Joana Prado',
            evidence_by_role: 'Gestora da unidade',
          }),
        ]}
        onSubmitEvidence={vi.fn()}
      />
    );
    expect(screen.getByText(/por Joana Prado \(Gestora da unidade\)/)).toBeInTheDocument();
  });

  test('evidência em análise deixa claro que a pendência continua aberta', () => {
    render(
      <PortalActionPlan
        items={[actionItem({ evidence_count: 1, evidence_status: 'pending' })]}
        onSubmitEvidence={vi.fn()}
      />
    );
    expect(screen.getByText(/Evidência em análise/)).toBeInTheDocument();
    expect(screen.getByText(/pendência continua aberta/)).toBeInTheDocument();
    // O contador do cabeçalho não muda com o upload: 1 pendente continua 1 pendente.
    expect(screen.getByText('1 pendente')).toBeInTheDocument();
  });
});

describe('P360-014 — acessibilidade do plano de ação', () => {
  test('lista de pendências não tem violações críticas de WCAG A/AA', async () => {
    const { container } = render(<PortalActionPlan items={[actionItem()]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  test('estado de erro com retry não tem violações e expõe o botão de tentar novamente', async () => {
    const onRetry = vi.fn();
    const { container } = render(<PortalActionPlan items={[]} error onRetry={onRetry} />);
    const retryButton = screen.getByRole('button', { name: /Tentar novamente/ });
    expect(retryButton).toBeInTheDocument();
    await userEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});
