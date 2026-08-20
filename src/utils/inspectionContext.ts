// ============================================================
// src/utils/inspectionContext.ts
// COND-05 — a ponte entre os dados do app (Client, Inspection, wizard) e o
// contexto congelado que o motor de aplicabilidade lê.
//
// A normalização mora no domínio (src/domain/applicability/context.ts). Aqui só
// se decide DE ONDE cada campo vem — e a resposta é sempre a mesma: do que a
// inspeção já guardou, nunca do cadastro vivo (contrato § 4 e § 6.2).
// ============================================================

import { buildInspectionContext } from '../domain/applicability';
import type { InspectionContext } from '../domain/applicability';
import type { Client, ClientCategory, Inspection } from '../types';

/** Registro antigo guardava a categoria em `category`, não em `clientCategory`. */
function categoriaDaInspecao(inspection: Inspection): ClientCategory | undefined {
  return inspection.clientCategory ?? (inspection as Inspection & { category?: ClientCategory }).category;
}

/** Os números do wizard que entram no contexto — o resto do cadastro vem do cliente. */
export interface WizardContextInput {
  startedAt: Date;
  ilpiCapacity?: number | string | null;
  residentsTotal?: number | string | null;
  usableAreaM2?: number | string | null;
}

/**
 * O contexto congelado de uma inspeção **nova**: cadastro do cliente + o que a
 * consultora acabou de digitar no wizard, na hora de criar.
 */
export function freezeContextForNewInspection(client: Client, wizard: WizardContextInput): InspectionContext {
  return buildInspectionContext({
    state: client.state,
    city: client.city,
    category: client.category,
    foodTypes: client.foodTypes,
    ilpiCapacity: wizard.ilpiCapacity,
    residentsTotal: wizard.residentsTotal,
    usableAreaM2: wizard.usableAreaM2,
    startedAt: wizard.startedAt,
  });
}

/**
 * O contexto de uma inspeção que já existe, reconstruído **do que ela própria
 * guardou** na criação (cidade, UF, categoria, números). É o congelamento
 * tardio das inspeções em andamento criadas antes do COND-05 — mesmo espírito do
 * lazy freeze do roteiro no COND-03: uma vez só, e nunca mais o cadastro vivo.
 */
export function contextFromInspection(inspection: Inspection): InspectionContext {
  return buildInspectionContext({
    state: inspection.state,
    city: inspection.city,
    category: categoriaDaInspecao(inspection),
    foodTypes: inspection.foodTypes,
    ilpiCapacity: inspection.ilpiCapacity,
    residentsTotal: inspection.residentsTotal,
    usableAreaM2: inspection.usableAreaM2,
    startedAt: inspection.createdAt,
  });
}

/**
 * O contexto que vale para esta inspeção: o congelado, se houver. Só reconstrói
 * quando ele não existe — inspeção anterior ao COND-05.
 */
export function resolveInspectionContext(inspection: Inspection): InspectionContext {
  return inspection.applicabilityContext ?? contextFromInspection(inspection);
}
