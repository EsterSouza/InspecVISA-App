// ============================================================
// COND-02 — tabelas verdade do motor de aplicabilidade.
// Cada bloco cita o parágrafo do contrato que ele guarda:
// docs/contrato-aplicabilidade.md · docs/gherkin/aplicabilidade.feature
// ============================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { evaluateApplicability } from '../../domain/applicability';
import type {
  ApplicabilityRule,
  ApplicabilityState,
  Condition,
  ConditionalTemplate,
  InspectionContext,
  RoutingAnswers,
  RoutingQuestion,
} from '../../domain/applicability';

const PERGUNTA_PROCESSA: RoutingQuestion = {
  id: 'q-processa',
  text: 'Realiza processamento de artigos?',
  type: 'boolean',
};

const PERGUNTA_MODALIDADE: RoutingQuestion = {
  id: 'q-modalidade',
  text: 'O processamento é próprio ou terceirizado?',
  type: 'single_choice',
  options: [
    { value: 'proprio', label: 'Próprio' },
    { value: 'terceirizado', label: 'Terceirizado' },
  ],
};

const PERGUNTAS = [PERGUNTA_PROCESSA, PERGUNTA_MODALIDADE];

function regra(conditions: Condition[], overrides: Partial<ApplicabilityRule> = {}): ApplicabilityRule {
  return {
    id: 'regra-1',
    target: { type: 'section', id: 'sec-1' },
    expression: { combinator: 'all', conditions },
    ...overrides,
  };
}

function roteiro(rules: ApplicabilityRule[], sections?: ConditionalTemplate['sections']): ConditionalTemplate {
  return {
    sections: sections || [
      { id: 'sec-1', title: 'Processamento próprio', items: [{ id: 'item-1' }, { id: 'item-2' }] },
    ],
    routingQuestions: PERGUNTAS,
    rules,
  };
}

function estadoDaSecao(condition: Condition, context: InspectionContext = {}, answers: RoutingAnswers = {}): ApplicabilityState {
  const result = evaluateApplicability({ template: roteiro([regra([condition])]), context, answers });
  return result.sections['sec-1'].state;
}

// ── Operadores, um a um (contrato § 5.1) ─────────────────────
describe('operadores sobre o contexto congelado', () => {
  const casos: [string, Condition, InspectionContext, ApplicabilityState][] = [
    ['igual casa a sigla', { source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }, { uf: 'RJ' }, 'aplicavel'],
    ['igual ignora caixa e acento', { source: 'context', field: 'municipio', operator: 'equals', value: 'Sao Paulo' }, { municipio: 'SÃO PAULO' }, 'aplicavel'],
    ['igual falha em UF diferente', { source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }, { uf: 'SP' }, 'nao_aplicavel_por_regra'],
    ['diferente', { source: 'context', field: 'uf', operator: 'not_equals', value: 'RJ' }, { uf: 'SP' }, 'aplicavel'],
    ['contém em texto é trecho', { source: 'context', field: 'municipio', operator: 'contains', value: 'belo horizonte' }, { municipio: 'Belo Horizonte' }, 'aplicavel'],
    ['contém em lista é pertinência', { source: 'context', field: 'tiposDeAlimento', operator: 'contains', value: 'pescados_crus' }, { tiposDeAlimento: ['dark_kitchen', 'pescados_crus'] }, 'aplicavel'],
    ['não contém', { source: 'context', field: 'tiposDeAlimento', operator: 'not_contains', value: 'pescados_crus' }, { tiposDeAlimento: ['dark_kitchen'] }, 'aplicavel'],
    ['maior', { source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 20 }, { capacidadeIlpi: 21 }, 'aplicavel'],
    ['maior falha no empate', { source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 20 }, { capacidadeIlpi: 20 }, 'nao_aplicavel_por_regra'],
    ['maior ou igual aceita o empate', { source: 'context', field: 'capacidadeIlpi', operator: 'greater_or_equal', value: 20 }, { capacidadeIlpi: 20 }, 'aplicavel'],
    ['menor', { source: 'context', field: 'capacidadeIlpi', operator: 'less', value: 20 }, { capacidadeIlpi: 19 }, 'aplicavel'],
    ['menor ou igual aceita o empate', { source: 'context', field: 'capacidadeIlpi', operator: 'less_or_equal', value: 20 }, { capacidadeIlpi: 20 }, 'aplicavel'],
    ['número em texto ainda compara como número', { source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 20 }, { capacidadeIlpi: '21' }, 'aplicavel'],
    ['pertence a lista com fonte escalar', { source: 'context', field: 'uf', operator: 'in_list', value: ['RJ', 'SP'] }, { uf: 'SP' }, 'aplicavel'],
    ['pertence a lista com fonte lista é interseção', { source: 'context', field: 'tiposDeAlimento', operator: 'in_list', value: ['pescados_crus', 'catering_eventos'] }, { tiposDeAlimento: ['dark_kitchen', 'catering_eventos'] }, 'aplicavel'],
    ['pertence a lista sem interseção', { source: 'context', field: 'tiposDeAlimento', operator: 'in_list', value: ['pescados_crus'] }, { tiposDeAlimento: ['dark_kitchen'] }, 'nao_aplicavel_por_regra'],
    ['não pertence a lista', { source: 'context', field: 'uf', operator: 'not_in_list', value: ['RJ', 'SP'] }, { uf: 'MG' }, 'aplicavel'],
    ['data anterior ao corte', { source: 'context', field: 'inicioDaInspecao', operator: 'less', value: '2026-08-16T00:00:00.000Z' }, { inicioDaInspecao: '2026-08-15T12:00:00.000Z' }, 'aplicavel'],
    ['data posterior ao corte', { source: 'context', field: 'inicioDaInspecao', operator: 'less', value: '2026-08-16T00:00:00.000Z' }, { inicioDaInspecao: '2026-08-17T12:00:00.000Z' }, 'nao_aplicavel_por_regra'],
  ];

  test.each(casos)('%s', (_nome, condition, context, esperado) => {
    expect(estadoDaSecao(condition, context)).toBe(esperado);
  });
});

// ── `null` / desconhecido (contrato § 5.2) ───────────────────
describe('ausência de valor é indeterminado, nunca falso', () => {
  test('pergunta sem resposta deixa a seção pendente', () => {
    expect(estadoDaSecao({ source: 'question', field: 'q-processa', operator: 'equals', value: true })).toBe('pendente_de_condicao');
  });

  test.each([undefined, null, '', []])('dado de contexto vazio (%j) deixa pendente, não assume não', (valor) => {
    expect(estadoDaSecao({ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }, { uf: valor as never })).toBe('pendente_de_condicao');
  });

  test('existe sobre fonte vazia resolve, não fica pendente', () => {
    expect(estadoDaSecao({ source: 'context', field: 'uf', operator: 'exists' }, { uf: '' })).toBe('nao_aplicavel_por_regra');
    expect(estadoDaSecao({ source: 'context', field: 'uf', operator: 'not_exists' }, { uf: '' })).toBe('aplicavel');
    expect(estadoDaSecao({ source: 'question', field: 'q-processa', operator: 'not_exists' })).toBe('aplicavel');
  });

  test('valor ilegível não vira falso — fica indeterminado', () => {
    expect(estadoDaSecao({ source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 20 }, { capacidadeIlpi: 'trinta' })).toBe('pendente_de_condicao');
  });
});

// ── Propagação em grupo (contrato § 5.2) ─────────────────────
describe('TODAS e QUALQUER: curto-circuito resolve, a dúvida só sobrevive quando faz diferença', () => {
  const verdadeira: Condition = { source: 'context', field: 'uf', operator: 'equals', value: 'RJ' };
  const falsa: Condition = { source: 'context', field: 'uf', operator: 'equals', value: 'SP' };
  const desconhecida: Condition = { source: 'question', field: 'q-processa', operator: 'equals', value: true };
  const contexto = { uf: 'RJ' };

  const casos: [string, 'all' | 'any', Condition[], ApplicabilityState][] = [
    ['TODAS: falsa com indeterminada ao lado derruba', 'all', [falsa, desconhecida], 'nao_aplicavel_por_regra'],
    ['TODAS: sem falsa e com indeterminada fica pendente', 'all', [verdadeira, desconhecida], 'pendente_de_condicao'],
    ['TODAS: todas verdadeiras', 'all', [verdadeira, verdadeira], 'aplicavel'],
    ['QUALQUER: uma verdadeira basta', 'any', [verdadeira, desconhecida], 'aplicavel'],
    ['QUALQUER: sem verdadeira e com indeterminada fica pendente', 'any', [falsa, desconhecida], 'pendente_de_condicao'],
    ['QUALQUER: todas falsas', 'any', [falsa, falsa], 'nao_aplicavel_por_regra'],
  ];

  test.each(casos)('%s', (_nome, combinator, conditions, esperado) => {
    const result = evaluateApplicability({
      template: roteiro([regra(conditions, { expression: { combinator, conditions } })]),
      context: contexto,
    });
    expect(result.sections['sec-1'].state).toBe(esperado);
  });
});

// ── `else` (contrato § 5.3) ──────────────────────────────────
describe('caminho alternativo', () => {
  const condicao: Condition = { source: 'question', field: 'q-modalidade', operator: 'equals', value: 'proprio' };

  function ramos(answers: RoutingAnswers) {
    const template: ConditionalTemplate = {
      sections: [
        { id: 'sec-proprio', title: 'Processamento próprio', items: [{ id: 'item-a' }] },
        { id: 'sec-terceirizado', title: 'Processamento terceirizado', items: [{ id: 'item-b' }] },
      ],
      routingQuestions: PERGUNTAS,
      rules: [
        { id: 'r-se', target: { type: 'section', id: 'sec-proprio' }, expression: { combinator: 'all', conditions: [condicao] } },
        { id: 'r-senao', target: { type: 'section', id: 'sec-terceirizado' }, branch: 'else', expression: { combinator: 'all', conditions: [condicao] } },
      ],
    };
    return evaluateApplicability({ template, answers }).sections;
  }

  test('resposta "próprio" abre o ramo principal e fecha o alternativo', () => {
    const secoes = ramos({ 'q-modalidade': 'proprio' });
    expect(secoes['sec-proprio'].state).toBe('aplicavel');
    expect(secoes['sec-terceirizado'].state).toBe('nao_aplicavel_por_regra');
  });

  test('resposta "terceirizado" abre o alternativo', () => {
    const secoes = ramos({ 'q-modalidade': 'terceirizado' });
    expect(secoes['sec-proprio'].state).toBe('nao_aplicavel_por_regra');
    expect(secoes['sec-terceirizado'].state).toBe('aplicavel');
  });

  test('sem resposta, nenhum ramo é assumido: os dois ficam pendentes', () => {
    const secoes = ramos({});
    expect(secoes['sec-proprio'].state).toBe('pendente_de_condicao');
    expect(secoes['sec-terceirizado'].state).toBe('pendente_de_condicao');
  });
});

// ── Herança (contrato § 5.4) ─────────────────────────────────
describe('item herda a aplicabilidade da seção', () => {
  function comRegraDeItem(sectionValue: string, answers: RoutingAnswers = {}) {
    const template: ConditionalTemplate = {
      sections: [{ id: 'sec-1', title: 'Processamento próprio', items: [{ id: 'item-1' }, { id: 'item-2' }] }],
      routingQuestions: PERGUNTAS,
      rules: [
        { id: 'r-secao', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: sectionValue }] } },
        // regra do item satisfeita de propósito: a da seção tem que ganhar
        { id: 'r-item', target: { type: 'item', id: 'item-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'categoria', operator: 'equals', value: 'ilpi' }] } },
      ],
    };
    return evaluateApplicability({ template, context: { uf: 'RJ', categoria: 'ilpi' }, answers });
  }

  test('seção não aplicável arrasta o item mesmo com regra própria satisfeita', () => {
    const { items, sections } = comRegraDeItem('SP');
    expect(sections['sec-1'].state).toBe('nao_aplicavel_por_regra');
    expect(items['item-1'].state).toBe('nao_aplicavel_por_regra');
    expect(items['item-1'].reason).toBe('inherited');
    expect(items['item-1'].inheritedFrom).toBe('sec-1');
    expect(items['item-2'].state).toBe('nao_aplicavel_por_regra');
  });

  test('seção pendente deixa o item pendente', () => {
    const template: ConditionalTemplate = {
      sections: [{ id: 'sec-1', title: 'Processamento próprio', items: [{ id: 'item-1' }] }],
      routingQuestions: PERGUNTAS,
      rules: [
        { id: 'r-secao', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: true }] } },
        { id: 'r-item', target: { type: 'item', id: 'item-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'SP' }] } },
      ],
    };
    const { items } = evaluateApplicability({ template, context: { uf: 'RJ' } });
    expect(items['item-1'].state).toBe('pendente_de_condicao');
    expect(items['item-1'].reason).toBe('inherited');
  });

  test('dentro de seção aplicável, o item resolve pela regra própria', () => {
    const { items } = comRegraDeItem('RJ');
    expect(items['item-1'].state).toBe('aplicavel');
    expect(items['item-1'].reason).toBe('rule_satisfied');
    expect(items['item-2'].reason).toBe('no_rule');
  });
});

// ── Compatibilidade (handoff, § Compatibilidade) ─────────────
describe('roteiro sem regra', () => {
  test('tudo aplicável, sem regra nenhuma configurada', () => {
    const { sections, items, validation } = evaluateApplicability({ template: roteiro([]) });
    expect(sections['sec-1'].state).toBe('aplicavel');
    expect(sections['sec-1'].reason).toBe('no_rule');
    expect(Object.values(items).every((d) => d.state === 'aplicavel')).toBe(true);
    expect(validation).toEqual([]);
  });
});

// ── "Não foi possível determinar" (contrato § 6.4) ───────────
describe('informação indisponível em campo', () => {
  test('fica pendente declarado, com a justificativa preservada', () => {
    const result = evaluateApplicability({
      template: roteiro([regra([{ source: 'question', field: 'q-processa', operator: 'equals', value: true }])]),
      answers: { 'q-processa': { undetermined: true, justification: 'Responsável ausente na visita' } },
    });
    const decisao = result.sections['sec-1'];
    expect(decisao.state).toBe('pendente_de_condicao');
    expect(decisao.reason).toBe('declared_undetermined');
    expect(decisao.justifications).toEqual(['Responsável ausente na visita']);
    expect(decisao.explanation).toContain('Responsável ausente na visita');
  });

  test('pendente declarado ao lado de pendente sem resposta continua cobrando a resposta', () => {
    const conditions: Condition[] = [
      { source: 'question', field: 'q-processa', operator: 'equals', value: true },
      { source: 'question', field: 'q-modalidade', operator: 'equals', value: 'proprio' },
    ];
    const result = evaluateApplicability({
      template: roteiro([regra(conditions, { expression: { combinator: 'all', conditions } })]),
      answers: { 'q-processa': { undetermined: true, justification: 'sem informação' } },
    });
    expect(result.sections['sec-1'].reason).toBe('awaiting_answer');
  });
});

// ── Erro do motor (contrato § 6.7 · regra inegociável 10) ────
describe('regra quebrada nunca esconde requisito', () => {
  test('condição que aponta para pergunta inexistente deixa o alvo pendente e visível', () => {
    const template: ConditionalTemplate = {
      sections: [{ id: 'sec-1', title: 'Seção', items: [{ id: 'item-1' }] }],
      routingQuestions: [],
      rules: [regra([{ source: 'question', field: 'q-que-nao-existe', operator: 'equals', value: true }])],
    };
    const { sections, items, validation } = evaluateApplicability({ template });
    expect(sections['sec-1'].state).toBe('pendente_de_condicao');
    expect(sections['sec-1'].reason).toBe('rule_error');
    expect(sections['sec-1'].explanation).toContain('erro de configuração');
    expect(items['item-1'].state).toBe('pendente_de_condicao');
    expect(validation.some((issue) => issue.code === 'unknown_question')).toBe(true);
  });

  test('nenhum caminho de erro produz "não aplicável"', () => {
    const quebradas: ApplicabilityRule[] = [
      regra([]),
      regra([{ source: 'context', field: 'campo-inexistente', operator: 'equals', value: 'x' }], { id: 'r2' }),
      regra([{ source: 'context', field: 'capacidadeIlpi', operator: 'contains', value: 'x' }], { id: 'r3' }),
      regra([{ source: 'context', field: 'uf', operator: 'equals' }], { id: 'r4' }),
    ];
    for (const rule of quebradas) {
      const { sections } = evaluateApplicability({ template: roteiro([rule]), context: { uf: 'RJ' } });
      expect(sections['sec-1'].state).toBe('pendente_de_condicao');
      expect(sections['sec-1'].reason).toBe('rule_error');
    }
  });
});

// ── Explicação (o que responde "por que este item apareceu?") ─
describe('explicação', () => {
  test('nomeia a pergunta, o valor esperado e o que foi respondido', () => {
    const decisao = evaluateApplicability({
      template: roteiro([regra([{ source: 'question', field: 'q-modalidade', operator: 'equals', value: 'proprio' }])]),
      answers: { 'q-modalidade': 'terceirizado' },
    }).sections['sec-1'];

    expect(decisao.explanation).toContain('Não aplicável por regra');
    expect(decisao.explanation).toContain('O processamento é próprio ou terceirizado?');
    expect(decisao.explanation).toContain('terceirizado');
    expect(decisao.conditions).toHaveLength(1);
    expect(decisao.conditions[0].truth).toBe('false');
    expect(decisao.conditions[0].observed).toBe('terceirizado');
  });

  test('pendente diz qual pergunta falta responder', () => {
    const decisao = evaluateApplicability({
      template: roteiro([regra([{ source: 'question', field: 'q-processa', operator: 'equals', value: true }])]),
    }).sections['sec-1'];
    expect(decisao.explanation).toContain('sem resposta');
    expect(decisao.explanation).toContain('Realiza processamento de artigos?');
  });

  test('item que herdou diz de qual seção herdou', () => {
    const template: ConditionalTemplate = {
      sections: [{ id: 'sec-1', title: 'Processamento próprio', items: [{ id: 'item-1' }] }],
      routingQuestions: PERGUNTAS,
      rules: [regra([{ source: 'question', field: 'q-processa', operator: 'equals', value: true }])],
    };
    const decisao = evaluateApplicability({ template, answers: { 'q-processa': false } }).items['item-1'];
    expect(decisao.explanation).toContain('Processamento próprio');
  });
});

// ── Aceite do card: determinístico e isolado ─────────────────
describe('determinismo', () => {
  const template: ConditionalTemplate = {
    sections: [
      { id: 'sec-1', title: 'Uma', items: [{ id: 'item-1' }, { id: 'item-2' }] },
      { id: 'sec-2', title: 'Outra', items: [{ id: 'item-3' }] },
    ],
    routingQuestions: PERGUNTAS,
    rules: [
      regra([{ source: 'context', field: 'uf', operator: 'in_list', value: ['RJ', 'SP'] }]),
      { id: 'r2', target: { type: 'section', id: 'sec-2' }, expression: { combinator: 'any', conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: true }] } },
      { id: 'r3', target: { type: 'item', id: 'item-2' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 30 }] } },
    ],
  };
  const input = { template, context: { uf: 'RJ', capacidadeIlpi: 40 }, answers: { 'q-processa': true } };

  test('mesma entrada, mesma saída', () => {
    expect(evaluateApplicability(input)).toEqual(evaluateApplicability(input));
  });

  test('a entrada não é modificada pela avaliação', () => {
    const antes = JSON.stringify(input);
    evaluateApplicability(input);
    expect(JSON.stringify(input)).toBe(antes);
  });

  test('a ordem das chaves acompanha a ordem do roteiro', () => {
    const { sections, items } = evaluateApplicability(input);
    expect(Object.keys(sections)).toEqual(['sec-1', 'sec-2']);
    expect(Object.keys(items)).toEqual(['item-1', 'item-2', 'item-3']);
  });
});

describe('pureza do pacote de domínio', () => {
  const arquivos = ['schema.ts', 'values.ts', 'validate.ts', 'evaluate.ts', 'index.ts'];
  // O card exige: sem React, sem Supabase, sem rede, sem banco, sem Date.now().
  const proibidos = [/Date\.now\(/, /new Date\(/, /Math\.random\(/, /\bfetch\(/, /localStorage/, /from '.*react/, /supabase/i, /dexie/i];

  test.each(arquivos)('%s não traz dependência de plataforma nem relógio', (arquivo) => {
    // Sem os comentários: o cabeçalho de cada arquivo cita justamente o que
    // não pode existir aqui, e a busca é literal.
    const fonte = readFileSync(join(process.cwd(), 'src/domain/applicability', arquivo), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const padrao of proibidos) {
      expect(fonte, `${arquivo} casou com ${padrao}`).not.toMatch(padrao);
    }
  });
});
