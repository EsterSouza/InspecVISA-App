// ============================================================
// COND-05 — perguntas de roteamento: onde são respondidas, o que é resposta
// válida, o que trava o bloco e o que o validador acusa.
//
// Contrato: docs/contrato-aplicabilidade.md (§ 3, § 4.1, § 6.4)
// Cenários: docs/gherkin/aplicabilidade.feature
// ============================================================

import { describe, expect, test } from 'vitest';
import {
  askAtOf,
  declaredRoutingContext,
  describeRoutingAnswer,
  evaluateApplicability,
  isAnswered,
  isDetermined,
  missingRequiredQuestions,
  parseRoutingAnswer,
  routingGate,
  routingQuestionsFor,
  targetsControlledBy,
  validateTemplateRules,
} from '../../domain/applicability';
import type {
  ConditionalTemplate,
  RoutingAnswers,
  RoutingQuestion,
  ValidationIssue,
} from '../../domain/applicability';

const PROCESSA: RoutingQuestion = {
  id: 'q-processa',
  text: 'Realiza processamento de artigos?',
  type: 'boolean',
  askAt: 'execution',
  required: true,
  sectionId: 'sec-geral',
};

// `value` e `label` propositalmente diferentes: é assim que o teste prova que a
// resposta guarda o id da opção, nunca o texto que aparece na tela.
const MODALIDADE: RoutingQuestion = {
  id: 'q-modalidade',
  text: 'O processamento é próprio ou terceirizado?',
  type: 'single_choice',
  askAt: 'wizard',
  options: [
    { value: 'proprio', label: 'Próprio' },
    { value: 'terc', label: 'Terceirizado' },
  ],
};

const EQUIPAMENTOS: RoutingQuestion = {
  id: 'q-equipamentos',
  text: 'Quais equipamentos existem?',
  type: 'multi_choice',
  askAt: 'wizard',
  options: [
    { value: 'autoclave', label: 'Autoclave' },
    { value: 'laser', label: 'Laser' },
  ],
};

const SALAS: RoutingQuestion = {
  id: 'q-salas',
  text: 'Quantas salas de procedimento?',
  type: 'number',
  askAt: 'wizard',
};

function roteiro(overrides: Partial<ConditionalTemplate> = {}): ConditionalTemplate {
  return {
    sections: [
      { id: 'sec-geral', title: 'Geral', items: [{ id: 'item-1' }] },
      { id: 'sec-proc', title: 'Processamento próprio', items: [{ id: 'item-2' }] },
    ],
    routingQuestions: [PROCESSA, MODALIDADE, EQUIPAMENTOS, SALAS],
    rules: [
      {
        id: 'regra-proc',
        target: { type: 'section', id: 'sec-proc' },
        expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: true }] },
      },
      {
        id: 'regra-item',
        target: { type: 'item', id: 'item-2' },
        expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-modalidade', operator: 'equals', value: 'proprio' }] },
      },
      {
        id: 'regra-equip',
        target: { type: 'item', id: 'item-1' },
        expression: { combinator: 'any', conditions: [{ source: 'question', field: 'q-equipamentos', operator: 'contains', value: 'laser' }] },
      },
      {
        id: 'regra-salas',
        target: { type: 'section', id: 'sec-geral' },
        expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-salas', operator: 'greater', value: 0 }] },
      },
    ],
    ...overrides,
  };
}

function codigos(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

describe('onde a pergunta é respondida', () => {
  test('ausente vale execução — o lado conservador é perguntar em campo', () => {
    expect(askAtOf({ id: 'q', text: 'Pergunta', type: 'boolean' })).toBe('execution');
    expect(askAtOf({ id: 'q', text: 'Pergunta', type: 'boolean', askAt: 'wizard' })).toBe('wizard');
  });

  test('o wizard recebe só as perguntas de wizard, e a execução só as de campo', () => {
    const template = roteiro();
    expect(routingQuestionsFor(template, 'wizard').map((q) => q.id)).toEqual([
      'q-modalidade',
      'q-equipamentos',
      'q-salas',
    ]);
    expect(routingQuestionsFor(template, 'execution').map((q) => q.id)).toEqual(['q-processa']);
  });

  test('pergunta aposentada não é perguntada de novo, mas pode ser exibida', () => {
    const template = roteiro({
      routingQuestions: [{ ...MODALIDADE, retiredAt: '2026-08-01T00:00:00.000Z' }],
    });
    expect(routingQuestionsFor(template, 'wizard')).toHaveLength(0);
    expect(routingQuestionsFor(template, 'wizard', { includeRetired: true })).toHaveLength(1);
  });
});

describe('resposta normalizada', () => {
  test('booleano aceita Sim/Não e texto, e recusa o que não dá para ler', () => {
    expect(parseRoutingAnswer(PROCESSA, true).answer).toBe(true);
    expect(parseRoutingAnswer(PROCESSA, 'Sim').answer).toBe(true);
    expect(parseRoutingAnswer(PROCESSA, 'false').answer).toBe(false);
    expect(parseRoutingAnswer(PROCESSA, 'mais ou menos').error).toBeTruthy();
  });

  test('escolha guarda o VALOR da opção — nunca o rótulo', () => {
    expect(parseRoutingAnswer(MODALIDADE, 'terc').answer).toBe('terc');
    // "Terceirizado" é o rótulo: renomear o rótulo não pode virar resposta.
    expect(parseRoutingAnswer(MODALIDADE, 'Terceirizado').answer).toBeNull();
    expect(parseRoutingAnswer(MODALIDADE, 'Terceirizado').error).toBeTruthy();
  });

  test('múltipla escolha remove repetição, recusa opção inexistente e vazio limpa', () => {
    expect(parseRoutingAnswer(EQUIPAMENTOS, ['laser', 'laser', 'autoclave']).answer).toEqual(['laser', 'autoclave']);
    expect(parseRoutingAnswer(EQUIPAMENTOS, ['raio-x']).error).toBeTruthy();
    expect(parseRoutingAnswer(EQUIPAMENTOS, []).answer).toBeNull();
  });

  test('número aceita vírgula e recusa texto', () => {
    expect(parseRoutingAnswer(SALAS, '2,5').answer).toBe(2.5);
    expect(parseRoutingAnswer(SALAS, 'duas').error).toBeTruthy();
  });

  test('"não foi possível determinar" atravessa com a justificativa aparada', () => {
    const parsed = parseRoutingAnswer(PROCESSA, { undetermined: true, justification: '  sala trancada  ' });
    expect(parsed.answer).toEqual({ undetermined: true, justification: 'sala trancada' });
    expect(isAnswered(parsed.answer)).toBe(true);
    expect(isDetermined(parsed.answer)).toBe(false);
  });
});

describe('obrigatória libera o bloco', () => {
  test('obrigatória sem resposta segura; respondida libera', () => {
    const template = roteiro();
    expect(missingRequiredQuestions(template, {}).map((q) => q.id)).toEqual(['q-processa']);
    expect(routingGate(template, { 'q-processa': true }).ready).toBe(true);
  });

  test('"não foi possível determinar" também libera — campo é campo (contrato § 6.4)', () => {
    const answers: RoutingAnswers = { 'q-processa': { undetermined: true, justification: 'sem acesso' } };
    expect(routingGate(roteiro(), answers).ready).toBe(true);
  });

  test('o gate do wizard não cobra pergunta que só se responde em campo', () => {
    expect(routingGate(roteiro(), {}, 'wizard').ready).toBe(true);
    expect(routingGate(roteiro(), {}, 'execution').missing.map((q) => q.id)).toEqual(['q-processa']);
  });

  test('pergunta aposentada nunca trava', () => {
    const template = roteiro({ routingQuestions: [{ ...PROCESSA, retiredAt: '2026-08-01T00:00:00.000Z' }] });
    expect(routingGate(template, {}).ready).toBe(true);
  });

  test('a pergunta sabe o que libera', () => {
    expect(targetsControlledBy(roteiro(), 'q-processa')).toEqual({ sections: ['sec-proc'], items: [] });
    expect(targetsControlledBy(roteiro(), 'q-modalidade')).toEqual({ sections: [], items: ['item-2'] });
  });
});

describe('como a resposta aparece no relatório (contexto declarado)', () => {
  const answers: RoutingAnswers = {
    'q-processa': true,
    'q-modalidade': 'terc',
    'q-equipamentos': ['laser'],
    'q-salas': 3,
  };

  test('mostra o rótulo da opção, na ordem do roteiro', () => {
    expect(declaredRoutingContext(roteiro(), answers)).toEqual([
      { questionId: 'q-processa', question: PROCESSA.text, answer: 'Sim', undetermined: false },
      { questionId: 'q-modalidade', question: MODALIDADE.text, answer: 'Terceirizado', undetermined: false },
      { questionId: 'q-equipamentos', question: EQUIPAMENTOS.text, answer: 'Laser', undetermined: false },
      { questionId: 'q-salas', question: SALAS.text, answer: '3', undetermined: false },
    ]);
  });

  test('pergunta sem resposta não entra: o relatório não afirma o que ninguém disse', () => {
    expect(declaredRoutingContext(roteiro(), {})).toEqual([]);
  });

  test('indisponível vira linha própria, com a justificativa', () => {
    const declarado = declaredRoutingContext(roteiro(), {
      'q-processa': { undetermined: true, justification: 'sala trancada' },
    });
    expect(declarado).toEqual([
      {
        questionId: 'q-processa',
        question: PROCESSA.text,
        answer: 'Não foi possível determinar',
        undetermined: true,
        justification: 'sala trancada',
      },
    ]);
  });

  test('sem resposta é dito como tal, nunca como "Não"', () => {
    expect(describeRoutingAnswer(PROCESSA, undefined)).toBe('Sem resposta');
    expect(describeRoutingAnswer(PROCESSA, false)).toBe('Não');
  });
});

describe('o validador olha para as perguntas (COND-05)', () => {
  test('§ 4.1 — perguntar o que já está no cadastro é avisado, não proibido', () => {
    const issues = validateTemplateRules({
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [
        { id: 'q-uf', text: 'Qual o estado?', type: 'single_choice', options: [{ value: 'RJ', label: 'RJ' }] },
      ],
      rules: [
        {
          id: 'r1',
          target: { type: 'section', id: 'sec-1' },
          expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-uf', operator: 'equals', value: 'RJ' }] },
        },
      ],
    });
    const aviso = issues.find((issue) => issue.code === 'question_duplicates_context');
    expect(aviso?.severity).toBe('warning');
    expect(aviso?.field).toBe('uf');
    expect(aviso?.disablesRule).toBe(false);
  });

  test('pergunta que nenhuma condição usa é avisada — seria feita à toa', () => {
    const issues = validateTemplateRules({
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [SALAS],
      rules: [
        {
          id: 'r1',
          target: { type: 'section', id: 'sec-1' },
          expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }] },
        },
      ],
    });
    expect(codigos(issues)).toContain('unused_question');
  });

  test('roteiro sem regra nenhuma não acusa pergunta órfã — é rascunho, não erro', () => {
    const issues = validateTemplateRules({
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [SALAS],
      rules: [],
    });
    expect(codigos(issues)).not.toContain('unused_question');
  });

  test('opção repetida, opção sem valor, escolha sem opção e opção em pergunta que não é escolha', () => {
    const issues = validateTemplateRules({
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [
        { id: 'q-a', text: 'Escolha', type: 'single_choice', options: [{ value: 'x', label: 'X' }, { value: 'x', label: 'Outro X' }] },
        { id: 'q-b', text: 'Escolha vazia', type: 'multi_choice', options: [] },
        { id: 'q-c', text: 'Sim ou não', type: 'boolean', options: [{ value: 's', label: 'S' }] },
        { id: 'q-d', text: 'Opção sem valor', type: 'single_choice', options: [{ value: '  ', label: 'Vazia' }] },
      ],
      rules: [],
    });
    expect(codigos(issues)).toEqual(expect.arrayContaining([
      'duplicate_option',
      'question_without_options',
      'invalid_option',
    ]));
    expect(issues.filter((issue) => issue.code === 'invalid_option')).toHaveLength(2);
  });

  test('id de pergunta não pode ser id de item — as duas coisas nunca se misturam', () => {
    const issues = validateTemplateRules({
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [{ id: 'item-1', text: 'Pergunta disfarçada de item', type: 'boolean' }],
      rules: [],
    });
    const colisao = issues.find((issue) => issue.code === 'question_id_collides');
    expect(colisao?.severity).toBe('error');
  });

  test('pergunta do wizard não cria ciclo, mesmo apontando para a própria seção', () => {
    const comCiclo = validateTemplateRules({
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [{ id: 'q-1', text: 'Depende de si mesma?', type: 'boolean', sectionId: 'sec-1' }],
      rules: [
        {
          id: 'r1',
          target: { type: 'section', id: 'sec-1' },
          expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-1', operator: 'equals', value: true }] },
        },
      ],
    });
    expect(codigos(comCiclo)).toContain('cycle');

    const noWizard = validateTemplateRules({
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [{ id: 'q-1', text: 'Respondida antes da visita', type: 'boolean', askAt: 'wizard', sectionId: 'sec-1' }],
      rules: [
        {
          id: 'r1',
          target: { type: 'section', id: 'sec-1' },
          expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-1', operator: 'equals', value: true }] },
        },
      ],
    });
    expect(codigos(noWizard)).not.toContain('cycle');
  });

  test('aviso não desabilita regra: o motor segue avaliando normalmente', () => {
    const template: ConditionalTemplate = {
      sections: [{ id: 'sec-1', items: [{ id: 'item-1' }] }],
      routingQuestions: [
        { id: 'q-uf', text: 'Qual o estado?', type: 'single_choice', askAt: 'wizard', options: [{ value: 'RJ', label: 'RJ' }] },
      ],
      rules: [
        {
          id: 'r1',
          target: { type: 'section', id: 'sec-1' },
          expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-uf', operator: 'equals', value: 'RJ' }] },
        },
      ],
    };
    const resultado = evaluateApplicability({ template, answers: { 'q-uf': 'RJ' } });
    expect(resultado.sections['sec-1'].state).toBe('aplicavel');
    expect(resultado.validation.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});
