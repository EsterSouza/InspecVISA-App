// ============================================================
// src/utils/applicableResults.ts
// COND-09 — a ponte entre a inspeção do app e a camada pura de resultados.
//
// `resolveResultsTree` (domain/applicability/results.ts) não conhece `Inspection`
// nem `InspectionResponse`, e é assim que ela permanece testável sem banco. Este
// arquivo faz a tradução — e só isso. **Nenhuma decisão de aplicabilidade mora
// aqui** (regra inegociável 8 do handoff): quem decide é o motor.
//
// Quem chama isto: o resumo, o PDF, a página de referências, o plano de ação e a
// nota da execução. Todos recebem o MESMO roteiro recortado, que é o que faz os
// cinco conjuntos serem idênticos por construção.
// ============================================================

import { gateByPilot, resolveResultsTree } from '../domain/applicability';
import type { ResultsSource, ResultsTree } from '../domain/applicability';
import { getLatestResponsesByItem } from './scoring';
import type { ChecklistTemplate, InspectionResponse, Section } from '../types';

export type ReportResultsTree = ResultsTree<Section, ChecklistTemplate>;

/** Itens com **qualquer** resposta viva — decide o que aparece na lista de excluídos. */
export function answeredItemIdsFrom(responses: InspectionResponse[]): Set<string> {
  const ids = new Set<string>();
  for (const response of responses) {
    if (!response?.itemId || response.deletedAt) continue;
    ids.add(response.itemId);
  }
  return ids;
}

/**
 * Itens com resposta **definitiva** na versão mais recente.
 *
 * A régua é a mesma do `calculateScore` — `result` presente e diferente de
 * `not_evaluated` —, e por isso passa pelo `getLatestResponsesByItem`: item
 * reavaliado depois conta pela última resposta, não pela primeira.
 */
export function evaluatedItemIdsFrom(responses: InspectionResponse[]): Set<string> {
  const ids = new Set<string>();
  for (const response of getLatestResponsesByItem(responses)) {
    if (!response.result || response.result === 'not_evaluated') continue;
    ids.add(response.itemId);
  }
  return ids;
}

/**
 * O roteiro do resultado, já sem o que saiu por regra, com as contagens do
 * resumo e a lista do que foi excluído.
 *
 * `source` é a inspeção: o contexto e as respostas de roteamento **congelados**
 * nela. Inspeção legada (sem os dois) e roteiro sem regra atravessam inteiros —
 * nada muda para os relatórios já entregues.
 */
export function applicableResults(
  template: ChecklistTemplate,
  source: ResultsSource | null | undefined,
  responses: InspectionResponse[]
): ReportResultsTree {
  // COND-10 - fora do piloto o motor nao e consultado, mesmo que a arvore
  // congelada carregue regra. E aqui que o rollback alcanca inspecao JA
  // congelada, sem tocar em nada gravado. O gate mora nesta ponte, e nao dentro
  // de `resolveResultsTree`: a camada pura faz o que lhe mandam, quem decide se
  // o motor roda e o app.
  return resolveResultsTree<Section, ChecklistTemplate>({
    template: gateByPilot(template),
    source: source || undefined,
    answeredItemIds: answeredItemIdsFrom(responses),
    evaluatedItemIds: evaluatedItemIdsFrom(responses),
  });
}

/**
 * Atalho para quem só quer o roteiro recortado — o caso da nota numa lista de
 * inspeções, onde as contagens não são exibidas.
 */
export function applicableTemplate(
  template: ChecklistTemplate,
  source: ResultsSource | null | undefined,
  responses: InspectionResponse[]
): ChecklistTemplate {
  return applicableResults(template, source, responses).template;
}
