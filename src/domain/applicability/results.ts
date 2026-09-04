// ============================================================
// src/domain/applicability/results.ts
// COND-09 — os resultados sobre o conjunto de APLICÁVEIS.
//
// O COND-08 respondeu "o que a tela mostra?". Este arquivo responde a pergunta
// seguinte, que é a que decide integridade sanitária: **"o que entra no
// resultado?"** — nota, progresso, resumo, PDF, página de referências e plano de
// ação. O card é reprovado se qualquer um desses cinco enxergar um conjunto
// diferente dos outros, então existe uma função só, e todos passam por ela:
//
//   itens considerados na execução
// = itens considerados no score
// = itens considerados no summary
// = itens considerados no PDF
// = itens elegíveis ao plano de ação
//
// A garantia é estrutural, não de disciplina: `resolveResultsTree` devolve o
// **próprio roteiro** já sem o que saiu por regra. Quem recebe esse roteiro não
// tem como incluir de volta um item excluído, porque ele não está mais lá. Foi
// assim que os cinco consumidores convergiram sem cinco filtros paralelos.
//
// Nenhuma regra de aplicabilidade nova mora aqui. Quem decide continua sendo
// `evaluateApplicability`, por meio de `resolveExecutionTree` (regra inegociável
// 8 do handoff). Este arquivo só recorta a árvore e conta.
//
// Puro: sem React, sem Supabase, sem rede, sem relógio.
//
// Contrato normativo: docs/contrato-aplicabilidade.md
// ============================================================

import { CONTEXT_FIELDS } from './schema';
import type {
  ConditionalTemplate,
  ContextField,
  InspectionContext,
  RoutingAnswers,
} from './schema';
import type { ApplicabilityDecision, ApplicabilityResult } from './evaluate';
import { resolveExecutionTree } from './execution';
import type { ExcludedTarget, ExecutionCounts, ExecutionSection } from './execution';

/**
 * O que a inspeção carrega de congelado. É de propósito o subconjunto de
 * `Inspection` que interessa: a camada pura não conhece o tipo do app.
 */
export interface ResultsSource {
  applicabilityContext?: InspectionContext;
  routingAnswers?: RoutingAnswers;
}

export interface ResultsCounts extends ExecutionCounts {
  /**
   * O que continua na árvore: aplicáveis **mais** pendentes de condição.
   * Pendente não sai da tela (contrato § 6.4) — então ele é denominador, não
   * exclusão. É este o número que o "X de Y" do progresso usa.
   */
  naArvore: number;
  /** Itens da árvore com resposta definitiva (C · NC · NA · NO). */
  respondidos: number;
  /** Itens da árvore ainda sem resposta definitiva. */
  semResposta: number;
}

export interface ResultsTreeInput<
  S extends ExecutionSection,
  T extends ConditionalTemplate & { sections: S[] },
> {
  /** A revisão congelada — snapshot do relatório ou árvore da execução. Nunca o roteiro vivo. */
  template: T;
  source?: ResultsSource;
  /**
   * Ids com **qualquer** resposta gravada. Decide se o item excluído aparece na
   * lista de "saiu por regra, mas tem resposta" (contrato § 6.1).
   */
  answeredItemIds?: ReadonlySet<string>;
  /**
   * Ids com resposta **definitiva** (`result` presente e diferente de
   * `not_evaluated`). É o numerador do progresso — mesma régua do `calculateScore`.
   */
  evaluatedItemIds?: ReadonlySet<string>;
  contextFields?: ContextField[];
}

export interface ResultsTree<
  S extends ExecutionSection,
  T extends ConditionalTemplate & { sections: S[] },
> {
  /**
   * O roteiro pronto para o resultado: mesmo objeto, mesmas propriedades, já sem
   * seção e sem item que saíram por regra. É o que score, resumo, PDF,
   * referências e plano de ação recebem.
   */
  template: T;
  counts: ResultsCounts;
  /** O que saiu por regra, com o motivo — o resumo lista, o PDF não conta. */
  excluded: ExcludedTarget[];
  sectionState: Record<string, ApplicabilityDecision>;
  itemState: Record<string, ApplicabilityDecision>;
  validation: ApplicabilityResult['validation'];
}

const VAZIO: ReadonlySet<string> = new Set<string>();

/**
 * A árvore dos resultados.
 *
 * Roteiro **sem regra nenhuma** atravessa inteiro: o motor devolve tudo
 * aplicável, o recorte não tira nada e as contagens ficam iguais às de antes do
 * COND-09. É a propriedade que mantém os 40 e tantos relatórios já entregues
 * byte a byte idênticos, e que faz "desligar o motor" ser seguro (COND-10).
 */
export function resolveResultsTree<
  S extends ExecutionSection,
  T extends ConditionalTemplate & { sections: S[] },
>(input: ResultsTreeInput<S, T>): ResultsTree<S, T> {
  const answered = input.answeredItemIds || VAZIO;
  const evaluated = input.evaluatedItemIds || VAZIO;

  const tree = resolveExecutionTree<S>({
    sections: input.template.sections || [],
    rules: input.template.rules,
    routingQuestions: input.template.routingQuestions,
    context: input.source?.applicabilityContext,
    answers: input.source?.routingAnswers,
    contextFields: input.contextFields || CONTEXT_FIELDS,
    answeredItemIds: answered,
  });

  // O numerador do progresso conta sobre a árvore recortada, não sobre o
  // roteiro inteiro: resposta de item que saiu por regra está preservada no
  // histórico, mas não é progresso de nada (contrato § 6.1).
  let respondidos = 0;
  let naArvore = 0;
  for (const section of tree.sections) {
    for (const item of section.items || []) {
      naArvore += 1;
      if (evaluated.has(item.id)) respondidos += 1;
    }
  }

  return {
    template: { ...input.template, sections: tree.sections },
    counts: {
      ...tree.counts,
      naArvore,
      respondidos,
      semResposta: Math.max(0, naArvore - respondidos),
    },
    excluded: tree.excluded,
    sectionState: tree.sectionState,
    itemState: tree.itemState,
    validation: tree.validation,
  };
}
