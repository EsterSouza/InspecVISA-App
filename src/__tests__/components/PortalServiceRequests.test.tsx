import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { PortalServiceRequests } from '../../components/client/PortalServiceRequests';
import type { ClientPortalServiceRequest } from '../../services/clientPortalService';

// PORT-07 — a pasta sanitária personalizada é o que libera a categoria "Documentação"; a
// unidade Barra fica sem ela de propósito, para o teste da trava ter as duas pontas.
const UNITS = [
  { client_id: 'unit-1', client_name: 'Unidade Centro', has_personalized_sanitary_folder: true },
  { client_id: 'unit-2', client_name: 'Unidade Barra', has_personalized_sanitary_folder: false },
];

function request(overrides: Partial<ClientPortalServiceRequest> = {}): ClientPortalServiceRequest {
  return {
    id: 'req-1',
    request_number: 7,
    client_id: 'unit-1',
    unit_name: 'Unidade Centro',
    category: 'licenciamento',
    subject: 'Renovação do alvará sanitário',
    description: 'O alvará vence no mês que vem e precisamos de apoio.',
    status: 'in_progress',
    waiting_on: 'team',
    assigned_to: 'Ester Caiafa',
    sla_days: null,
    sla_hint_date: null,
    attachment_name: null,
    opened_by_name: 'Maria da Silva',
    opened_by_role: 'Gerente',
    created_at: '2026-08-01T12:00:00Z',
    last_event_at: '2026-08-03T12:00:00Z',
    closed_at: null,
    accepts_reply: false,
    events: [],
    ...overrides,
  };
}

describe('P360-012 - PortalServiceRequests', () => {
  test('mostra numero, categoria, data, situacao e ultima atualizacao', () => {
    render(<PortalServiceRequests requests={[request()]} units={UNITS} />);

    expect(screen.getByText('Nº 7')).toBeInTheDocument();
    expect(screen.getByText('Licenciamento e alvará')).toBeInTheDocument();
    expect(screen.getByText('Em atendimento')).toBeInTheDocument();
    expect(screen.getByText('Renovação do alvará sanitário')).toBeInTheDocument();
    expect(screen.getByText(/Aberta em 01\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Última atualização em 03\/08\/2026/)).toBeInTheDocument();
  });

  test('estado vazio explica para que serve o canal, sem prometer resposta', () => {
    render(<PortalServiceRequests requests={[]} units={UNITS} />);
    expect(screen.getByText(/ainda não abriu nenhuma solicitação/i)).toBeInTheDocument();
  });

  test('estado de erro nao finge lista vazia', () => {
    render(<PortalServiceRequests requests={[]} units={UNITS} error />);
    expect(screen.getByText(/Não foi possível carregar suas solicitações/i)).toBeInTheDocument();
    expect(screen.queryByText(/ainda não abriu nenhuma/i)).not.toBeInTheDocument();
  });

  test('sem SLA configurado o portal nao fala em prazo', () => {
    render(<PortalServiceRequests requests={[request()]} units={UNITS} />);
    expect(screen.queryByText(/Retorno previsto/i)).not.toBeInTheDocument();
  });

  test('com SLA configurado o prazo aparece marcado como informativo', () => {
    render(
      <PortalServiceRequests
        requests={[request({ sla_days: 3, sla_hint_date: '2026-08-06' })]}
        units={UNITS}
      />
    );
    expect(screen.getByText(/Retorno previsto até 06\/08\/2026 · prazo informativo/)).toBeInTheDocument();
  });

  test('so oferece resposta quando a consultoria perguntou algo', () => {
    const onReply = vi.fn();
    const { rerender } = render(
      <PortalServiceRequests requests={[request()]} units={UNITS} onReply={onReply} />
    );
    expect(screen.queryByLabelText('Sua resposta')).not.toBeInTheDocument();

    rerender(
      <PortalServiceRequests
        requests={[request({ status: 'awaiting_client', waiting_on: 'client', accepts_reply: true })]}
        units={UNITS}
        onReply={onReply}
      />
    );
    expect(screen.getByLabelText('Sua resposta')).toBeInTheDocument();
    expect(screen.getByText('Aguardando você')).toBeInTheDocument();
  });

  test('solicitacao encerrada vai para o historico e nao aceita resposta', () => {
    render(
      <PortalServiceRequests
        requests={[request({ status: 'resolved', waiting_on: 'none', closed_at: '2026-08-05T12:00:00Z' })]}
        units={UNITS}
        onReply={vi.fn()}
      />
    );

    expect(screen.getByText(/1 solicitação\(ões\)/)).toBeInTheDocument();
    expect(screen.getByText(/Concluída em 05\/08\/2026/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Sua resposta')).not.toBeInTheDocument();
  });

  test('conta separadamente o que aguarda o cliente', () => {
    render(
      <PortalServiceRequests
        requests={[
          request(),
          request({ id: 'req-2', status: 'awaiting_client', waiting_on: 'client', accepts_reply: true }),
        ]}
        units={UNITS}
      />
    );
    expect(screen.getByText(/1 aguardando você/)).toBeInTheDocument();
  });

  test('o formulario exige unidade, categoria, assunto e descricao antes de chamar o servidor', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<PortalServiceRequests requests={[]} units={UNITS} onCreate={onCreate} />);

    await user.click(screen.getByRole('button', { name: /Nova solicitação/i }));
    await user.click(screen.getByRole('button', { name: /Registrar solicitação/i }));
    expect(screen.getByText('Escolha a unidade.')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText(/^Unidade/), 'unit-2');
    await user.click(screen.getByRole('button', { name: /Registrar solicitação/i }));
    expect(screen.getByText('Escolha a categoria.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Categoria/), 'treinamento');
    await user.type(screen.getByLabelText(/^Assunto/), 'Treinamento da equipe');
    await user.click(screen.getByRole('button', { name: /Registrar solicitação/i }));
    expect(screen.getByText(/pelo menos 10 caracteres/)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  test('duplo clique manda a MESMA chave de submissao, para o servidor deduplicar', async () => {
    const user = userEvent.setup();
    let resolveCreate: (value: { requestNumber: number }) => void = () => {};
    const onCreate = vi.fn().mockImplementation(
      () => new Promise<{ requestNumber: number }>((resolve) => { resolveCreate = resolve; })
    );

    render(<PortalServiceRequests requests={[]} units={[UNITS[0]]} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /Nova solicitação/i }));
    await user.selectOptions(screen.getByLabelText(/^Categoria/), 'documentacao');
    await user.type(screen.getByLabelText(/^Assunto/), 'Modelo de POP');
    await user.type(screen.getByLabelText(/^O que você precisa/), 'Preciso do modelo de POP de limpeza.');

    const submit = screen.getByRole('button', { name: /Registrar solicitação/i });
    await user.click(submit);
    await user.click(submit);

    // O segundo clique não chega ao servidor enquanto o primeiro está em voo; se chegasse
    // (aba duplicada, retry manual), iria com a mesma chave e o servidor devolveria a MESMA
    // solicitação — é a trava do card, e ela mora nos dois lados.
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].submissionKey).toMatch(/^[0-9a-f-]{36}$/i);

    resolveCreate({ requestNumber: 12 });
    expect(await screen.findByText(/Solicitação 12 registrada/)).toBeInTheDocument();
  });

  test('anexo que falha avisa sobre o arquivo, nao sobre o pedido', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ requestNumber: 3, attachmentError: 'arquivo acima do limite de 10 MB' });

    render(<PortalServiceRequests requests={[]} units={[UNITS[0]]} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /Nova solicitação/i }));
    await user.selectOptions(screen.getByLabelText(/^Categoria/), 'outro');
    await user.type(screen.getByLabelText(/^Assunto/), 'Dúvida de rotina');
    await user.type(screen.getByLabelText(/^O que você precisa/), 'Queria entender a rotina de limpeza.');
    await user.click(screen.getByRole('button', { name: /Registrar solicitação/i }));

    expect(await screen.findByText(/Solicitação 3 registrada, mas o anexo não subiu/)).toBeInTheDocument();
  });

  test('o historico mostra so o que a consultoria deixou visivel', async () => {
    const user = userEvent.setup();
    render(
      <PortalServiceRequests
        requests={[
          request({
            events: [
              { id: 'e1', event_type: 'created', to_status: 'open', note: null, actor_kind: 'client', actor_name: 'Maria', created_at: '2026-08-01T12:00:00Z' },
              { id: 'e2', event_type: 'status_changed', to_status: 'awaiting_client', note: 'Envie o contrato social.', actor_kind: 'staff', actor_name: 'Ester', created_at: '2026-08-03T12:00:00Z' },
            ],
          }),
        ]}
        units={UNITS}
      />
    );

    await user.click(screen.getByText(/Histórico · 2 registro/));
    expect(screen.getByText('Envie o contrato social.')).toBeInTheDocument();
    expect(screen.getByText('Ester')).toBeInTheDocument();
  });

  test('PORT-07 — sem a pasta contratada, a unidade não pede elaboração de documento', async () => {
    const user = userEvent.setup();
    render(<PortalServiceRequests requests={[]} units={UNITS} onCreate={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Nova solicitação/i }));

    // Unidade Barra não tem a pasta: a categoria some e a tela diz por quê.
    await user.selectOptions(screen.getByLabelText(/^Unidade/), 'unit-2');
    expect(
      screen.queryByRole('option', { name: 'Documentação' })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/faz parte da pasta sanitária personalizada/i)).toBeInTheDocument();

    // As outras categorias não caem junto — a trava é só da elaboração de documento.
    expect(screen.getByRole('option', { name: 'Licenciamento e alvará' })).toBeInTheDocument();

    // E a unidade que tem a pasta continua com a categoria.
    await user.selectOptions(screen.getByLabelText(/^Unidade/), 'unit-1');
    expect(screen.getByRole('option', { name: 'Documentação' })).toBeInTheDocument();
  });

  test('PORT-07 — trocar para uma unidade sem a pasta limpa "Documentação" já escolhida', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<PortalServiceRequests requests={[]} units={UNITS} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /Nova solicitação/i }));

    await user.selectOptions(screen.getByLabelText(/^Unidade/), 'unit-1');
    await user.selectOptions(screen.getByLabelText(/^Categoria/), 'documentacao');
    await user.selectOptions(screen.getByLabelText(/^Unidade/), 'unit-2');

    // Sem isto o formulário mandaria "documentacao" para uma unidade sem a pasta, e o servidor
    // devolveria o erro depois de tudo digitado.
    await user.type(screen.getByLabelText(/^Assunto/), 'Modelo de POP');
    await user.type(screen.getByLabelText(/^O que você precisa/), 'Preciso do modelo de POP de limpeza.');
    await user.click(screen.getByRole('button', { name: /Registrar solicitação/i }));

    expect(screen.getByText(/Escolha a categoria/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
