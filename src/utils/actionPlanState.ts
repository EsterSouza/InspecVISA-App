import type { ChecklistTemplate, Inspection, InspectionResponse } from '../types';

export interface OpenPendingItem {
  response: InspectionResponse;
  inspection: Inspection;
  count: number;
}

export function filterMissingPendingItems<T extends { itemId: string }>(
  pendingItems: Iterable<T>,
  existingItemIds: Set<string>,
): T[] {
  return [...pendingItems].filter(item => !existingItemIds.has(item.itemId));
}

export function filterPendingItemsForTemplate<
  T extends { itemId: string; customItemMeta?: { sectionId: string } },
>(
  pendingItems: Iterable<T>,
  template: Pick<ChecklistTemplate, 'sections'>,
): T[] {
  const sectionIds = new Set(template.sections.map(section => section.id));
  const itemIds = new Set(template.sections.flatMap(section => section.items.map(item => item.id)));
  return [...pendingItems].filter(item =>
    itemIds.has(item.itemId)
    || Boolean(item.customItemMeta && sectionIds.has(item.customItemMeta.sectionId))
  );
}

function time(value?: Date) {
  return value ? new Date(value).getTime() : 0;
}

function latestResponses(responses: InspectionResponse[]) {
  const byItem = new Map<string, InspectionResponse>();
  for (const response of responses) {
    const current = byItem.get(response.itemId);
    if (!current || time(response.updatedAt) >= time(current.updatedAt)) byItem.set(response.itemId, response);
  }
  return byItem.values();
}

function lastText(next: string | undefined, current: string | undefined) {
  return next?.trim() ? next : current;
}

export function deriveOpenPendingItems(
  inspections: Inspection[],
  responses: InspectionResponse[],
): Map<string, OpenPendingItem> {
  const open = new Map<string, OpenPendingItem>();
  const responsesByInspection = new Map<string, InspectionResponse[]>();
  for (const response of responses) {
    const list = responsesByInspection.get(response.inspectionId) || [];
    list.push(response);
    responsesByInspection.set(response.inspectionId, list);
  }

  const completed = inspections
    .filter(inspection => inspection.status === 'completed' && !inspection.deletedAt)
    .sort((a, b) =>
      time(a.inspectionDate) - time(b.inspectionDate)
      || time(a.completedAt) - time(b.completedAt)
      || time(a.updatedAt) - time(b.updatedAt)
    );

  for (const inspection of completed) {
    for (const response of latestResponses(responsesByInspection.get(inspection.id) || [])) {
      if (response.customItemMeta?.state === 'discontinued') {
        open.delete(response.itemId);
        continue;
      }
      if (response.deletedAt) continue;
      if (response.result === 'complies') {
        open.delete(response.itemId);
        continue;
      }
      if (response.result !== 'not_complies') continue;

      const current = open.get(response.itemId);
      open.set(response.itemId, {
        inspection,
        count: (current?.count || 0) + 1,
        response: {
          ...response,
          customDescription: lastText(response.customDescription, current?.response.customDescription),
          situationDescription: lastText(response.situationDescription, current?.response.situationDescription),
          correctiveAction: lastText(response.correctiveAction, current?.response.correctiveAction),
          responsible: lastText(response.responsible, current?.response.responsible),
          deadline: lastText(response.deadline, current?.response.deadline),
          customItemMeta: response.customItemMeta || current?.response.customItemMeta,
        },
      });
    }
  }
  return open;
}
