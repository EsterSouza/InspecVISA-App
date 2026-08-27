// ============================================================
// COND-08 — as duas superfícies novas da execução.
//
// O bloco das perguntas de campo: ele não pode parecer requisito sanitário
// (contrato § 3), tem que oferecer a saída "não foi possível determinar"
// (§ 6.4) e dizer quem respondeu por último — que é o que a colega precisa ver
// quando a árvore muda debaixo dela.
//
// O painel do que saiu: **nada some em silêncio** (§ 6.1). Item fora do roteiro
// continua listado, com o motivo, e resposta preservada aparece como tal.
// ============================================================

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RoutingQuestionsBlock } from '../../components/inspection/RoutingQuestionsBlock';
import { ExcludedByRulePanel } from '../../components/inspection/ExcludedByRulePanel';
import { executionQuestions, resolveExecutionTree } from '../../domain/applicability';
import type { ApplicabilityRule, ExecutionSection, RoutingQuestion } from '../../domain/applicability';

const PROCESSA: RoutingQuestion = {
  id: 'q-processa',
  text: 'Realiza processamento de artigos reutilizáveis?',
  type: 'boolean',
  askAt: 'execution',
  required: true,
};

const SECOES: ExecutionSection[] = [
  { id: 'sec-1', title: 'Estrutura', items: [{ id: 'item-1', description: 'Piso lavável' }] },
  {
    id: 'sec-2',
    title: 'Processamento próprio',
    items: [
      { id: 'item-3', description: 'Autoclave com registro de ciclo' },
      { id: 'item-4', description: 'Teste biológico semanal' },
    ],
  },
];

const REGRA: ApplicabilityRule = {
  id: 'regra-processamento',
  target: { type: 'section', id: 'sec-2' },
  expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: true }] },
};

const BASE = { sections: SECOES, rules: [REGRA], routingQuestions: [PROCESSA] };

describe('COND-08 · o bloco das perguntas de campo', () => {
  test('anuncia o que falta e o que a pergunta define — sem vocabulário de conformidade', () => {
    render(<RoutingQuestionsBlock questions={executionQuestions(BASE, {})} onAnswer={vi.fn()} />);

    expect(screen.getByText('1 obrigatória(s) em aberto')).toBeInTheDocument();
    expect(screen.getByText(/Define 1 seção/)).toBeInTheDocument();
    expect(screen.queryByText(/Conforme/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Não conforme/i)).not.toBeInTheDocument();
  });

  test('responder devolve o valor normalizado pelo domínio', () => {
    const onAnswer = vi.fn();
    render(<RoutingQuestionsBlock questions={executionQuestions(BASE, {})} onAnswer={onAnswer} />);

    fireEvent.click(screen.getByLabelText('Não'));
    expect(onAnswer).toHaveBeenCalledWith('q-processa', false);
  });

  test('"não foi possível determinar" grava a justificativa (contrato § 6.4)', () => {
    const onAnswer = vi.fn();
    render(<RoutingQuestionsBlock questions={executionQuestions(BASE, {})} onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Não foi possível determinar' }));
    fireEvent.change(screen.getByLabelText('Por que não foi possível determinar?'), {
      target: { value: 'sala fechada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(onAnswer).toHaveBeenCalledWith('q-processa', { undetermined: true, justification: 'sala fechada' });
  });

  test('a resposta indeterminada aparece com a justificativa e diz o efeito', () => {
    const respostas = { 'q-processa': { undetermined: true, justification: 'responsável ausente' } as const };
    render(<RoutingQuestionsBlock questions={executionQuestions(BASE, respostas)} onAnswer={vi.fn()} />);

    expect(screen.getByText(/responsável ausente/)).toBeInTheDocument();
    expect(screen.getByText(/fica pendente e aparece no relatório/)).toBeInTheDocument();
  });

  test('mostra quem respondeu por último — é o que a colega precisa ver', () => {
    const perguntas = executionQuestions(BASE, { 'q-processa': true }, {
      'q-processa': { at: '2026-08-27T13:30:00.000Z', by: 'Ana' },
    });
    render(<RoutingQuestionsBlock questions={perguntas} onAnswer={vi.fn()} />);
    expect(screen.getByText(/Respondida por Ana/)).toBeInTheDocument();
  });

  test('sem pergunta de campo, o bloco não existe', () => {
    const { container } = render(<RoutingQuestionsBlock questions={[]} onAnswer={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('COND-08 · o painel do que saiu do roteiro', () => {
  const arvore = resolveExecutionTree({
    ...BASE,
    answers: { 'q-processa': false },
    answeredItemIds: new Set(['item-3']),
  });

  test('nasce fechado, mas já diz quantos e que a resposta foi preservada', () => {
    render(<ExcludedByRulePanel excluded={arvore.excluded} answeredCount={arvore.counts.foraComResposta} />);

    expect(screen.getByText('Fora do roteiro por condição (2)')).toBeInTheDocument();
    expect(screen.getByText(/1 com resposta preservada/)).toBeInTheDocument();
    expect(screen.queryByText('Autoclave com registro de ciclo')).not.toBeInTheDocument();
  });

  test('aberto, mostra o motivo que o motor escreveu', () => {
    render(<ExcludedByRulePanel excluded={arvore.excluded} answeredCount={arvore.counts.foraComResposta} />);

    fireEvent.click(screen.getByRole('button', { name: /Fora do roteiro por condição/ }));
    expect(screen.getByText('Autoclave com registro de ciclo')).toBeInTheDocument();
    expect(screen.getByText('Resposta preservada')).toBeInTheDocument();
    expect(screen.getAllByText(/Não aplicável por regra/).length).toBeGreaterThan(0);
  });

  test('sem nada fora, o painel não ocupa espaço', () => {
    const { container } = render(<ExcludedByRulePanel excluded={[]} answeredCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
