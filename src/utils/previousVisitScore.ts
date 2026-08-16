import { db } from '../db/database';
import { getTemplateById } from '../data/templates';
import { InspectionService } from '../services/inspectionService';
import { calculateAreaScores, classificationLabel } from './scoring';
import { filterByActiveTenant } from './localScope';
import type { ChecklistTemplate, ScoreClassification } from '../types';

/**
 * Nota da visita anterior, para a comparação da decisão 29 do FE-23.
 *
 * A diferença é sempre em **pontos percentuais**, nunca em por cento: de 63%
 * para 71% são 8 pontos, e chamar isso de "+8%" está errado. Cada área compara
 * com a **mesma** área — comparar a sanitária com a nota global daria uma
 * diferença que não existe.
 */
export interface PreviousVisitScore {
  inspectionId: string;
  inspectionDate: Date;
  global: number;
  classification: ScoreClassification;
  classificationLabel: string;
  sanitary?: number;
  nutrition?: number;
}

/**
 * Última inspeção **concluída** do mesmo cliente, desde que feita com o **mesmo
 * roteiro**. Roteiro trocado entre as duas visitas devolve `null` e a linha de
 * comparação some da tela: número comparado com o que não é comparável é pior
 * que número sozinho.
 *
 * Lê o mesmo cache Dexie que `getOpenPendingHistory` já hidrata — sem consulta
 * nova ao servidor. A nota sai do `reportTemplateSnapshot` congelado no
 * encerramento (REF-06), não do roteiro de hoje, que pode ter mudado desde então.
 */
export async function getPreviousVisitScore(
  clientId: string,
  currentInspectionId: string,
  currentTemplateId: string,
): Promise<PreviousVisitScore | null> {
  const completed = filterByActiveTenant(await db.inspections
    .where('clientId')
    .equals(clientId)
    .filter(inspection =>
      inspection.status === 'completed'
      && !inspection.deletedAt
      && inspection.id !== currentInspectionId
    )
    .toArray());

  if (completed.length === 0) return null;

  const previous = completed.sort((a, b) => {
    const aTime = new Date(a.inspectionDate || a.completedAt || a.createdAt).getTime();
    const bTime = new Date(b.inspectionDate || b.completedAt || b.createdAt).getTime();
    return bTime - aTime;
  })[0];

  if (previous.templateId !== currentTemplateId) return null;

  const template: ChecklistTemplate | undefined = previous.reportTemplateSnapshot
    || getTemplateById(previous.templateId)
    || await db.templates.get(previous.templateId);
  if (!template?.sections?.length) return null;

  const responses = filterByActiveTenant(await db.responses
    .where('inspectionId')
    .equals(previous.id)
    .filter(response => !response.deletedAt)
    .toArray());
  if (responses.length === 0) return null;

  const areas = calculateAreaScores(responses, template.sections);

  return {
    inspectionId: previous.id,
    inspectionDate: new Date(previous.inspectionDate),
    global: areas.global.scorePercentage,
    classification: areas.global.classification,
    classificationLabel: classificationLabel(areas.global.classification),
    sanitary: areas.sanitary.hasResponses ? areas.sanitary.score.scorePercentage : undefined,
    nutrition: areas.nutrition.hasResponses ? areas.nutrition.score.scorePercentage : undefined,
  };
}

/**
 * Garante que as inspeções concluídas do cliente estejam no cache local antes
 * de comparar. Sem isso, um aparelho novo mostraria "sem visita anterior" para
 * um cliente que tem cinco.
 */
export async function hydrateAndGetPreviousVisitScore(
  clientId: string,
  currentInspectionId: string,
  currentTemplateId: string,
): Promise<PreviousVisitScore | null> {
  await InspectionService.hydrateClientHistory(clientId).catch(() => {});
  return getPreviousVisitScore(clientId, currentInspectionId, currentTemplateId);
}
