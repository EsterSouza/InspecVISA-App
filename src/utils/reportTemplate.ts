import { composeCanonicalTemplate, getEffectiveTemplate } from '../data/templates';
import type { ChecklistTemplate, Client, Inspection, InspectionResponse, Section } from '../types';

function cloneTemplate(template: ChecklistTemplate): ChecklistTemplate {
  return JSON.parse(JSON.stringify(template));
}

function withoutSyntheticSections(template: ChecklistTemplate): ChecklistTemplate {
  const sections = template.sections.filter(section =>
    section.id !== 'sec-report-recovered'
    && section.id !== 'sec-previous-pendencies'
  );
  return sections.length === template.sections.length ? template : { ...template, sections };
}

/**
 * Builds a conservative template for completed reports created before snapshots existed.
 * Federal items remain in place, while supplementary/dynamic items are only retained
 * when there is a recorded response for them.
 */
export function buildLegacyCompletedReportTemplate(
  baseTemplate: ChecklistTemplate,
  inspection: Inspection,
  responses: InspectionResponse[]
): ChecklistTemplate {
  const effectiveTemplate = getEffectiveTemplate(
    baseTemplate,
    inspection as unknown as Parameters<typeof getEffectiveTemplate>[1],
    undefined,
    true,
  );
  const baseItemIds = new Set(baseTemplate.sections.flatMap(section => section.items.map(item => item.id)));
  const responseIds = new Set(
    responses
      .filter(response => response.itemId && !response.deletedAt)
      .map(response => response.itemId)
  );
  let retainedSupplementItems = 0;

  const sections: Section[] = effectiveTemplate.sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        const shouldKeep = baseItemIds.has(item.id) || responseIds.has(item.id);
        if (shouldKeep) {
          if (!baseItemIds.has(item.id)) retainedSupplementItems += 1;
        }
        return shouldKeep;
      }),
    }))
    .filter(section => section.items.length > 0);

  const template = cloneTemplate(effectiveTemplate);
  template.sections = sections;
  if (retainedSupplementItems === 0) template.name = baseTemplate.name;
  return template;
}

/**
 * Verifica se o snapshot do relatório cobre TODAS as respostas avaliadas. Um
 * snapshot congelado a partir de um roteiro filtrado por papel (ex.: Ester, só
 * sanitária) deixa de fora as seções de nutrição da Ana — mas as respostas dela
 * existem. Nesse caso o snapshot está incompleto e não deve ser usado cru.
 */
function snapshotCoversResponses(snapshot: ChecklistTemplate, responses: InspectionResponse[]): boolean {
  const snapshotItemIds = new Set(snapshot.sections.flatMap(section => section.items.map(item => item.id)));
  return responses
    .filter(response => response.itemId && !response.deletedAt && response.result && response.result !== 'not_evaluated')
    .every(response => snapshotItemIds.has(response.itemId));
}

export function resolveReportTemplate(
  baseTemplate: ChecklistTemplate,
  inspection: Inspection,
  responses: InspectionResponse[]
): ChecklistTemplate {
  if (inspection.status === 'completed') {
    const snapshot = inspection.reportTemplateSnapshot;
    if (snapshot && snapshotCoversResponses(snapshot, responses)) return withoutSyntheticSections(snapshot);
    // COND-03: com "uma árvore só" (contrato § 6.6), o snapshot é sempre a árvore
    // completa e cobre as respostas por construção. Chegar aqui com snapshot
    // presente é dado anterior à unificação (congelado filtrado por papel):
    // reconstrói de forma conservadora, mas registra VISIVELMENTE em vez de
    // falhar calado. Relatório concluído sem snapshot (pré-snapshot) segue o
    // mesmo caminho legado, idêntico ao de antes.
    if (snapshot) {
      console.warn(
        '[reportTemplate] Snapshot congelado não cobre todas as respostas avaliadas; roteiro do relatório reconstruído de forma conservadora.',
        { inspectionId: inspection.id },
      );
    }
    return buildLegacyCompletedReportTemplate(baseTemplate, inspection, responses);
  }

  // COND-03: inspeção EM ANDAMENTO lê a REVISÃO CONGELADA e não segue o roteiro
  // vivo (contrato § 6.2). Sem snapshot (legada ainda não aberta na execução, que
  // é onde o lazy-freeze acontece), compõe a canônica uma vez — agora com o MESMO
  // corte de aposentados da execução (`createdAt`), unificando execução e resumo
  // (mapa, achado A9), que hoje divergem porque este caminho não aplicava o corte.
  if (inspection.reportTemplateSnapshot) return withoutSyntheticSections(inspection.reportTemplateSnapshot);
  return composeCanonicalTemplate(
    baseTemplate,
    inspection as unknown as Client,
    inspection.createdAt,
  );
}
