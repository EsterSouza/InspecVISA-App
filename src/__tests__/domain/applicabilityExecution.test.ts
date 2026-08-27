// ============================================================
// COND-08 — a execução adaptativa, do lado puro.
//
// O aceite do card em quatro blocos: **o que a tela mostra** (aplicável +
// pendente; o que saiu por regra vai para a lista de excluídos, com resposta
// preservada) · **o que a mudança de resposta tira e devolve** (a confirmação
// com número do contrato § 6.1) · **convergência entre dispositivos** (merge por
// pergunta, nunca do objeto inteiro) · **as perguntas de campo**.
// ============================================================

import { describe, expect, test } from 'vitest';
import {
  answerChangeImpact,
  executionQuestions,
  mergeRoutingAnswers,
  pendingBlockers,
  resolveExecutionTree,
  stampRoutingAnswer,
  undeterminedQuestions,
} from '../../domain/applicability';
import type {
  ApplicabilityRule,
  ExecutionSection,
  RoutingQuestion,
} from '../../domain/applicability';

const PROCESSA: RoutingQuestion = {
  id: 'q-processa',
  text: 'Realiza processamento de artigos reutilizáveis?',
  type: 'boolean',
  askAt: 'execution',
  sectionId: 'sec-1',
};

const INVASIVO: RoutingQuestion = {
  id: 'q-invasivo',
  text: 'Realiza procedimento invasivo?',
  type: 'boolean',
  askAt: 'execution',
  required: true,
};

const SECOES: ExecutionSection[] = [
  {
    id: 'sec-1',
    title: 'Estrutura',
    items: [
      { id: 'item-1', description: 'Piso lavável' },
      { id: 'item-2', description: 'Pia com água corrente' },
    ],
  },
  {
    id: 'sec-2',
    title: 'Processamento próprio',
    items: [
      { id: 'item-3', description: 'Autoclave com registro' },
      { id: 'item-4', description: 'Teste biológico semanal' },
    ],
  },
];

/** Seção 2 só aparece quando a consultora responde "Sim" ao processamento. */
const REGRA_SECAO: ApplicabilityRule = {
  id: 'regra-processamento',
  target: { type: 'section', id: 'sec-2' },
  expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: true }] },
};

/** Item 2 só aparece no RJ — regra de contexto, sem pergunta. */
const REGRA_ITEM: ApplicabilityRule = {
  id: 'regra-pia-rj',
  target: { type: 'item', id: 'item-2' },
  expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'in_list', value: ['RJ'] }] },
};

const BASE = {
  sections: SECOES,
  rules: [REGRA_SECAO, REGRA_ITEM],
  routingQuestions: [PROCESSA, INVASIVO],
};

describe('COND-08 · a árvore que a execução mostra', () => {
  test('roteiro sem regra é o roteiro inteiro, como hoje', () => {
    const arvore = resolveExecutionTree({ sections: SECOES });
    expect(arvore.sections.map((s) => s.id)).toEqual(['sec-1', 'sec-2']);
    expect(arvore.excluded).toEqual([]);
    expect(arvore.counts).toMatchObject({ cadastrados: 4, aplicaveis: 4, foraPorRegra: 0, pendentes: 0 });
  });

  test('seção não aplicável sai da tela e vai para a lista, com o motivo', () => {
    const arvore = resolveExecutionTree({ ...BASE, context: { uf: 'RJ' }, answers: { 'q-processa': false } });

    expect(arvore.sections.map((s) => s.id)).toEqual(['sec-1']);
    const secao = arvore.excluded.find((alvo) => alvo.type === 'section');
    expect(secao?.id).toBe('sec-2');
    expect(secao?.decision.explanation).toContain('Não aplicável por regra');
    expect(arvore.counts).toMatchObject({ cadastrados: 4, aplicaveis: 2, foraPorRegra: 2 });
  });

  test('item da seção que saiu só é listado um a um quando tem resposta', () => {
    const semResposta = resolveExecutionTree({ ...BASE, context: { uf: 'RJ' }, answers: { 'q-processa': false } });
    expect(semResposta.excluded.filter((alvo) => alvo.type === 'item')).toHaveLength(0);

    const comResposta = resolveExecutionTree({
      ...BASE,
      context: { uf: 'RJ' },
      answers: { 'q-processa': false },
      answeredItemIds: new Set(['item-3']),
    });
    const itens = comResposta.excluded.filter((alvo) => alvo.type === 'item');
    expect(itens.map((alvo) => alvo.id)).toEqual(['item-3']);
    expect(itens[0].sectionTitle).toBe('Processamento próprio');
    expect(comResposta.counts.foraComResposta).toBe(1);
  });

  test('item não aplicável sai da seção que continua na tela', () => {
    const arvore = resolveExecutionTree({ ...BASE, context: { uf: 'SP' }, answers: { 'q-processa': true } });
    const secao1 = arvore.sections.find((s) => s.id === 'sec-1');
    expect(secao1?.items.map((i) => i.id)).toEqual(['item-1']);
    expect(arvore.excluded.map((alvo) => alvo.id)).toEqual(['item-2']);
    expect(arvore.sections.map((s) => s.id)).toEqual(['sec-1', 'sec-2']);
  });

  test('pergunta sem resposta deixa a seção PENDENTE — visível, nunca oculta', () => {
    const arvore = resolveExecutionTree({ ...BASE, context: { uf: 'RJ' } });
    expect(arvore.sections.map((s) => s.id)).toEqual(['sec-1', 'sec-2']);
    expect(arvore.sectionState['sec-2'].state).toBe('pendente_de_condicao');
    expect(arvore.counts).toMatchObject({ pendentes: 2, foraPorRegra: 0 });
  });

  test('"não foi possível determinar" mantém o item na tela, como pendente declarado', () => {
    const arvore = resolveExecutionTree({
      ...BASE,
      context: { uf: 'RJ' },
      answers: { 'q-processa': { undetermined: true, justification: 'sala fechada' } },
    });
    expect(arvore.sections.map((s) => s.id)).toEqual(['sec-1', 'sec-2']);
    expect(arvore.sectionState['sec-2'].reason).toBe('declared_undetermined');
    expect(arvore.sectionState['sec-2'].justifications).toEqual(['sala fechada']);
  });

  test('regra quebrada não esconde requisito: item pendente com o erro na explicação', () => {
    const arvore = resolveExecutionTree({
      sections: SECOES,
      rules: [{ id: 'r-orfa', target: { type: 'item', id: 'item-1' }, expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-que-nao-existe', operator: 'equals', value: true }] } }],
    });
    expect(arvore.sections[0].items.map((i) => i.id)).toEqual(['item-1', 'item-2']);
    expect(arvore.itemState['item-1'].reason).toBe('rule_error');
    expect(arvore.validation.some((issue) => issue.severity === 'error')).toBe(true);
  });

  test('seção aplicável que perdeu todos os itens continua na tela para explicar', () => {
    const arvore = resolveExecutionTree({
      sections: [{ id: 'sec-1', title: 'Estrutura', items: [{ id: 'item-1' }] }],
      rules: [{ id: 'r', target: { type: 'item', id: 'item-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }] } }],
      context: { uf: 'SP' },
    });
    expect(arvore.sections).toHaveLength(1);
    expect(arvore.sections[0].items).toEqual([]);
  });
});

describe('COND-08 · o que impede fechar a inspeção (contrato § 6.4)', () => {
  test('pergunta sem resposta bloqueia: a árvore real não é conhecida', () => {
    const arvore = resolveExecutionTree({ ...BASE, context: { uf: 'RJ' } });
    expect(pendingBlockers(arvore).map((alvo) => alvo.id)).toEqual(['item-3', 'item-4']);
  });

  test('"não foi possível determinar" NÃO bloqueia — é a saída de campo', () => {
    const arvore = resolveExecutionTree({
      ...BASE,
      context: { uf: 'RJ' },
      answers: { 'q-processa': { undetermined: true, justification: 'sala fechada' } },
    });
    expect(pendingBlockers(arvore)).toEqual([]);
  });

  test('resolvida a pergunta, não sobra bloqueio', () => {
    const arvore = resolveExecutionTree({ ...BASE, context: { uf: 'RJ' }, answers: { 'q-processa': true } });
    expect(pendingBlockers(arvore)).toEqual([]);
  });

  test('regra quebrada bloqueia: é roteiro para consertar, não informação indisponível', () => {
    const arvore = resolveExecutionTree({
      sections: SECOES,
      rules: [{ id: 'r-orfa', target: { type: 'item', id: 'item-1' }, expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-fantasma', operator: 'equals', value: true }] } }],
    });
    expect(pendingBlockers(arvore).map((alvo) => alvo.id)).toEqual(['item-1']);
  });
});

describe('COND-08 · o que a mudança de resposta tira e devolve', () => {
  test('mudar para "Não" retira os itens já respondidos e pede confirmação', () => {
    const impacto = answerChangeImpact({
      ...BASE,
      context: { uf: 'RJ' },
      answers: { 'q-processa': true },
      answeredItemIds: new Set(['item-3', 'item-4']),
      questionId: 'q-processa',
      nextAnswer: false,
    });
    expect(impacto.needsConfirmation).toBe(true);
    expect(impacto.leaving.map((alvo) => alvo.id).sort()).toEqual(['item-3', 'item-4']);
    expect(impacto.leavingSections.map((alvo) => alvo.id)).toEqual(['sec-2']);
  });

  test('sem resposta gravada não há o que confirmar', () => {
    const impacto = answerChangeImpact({
      ...BASE,
      context: { uf: 'RJ' },
      answers: { 'q-processa': true },
      questionId: 'q-processa',
      nextAnswer: false,
    });
    expect(impacto.needsConfirmation).toBe(false);
    expect(impacto.leaving).toEqual([]);
    expect(impacto.leavingSections.map((alvo) => alvo.id)).toEqual(['sec-2']);
  });

  test('o caminho de volta: responder "Sim" de novo devolve os itens', () => {
    const impacto = answerChangeImpact({
      ...BASE,
      context: { uf: 'RJ' },
      answers: { 'q-processa': false },
      answeredItemIds: new Set(['item-3']),
      questionId: 'q-processa',
      nextAnswer: true,
    });
    expect(impacto.needsConfirmation).toBe(false);
    expect(impacto.returning.map((alvo) => alvo.id).sort()).toEqual(['item-3', 'item-4']);
  });

  test('limpar a resposta deixa pendente, não retira — e não pede confirmação', () => {
    const impacto = answerChangeImpact({
      ...BASE,
      context: { uf: 'RJ' },
      answers: { 'q-processa': true },
      answeredItemIds: new Set(['item-3']),
      questionId: 'q-processa',
      nextAnswer: null,
    });
    expect(impacto.needsConfirmation).toBe(false);
    expect(impacto.leaving).toEqual([]);
  });
});

describe('COND-08 · convergência entre dispositivos', () => {
  const cedo = { at: '2026-08-27T10:00:00.000Z', by: 'Ester' };
  const tarde = { at: '2026-08-27T11:00:00.000Z', by: 'Ana' };

  test('cada uma responde uma pergunta offline: o merge fica com as duas', () => {
    const local = stampRoutingAnswer(undefined, 'q-processa', true, cedo);
    const remoto = stampRoutingAnswer(undefined, 'q-invasivo', false, tarde);
    const merged = mergeRoutingAnswers(local, remoto);
    expect(merged.answers).toEqual({ 'q-processa': true, 'q-invasivo': false });
    expect(merged.meta['q-processa'].by).toBe('Ester');
    expect(merged.meta['q-invasivo'].by).toBe('Ana');
  });

  test('mesma pergunta: vence o carimbo mais recente, dos dois lados', () => {
    const local = stampRoutingAnswer(undefined, 'q-processa', true, cedo);
    const remoto = stampRoutingAnswer(undefined, 'q-processa', false, tarde);
    expect(mergeRoutingAnswers(local, remoto).answers['q-processa']).toBe(false);
    expect(mergeRoutingAnswers(remoto, local).answers['q-processa']).toBe(false);
  });

  test('resposta carimbada ganha de resposta sem carimbo (registro anterior ao card)', () => {
    const antigo = { answers: { 'q-processa': true } };
    const novo = stampRoutingAnswer(undefined, 'q-processa', false, cedo);
    expect(mergeRoutingAnswers(antigo, novo).answers['q-processa']).toBe(false);
    expect(mergeRoutingAnswers(novo, antigo).answers['q-processa']).toBe(false);
  });

  test('empate de relógio converge para o mesmo lado nos dois dispositivos', () => {
    const a = stampRoutingAnswer(undefined, 'q-processa', true, { at: cedo.at, by: 'Ester' });
    const b = stampRoutingAnswer(undefined, 'q-processa', false, { at: cedo.at, by: 'Ana' });
    expect(mergeRoutingAnswers(a, b).answers['q-processa']).toBe(mergeRoutingAnswers(b, a).answers['q-processa']);
  });

  test('apagar a resposta é uma escrita, não a ausência dela', () => {
    const local = stampRoutingAnswer(undefined, 'q-processa', true, cedo);
    const remoto = stampRoutingAnswer(local, 'q-processa', null, tarde);
    const merged = mergeRoutingAnswers(local, remoto);
    expect(merged.answers['q-processa']).toBeNull();
  });

  test('o merge é idempotente — sincronizar duas vezes não muda nada', () => {
    const local = stampRoutingAnswer(undefined, 'q-processa', true, cedo);
    const remoto = stampRoutingAnswer(undefined, 'q-invasivo', false, tarde);
    const uma = mergeRoutingAnswers(local, remoto);
    expect(mergeRoutingAnswers(uma, remoto)).toEqual(uma);
  });

  test('depois do merge as duas árvores são idênticas (contrato § 6.5)', () => {
    const local = stampRoutingAnswer(undefined, 'q-processa', true, cedo);
    const remoto = stampRoutingAnswer(undefined, 'q-processa', false, tarde);
    const noCelular = mergeRoutingAnswers(local, remoto);
    const noTablet = mergeRoutingAnswers(remoto, local);
    const arvoreA = resolveExecutionTree({ ...BASE, context: { uf: 'RJ' }, answers: noCelular.answers });
    const arvoreB = resolveExecutionTree({ ...BASE, context: { uf: 'RJ' }, answers: noTablet.answers });
    expect(arvoreA.sections.map((s) => s.id)).toEqual(arvoreB.sections.map((s) => s.id));
    expect(arvoreA.counts).toEqual(arvoreB.counts);
  });
});

describe('COND-08 · as perguntas de campo', () => {
  test('só as de execução, com o que cada uma controla', () => {
    const perguntas = executionQuestions(
      { ...BASE, routingQuestions: [{ ...PROCESSA }, { ...INVASIVO }, { id: 'q-wizard', text: 'UF?', type: 'single_choice', askAt: 'wizard' }] },
      {}
    );
    expect(perguntas.map((p) => p.question.id)).toEqual(['q-processa', 'q-invasivo']);
    expect(perguntas[0].controls).toEqual({ sections: 1, items: 0 });
  });

  test('obrigatória em aberto segura o bloco; respondida libera', () => {
    expect(executionQuestions(BASE, {}).find((p) => p.question.id === 'q-invasivo')?.blocking).toBe(true);
    expect(executionQuestions(BASE, { 'q-invasivo': true }).find((p) => p.question.id === 'q-invasivo')?.blocking).toBe(false);
  });

  test('"não foi possível determinar" também libera o bloco (contrato § 6.4)', () => {
    const respostas = { 'q-invasivo': { undetermined: true, justification: 'responsável ausente' } as const };
    expect(executionQuestions(BASE, respostas).find((p) => p.question.id === 'q-invasivo')?.blocking).toBe(false);
    expect(undeterminedQuestions(BASE, respostas).map((q) => q.id)).toEqual(['q-invasivo']);
  });

  test('pergunta aposentada some da tela, mas não quando já decidiu esta inspeção', () => {
    const aposentada = { ...BASE, routingQuestions: [{ ...PROCESSA, retiredAt: '2026-08-01T00:00:00.000Z' }] };
    expect(executionQuestions(aposentada, {})).toHaveLength(0);
    expect(executionQuestions(aposentada, { 'q-processa': true })).toHaveLength(1);
  });
});
