// ============================================================
// COND-06 — o que o editor precisa para não deixar referência órfã.
//
// O aceite do card é uma frase só: **nenhuma operação do editor produz
// referência órfã em silêncio**. Aqui isso vira três blocos —
// resumo em linguagem humana · travas do ciclo de vida · duplicação sem herdar id.
// ============================================================

import { describe, expect, test } from 'vitest';
import {
  canRemoveOption,
  canRetireQuestion,
  cloneSectionForDuplicate,
  cloneTemplateForDuplicate,
  describeCondition,
  describeRule,
  rulesOrphanedBy,
  rulesTargeting,
  validateTemplateRules,
} from '../../domain/applicability';
import type {
  ApplicabilityRule,
  ConditionalTemplate,
  MakeId,
  RoutingQuestion,
} from '../../domain/applicability';

const PROCESSA: RoutingQuestion = {
  id: 'q-processa',
  text: 'Realiza processamento de artigos?',
  type: 'single_choice',
  options: [
    { value: 'proprio', label: 'Próprio' },
    { value: 'terceirizado', label: 'Terceirizado' },
  ],
  sectionId: 'sec-1',
};

const TEM_LAVANDERIA: RoutingQuestion = {
  id: 'q-lavanderia',
  text: 'Possui lavanderia própria?',
  type: 'boolean',
  sectionId: 'sec-1',
};

const REGRA_PROPRIO: ApplicabilityRule = {
  id: 'r-1',
  target: { type: 'section', id: 'sec-2' },
  expression: {
    combinator: 'all',
    conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: 'proprio' }],
  },
};

function roteiro(overrides: Partial<ConditionalTemplate> = {}): ConditionalTemplate {
  return {
    sections: [
      { id: 'sec-1', title: 'Contexto', items: [{ id: 'item-1' }] },
      { id: 'sec-2', title: 'Processamento', items: [{ id: 'item-2' }, { id: 'item-3' }] },
    ],
    routingQuestions: [PROCESSA, TEM_LAVANDERIA],
    rules: [REGRA_PROPRIO],
    ...overrides,
  };
}

/** Gerador determinístico: `sec-1` vira `copia-section-sec-1`. Sem relógio, sem sorteio. */
const makeId: MakeId = (kind, originalId) => `copia-${kind}-${originalId}`;

// ── 1 · Resumo em linguagem humana ───────────────────────────

describe('resumo em linguagem humana', () => {
  const fontes = { routingQuestions: [PROCESSA, TEM_LAVANDERIA] };

  test('usa o texto da pergunta e o rótulo da opção, nunca o id', () => {
    const frase = describeRule(REGRA_PROPRIO, fontes);
    expect(frase).toBe("Exibida quando Realiza processamento de artigos? é igual a Próprio");
    expect(frase).not.toContain('q-processa');
    expect(frase).not.toContain('proprio');
  });

  test('booleano vira Sim/Não', () => {
    expect(
      describeCondition(
        { source: 'question', field: 'q-lavanderia', operator: 'equals', value: true },
        fontes
      )
    ).toBe('Possui lavanderia própria? é igual a Sim');
  });

  test('campo de contexto usa o rótulo do catálogo', () => {
    expect(
      describeCondition({ source: 'context', field: 'uf', operator: 'in_list', value: ['RJ', 'SP'] }, fontes)
    ).toBe('UF pertence a RJ, SP');
  });

  test('operador sem valor não inventa valor', () => {
    expect(
      describeCondition({ source: 'context', field: 'capacidadeIlpi', operator: 'exists' }, fontes)
    ).toBe('Capacidade da ILPI está preenchido');
  });

  test('TODAS junta com "e"; QUALQUER junta com "ou"', () => {
    const duas = (combinator: 'all' | 'any'): ApplicabilityRule => ({
      ...REGRA_PROPRIO,
      expression: {
        combinator,
        conditions: [
          { source: 'question', field: 'q-processa', operator: 'equals', value: 'proprio' },
          { source: 'question', field: 'q-lavanderia', operator: 'equals', value: true },
        ],
      },
    });
    expect(describeRule(duas('all'), fontes)).toContain(' e Possui lavanderia');
    expect(describeRule(duas('any'), fontes)).toContain(' ou Possui lavanderia');
  });

  test('o else se anuncia como caminho complementar, não como "o resto"', () => {
    const frase = describeRule({ ...REGRA_PROPRIO, branch: 'else' }, fontes);
    expect(frase).toBe(
      'Exibida quando não for o caso: Realiza processamento de artigos? é igual a Próprio'
    );
  });

  test('pergunta que não existe mais aparece como referência quebrada, não some', () => {
    const frase = describeCondition(
      { source: 'question', field: 'q-fantasma', operator: 'equals', value: 'x' },
      fontes
    );
    expect(frase).toContain('referência quebrada');
    expect(frase).toContain('q-fantasma');
  });
});

// ── 2 · Travas do ciclo de vida ──────────────────────────────

describe('aposentar pergunta controladora', () => {
  test('é bloqueada enquanto houver regra dependente', () => {
    const guarda = canRetireQuestion(roteiro(), 'q-processa');
    expect(guarda.allowed).toBe(false);
    expect(guarda.blockingRules.map((r) => r.id)).toEqual(['r-1']);
    expect(guarda.reason).toContain('1 regra');
  });

  test('é liberada quando ninguém depende', () => {
    expect(canRetireQuestion(roteiro(), 'q-lavanderia').allowed).toBe(true);
  });

  test('a frase concorda em número com a quantidade de regras', () => {
    const duas = roteiro({ rules: [REGRA_PROPRIO, { ...REGRA_PROPRIO, id: 'r-2' }] });
    expect(canRetireQuestion(duas, 'q-processa').reason).toContain('2 regras');
  });
});

describe('excluir opção referenciada', () => {
  test('é bloqueada quando alguma regra cita a opção', () => {
    const guarda = canRemoveOption(roteiro(), 'q-processa', 'proprio');
    expect(guarda.allowed).toBe(false);
    expect(guarda.blockingRules.map((r) => r.id)).toEqual(['r-1']);
  });

  test('opção não citada continua excluível', () => {
    expect(canRemoveOption(roteiro(), 'q-processa', 'terceirizado').allowed).toBe(true);
  });

  test('acha a opção dentro de lista de in_list', () => {
    const emLista = roteiro({
      rules: [
        {
          ...REGRA_PROPRIO,
          expression: {
            combinator: 'all',
            conditions: [
              { source: 'question', field: 'q-processa', operator: 'in_list', value: ['terceirizado'] },
            ],
          },
        },
      ],
    });
    expect(canRemoveOption(emLista, 'q-processa', 'terceirizado').allowed).toBe(false);
  });

  test('compara normalizado: caixa e acento não escapam da trava', () => {
    expect(canRemoveOption(roteiro(), 'q-processa', 'PRÓPRIO').allowed).toBe(false);
  });
});

describe('remover seção ou item', () => {
  test('não bloqueia, mas entrega a regra que ficaria órfã', () => {
    const orfas = rulesOrphanedBy(roteiro(), { sections: ['sec-2'] });
    expect(orfas.map((r) => r.id)).toEqual(['r-1']);
  });

  test('não arrasta regra de outro alvo', () => {
    expect(rulesOrphanedBy(roteiro(), { sections: ['sec-1'] })).toEqual([]);
    expect(rulesOrphanedBy(roteiro(), { items: ['item-2'] })).toEqual([]);
  });

  test('rulesTargeting acha a regra do alvo', () => {
    expect(rulesTargeting(roteiro(), 'section', 'sec-2').map((r) => r.id)).toEqual(['r-1']);
    expect(rulesTargeting(roteiro(), 'item', 'sec-2')).toEqual([]);
  });
});

// ── 3 · Duplicar sem herdar id ───────────────────────────────

describe('duplicar roteiro', () => {
  const original = roteiro();
  const copia = cloneTemplateForDuplicate(original, makeId);

  test('nenhum id da cópia existe no original', () => {
    const idsOriginais = new Set([
      ...original.sections.map((s) => s.id),
      ...original.sections.flatMap((s) => s.items.map((i) => i.id)),
      ...(original.routingQuestions || []).map((q) => q.id),
      ...(original.rules || []).map((r) => r.id),
    ]);
    const idsCopia = [
      ...copia.sections.map((s) => s.id),
      ...copia.sections.flatMap((s) => s.items.map((i) => i.id)),
      ...copia.routingQuestions.map((q) => q.id),
      ...copia.rules.map((r) => r.id),
    ];
    for (const id of idsCopia) expect(idsOriginais.has(id)).toBe(false);
  });

  test('a regra da cópia mira o alvo da cópia, não o do original', () => {
    expect(copia.rules[0].target.id).toBe('copia-section-sec-2');
  });

  test('a condição da cópia lê a pergunta da cópia', () => {
    expect(copia.rules[0].expression.conditions[0].field).toBe('copia-question-q-processa');
  });

  test('a pergunta da cópia mora na seção da cópia', () => {
    expect(copia.routingQuestions[0].sectionId).toBe('copia-section-sec-1');
  });

  test('a cópia passa no validador — sem referência quebrada nenhuma', () => {
    const erros = validateTemplateRules({
      sections: copia.sections,
      rules: copia.rules,
      routingQuestions: copia.routingQuestions,
    }).filter((issue) => issue.severity === 'error');
    expect(erros).toEqual([]);
  });

  test('o original não é tocado', () => {
    expect(original.sections[0].id).toBe('sec-1');
    expect(original.rules?.[0].target.id).toBe('sec-2');
  });
});

describe('duplicar seção', () => {
  test('leva os itens com id novo e a regra que mira a seção', () => {
    const { section, rules } = cloneSectionForDuplicate(roteiro(), 'sec-2', makeId);
    expect(section?.id).toBe('copia-section-sec-2');
    expect(section?.items.map((i) => i.id)).toEqual(['copia-item-item-2', 'copia-item-item-3']);
    expect(rules).toHaveLength(1);
    expect(rules[0].target.id).toBe('copia-section-sec-2');
  });

  test('não leva regra que mira fora da seção', () => {
    const { rules } = cloneSectionForDuplicate(roteiro(), 'sec-1', makeId);
    expect(rules).toEqual([]);
  });

  test('a regra copiada continua lendo a pergunta original — ela não foi clonada', () => {
    const { rules } = cloneSectionForDuplicate(roteiro(), 'sec-2', makeId);
    expect(rules[0].expression.conditions[0].field).toBe('q-processa');
  });

  test('leva a regra que mira um item de dentro da seção', () => {
    const porItem = roteiro({
      rules: [{ ...REGRA_PROPRIO, target: { type: 'item', id: 'item-3' } }],
    });
    const { rules } = cloneSectionForDuplicate(porItem, 'sec-2', makeId);
    expect(rules[0].target.id).toBe('copia-item-item-3');
  });

  test('seção que não existe devolve nada, sem estourar', () => {
    const { section, rules } = cloneSectionForDuplicate(roteiro(), 'sec-fantasma', makeId);
    expect(section).toBeNull();
    expect(rules).toEqual([]);
  });
});
