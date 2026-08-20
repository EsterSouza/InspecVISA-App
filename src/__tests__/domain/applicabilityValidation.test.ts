// ============================================================
// COND-02 — validador estrutural.
// A lista de erros vem do card: referência inexistente · tipo incompatível ·
// valor inválido · ciclo · pergunta aposentada · opção inexistente · condição
// impossível · regra sem destino · seção que depende de descendente de si mesma
// · id duplicado.
// ============================================================

import { describe, expect, test } from 'vitest';
import { evaluateApplicability, validateTemplateRules } from '../../domain/applicability';
import type { ApplicabilityRule, ConditionalTemplate, ContextField, ValidationCode } from '../../domain/applicability';

const PERGUNTA = {
  id: 'q-processa',
  text: 'Realiza processamento de artigos?',
  type: 'single_choice' as const,
  options: [
    { value: 'proprio', label: 'Próprio' },
    { value: 'terceirizado', label: 'Terceirizado' },
  ],
  sectionId: 'sec-2',
};

function roteiro(rules: ApplicabilityRule[], overrides: Partial<ConditionalTemplate> = {}): ConditionalTemplate {
  return {
    sections: [
      { id: 'sec-1', title: 'Uma', items: [{ id: 'item-1' }] },
      { id: 'sec-2', title: 'Outra', items: [{ id: 'item-2' }] },
    ],
    routingQuestions: [PERGUNTA],
    rules,
    ...overrides,
  };
}

/**
 * Os códigos de ERRO do roteiro. Aviso (`warning`) fica de fora de propósito:
 * ele não reprova publicação, e "não é acusada" nestes testes sempre quis dizer
 * "não vira erro". Os avisos do COND-05 têm suíte própria
 * (src/__tests__/domain/routingQuestions.test.ts).
 */
function codigos(template: ConditionalTemplate, contextFields?: ContextField[]): ValidationCode[] {
  return validateTemplateRules(template, contextFields)
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.code);
}

describe('referências', () => {
  test('regra sem destino', () => {
    const rules = [{ id: 'r', target: { type: 'section' as const, id: '' }, expression: { combinator: 'all' as const, conditions: [{ source: 'context' as const, field: 'uf', operator: 'equals' as const, value: 'RJ' }] } }];
    expect(codigos(roteiro(rules))).toContain('rule_without_target');
  });

  test('alvo inexistente', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: { type: 'item', id: 'item-fantasma' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }] } }];
    expect(codigos(roteiro(rules))).toContain('unknown_target');
  });

  test('dado de contexto inexistente', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'numeroDaSorte', operator: 'equals', value: 7 }] } }];
    expect(codigos(roteiro(rules))).toContain('unknown_context_field');
  });

  test('pergunta inexistente', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-fantasma', operator: 'equals', value: 'x' }] } }];
    expect(codigos(roteiro(rules))).toContain('unknown_question');
  });

  test('catálogo de contexto é parâmetro: campo novo passa a valer sem tocar no motor', () => {
    const campos: ContextField[] = [{ key: 'modalidade', label: 'Modalidade', type: 'text' }];
    const rules: ApplicabilityRule[] = [{ id: 'r', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'modalidade', operator: 'equals', value: 'presencial' }] } }];
    expect(codigos(roteiro(rules), campos)).toEqual([]);
  });
});

describe('tipo e valor', () => {
  const alvo = { type: 'section' as const, id: 'sec-1' };

  test('operador incompatível com o tipo da fonte', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: alvo, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'capacidadeIlpi', operator: 'contains', value: '2' }] } }];
    expect(codigos(roteiro(rules))).toContain('incompatible_operator');
  });

  test('grupo vazio é erro, não "sempre verdadeiro"', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: alvo, expression: { combinator: 'all', conditions: [] } }];
    expect(codigos(roteiro(rules))).toContain('empty_group');
  });

  test.each([
    ['falta o valor', { source: 'context' as const, field: 'uf', operator: 'equals' as const }],
    ['valor de lista num operador escalar', { source: 'context' as const, field: 'uf', operator: 'equals' as const, value: ['RJ', 'SP'] }],
    ['lista vazia', { source: 'context' as const, field: 'uf', operator: 'in_list' as const, value: [] }],
    ['valor não numérico em campo numérico', { source: 'context' as const, field: 'capacidadeIlpi', operator: 'greater' as const, value: 'muitos' }],
    ['data ilegível', { source: 'context' as const, field: 'inicioDaInspecao', operator: 'less' as const, value: 'ontem' }],
    ['valor num operador que não recebe valor', { source: 'context' as const, field: 'uf', operator: 'exists' as const, value: 'RJ' }],
  ])('valor inválido: %s', (_nome, condition) => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: alvo, expression: { combinator: 'all', conditions: [condition] } }];
    expect(codigos(roteiro(rules))).toContain('invalid_value');
  });

  test('opção que não existe na pergunta', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: alvo, expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: 'hibrido' }] } }];
    const issues = validateTemplateRules(roteiro(rules));
    const opcao = issues.find((issue) => issue.code === 'unknown_option');
    expect(opcao?.severity).toBe('error');
    // Não desabilita: a condição continua avaliável (dá falso, sempre). O que
    // ela impede é publicar.
    expect(opcao?.disablesRule).toBe(false);
    expect(evaluateApplicability({ template: roteiro(rules), answers: { 'q-processa': 'proprio' } }).sections['sec-1'].state).toBe('nao_aplicavel_por_regra');
  });
});

describe('ciclo de vida da pergunta', () => {
  test('pergunta aposentada com dependente é erro de publicação, mas não trava inspeção em andamento', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: 'proprio' }] } }];
    const template = roteiro(rules, { routingQuestions: [{ ...PERGUNTA, retiredAt: '2026-08-01T00:00:00.000Z' }] });

    const aposentada = validateTemplateRules(template).find((issue) => issue.code === 'retired_question');
    expect(aposentada?.severity).toBe('error');
    expect(aposentada?.disablesRule).toBe(false);

    // Contrato § 8, caso 14: a inspeção já criada segue com a revisão congelada.
    expect(evaluateApplicability({ template, answers: { 'q-processa': 'proprio' } }).sections['sec-1'].state).toBe('aplicavel');
  });
});

describe('ids duplicados', () => {
  test.each([
    ['seção', { sections: [{ id: 'sec-1', items: [] }, { id: 'sec-1', items: [] }] }],
    ['item', { sections: [{ id: 'sec-1', items: [{ id: 'item-1' }, { id: 'item-1' }] }] }],
    ['pergunta', { routingQuestions: [PERGUNTA, PERGUNTA] }],
  ])('%s repetida', (_nome, overrides) => {
    expect(codigos(roteiro([], overrides as Partial<ConditionalTemplate>))).toContain('duplicate_id');
  });

  test('regra repetida no mesmo alvo é ambígua e nenhuma vale', () => {
    const rules: ApplicabilityRule[] = [
      { id: 'r1', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }] } },
      { id: 'r2', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'SP' }] } },
    ];
    expect(codigos(roteiro(rules))).toContain('duplicate_rule_target');
    expect(evaluateApplicability({ template: roteiro(rules), context: { uf: 'RJ' } }).sections['sec-1'].reason).toBe('rule_error');
  });
});

describe('condição impossível', () => {
  const alvo = { type: 'section' as const, id: 'sec-1' };
  const impossiveis = [
    ['igual a dois valores diferentes', [{ source: 'context' as const, field: 'uf', operator: 'equals' as const, value: 'RJ' }, { source: 'context' as const, field: 'uf', operator: 'equals' as const, value: 'SP' }]],
    ['igual e diferente do mesmo valor', [{ source: 'context' as const, field: 'uf', operator: 'equals' as const, value: 'RJ' }, { source: 'context' as const, field: 'uf', operator: 'not_equals' as const, value: 'RJ' }]],
    ['existe e não existe', [{ source: 'context' as const, field: 'uf', operator: 'exists' as const }, { source: 'context' as const, field: 'uf', operator: 'not_exists' as const }]],
    ['igual fora da lista exigida', [{ source: 'context' as const, field: 'uf', operator: 'equals' as const, value: 'MG' }, { source: 'context' as const, field: 'uf', operator: 'in_list' as const, value: ['RJ', 'SP'] }]],
    ['listas sem interseção', [{ source: 'context' as const, field: 'uf', operator: 'in_list' as const, value: ['MG'] }, { source: 'context' as const, field: 'uf', operator: 'in_list' as const, value: ['RJ', 'SP'] }]],
    ['faixa numérica vazia', [{ source: 'context' as const, field: 'capacidadeIlpi', operator: 'greater' as const, value: 50 }, { source: 'context' as const, field: 'capacidadeIlpi', operator: 'less' as const, value: 20 }]],
  ] as const;

  test.each(impossiveis)('%s', (_nome, conditions) => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: alvo, expression: { combinator: 'all', conditions: [...conditions] } }];
    expect(codigos(roteiro(rules))).toContain('impossible_condition');
  });

  test('faixa numérica válida não é acusada', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: alvo, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 20 }, { source: 'context', field: 'capacidadeIlpi', operator: 'less', value: 50 }] } }];
    expect(codigos(roteiro(rules))).toEqual([]);
  });

  test('as mesmas condições em QUALQUER não são impossíveis', () => {
    const rules: ApplicabilityRule[] = [{ id: 'r', target: alvo, expression: { combinator: 'any', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }, { source: 'context', field: 'uf', operator: 'equals', value: 'SP' }] } }];
    expect(codigos(roteiro(rules))).toEqual([]);
  });
});

describe('ciclo', () => {
  const perguntaDaSecao1 = { id: 'q-a', text: 'A?', type: 'boolean' as const, sectionId: 'sec-1' };
  const perguntaDaSecao2 = { id: 'q-b', text: 'B?', type: 'boolean' as const, sectionId: 'sec-2' };
  const perguntaDaSecao3 = { id: 'q-c', text: 'C?', type: 'boolean' as const, sectionId: 'sec-3' };

  function comSecoes(rules: ApplicabilityRule[], routingQuestions: typeof perguntaDaSecao1[]): ConditionalTemplate {
    return {
      sections: [
        { id: 'sec-1', title: 'A', items: [{ id: 'item-1' }] },
        { id: 'sec-2', title: 'B', items: [{ id: 'item-2' }] },
        { id: 'sec-3', title: 'C', items: [{ id: 'item-3' }] },
      ],
      routingQuestions,
      rules,
    };
  }

  const dependeDe = (secao: string, pergunta: string, id: string): ApplicabilityRule => ({
    id,
    target: { type: 'section', id: secao },
    expression: { combinator: 'all', conditions: [{ source: 'question', field: pergunta, operator: 'equals', value: true }] },
  });

  test('ciclo direto entre duas seções', () => {
    const template = comSecoes([dependeDe('sec-1', 'q-b', 'r1'), dependeDe('sec-2', 'q-a', 'r2')], [perguntaDaSecao1, perguntaDaSecao2]);
    const ciclos = validateTemplateRules(template).filter((issue) => issue.code === 'cycle');
    expect(ciclos.length).toBeGreaterThan(0);
    expect(ciclos[0].message).toContain('sec-1');
    expect(ciclos[0].message).toContain('sec-2');
    // Todas as seções do ciclo ficam pendentes e visíveis — nenhuma some.
    const { sections } = evaluateApplicability({ template });
    expect(sections['sec-1'].reason).toBe('rule_error');
    expect(sections['sec-2'].reason).toBe('rule_error');
  });

  test('ciclo indireto A → B → C → A', () => {
    const template = comSecoes(
      [dependeDe('sec-1', 'q-b', 'r1'), dependeDe('sec-2', 'q-c', 'r2'), dependeDe('sec-3', 'q-a', 'r3')],
      [perguntaDaSecao1, perguntaDaSecao2, perguntaDaSecao3]
    );
    expect(codigos(template)).toContain('cycle');
  });

  test('seção que depende de pergunta de dentro dela mesma', () => {
    const template = comSecoes([dependeDe('sec-1', 'q-a', 'r1')], [perguntaDaSecao1]);
    expect(codigos(template)).toContain('cycle');
  });

  test('item que depende de pergunta da própria seção não é ciclo', () => {
    const regraDeItem: ApplicabilityRule = {
      id: 'r-item',
      target: { type: 'item', id: 'item-1' },
      expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-a', operator: 'equals', value: true }] },
    };
    expect(codigos(comSecoes([regraDeItem], [perguntaDaSecao1]))).toEqual([]);
  });

  test('cadeia sem volta não é ciclo', () => {
    const template = comSecoes([dependeDe('sec-1', 'q-b', 'r1'), dependeDe('sec-2', 'q-c', 'r2')], [perguntaDaSecao2, perguntaDaSecao3]);
    expect(codigos(template)).toEqual([]);
  });
});
