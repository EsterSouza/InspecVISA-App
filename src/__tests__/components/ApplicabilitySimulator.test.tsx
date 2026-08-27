// ============================================================
// COND-07 — o simulador na tela.
//
// O aceite do card é uma frase: "a Ester consegue testar um roteiro inteiro sem
// criar cliente nem inspeção real". Estes testes conferem justamente isso — que
// o cenário é editável na própria tela, que o resultado responde a cada
// mudança, e que a justificativa de cada decisão está visível, não escondida
// atrás de um ícone.
// ============================================================

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ApplicabilitySimulator } from '../../components/templates/ApplicabilitySimulator';
import type { ApplicabilityRule, LabeledSection, RoutingQuestion } from '../../domain/applicability';

const INVASIVO: RoutingQuestion = {
  id: 'q-invasivo',
  text: 'Realiza procedimento invasivo?',
  type: 'single_choice',
  askAt: 'wizard',
  options: [
    { value: 'sim', label: 'Sim, invasivo' },
    { value: 'nao', label: 'Não, apenas estético' },
  ],
};

const SECOES: LabeledSection[] = [
  {
    id: 's-geral',
    title: 'Estrutura física',
    items: [{ id: 'i-piso', description: 'Piso lavável e íntegro' }],
  },
  {
    id: 's-invasivo',
    title: 'Procedimentos invasivos',
    items: [
      { id: 'i-autoclave', description: 'Autoclave com validação periódica' },
      { id: 'i-descarte', description: 'Descarte de perfurocortante' },
    ],
  },
];

const REGRA: ApplicabilityRule = {
  id: 'r-invasivo',
  target: { type: 'section', id: 's-invasivo' },
  expression: {
    combinator: 'all',
    conditions: [{ source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' }],
  },
  branch: 'if',
};

function montar(over: Partial<React.ComponentProps<typeof ApplicabilitySimulator>> = {}) {
  return render(
    <ApplicabilitySimulator sections={SECOES} rules={[REGRA]} questions={[INVASIVO]} {...over} />
  );
}

function abrir() {
  fireEvent.click(screen.getByRole('button', { name: /Simular cenário/ }));
}

describe('ApplicabilitySimulator', () => {
  test('nasce fechado — o editor não abre com um painel pesado por padrão', () => {
    montar();
    expect(screen.queryByText(/Cenário desta simulação/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simular cenário/ })).toHaveAttribute('aria-expanded', 'false');
  });

  test('abre o cenário e pergunta só o que muda o resultado', () => {
    montar();
    abrir();
    expect(screen.getByText(/Cenário desta simulação/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Realiza procedimento invasivo\?/)).toBeInTheDocument();
    // Nenhuma condição usa contexto: não há por que pedir UF nem município.
    expect(screen.queryByLabelText('UF')).not.toBeInTheDocument();
  });

  test('sem responder nada, a seção condicional aparece como pendente — nunca como excluída', () => {
    montar();
    abrir();
    const secao = screen.getByRole('button', { name: /Procedimentos invasivos/ });
    expect(within(secao).getByText('Pendente de condição')).toBeInTheDocument();
    expect(within(secao).getByText(/2 pendentes/)).toBeInTheDocument();
  });

  test('responder muda o resultado na hora, com a justificativa escrita', () => {
    montar();
    abrir();
    fireEvent.change(screen.getByLabelText(/Realiza procedimento invasivo\?/), { target: { value: 'sim' } });

    const secao = screen.getByRole('button', { name: /Procedimentos invasivos/ });
    expect(within(secao).getByText('Aplicável')).toBeInTheDocument();
    expect(within(secao).getByText(/Aplicável porque/)).toBeInTheDocument();
    expect(within(secao).getByText(/Realiza procedimento invasivo\?/)).toBeInTheDocument();
  });

  test('a resposta contrária tira a seção, e a explicação diz qual resposta a tirou', () => {
    montar();
    abrir();
    fireEvent.change(screen.getByLabelText(/Realiza procedimento invasivo\?/), { target: { value: 'nao' } });

    const secao = screen.getByRole('button', { name: /Procedimentos invasivos/ });
    expect(within(secao).getByText('Não aplicável por regra')).toBeInTheDocument();
    expect(within(secao).getByText(/Não aplicável por regra porque/)).toBeInTheDocument();
    expect(within(secao).getByText(/2 fora por regra/)).toBeInTheDocument();
  });

  test('expandir a seção lista item a item, com o motivo de cada um', () => {
    montar();
    abrir();
    fireEvent.change(screen.getByLabelText(/Realiza procedimento invasivo\?/), { target: { value: 'nao' } });
    fireEvent.click(screen.getByRole('button', { name: /Procedimentos invasivos/ }));

    expect(screen.getByText('Autoclave com validação periódica')).toBeInTheDocument();
    expect(screen.getByText('Descarte de perfurocortante')).toBeInTheDocument();
    // Herança do contrato § 5.4: o item diz que saiu por causa da seção.
    expect(screen.getAllByText(/porque a seção «Procedimentos invasivos» não é aplicável/).length).toBe(2);
  });

  test('"não foi possível determinar" é resposta, não ausência: deixa pendente', () => {
    montar();
    abrir();
    fireEvent.change(screen.getByLabelText(/Realiza procedimento invasivo\?/), { target: { value: 'sim' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Não foi possível determinar/ }));

    const secao = screen.getByRole('button', { name: /Procedimentos invasivos/ });
    expect(within(secao).getByText('Pendente de condição')).toBeInTheDocument();
    expect(within(secao).getByText(/não foi possível determinar/i)).toBeInTheDocument();
  });

  test('limpar o cenário devolve tudo para pendente', () => {
    montar();
    abrir();
    fireEvent.change(screen.getByLabelText(/Realiza procedimento invasivo\?/), { target: { value: 'nao' } });
    expect(within(screen.getByRole('button', { name: /Procedimentos invasivos/ })).getByText('Não aplicável por regra')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Limpar cenário/ }));
    expect(within(screen.getByRole('button', { name: /Procedimentos invasivos/ })).getByText('Pendente de condição')).toBeInTheDocument();
  });

  test('seção sem regra continua aplicável em qualquer cenário', () => {
    montar();
    abrir();
    fireEvent.change(screen.getByLabelText(/Realiza procedimento invasivo\?/), { target: { value: 'nao' } });
    const geral = screen.getByRole('button', { name: /Estrutura física/ });
    expect(within(geral).getByText('Aplicável')).toBeInTheDocument();
  });

  test('pede o dado do cadastro quando a condição é de contexto', () => {
    montar({
      questions: [],
      rules: [
        {
          ...REGRA,
          expression: {
            combinator: 'all',
            conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }],
          },
        },
      ],
    });
    abrir();
    fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'RJ' } });
    expect(within(screen.getByRole('button', { name: /Procedimentos invasivos/ })).getByText('Aplicável')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'SP' } });
    expect(within(screen.getByRole('button', { name: /Procedimentos invasivos/ })).getByText('Não aplicável por regra')).toBeInTheDocument();
  });

  test('roteiro sem condição nenhuma diz que não há o que simular', () => {
    montar({ rules: [], questions: [] });
    abrir();
    expect(screen.getByText(/não tem nenhuma condição configurada/)).toBeInTheDocument();
    expect(screen.queryByText(/Cenário desta simulação/)).not.toBeInTheDocument();
  });

  test('referência quebrada é dita, não escondida', () => {
    montar({ questions: [] });
    abrir();
    expect(screen.getByText(/apontam para pergunta que não existe mais/)).toBeInTheDocument();
  });

  test('o total conta exigência cadastrada, não só a aplicável', () => {
    montar();
    abrir();
    expect(screen.getByText(/de 3 exigências cadastradas/)).toBeInTheDocument();
  });
});
