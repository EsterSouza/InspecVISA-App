import { getEffectiveTemplate } from '../data/templates';
import type { ChecklistItem, ChecklistTemplate, Inspection, InspectionResponse, Section } from '../types';

function cloneTemplate(template: ChecklistTemplate): ChecklistTemplate {
  return JSON.parse(JSON.stringify(template));
}

function recoveryItem(response: InspectionResponse, order: number): ChecklistItem {
  return {
    id: response.itemId,
    sectionId: 'sec-report-recovered',
    order,
    description:
      response.customDescription ||
      response.situationDescription ||
      `Item preservado do relatorio concluido (${response.itemId})`,
    weight: 1,
    isCritical: false,
  };
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
  const effectiveTemplate = getEffectiveTemplate(baseTemplate, inspection as any, undefined, true);
  const baseItemIds = new Set(baseTemplate.sections.flatMap(section => section.items.map(item => item.id)));
  const responseIds = new Set(
    responses
      .filter(response => response.itemId && !response.deletedAt)
      .map(response => response.itemId)
  );
  const representedIds = new Set<string>();
  let retainedSupplementItems = 0;

  const sections: Section[] = effectiveTemplate.sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        const shouldKeep = baseItemIds.has(item.id) || responseIds.has(item.id);
        if (shouldKeep) {
          representedIds.add(item.id);
          if (!baseItemIds.has(item.id)) retainedSupplementItems += 1;
        }
        return shouldKeep;
      }),
    }))
    .filter(section => section.items.length > 0);

  const missingResponses = responses
    .filter(response => response.itemId && !response.deletedAt && !representedIds.has(response.itemId))
    .filter((response, index, all) => all.findIndex(candidate => candidate.itemId === response.itemId) === index);

  if (missingResponses.length > 0) {
    sections.push({
      id: 'sec-report-recovered',
      title: 'Itens preservados do roteiro concluido',
      order: Math.max(0, ...sections.map(section => section.order)) + 1,
      items: missingResponses.map((response, index) => recoveryItem(response, index + 1)),
    });
  }

  const template = cloneTemplate(effectiveTemplate);
  template.sections = sections;
  if (retainedSupplementItems === 0) template.name = baseTemplate.name;
  return template;
}

export function resolveReportTemplate(
  baseTemplate: ChecklistTemplate,
  inspection: Inspection,
  responses: InspectionResponse[]
): ChecklistTemplate {
  if (inspection.status === 'completed') {
    return inspection.reportTemplateSnapshot || buildLegacyCompletedReportTemplate(baseTemplate, inspection, responses);
  }

  return getEffectiveTemplate(baseTemplate, inspection as any, undefined, true);
}
