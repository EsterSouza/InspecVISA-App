// ============================================================
// COND-07 — simulador de cenário e gate de publicação.
//
// O aceite do card é "a Ester consegue testar um roteiro inteiro sem criar
// cliente nem inspeção real". Estes testes cobrem os dois lados disso: o gate,
// que recusa publicar roteiro quebrado, e o simulador, que responde "o que
// apareceria se fosse assim" — com a justificativa de cada decisão.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  describeIssueLocation,
  gateFromIssues,
  publishGate,
  simulateTemplate,
  simulationInputs,
  validateTemplateRules,
} from '../../domain/applicability';
import type {
  ApplicabilityRule,
  ConditionalTemplate,
  LabeledTemplate,
  RoutingQuestion,
} from '../../domain/applicability';

// ── fixtures ─────────────────────────────────────────────────

const PERGUNTA_INVASIVO: RoutingQuestion = {
  id: 'q-invasivo',
  text: 'Realiza procedimento invasivo?',
  type: 'single_choice',
  askAt: 'wizard',
  options: [
    { value: 'sim', label: 'Sim, invasivo' },
    { value: 'nao', label: 'Não, apenas estético' },
  ],
};

function regra(over: Partial<ApplicabilityRule> = {}): ApplicabilityRule {
  return {
    id: 'r1',
    target: { type: 'section', id: 's-invasivo' },
    expression: {
      combinator: 'all',
      conditions: [{ source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' }],
    },
    branch: 'if',
    ...over,
  };
}

function roteiro(over: Partial<LabeledTemplate> = {}): LabeledTemplate {
  return {
    sections: [
      {
        id: 's-geral',
        title: 'Estrutura física',
        items: [
          { id: 'i-piso', description: 'Piso lavável e íntegro' },
          { id: 'i-lavatorio', description: 'Lavatório com sabonete líquido' },
        ],
      },
      {
        id: 's-invasivo',
        title: 'Procedimentos invasivos',
        items: [
          { id: 'i-autoclave', description: 'Autoclave com validação periódica' },
          { id: 'i-descarte', description: 'Descarte de perfurocortante' },
        ],
      },
    ],
    routingQuestions: [PERGUNTA_INVASIVO],
    rules: [regra()],
    ...over,
  };
}

const codigos = (template: ConditionalTemplate) => validateTemplateRules(template).map((p) => p.code);

// ── 1 · o gate ───────────────────────────────────────────────

describe('COND-07 · gate de publicação', () => {
  it('libera roteiro sem problema nenhum', () => {
    const gate = publishGate(roteiro());
    expect(gate.ready).toBe(true);
    expect(gate.blockers).toHaveLength(0);
    expect(gate.groups).toHaveLength(0);
  });

  it('reprova destino que não existe no roteiro', () => {
    const gate = publishGate(roteiro({ rules: [regra({ target: { type: 'item', id: 'i-fantasma' } })] }));
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('unknown_target');
  });

  it('reprova regra sem destino', () => {
    const gate = publishGate(
      roteiro({ rules: [{ ...regra(), target: undefined as unknown as ApplicabilityRule['target'] }] })
    );
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('rule_without_target');
  });

  it('reprova referência quebrada de pergunta', () => {
    const gate = publishGate(roteiro({ routingQuestions: [] }));
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('unknown_question');
  });

  it('reprova referência quebrada de contexto', () => {
    const gate = publishGate(
      roteiro({
        rules: [
          regra({
            expression: {
              combinator: 'all',
              conditions: [{ source: 'context', field: 'faturamento', operator: 'greater', value: 10 }],
            },
          }),
        ],
      })
    );
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('unknown_context_field');
  });

  it('reprova opção que não existe mais na pergunta', () => {
    const gate = publishGate(
      roteiro({
        rules: [
          regra({
            expression: {
              combinator: 'all',
              conditions: [{ source: 'question', field: 'q-invasivo', operator: 'equals', value: 'talvez' }],
            },
          }),
        ],
      })
    );
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('unknown_option');
  });

  it('reprova pergunta aposentada que ainda tem regra dependente', () => {
    const gate = publishGate(
      roteiro({ routingQuestions: [{ ...PERGUNTA_INVASIVO, retiredAt: '2026-08-01T00:00:00Z' }] })
    );
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('retired_question');
  });

  it('reprova condição impossível', () => {
    const gate = publishGate(
      roteiro({
        rules: [
          regra({
            expression: {
              combinator: 'all',
              conditions: [
                { source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' },
                { source: 'question', field: 'q-invasivo', operator: 'equals', value: 'nao' },
              ],
            },
          }),
        ],
      })
    );
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('impossible_condition');
  });

  it('reprova dependência circular entre seções', () => {
    const emCampo = (id: string, sectionId: string): RoutingQuestion => ({
      id,
      text: `Pergunta ${id}`,
      type: 'boolean',
      askAt: 'execution',
      sectionId,
    });
    const gate = publishGate({
      sections: [
        { id: 's-a', items: [{ id: 'i-a' }] },
        { id: 's-b', items: [{ id: 'i-b' }] },
      ],
      routingQuestions: [emCampo('q-a', 's-a'), emCampo('q-b', 's-b')],
      rules: [
        {
          id: 'r-a',
          target: { type: 'section', id: 's-a' },
          expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-b', operator: 'equals', value: true }] },
        },
        {
          id: 'r-b',
          target: { type: 'section', id: 's-b' },
          expression: { combinator: 'all', conditions: [{ source: 'question', field: 'q-a', operator: 'equals', value: true }] },
        },
      ],
    });
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.code)).toContain('cycle');
  });

  it('aviso não reprova: o gate continua liberado e a observação aparece à parte', () => {
    const gate = publishGate(
      roteiro({
        routingQuestions: [PERGUNTA_INVASIVO, { id: 'q-solta', text: 'Pergunta que ninguém usa?', type: 'boolean' }],
      })
    );
    expect(gate.ready).toBe(true);
    expect(gate.warnings.map((p) => p.code)).toContain('unused_question');
    expect(gate.blockers).toHaveLength(0);
  });

  it('agrupa por causa, na ordem em que os problemas aparecem', () => {
    const gate = publishGate(
      roteiro({
        rules: [
          regra({ id: 'r1', target: { type: 'item', id: 'i-fantasma-1' } }),
          regra({ id: 'r2', target: { type: 'item', id: 'i-fantasma-2' } }),
        ],
      })
    );
    const grupo = gate.groups.find((g) => g.code === 'unknown_target');
    expect(grupo?.issues).toHaveLength(2);
    expect(grupo?.label).toBe('Destino que não existe');
  });

  it('usa o mesmo corte do serviço: severity error reprova, warning não', () => {
    const problemas = validateTemplateRules(
      roteiro({
        routingQuestions: [
          { ...PERGUNTA_INVASIVO, retiredAt: '2026-08-01T00:00:00Z' },
          { id: 'q-solta', text: 'Pergunta que ninguém usa?', type: 'boolean' },
        ],
      })
    );
    const gate = gateFromIssues(problemas);
    expect(gate.blockers).toEqual(problemas.filter((p) => p.severity === 'error'));
    expect(gate.warnings).toEqual(problemas.filter((p) => p.severity === 'warning'));
    expect(gate.ready).toBe(gate.blockers.length === 0);
  });
});

// ── 2 · ramo inalcançável ────────────────────────────────────

describe('COND-07 · ramo inalcançável', () => {
  const comQualquer = (conditions: ApplicabilityRule['expression']['conditions'], branch: 'if' | 'else' = 'if') =>
    roteiro({ rules: [regra({ branch, expression: { combinator: 'any', conditions } })] });

  it('acusa "é igual a X OU é diferente de X" — a condição nunca é falsa', () => {
    const problemas = validateTemplateRules(
      comQualquer([
        { source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' },
        { source: 'question', field: 'q-invasivo', operator: 'not_equals', value: 'sim' },
      ])
    );
    expect(problemas.map((p) => p.code)).toContain('unreachable_branch');
  });

  it('acusa "está preenchido OU está vazio"', () => {
    expect(
      codigos(
        comQualquer([
          { source: 'question', field: 'q-invasivo', operator: 'exists' },
          { source: 'question', field: 'q-invasivo', operator: 'not_exists' },
        ])
      )
    ).toContain('unreachable_branch');
  });

  it('acusa booleano "= Sim OU = Não": o domínio inteiro', () => {
    const template = roteiro({
      routingQuestions: [{ id: 'q-bool', text: 'Tem processamento próprio?', type: 'boolean' }],
      rules: [
        regra({
          expression: {
            combinator: 'any',
            conditions: [
              { source: 'question', field: 'q-bool', operator: 'equals', value: true },
              { source: 'question', field: 'q-bool', operator: 'equals', value: false },
            ],
          },
        }),
      ],
    });
    expect(codigos(template)).toContain('unreachable_branch');
  });

  it('acusa faixas que se encostam: >= 50 OU <= 50 não deixa buraco', () => {
    expect(
      codigos(
        comQualquer([
          { source: 'context', field: 'capacidadeIlpi', operator: 'greater_or_equal', value: 50 },
          { source: 'context', field: 'capacidadeIlpi', operator: 'less_or_equal', value: 50 },
        ])
      )
    ).toContain('unreachable_branch');
  });

  it('NÃO acusa > 50 OU < 50: o valor 50 escapa dos dois lados', () => {
    expect(
      codigos(
        comQualquer([
          { source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 50 },
          { source: 'context', field: 'capacidadeIlpi', operator: 'less', value: 50 },
        ])
      )
    ).not.toContain('unreachable_branch');
  });

  it('NÃO acusa condições sobre fontes diferentes', () => {
    expect(
      codigos(
        comQualquer([
          { source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' },
          { source: 'context', field: 'uf', operator: 'equals', value: 'RJ' },
        ])
      )
    ).not.toContain('unreachable_branch');
  });

  it('a mensagem diz o desfecho certo conforme o ramo', () => {
    const noSe = validateTemplateRules(
      comQualquer([
        { source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' },
        { source: 'question', field: 'q-invasivo', operator: 'not_equals', value: 'sim' },
      ])
    ).find((p) => p.code === 'unreachable_branch');
    expect(noSe?.message).toContain('apareceria em toda inspeção');

    const noSenao = validateTemplateRules(
      comQualquer(
        [
          { source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' },
          { source: 'question', field: 'q-invasivo', operator: 'not_equals', value: 'sim' },
        ],
        'else'
      )
    ).find((p) => p.code === 'unreachable_branch');
    expect(noSenao?.message).toContain('nunca seria aplicável');
  });

  it('grupo TODAS contraditório no ramo "senão" é ramo inalcançável, não condição impossível', () => {
    const contraditorio = [
      { source: 'question' as const, field: 'q-invasivo', operator: 'equals' as const, value: 'sim' },
      { source: 'question' as const, field: 'q-invasivo', operator: 'equals' as const, value: 'nao' },
    ];
    const noSenao = codigos(
      roteiro({ rules: [regra({ branch: 'else', expression: { combinator: 'all', conditions: contraditorio } })] })
    );
    expect(noSenao).toContain('unreachable_branch');
    expect(noSenao).not.toContain('impossible_condition');

    const noSe = codigos(
      roteiro({ rules: [regra({ branch: 'if', expression: { combinator: 'all', conditions: contraditorio } })] })
    );
    expect(noSe).toContain('impossible_condition');
    expect(noSe).not.toContain('unreachable_branch');
  });

  it('ramo inalcançável reprova a publicação', () => {
    const gate = publishGate(
      comQualquer([
        { source: 'question', field: 'q-invasivo', operator: 'equals', value: 'sim' },
        { source: 'question', field: 'q-invasivo', operator: 'not_equals', value: 'sim' },
      ])
    );
    expect(gate.ready).toBe(false);
    expect(gate.groups.map((g) => g.label)).toContain('Ramo inalcançável');
  });
});

// ── 3 · o simulador ──────────────────────────────────────────

describe('COND-07 · simulador de cenário', () => {
  it('sem responder nada, o que depende de pergunta fica PENDENTE — nunca "não se aplica"', () => {
    const resultado = simulateTemplate({ template: roteiro() });
    const invasivo = resultado.sections.find((s) => s.id === 's-invasivo');
    expect(invasivo?.decision.state).toBe('pendente_de_condicao');
    expect(invasivo?.items.every((i) => i.decision.state === 'pendente_de_condicao')).toBe(true);
    expect(resultado.itemCounts.nao_aplicavel_por_regra).toBe(0);
  });

  it('respondendo o que satisfaz a regra, a seção aparece e a explicação diz por quê', () => {
    const resultado = simulateTemplate({
      template: roteiro(),
      scenario: { answers: { 'q-invasivo': 'sim' } },
    });
    const invasivo = resultado.sections.find((s) => s.id === 's-invasivo');
    expect(invasivo?.decision.state).toBe('aplicavel');
    expect(invasivo?.decision.explanation).toContain('Realiza procedimento invasivo?');
    expect(resultado.itemCounts.aplicavel).toBe(4);
  });

  it('respondendo o contrário, a seção sai e os itens herdam o motivo', () => {
    const resultado = simulateTemplate({
      template: roteiro(),
      scenario: { answers: { 'q-invasivo': 'nao' } },
    });
    const invasivo = resultado.sections.find((s) => s.id === 's-invasivo');
    expect(invasivo?.decision.state).toBe('nao_aplicavel_por_regra');
    expect(invasivo?.counts.nao_aplicavel_por_regra).toBe(2);
    const autoclave = invasivo?.items.find((i) => i.id === 'i-autoclave');
    expect(autoclave?.decision.reason).toBe('inherited');
    expect(autoclave?.decision.explanation).toContain('Procedimentos invasivos');
  });

  it('"não foi possível determinar" deixa pendente e carrega a justificativa', () => {
    const resultado = simulateTemplate({
      template: roteiro(),
      scenario: {
        answers: { 'q-invasivo': { undetermined: true, justification: 'responsável técnico ausente' } },
      },
    });
    const invasivo = resultado.sections.find((s) => s.id === 's-invasivo');
    expect(invasivo?.decision.state).toBe('pendente_de_condicao');
    expect(invasivo?.decision.reason).toBe('declared_undetermined');
    expect(invasivo?.decision.justifications).toEqual(['responsável técnico ausente']);
  });

  it('a seção sem regra continua sempre aplicável', () => {
    const resultado = simulateTemplate({ template: roteiro(), scenario: { answers: { 'q-invasivo': 'nao' } } });
    const geral = resultado.sections.find((s) => s.id === 's-geral');
    expect(geral?.decision.state).toBe('aplicavel');
    expect(geral?.decision.reason).toBe('no_rule');
  });

  it('as contagens fecham: cada item entra em exatamente um estado', () => {
    const resultado = simulateTemplate({ template: roteiro(), scenario: { answers: { 'q-invasivo': 'nao' } } });
    const { aplicavel, nao_aplicavel_por_regra, pendente_de_condicao, total } = resultado.itemCounts;
    expect(aplicavel + nao_aplicavel_por_regra + pendente_de_condicao).toBe(total);
    expect(total).toBe(4);
    expect(resultado.sectionCounts.total).toBe(2);
  });

  it('não esconde nada: item fora por regra continua na lista, com o motivo', () => {
    const resultado = simulateTemplate({ template: roteiro(), scenario: { answers: { 'q-invasivo': 'nao' } } });
    const invasivo = resultado.sections.find((s) => s.id === 's-invasivo');
    expect(invasivo?.items).toHaveLength(2);
    expect(invasivo?.items[0].label).toBe('Autoclave com validação periódica');
  });

  it('condição de contexto responde ao cenário digitado', () => {
    const template = roteiro({
      rules: [
        regra({
          expression: {
            combinator: 'all',
            conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }],
          },
        }),
      ],
      routingQuestions: [],
    });
    expect(simulateTemplate({ template, scenario: { context: { uf: 'RJ' } } }).sections[1].decision.state).toBe('aplicavel');
    expect(simulateTemplate({ template, scenario: { context: { uf: 'SP' } } }).sections[1].decision.state).toBe(
      'nao_aplicavel_por_regra'
    );
    // Contexto em branco é indeterminado, nunca falso (contrato § 4.1).
    expect(simulateTemplate({ template }).sections[1].decision.state).toBe('pendente_de_condicao');
  });

  it('cai no id quando o item não tem descrição', () => {
    const resultado = simulateTemplate({
      template: { sections: [{ id: 's-x', items: [{ id: 'i-x' }] }] },
    });
    expect(resultado.sections[0].label).toBe('s-x');
    expect(resultado.sections[0].items[0].label).toBe('i-x');
  });

  it('é determinístico: mesma entrada, mesma saída', () => {
    const cenario = { answers: { 'q-invasivo': 'sim' } };
    const a = simulateTemplate({ template: roteiro(), scenario: cenario });
    const b = simulateTemplate({ template: roteiro(), scenario: cenario });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('devolve a validação junto — simular roteiro quebrado mostra o requisito, nunca o esconde', () => {
    const resultado = simulateTemplate({ template: roteiro({ routingQuestions: [] }) });
    expect(resultado.validation.map((p) => p.code)).toContain('unknown_question');
    const invasivo = resultado.sections.find((s) => s.id === 's-invasivo');
    expect(invasivo?.decision.state).toBe('pendente_de_condicao');
    expect(invasivo?.decision.reason).toBe('rule_error');
  });
});

// ── 4 · o que o simulador precisa perguntar ──────────────────

describe('COND-07 · entradas do simulador', () => {
  it('só oferece o que muda o resultado', () => {
    const entradas = simulationInputs(roteiro());
    expect(entradas.questions.map((q) => q.id)).toEqual(['q-invasivo']);
    expect(entradas.contextFields).toHaveLength(0);
  });

  it('não oferece pergunta que nenhuma regra usa', () => {
    const entradas = simulationInputs(
      roteiro({ routingQuestions: [PERGUNTA_INVASIVO, { id: 'q-solta', text: 'Solta?', type: 'boolean' }] })
    );
    expect(entradas.questions.map((q) => q.id)).toEqual(['q-invasivo']);
  });

  it('oferece o campo de contexto citado, com o rótulo do catálogo', () => {
    const entradas = simulationInputs(
      roteiro({
        rules: [
          regra({
            expression: {
              combinator: 'all',
              conditions: [{ source: 'context', field: 'capacidadeIlpi', operator: 'greater', value: 30 }],
            },
          }),
        ],
      })
    );
    expect(entradas.contextFields.map((f) => f.label)).toEqual(['Capacidade da ILPI']);
  });

  it('acusa referência quebrada em vez de sumir com ela', () => {
    const entradas = simulationInputs(roteiro({ routingQuestions: [] }));
    expect(entradas.unknownQuestionIds).toEqual(['q-invasivo']);
  });

  it('oferece pergunta aposentada que ainda tem regra — é o cenário quebrado que se quer ver', () => {
    const entradas = simulationInputs(
      roteiro({ routingQuestions: [{ ...PERGUNTA_INVASIVO, retiredAt: '2026-08-01T00:00:00Z' }] })
    );
    expect(entradas.questions.map((q) => q.id)).toEqual(['q-invasivo']);
  });
});

// ── 5 · onde o problema mora ─────────────────────────────────
// O validador é puro e só fala em id (`a regra "dzioxzc"`). Quem conserta precisa
// do nome da seção e do item — foi o que faltou ao usar o gate pela primeira vez.

describe('COND-07 · localização do problema do gate', () => {
  const template = roteiro();

  it('traduz id de seção para o título que está na tela', () => {
    const gate = publishGate(
      roteiro({
        rules: [
          regra({
            expression: {
              combinator: 'all',
              conditions: [{ source: 'question', field: 'q-invasivo', operator: 'equals', value: 'talvez' }],
            },
          }),
        ],
      })
    );
    const problema = gate.blockers.find((p) => p.code === 'unknown_option');
    expect(describeIssueLocation(problema!, template)).toBe('Pergunta «Realiza procedimento invasivo?»');
  });

  it('traduz id de item para a seção mais a exigência', () => {
    expect(
      describeIssueLocation({ code: 'unknown_target', severity: 'error', disablesRule: true, message: '', targetId: 'i-autoclave' }, template)
    ).toBe('Procedimentos invasivos · «Autoclave com validação periódica»');
  });

  it('traduz id de seção sozinho', () => {
    expect(
      describeIssueLocation({ code: 'cycle', severity: 'error', disablesRule: true, message: '', targetId: 's-invasivo' }, template)
    ).toBe('Seção «Procedimentos invasivos»');
  });

  it('encurta exigência muito longa em vez de estourar a linha', () => {
    const longa = 'A'.repeat(140);
    const onde = describeIssueLocation(
      { code: 'unknown_target', severity: 'error', disablesRule: true, message: '', targetId: 'i-longo' },
      { sections: [{ id: 's-x', title: 'Seção X', items: [{ id: 'i-longo', description: longa }] }] }
    );
    expect(onde).toContain('…');
    expect(onde!.length).toBeLessThan(120);
  });

  it('devolve undefined quando não há nome melhor do que o id', () => {
    expect(
      describeIssueLocation(
        { code: 'unknown_target', severity: 'error', disablesRule: true, message: '', targetId: 'i-sem-nome' },
        { sections: [{ id: 's-x', items: [{ id: 'i-sem-nome' }] }] }
      )
    ).toBeUndefined();
    expect(
      describeIssueLocation({ code: 'cycle', severity: 'error', disablesRule: true, message: '' }, template)
    ).toBeUndefined();
  });
});
