// ============================================================
// COND-05 — contexto congelado + a fronteira entre pergunta de roteamento e
// requisito sanitário.
//
// Contrato: docs/contrato-aplicabilidade.md (§ 3, § 4, § 4.1, § 6.2)
//
// O que estes testes travam:
//  1. O contexto é normalizado na criação (UF de texto livre vira sigla) e dado
//     em branco não vira valor — fica ausente, logo indeterminado.
//  2. Congelado é congelado: mudar o cadastro do cliente depois não muda a
//     árvore de uma inspeção já criada.
//  3. Pergunta de roteamento não entra em nota, relatório nem plano de ação —
//     nem quando alguém força uma resposta com o id dela.
// ============================================================

import { describe, expect, test } from 'vitest';
import { buildInspectionContext, evaluateApplicability } from '../../domain/applicability';
import type { ConditionalTemplate } from '../../domain/applicability';
import {
  contextFromInspection,
  freezeContextForNewInspection,
  resolveInspectionContext,
} from '../../utils/inspectionContext';
import { calculateScore, getLatestResponsesByItem } from '../../utils/scoring';
import { resolveReportTemplate } from '../../utils/reportTemplate';
import { buildClientActionItems } from '../../utils/clientActionPlan';
import type { ChecklistTemplate, Client, Inspection, InspectionResponse } from '../../types';

const CRIADA_EM = new Date('2026-08-20T14:00:00.000Z');

function cliente(overrides: Partial<Client> = {}): Client {
  return {
    id: 'cli-1',
    name: 'Clínica Exemplo',
    category: 'estetica',
    city: 'Niterói',
    state: 'Rio de Janeiro',
    ...overrides,
  } as unknown as Client;
}

function roteiroDeItens(): ChecklistTemplate {
  return {
    id: 'tpl-teste',
    name: 'Roteiro de teste',
    category: 'estetica',
    version: '1',
    sections: [
      {
        id: 'sec-1',
        title: 'Estrutura',
        order: 1,
        items: [
          { id: 'item-1', sectionId: 'sec-1', order: 1, description: 'Piso lavável', weight: 5, isCritical: false },
          { id: 'item-2', sectionId: 'sec-1', order: 2, description: 'Pia com água corrente', weight: 10, isCritical: true },
        ],
      },
    ],
  };
}

function inspecao(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'insp-1',
    clientId: 'cli-1',
    templateId: 'tpl-teste',
    consultantName: 'Consultora',
    inspectionDate: CRIADA_EM,
    status: 'in_progress',
    createdAt: CRIADA_EM,
    updatedAt: CRIADA_EM,
    city: 'Niterói',
    state: 'Rio de Janeiro',
    clientCategory: 'estetica',
    syncStatus: 'pending',
    ...overrides,
  } as Inspection;
}

function resposta(itemId: string, overrides: Partial<InspectionResponse> = {}): InspectionResponse {
  return {
    id: `resp-${itemId}`,
    inspectionId: 'insp-1',
    itemId,
    result: 'not_complies',
    createdAt: CRIADA_EM,
    updatedAt: CRIADA_EM,
    syncStatus: 'pending',
    ...overrides,
  } as InspectionResponse;
}

describe('o contexto congelado é normalizado na criação', () => {
  test('UF de texto livre vira sigla — o cadastro escreve como quer', () => {
    expect(buildInspectionContext({ state: 'Goias' }).uf).toBe('GO');
    expect(buildInspectionContext({ state: 'rj ' }).uf).toBe('RJ');
    expect(buildInspectionContext({ state: 'Rio de Janeiro' }).uf).toBe('RJ');
  });

  test('dado em branco ou irreconhecível fica AUSENTE, nunca vira valor', () => {
    const context = buildInspectionContext({ state: 'Terra Média', city: '   ', ilpiCapacity: '' });
    expect('uf' in context).toBe(false);
    expect('municipio' in context).toBe(false);
    expect('capacidadeIlpi' in context).toBe(false);
  });

  test('número em texto vira número, e data vira instante', () => {
    const context = buildInspectionContext({
      ilpiCapacity: '40',
      residentsTotal: 37,
      usableAreaM2: '120,5',
      startedAt: CRIADA_EM,
    });
    expect(context.capacidadeIlpi).toBe(40);
    expect(context.residentesTotal).toBe(37);
    expect(context.areaUtilM2).toBe(120.5);
    expect(context.inicioDaInspecao).toBe(CRIADA_EM.toISOString());
  });

  test('as chaves são as do catálogo do motor — condição sobre elas é avaliável', () => {
    const context = freezeContextForNewInspection(cliente({ category: 'alimentos', foodTypes: ['pescados_crus'] }), {
      startedAt: CRIADA_EM,
    });
    expect(context).toEqual({
      uf: 'RJ',
      municipio: 'Niterói',
      categoria: 'alimentos',
      tiposDeAlimento: ['pescados_crus'],
      inicioDaInspecao: CRIADA_EM.toISOString(),
    });
  });
});

describe('congelado é congelado (contrato § 4 e § 6.2)', () => {
  const template: ConditionalTemplate = {
    sections: [{ id: 'sec-rj', title: 'Exigências do RJ', items: [{ id: 'item-rj' }] }],
    rules: [
      {
        id: 'regra-rj',
        target: { type: 'section', id: 'sec-rj' },
        expression: { combinator: 'all', conditions: [{ source: 'context', field: 'uf', operator: 'equals', value: 'RJ' }] },
      },
    ],
  };

  test('mudar o cadastro do cliente depois não muda a árvore da inspeção', () => {
    const congelado = freezeContextForNewInspection(cliente(), { startedAt: CRIADA_EM });
    const naInspecao = inspecao({ applicabilityContext: congelado });

    // O cadastro muda de estado depois da inspeção criada.
    const cadastroVivo = cliente({ state: 'São Paulo', city: 'Santos' });
    expect(cadastroVivo.state).toBe('São Paulo');

    const decisao = evaluateApplicability({ template, context: resolveInspectionContext(naInspecao) });
    expect(decisao.sections['sec-rj'].state).toBe('aplicavel');
  });

  test('inspeção anterior ao COND-05 congela do que ela própria guardou, não do cadastro', () => {
    const legada = inspecao({ state: 'Goias', city: 'Goiânia' });
    expect(legada.applicabilityContext).toBeUndefined();

    const reconstruido = contextFromInspection(legada);
    expect(reconstruido.uf).toBe('GO');
    expect(reconstruido.municipio).toBe('Goiânia');
    expect(reconstruido.inicioDaInspecao).toBe(CRIADA_EM.toISOString());
    expect(resolveInspectionContext(legada)).toEqual(reconstruido);
  });

  test('havendo contexto congelado, ele ganha do que a inspeção guardou solto', () => {
    const congelada = inspecao({ state: 'São Paulo', applicabilityContext: { uf: 'RJ' } });
    expect(resolveInspectionContext(congelada)).toEqual({ uf: 'RJ' });
  });
});

describe('pergunta de roteamento não é exigência sanitária (contrato § 3)', () => {
  const template = roteiroDeItens();
  const itens = template.sections.flatMap((section) => section.items);
  const itemIds = new Set(itens.map((item) => item.id));

  // A resposta de roteamento mora na inspeção. Aqui a gente força o pior caso:
  // alguém gravou uma RESPOSTA com o id da pergunta, como se fosse requisito.
  const forjada = resposta('q-processa', { situationDescription: 'Resposta de roteamento disfarçada' });
  const respostas = [resposta('item-1'), resposta('item-2', { result: 'complies' }), forjada];

  test('a resposta de roteamento vive fora de `responses` — é campo da inspeção', () => {
    const comRoteamento = inspecao({ routingAnswers: { 'q-processa': true } });
    expect(comRoteamento.routingAnswers).toEqual({ 'q-processa': true });
    expect(itemIds.has('q-processa')).toBe(false);
  });

  test('a nota ignora resposta que não é de item do roteiro', () => {
    const score = calculateScore(respostas, template.sections);
    expect(score.totalItems).toBe(2);
    expect(score.evaluatedItems).toBe(2);
    expect(score.notCompliesCount).toBe(1);
  });

  test('o relatório não conhece o id da pergunta', () => {
    const resolvido = resolveReportTemplate(template, inspecao({ reportTemplateSnapshot: template }), respostas);
    const idsDoRelatorio = resolvido.sections.flatMap((section) => section.items.map((item) => item.id));
    expect(idsDoRelatorio).toEqual(['item-1', 'item-2']);
    expect(idsDoRelatorio).not.toContain('q-processa');
  });

  test('o plano de ação sai só das NCs de item do roteiro', () => {
    // É o mesmo recorte do resumo (InspectionSummary): as respostas do relatório
    // são filtradas pelos itens do roteiro antes de virar pendência.
    const doRelatorio = getLatestResponsesByItem(respostas, itemIds);
    const naoConformes = doRelatorio.filter((r) => r.result === 'not_complies');
    const plano = buildClientActionItems(naoConformes, itens, CRIADA_EM);
    expect(plano.map((item) => item.source_item_id)).toEqual(['item-1']);
  });
});
