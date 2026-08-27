// ============================================================
// COND-02 — suíte de equivalência: as regras de aplicabilidade que já existem
// hardcoded (docs/mapa-roteiro-inspecao.md, "As 6 regras de aplicabilidade que
// já existem") reproduzidas pelo motor declarativo.
//
// Se o motor não reproduzir cada uma delas, ele está errado. É a rede de
// segurança da migração do COND-03 — que é quem vai trocar o código hardcoded
// por estas regras; aqui elas ainda vivem lado a lado, e ninguém foi removido.
// ============================================================

import { describe, expect, test } from 'vitest';
import { CONTEXT_FIELDS, evaluateApplicability } from '../../domain/applicability';
import type { ApplicabilityRule, ConditionGroup, ConditionalTemplate, ContextField, InspectionContext } from '../../domain/applicability';
import { getEffectiveTemplate, getTemplateById } from '../../data/templates';
import { extraSections, getExtraSections, segmentSectionMap } from '../../data/templates_alimentos_segmentos';
import { supplementRegistry } from '../../data/supplementRegistry';
import { toUF } from '../../utils/state';
import type { ChecklistTemplate, Client, Section } from '../../types';

function aplicavel(
  template: ConditionalTemplate,
  context: InspectionContext,
  contextFields?: ContextField[]
): { secao: (id: string) => boolean; item: (id: string) => boolean; estadoDaSecao: (id: string) => string; estadoDoItem: (id: string) => string } {
  const result = evaluateApplicability({ template, context, contextFields });
  return {
    secao: (id) => result.sections[id]?.state === 'aplicavel',
    item: (id) => result.items[id]?.state === 'aplicavel',
    estadoDaSecao: (id) => result.sections[id]?.state,
    estadoDoItem: (id) => result.items[id]?.state,
  };
}

function cliente(state?: string, city?: string, foodTypes?: string[]): Client {
  return { state, city, foodTypes } as unknown as Client;
}

// ════════════════════════════════════════════════════════════
// O motor aceita um roteiro real sem conversão nenhuma — é o que permite ao
// COND-03 ligar as duas pontas sem inventar um segundo tipo de roteiro.
// ════════════════════════════════════════════════════════════
test('um ChecklistTemplate real entra direto no motor e, sem regra, sai todo aplicável', () => {
  const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
  const { sections, items, validation } = evaluateApplicability({ template: base });

  expect(validation).toEqual([]);
  expect(Object.keys(sections)).toHaveLength(base.sections.length);
  expect(Object.values(sections).every((d) => d.state === 'aplicavel')).toBe(true);
  expect(Object.values(items).every((d) => d.state === 'aplicavel')).toBe(true);
});

// ════════════════════════════════════════════════════════════
// Regra 1 — seções extras de alimentos por tipo de estabelecimento
// templates.ts:398 · templates_alimentos_segmentos.ts:865
// ════════════════════════════════════════════════════════════
describe('regra 1 e 6 — seções extras por tipo de estabelecimento e itens só do RJ', () => {
  const tiposPorSecao = new Map<string, string[]>();
  for (const [tipo, ids] of Object.entries(segmentSectionMap)) {
    for (const id of ids) tiposPorSecao.set(id, [...(tiposPorSecao.get(id) || []), tipo]);
  }

  const itensSoDoRj = extraSections.flatMap((section) =>
    section.items.filter((item) => (item as { isRJOnly?: boolean }).isRJOnly).map((item) => item.id)
  );

  const template: ConditionalTemplate = {
    sections: extraSections.map((section) => ({ id: section.id, title: section.title, items: section.items.map((item) => ({ id: item.id })) })),
    rules: [
      ...[...tiposPorSecao.entries()].map(([sectionId, tipos]): ApplicabilityRule => ({
        id: `r-${sectionId}`,
        target: { type: 'section', id: sectionId },
        expression: { combinator: 'all', conditions: [{ source: 'context', field: 'tiposDeAlimento', operator: 'in_list', value: tipos }] },
      })),
      ...itensSoDoRj.map((itemId): ApplicabilityRule => ({
        id: `r-${itemId}`,
        target: { type: 'item', id: itemId },
        expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'in_list', value: ['RJ'] }] },
      })),
    ],
  };

  test('toda seção extra é alcançável por algum tipo de estabelecimento', () => {
    expect([...tiposPorSecao.keys()].sort()).toEqual(extraSections.map((s) => s.id).sort());
  });

  test('o roteiro declarativo montado aqui é válido', () => {
    expect(evaluateApplicability({ template }).validation).toEqual([]);
  });

  const tipos = Object.keys(segmentSectionMap);
  const estados = ['RJ', 'Rio de Janeiro', 'SP', 'Minas Gerais'];

  test.each(tipos.flatMap((tipo) => estados.map((estado) => [tipo, estado] as const)))(
    'tipo %s em %s: motor e getExtraSections concordam seção a seção',
    (tipo, estado) => {
      const hardcoded = getExtraSections([tipo], estado);
      const motor = aplicavel(template, { tiposDeAlimento: [tipo], uf: toUF(estado) });

      for (const section of extraSections) {
        expect(motor.secao(section.id), `seção ${section.id}`).toBe(hardcoded.some((s) => s.id === section.id));
      }
      for (const itemId of itensSoDoRj) {
        const presente = hardcoded.some((s) => s.items.some((i) => i.id === itemId));
        expect(motor.item(itemId), `item ${itemId}`).toBe(presente);
      }
    }
  );

  test('dois tipos ao mesmo tempo trazem as seções dos dois', () => {
    const escolhidos = ['manipulacao_carnes', 'bebidas_sorvetes'];
    const hardcoded = getExtraSections(escolhidos, 'RJ').map((s) => s.id).sort();
    const motor = aplicavel(template, { tiposDeAlimento: escolhidos, uf: 'RJ' });
    expect(extraSections.filter((s) => motor.secao(s.id)).map((s) => s.id).sort()).toEqual(hardcoded);
  });
});

// ════════════════════════════════════════════════════════════
// Regra 2 — suplementos regionais (supplementRegistry.ts)
// O predicado de contexto vira condição; a parte que casa o roteiro-base
// continua sendo composição, e é trabalho do COND-03.
// ════════════════════════════════════════════════════════════
describe('regra 2 — predicado de UF/município dos suplementos regionais', () => {
  const PREDICADOS: Record<string, { expressao: ConditionGroup; clienteQueCasa: Client }> = {
    ' (+ Suplemento Alimentos — Rio de Janeiro)': {
      expressao: {
        combinator: 'all',
        conditions: [
          { source: 'context', field: 'uf', operator: 'equals', value: 'RJ' },
          { source: 'context', field: 'municipio', operator: 'equals', value: 'rio de janeiro' },
        ],
      },
      clienteQueCasa: cliente('RJ', 'Rio de Janeiro'),
    },
    ' (+ Suplemento São Paulo Capital)': {
      expressao: {
        combinator: 'all',
        conditions: [
          { source: 'context', field: 'uf', operator: 'equals', value: 'SP' },
          { source: 'context', field: 'municipio', operator: 'equals', value: 'sao paulo' },
        ],
      },
      clienteQueCasa: cliente('SP', 'São Paulo'),
    },
    ' (+ Suplemento RJ)': {
      expressao: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }] },
      clienteQueCasa: cliente('RJ', 'Niterói'),
    },
    ' (+ Suplemento GO)': {
      expressao: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'GO' }] },
      clienteQueCasa: cliente('GO', 'Goiânia'),
    },
    ' (+ Suplemento BH)': {
      expressao: {
        combinator: 'all',
        conditions: [
          { source: 'context', field: 'uf', operator: 'equals', value: 'MG' },
          { source: 'context', field: 'municipio', operator: 'contains', value: 'belo horizonte' },
        ],
      },
      clienteQueCasa: cliente('MG', 'Belo Horizonte'),
    },
  };

  const BASES = ['tpl-estetica-clinica-v1', 'tpl-ilpi-federal-v1', 'tpl-alimentos-federal-v1']
    .map((id) => getTemplateById(id) as ChecklistTemplate);

  const CLIENTES: Client[] = [
    cliente('SP', 'São Paulo'),
    cliente('SP', 'sao paulo '),
    cliente('SP', 'Campinas'),
    cliente('MG', 'Belo Horizonte'),
    cliente('Minas Gerais', 'belo horizonte'),
    cliente('MG', 'Contagem'),
    cliente('RJ', 'Rio de Janeiro'),
    cliente('Rio de Janeiro', 'Niterói'),
    cliente('GO', 'Goiânia'),
    cliente('Goias', 'Anápolis'),
    cliente('BA', 'Salvador'),
  ];

  test.each(supplementRegistry.map((entry, index) => [index, entry.nameSuffix] as const))(
    'suplemento %s%s: o motor reproduz appliesTo em toda a matriz de clientes',
    (index) => {
      const entry = supplementRegistry[index];
      const predicado = PREDICADOS[entry.nameSuffix];
      expect(predicado, `sem tradução declarativa para ${entry.nameSuffix}`).toBeDefined();

      // Qual roteiro-base este suplemento aceita — a parte "de composição" do
      // predicado, que o motor não decide (COND-03).
      const base = BASES.find((template) => entry.appliesTo(template, predicado.clienteQueCasa));
      expect(base, `nenhum roteiro-base casou com ${entry.nameSuffix}`).toBeDefined();

      const template: ConditionalTemplate = {
        sections: [{ id: 'sup', title: entry.supplement.name, items: [{ id: 'sup-item' }] }],
        rules: [{ id: 'r-sup', target: { type: 'section', id: 'sup' }, expression: predicado.expressao }],
      };

      for (const client of CLIENTES) {
        const motor = aplicavel(template, { uf: toUF(client.state), municipio: client.city });
        expect(motor.secao('sup'), `${entry.nameSuffix} · ${client.state}/${client.city}`).toBe(entry.appliesTo(base as ChecklistTemplate, client));
      }
    }
  );
});

// ════════════════════════════════════════════════════════════
// Regra 3 — section.applicableFoodTypes (templates.ts:417)
// É o protótipo declarado do schema: alvo + operador + lista.
// ════════════════════════════════════════════════════════════
describe('regra 3 — applicableFoodTypes', () => {
  const base: ChecklistTemplate = {
    id: 'tpl-equivalencia-alimentos',
    name: 'Roteiro de equivalência',
    category: 'alimentos',
    version: '1',
    sections: [
      { id: 'sec-livre', title: 'Sem restrição', order: 1, items: [{ id: 'i-livre', sectionId: 'sec-livre', order: 1, description: 'x', weight: 5, isCritical: false }] },
      {
        id: 'sec-pescados',
        title: 'Só pescados',
        order: 2,
        applicableFoodTypes: ['pescados_crus', 'catering_eventos'],
        items: [{ id: 'i-pescados', sectionId: 'sec-pescados', order: 1, description: 'x', weight: 5, isCritical: false }],
      } as Section,
    ],
  };

  const template: ConditionalTemplate = {
    sections: base.sections.map((section) => ({ id: section.id, title: section.title, items: section.items.map((item) => ({ id: item.id })) })),
    rules: [
      {
        id: 'r-pescados',
        target: { type: 'section', id: 'sec-pescados' },
        expression: { combinator: 'all', conditions: [{ source: 'context', field: 'tiposDeAlimento', operator: 'in_list', value: ['pescados_crus', 'catering_eventos'] }] },
      },
    ],
  };

  test.each([
    [['pescados_crus']],
    [['catering_eventos']],
    [['pescados_crus', 'dark_kitchen']],
    [['dark_kitchen']],
    [['servico_alimentacao', 'mercado_varejo']],
  ])('tipos %j: motor e getEffectiveTemplate concordam', (foodTypes) => {
    const efetivo = getEffectiveTemplate(base, cliente('SP', 'Campinas', foodTypes), undefined, true);
    const motor = aplicavel(template, { tiposDeAlimento: foodTypes });

    for (const section of base.sections) {
      expect(motor.secao(section.id), `seção ${section.id}`).toBe(efetivo.sections.some((s) => s.id === section.id));
    }
  });
});

// ════════════════════════════════════════════════════════════
// Regra 4 — recorte por papel (templates.ts:423)
//
// ATENÇÃO: reproduzir aqui **não** significa que o COND-03 vai transformar isto
// em regra de aplicabilidade. O contrato § 6.6 decidiu o contrário: existe uma
// árvore só, e o papel vira filtro de **exibição**. Este bloco existe porque o
// card pede as seis regras reproduzidas, e por isso `papel` entra por um
// catálogo de contexto próprio deste teste — nunca no catálogo de produção.
// ════════════════════════════════════════════════════════════
describe('regra 4 — recorte por papel na ILPI (expressividade, não destino)', () => {
  const CAMPOS: ContextField[] = [...CONTEXT_FIELDS, { key: 'papel', label: 'Papel da consultora', type: 'text' }];
  const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
  const SECOES_DE_NUTRICAO = ['sec-fed-05', 'sec-fed-06'];

  const template: ConditionalTemplate = {
    sections: base.sections.map((section) => ({ id: section.id, title: section.title, items: section.items.map((item) => ({ id: item.id })) })),
    rules: base.sections.map((section): ApplicabilityRule => ({
      id: `r-${section.id}`,
      target: { type: 'section', id: section.id },
      expression: {
        combinator: 'all',
        conditions: [
          {
            source: 'context',
            field: 'papel',
            operator: 'in_list',
            value: SECOES_DE_NUTRICAO.includes(section.id) ? ['nutricao', 'ambos'] : ['saude', 'ambos'],
          },
        ],
      },
    })),
  };

  test.each(['saude', 'nutricao', 'ambos'])('papel %s: motor e filterSectionsByRole vêem as mesmas seções', (papel) => {
    const efetivo = getEffectiveTemplate(base, cliente('SP', 'Campinas'), papel, false);
    const motor = aplicavel(template, { papel }, CAMPOS);

    for (const section of base.sections) {
      expect(motor.secao(section.id), `${papel} · ${section.id}`).toBe(efetivo.sections.some((s) => s.id === section.id));
    }
  });

  test('`papel` não existe no catálogo de produção — regra sobre ele não é avaliável', () => {
    expect(CONTEXT_FIELDS.some((field) => field.key === 'papel')).toBe(false);
    expect(evaluateApplicability({ template, context: { papel: 'saude' } }).sections['sec-fed-01'].reason).toBe('rule_error');
  });
});

// ════════════════════════════════════════════════════════════
// Regra 5 — item aposentado antes do início da inspeção
// templates.ts:427 (decisão 21 do FE-17b)
// ════════════════════════════════════════════════════════════
describe('regra 5 — aposentadoria com corte na data de início da inspeção', () => {
  const APOSENTADO_EM = '2026-08-10T00:00:00.000Z';
  const base: ChecklistTemplate = {
    id: 'tpl-equivalencia-aposentadoria',
    name: 'Roteiro de equivalência',
    category: 'ilpi',
    version: '1',
    sections: [
      {
        id: 'sec-1',
        title: 'Seção',
        order: 1,
        items: [
          { id: 'i-vivo', sectionId: 'sec-1', order: 1, description: 'x', weight: 5, isCritical: false },
          { id: 'i-aposentado', sectionId: 'sec-1', order: 2, description: 'x', weight: 5, isCritical: false, retiredAt: APOSENTADO_EM },
        ],
      },
    ],
  };

  const template: ConditionalTemplate = {
    sections: [{ id: 'sec-1', title: 'Seção', items: [{ id: 'i-vivo' }, { id: 'i-aposentado' }] }],
    rules: [
      {
        id: 'r-aposentado',
        target: { type: 'item', id: 'i-aposentado' },
        expression: { combinator: 'all', conditions: [{ source: 'context', field: 'inicioDaInspecao', operator: 'less', value: APOSENTADO_EM }] },
      },
    ],
  };

  test.each([
    ['inspeção aberta antes da aposentadoria', '2026-08-01T09:00:00.000Z'],
    ['inspeção aberta no mesmo instante', APOSENTADO_EM],
    ['inspeção aberta depois', '2026-08-15T09:00:00.000Z'],
  ])('%s', (_nome, inicio) => {
    const efetivo = getEffectiveTemplate(base, cliente('SP', 'Campinas'), undefined, true, new Date(inicio));
    const motor = aplicavel(template, { inicioDaInspecao: inicio });
    const itensDoEfetivo = efetivo.sections.flatMap((s) => s.items.map((i) => i.id));

    expect(motor.item('i-vivo')).toBe(itensDoEfetivo.includes('i-vivo'));
    expect(motor.item('i-aposentado')).toBe(itensDoEfetivo.includes('i-aposentado'));
  });
});

// ════════════════════════════════════════════════════════════
// Onde o motor novo é DIFERENTE do código de hoje — de propósito
// ════════════════════════════════════════════════════════════
describe('divergências deliberadas do código hardcoded', () => {
  test('contexto vazio deixa pendente e visível, em vez de excluir em silêncio', () => {
    // Hoje: `isRJOnly && !isRioState(undefined)` esconde o item sem avisar.
    // Contrato § 4.1 e § 5.2: dado ausente é indeterminado, nunca "assume não".
    const template: ConditionalTemplate = {
      sections: [{ id: 'sec-1', title: 'Extra', items: [{ id: 'i-rj' }] }],
      rules: [{ id: 'r', target: { type: 'item', id: 'i-rj' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'in_list', value: ['RJ'] }] } }],
    };

    const semUf = aplicavel(template, {});
    expect(semUf.item('i-rj')).toBe(false);
    expect(semUf.estadoDoItem('i-rj')).toBe('pendente_de_condicao');

    // getExtraSections com UF desconhecida simplesmente some com o item:
    const itens = getExtraSections(['bebidas_sorvetes'], undefined).flatMap((s) => s.items.map((i) => i.id));
    expect(itens).not.toContain('sor-003');
    expect(itens).toContain('sor-002');
  });

  test('erro de regra também aparece, em vez de devolver o roteiro sem filtro', () => {
    // Hoje o catch de InspectionExecution devolve o template cru e só grava
    // console.error (achado A6). Aqui o estado é explícito e carrega o motivo.
    const template: ConditionalTemplate = {
      sections: [{ id: 'sec-1', title: 'Seção', items: [{ id: 'i-1' }] }],
      rules: [{ id: 'r', target: { type: 'section', id: 'sec-1' }, expression: { combinator: 'all', conditions: [{ source: 'context', field: 'campo-que-nao-existe', operator: 'equals', value: 'x' }] } }],
    };
    const { sections, validation } = evaluateApplicability({ template });
    expect(sections['sec-1'].state).toBe('pendente_de_condicao');
    expect(sections['sec-1'].explanation).toContain('continua visível');
    expect(validation).not.toEqual([]);
  });
});
