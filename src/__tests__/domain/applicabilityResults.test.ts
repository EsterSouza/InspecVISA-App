// ============================================================
// COND-09 — os resultados sobre o conjunto de aplicáveis.
//
// O aceite do card é uma identidade, e qualquer divergência reprova:
//
//   itens considerados na execução
// = itens considerados no score
// = itens considerados no summary
// = itens considerados no PDF
// = itens elegíveis ao plano de ação
//
// Então o teste não verifica cinco filtros parecidos: verifica que os cinco
// consumidores REAIS — `calculateScore`, `citedLegislations`,
// `buildClientActionItems`, as contagens do resumo e a árvore da execução —
// enxergam exatamente o mesmo conjunto quando alimentados pela mesma árvore.
//
// A regressão que este arquivo tranca: até o COND-08, `calculateScore` corria
// sobre a árvore congelada inteira, e um item **fora por regra com resposta**
// entrava na nota.
// ============================================================

import { describe, expect, test } from 'vitest';
import { resolveResultsTree } from '../../domain/applicability';
import type { ApplicabilityRule } from '../../domain/applicability';
import { applicableResults, evaluatedItemIdsFrom } from '../../utils/applicableResults';
import { calculateScore, getLatestResponsesByItem } from '../../utils/scoring';
import { citedLegislations } from '../../utils/legislationRefs';
import { buildClientActionItems } from '../../utils/clientActionPlan';
import type { ChecklistTemplate, Inspection, InspectionResponse, Section } from '../../types';

// ── O roteiro de teste ───────────────────────────────────────
// Duas seções. A segunda só existe para quem processa artigo no local — é a
// condicional sanitária mais comum e a que motivou o projeto inteiro.

const SECOES = [
  {
    id: 'sec-1',
    title: 'Infraestrutura',
    items: [
      { id: 'i1', sectionId: 'sec-1', order: 1, description: 'Piso lavável', legislation: 'RDC Anvisa nº 50/2002', weight: 5, isCritical: false },
      { id: 'i2', sectionId: 'sec-1', order: 2, description: 'Lavatório de higiene das mãos', legislation: 'RDC Anvisa nº 63/2011', weight: 10, isCritical: true },
    ],
  },
  {
    id: 'sec-2',
    title: 'Processamento de artigos',
    items: [
      { id: 'i3', sectionId: 'sec-2', order: 1, description: 'Barreira técnica entre sujo e limpo', legislation: 'RDC Anvisa nº 15/2012', weight: 10, isCritical: true },
      { id: 'i4', sectionId: 'sec-2', order: 2, description: 'Teste biológico semanal', legislation: 'RDC Anvisa nº 15/2012', weight: 5, isCritical: false },
    ],
  },
] as unknown as Section[];

const REGRA_PROCESSAMENTO: ApplicabilityRule = {
  id: 'regra-processa',
  target: { type: 'section', id: 'sec-2' },
  expression: {
    combinator: 'all',
    conditions: [{ source: 'question', field: 'q-processa', operator: 'equals', value: true }],
  },
};

const ROTEIRO = {
  id: 'tpl-teste',
  name: 'Roteiro de teste',
  category: 'estetica',
  sections: SECOES,
  rules: [REGRA_PROCESSAMENTO],
  routingQuestions: [
    { id: 'q-processa', text: 'Processa artigos no local?', type: 'boolean', askAt: 'execution' },
  ],
} as unknown as ChecklistTemplate;

const SEM_REGRA = { ...ROTEIRO, rules: undefined, routingQuestions: undefined } as ChecklistTemplate;

const nc = (itemId: string): InspectionResponse => ({
  id: `r-${itemId}`,
  itemId,
  result: 'not_complies',
  createdAt: new Date('2026-09-01'),
} as unknown as InspectionResponse);

const ok = (itemId: string): InspectionResponse => ({
  id: `r-${itemId}`,
  itemId,
  result: 'complies',
  createdAt: new Date('2026-09-01'),
} as unknown as InspectionResponse);

/**
 * A situação que o card existe para resolver: a consultora respondeu os quatro
 * itens e **depois** declarou que a unidade não processa artigos. As respostas de
 * `i3` e `i4` continuam gravadas, e não podem contar em lugar nenhum.
 */
const RESPOSTAS = [ok('i1'), nc('i2'), nc('i3'), ok('i4')];

const NAO_PROCESSA = { routingAnswers: { 'q-processa': false } } as unknown as Inspection;
const PROCESSA = { routingAnswers: { 'q-processa': true } } as unknown as Inspection;

const idsDe = (template: ChecklistTemplate) =>
  template.sections.flatMap((s) => s.items.map((i) => i.id));

describe('COND-09 · o roteiro do resultado', () => {
  test('a seção que saiu por regra não está no roteiro que os resultados recebem', () => {
    const { template, counts } = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);

    expect(idsDe(template)).toEqual(['i1', 'i2']);
    expect(counts).toMatchObject({
      cadastrados: 4,
      aplicaveis: 2,
      foraPorRegra: 2,
      pendentes: 0,
      naArvore: 2,
      respondidos: 2,
      semResposta: 0,
    });
  });

  test('as duas respostas do que saiu continuam gravadas, e a tela conta que existem', () => {
    const { counts, excluded } = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);

    // Preservação (contrato § 6.1): nada foi apagado — a contagem prova.
    expect(counts.foraComResposta).toBe(2);
    expect(excluded.filter((alvo) => alvo.type === 'item').map((alvo) => alvo.id)).toEqual(['i3', 'i4']);
    expect(excluded.find((alvo) => alvo.type === 'section')?.id).toBe('sec-2');
  });

  test('respondendo "sim", a seção volta inteira e nada se perdeu', () => {
    const { template, counts } = applicableResults(ROTEIRO, PROCESSA, RESPOSTAS);

    expect(idsDe(template)).toEqual(['i1', 'i2', 'i3', 'i4']);
    expect(counts).toMatchObject({ aplicaveis: 4, foraPorRegra: 0, respondidos: 4 });
  });

  test('roteiro sem regra nenhuma atravessa inteiro — relatório já entregue não muda', () => {
    const { template, counts } = applicableResults(SEM_REGRA, undefined, RESPOSTAS);

    expect(idsDe(template)).toEqual(idsDe(SEM_REGRA));
    expect(counts).toMatchObject({ cadastrados: 4, aplicaveis: 4, foraPorRegra: 0, naArvore: 4 });
    expect(calculateScore(RESPOSTAS, template.sections))
      .toEqual(calculateScore(RESPOSTAS, SEM_REGRA.sections));
  });

  test('inspeção legada, sem contexto e sem resposta de roteamento, não perde item', () => {
    // Regra sem resposta é `pendente_de_condicao`: o item CONTINUA na árvore
    // (contrato § 6.4). Pendência que some é exatamente o que o contrato proíbe.
    const { template, counts } = applicableResults(ROTEIRO, undefined, RESPOSTAS);

    expect(idsDe(template)).toEqual(['i1', 'i2', 'i3', 'i4']);
    expect(counts).toMatchObject({ foraPorRegra: 0, pendentes: 2, naArvore: 4 });
  });
});

describe('COND-09 · a nota', () => {
  test('item fora por regra COM resposta não entra no denominador', () => {
    const { template } = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);

    const aplicavel = calculateScore(RESPOSTAS, template.sections);
    const arvoreInteira = calculateScore(RESPOSTAS, ROTEIRO.sections);

    // O denominador encolhe de 4 para 2 — e, o que pesa mais, a árvore inteira
    // acusa DUAS não conformidades críticas (i2 e i3) quando só uma delas foi
    // avaliada num ambiente que existe. A crítica fantasma é o que a nota antiga
    // punha no relatório.
    expect(arvoreInteira.totalItems).toBe(4);
    expect(arvoreInteira.criticalNotCompliesCount).toBe(2);

    expect(aplicavel.totalItems).toBe(2);
    expect(aplicavel.notCompliesCount).toBe(1);
    expect(aplicavel.criticalNotCompliesCount).toBe(1);
  });

  test('a NC crítica que saiu por regra deixa de contar como crítica', () => {
    const { template } = applicableResults(ROTEIRO, NAO_PROCESSA, [ok('i1'), ok('i2'), nc('i3')]);
    const score = calculateScore([ok('i1'), ok('i2'), nc('i3')], template.sections);

    expect(score.criticalNotCompliesCount).toBe(0);
    expect(score.scorePercentage).toBe(100);
  });
});

describe('COND-09 · as referências de legislação', () => {
  test('norma citada só por seção que saiu não fundamenta o relatório', () => {
    const { template } = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);

    // A RDC 15/2012 é citada só por i3 e i4, que saíram. Antes do COND-09 ela
    // aparecia na página de referências de um relatório que não avaliou nada de
    // processamento.
    expect(citedLegislations(template, RESPOSTAS)).toEqual([
      'RDC Anvisa nº 50/2002',
      'RDC Anvisa nº 63/2011',
    ]);
  });

  test('com a seção aplicável, a norma volta para a lista', () => {
    const { template } = applicableResults(ROTEIRO, PROCESSA, RESPOSTAS);
    expect(citedLegislations(template, RESPOSTAS)).toContain('RDC Anvisa nº 15/2012');
  });
});

describe('COND-09 · o plano de ação', () => {
  test('NC de item que saiu por regra não vira pendência no portal', () => {
    const { template } = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);
    const itens = template.sections.flatMap((s) => s.items);
    const idsAplicaveis = new Set(itens.map((i) => i.id));

    // O caminho real do resumo: as respostas do relatório saem do roteiro
    // recortado, e as NCs saem delas.
    const doRelatorio = getLatestResponsesByItem(RESPOSTAS, idsAplicaveis);
    const ncs = doRelatorio.filter((r) => r.result === 'not_complies');

    const publicados = buildClientActionItems(ncs, itens, new Date('2026-09-04'));

    expect(publicados.map((p) => p.source_item_id)).toEqual(['i2']);
    expect(publicados.map((p) => p.title)).toEqual(['Lavatório de higiene das mãos']);
  });

  test('nenhum rótulo do motor vaza para o payload do portal', () => {
    const { template } = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);
    const itens = template.sections.flatMap((s) => s.items);
    const publicados = buildClientActionItems([nc('i2')], itens, new Date('2026-09-04'));

    const texto = JSON.stringify(publicados);
    for (const jargao of ['nao_aplicavel_por_regra', 'pendente_de_condicao', 'aplicavel', 'por regra', 'condição']) {
      expect(texto).not.toContain(jargao);
    }
  });
});

describe('COND-09 · a identidade que é o aceite do card', () => {
  test('execução, score, resumo, PDF e plano de ação veem o MESMO conjunto', () => {
    const arvore = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);
    const itens = arvore.template.sections.flatMap((s) => s.items);
    const idsAplicaveis = new Set(itens.map((i) => i.id));

    // 1 · execução — a árvore que a tela mostra (o resumo recebe a mesma; o
    //     papel só recorta a EXIBIÇÃO, nunca o resultado — contrato § 6.6).
    const naExecucao = new Set(idsDe(arvore.template));

    // 2 · score — o denominador do MARP.
    const noScore = new Set(
      arvore.template.sections.flatMap((s) => s.items.map((i) => i.id))
    );
    expect(calculateScore(RESPOSTAS, arvore.template.sections).totalItems).toBe(naExecucao.size);

    // 3 · resumo — as respostas que o relatório exibe.
    const noResumo = new Set(getLatestResponsesByItem(RESPOSTAS, idsAplicaveis).map((r) => r.itemId));

    // 4 · PDF — as normas saem dos mesmos itens; a lista prova o recorte.
    const noPdf = new Set(
      arvore.template.sections.flatMap((s) => s.items.filter((i) => i.legislation).map((i) => i.id))
    );

    // 5 · plano de ação — elegível é NC de item aplicável.
    const noPlano = new Set(
      buildClientActionItems(
        getLatestResponsesByItem(RESPOSTAS, idsAplicaveis).filter((r) => r.result === 'not_complies'),
        itens,
        new Date('2026-09-04'),
      ).map((p) => p.source_item_id)
    );

    expect([...noScore].sort()).toEqual([...naExecucao].sort());
    expect([...noResumo].sort()).toEqual([...naExecucao].sort());
    expect([...noPdf].sort()).toEqual([...naExecucao].sort());
    for (const id of noPlano) expect(naExecucao.has(id)).toBe(true);

    // E o que ficou de fora ficou de fora de todos os cinco.
    for (const excluido of ['i3', 'i4']) {
      expect(naExecucao.has(excluido)).toBe(false);
      expect(noResumo.has(excluido)).toBe(false);
      expect(noPlano.has(excluido)).toBe(false);
    }
  });
});

describe('COND-09 · o progresso', () => {
  test('o denominador é o aplicável, não o cadastrado', () => {
    const parciais = [ok('i1'), nc('i3')];
    const { counts } = applicableResults(ROTEIRO, NAO_PROCESSA, parciais);

    // "1 de 2 aplicáveis respondidos" — e não "2 de 4 cadastrados".
    expect(counts.cadastrados).toBe(4);
    expect(counts.naArvore).toBe(2);
    expect(counts.respondidos).toBe(1);
    expect(counts.semResposta).toBe(1);
  });

  test('resposta "not_evaluated" não conta como respondida', () => {
    const respostas = [
      ok('i1'),
      { id: 'r-i2', itemId: 'i2', result: 'not_evaluated', createdAt: new Date('2026-09-01') },
    ] as unknown as InspectionResponse[];

    expect(evaluatedItemIdsFrom(respostas)).toEqual(new Set(['i1']));
    expect(applicableResults(ROTEIRO, NAO_PROCESSA, respostas).counts.respondidos).toBe(1);
  });

  test('item reavaliado conta pela última resposta', () => {
    const antiga = { id: 'a', itemId: 'i1', result: 'not_evaluated', createdAt: new Date('2026-09-01') };
    const nova = { id: 'b', itemId: 'i1', result: 'complies', createdAt: new Date('2026-09-02') };
    expect(evaluatedItemIdsFrom([antiga, nova] as unknown as InspectionResponse[]))
      .toEqual(new Set(['i1']));

    const desfeita = { id: 'c', itemId: 'i1', result: 'not_evaluated', createdAt: new Date('2026-09-03') };
    expect(evaluatedItemIdsFrom([antiga, nova, desfeita] as unknown as InspectionResponse[]))
      .toEqual(new Set());
  });
});

describe('COND-09 · a camada pura', () => {
  test('não inventa avaliador próprio: sem regra, devolve o que recebeu', () => {
    const arvore = resolveResultsTree({
      template: { sections: [{ id: 's', title: 'S', items: [{ id: 'a' }, { id: 'b' }] }] },
    });
    expect(arvore.template.sections[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(arvore.counts).toMatchObject({ cadastrados: 2, aplicaveis: 2, naArvore: 2, respondidos: 0 });
  });

  test('preserva as demais propriedades do roteiro', () => {
    const { template } = applicableResults(ROTEIRO, NAO_PROCESSA, RESPOSTAS);
    expect(template.id).toBe(ROTEIRO.id);
    expect(template.name).toBe(ROTEIRO.name);
    expect(template.category).toBe(ROTEIRO.category);
    // E não muta o original.
    expect(ROTEIRO.sections).toHaveLength(2);
  });
});
