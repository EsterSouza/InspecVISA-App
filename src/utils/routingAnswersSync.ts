// ============================================================
// src/utils/routingAnswersSync.ts
// COND-08 — a ponte entre o merge por pergunta (domínio) e o merge de registro
// do `RepositoryService`.
//
// O merge de registro é `{...local, ...remote}`: o lado que vence leva o objeto
// inteiro. Para resposta de roteamento isso é perda silenciosa — a colega
// respondeu a pergunta 2 offline e a sua resposta à pergunta 1 sumiria. Aqui a
// convergência é **por pergunta**, com carimbo de hora e autoria (contrato § 6.5).
//
// Puro: sem rede, sem Dexie, sem relógio. Quem grava é o RepositoryService.
// ============================================================

import { mergeRoutingAnswers } from '../domain/applicability';
import type { RoutingAnswers, RoutingAnswersMeta } from '../domain/applicability';

/** O recorte de uma inspeção que este arquivo lê. Serve local e remoto. */
export interface RoutingAnswerCarrier {
  routingAnswers?: RoutingAnswers;
  routingAnswersMeta?: RoutingAnswersMeta;
}

export interface RoutingReconciliation {
  /** O que gravar dos dois lados — já convergido. */
  patch: RoutingAnswerCarrier;
  /** `true` quando o local tem resposta que o servidor ainda não conhece. */
  localAhead: boolean;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function hasRouting(record: RoutingAnswerCarrier | undefined | null): boolean {
  if (!record) return false;
  return record.routingAnswers !== undefined || record.routingAnswersMeta !== undefined;
}

/**
 * Converge as respostas de roteamento dos dois lados.
 *
 * Devolve `null` quando não há nada a fazer — nenhum dos lados tem resposta, ou
 * os dois já estão iguais. Devolver `null` importa: é o que evita gravação e
 * `syncStatus: 'pending'` a cada verificação de rotina.
 */
export function reconcileRoutingAnswers(
  local: RoutingAnswerCarrier | undefined | null,
  remote: RoutingAnswerCarrier | undefined | null
): RoutingReconciliation | null {
  if (!hasRouting(local) && !hasRouting(remote)) return null;

  const merged = mergeRoutingAnswers(
    { answers: local?.routingAnswers, meta: local?.routingAnswersMeta },
    { answers: remote?.routingAnswers, meta: remote?.routingAnswersMeta }
  );

  const answers = Object.keys(merged.answers).length > 0 ? merged.answers : undefined;
  const meta = Object.keys(merged.meta).length > 0 ? merged.meta : undefined;

  const igualAoLocal = sameJson(answers, local?.routingAnswers) && sameJson(meta, local?.routingAnswersMeta);
  const igualAoRemoto = sameJson(answers, remote?.routingAnswers) && sameJson(meta, remote?.routingAnswersMeta);
  if (igualAoLocal && igualAoRemoto) return null;

  return {
    patch: { routingAnswers: answers, routingAnswersMeta: meta },
    localAhead: !igualAoRemoto,
  };
}
