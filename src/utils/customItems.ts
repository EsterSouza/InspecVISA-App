import type {
  ChecklistItem,
  ChecklistTemplate,
  CustomItemMeta,
  InspectionResponse,
  Section,
} from '../types';

export const CUSTOM_ITEM_WEIGHTS = [1, 2, 5, 10] as const;
export const PREVIOUS_PENDING_SECTION_ID = 'sec-previous-pendencies';

export function isCustomItem(response: Pick<InspectionResponse, 'itemId'>) {
  return response.itemId.startsWith('extra|');
}

function legacySectionId(itemId: string) {
  return itemId.split('|')[1] || PREVIOUS_PENDING_SECTION_ID;
}

export function normalizeCustomItems(
  responses: InspectionResponse[],
  sections: Section[],
): InspectionResponse[] {
  const maxOrder = new Map<string, number>();
  for (const section of sections) {
    maxOrder.set(section.id, Math.max(0, ...section.items.map(item => item.order || 0)));
  }
  for (const response of responses) {
    const meta = response.customItemMeta;
    if (!meta) continue;
    maxOrder.set(meta.sectionId, Math.max(maxOrder.get(meta.sectionId) || 0, meta.order));
  }

  return [...responses]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(response => {
      if (!isCustomItem(response) || response.customItemMeta) return response;
      const sectionId = legacySectionId(response.itemId);
      const order = (maxOrder.get(sectionId) || 0) + 1;
      maxOrder.set(sectionId, order);
      return {
        ...response,
        customItemMeta: {
          sectionId,
          order,
          weight: 1,
          isCritical: false,
          state: response.deletedAt ? 'discontinued' : 'active',
        },
      };
    });
}

export function nextCustomItemOrder(
  sectionId: string,
  template: ChecklistTemplate,
  responses: InspectionResponse[],
) {
  const original = template.sections.find(section => section.id === sectionId)?.items || [];
  const used = [
    ...original.map(item => item.order || 0),
    ...responses
      .filter(response => response.customItemMeta?.sectionId === sectionId)
      .map(response => response.customItemMeta!.order),
  ];
  return Math.max(0, ...used) + 1;
}

function itemFromResponse(response: InspectionResponse): ChecklistItem {
  const meta = response.customItemMeta!;
  return {
    id: response.itemId,
    sectionId: meta.sectionId,
    order: meta.order,
    description: response.customDescription || response.situationDescription || 'Item extra',
    weight: meta.weight,
    isCritical: meta.isCritical,
  };
}

export function composeChecklistTemplate(
  template: ChecklistTemplate,
  sourceResponses: InspectionResponse[],
): ChecklistTemplate {
  const responses = normalizeCustomItems(sourceResponses, template.sections);
  const sections = template.sections.map(section => ({ ...section, items: [...section.items] }));
  const represented = new Set(sections.flatMap(section => section.items.map(item => item.id)));
  const recovered: ChecklistItem[] = [];

  for (const response of responses) {
    if (response.deletedAt || represented.has(response.itemId)) continue;
    if (isCustomItem(response) && response.customItemMeta?.state === 'active') {
      const item = itemFromResponse(response);
      const section = sections.find(candidate => candidate.id === item.sectionId);
      if (section) section.items.push(item);
      else recovered.push({ ...item, sectionId: PREVIOUS_PENDING_SECTION_ID });
      represented.add(item.id);
      continue;
    }

    if (!isCustomItem(response)) {
      recovered.push({
        id: response.itemId,
        sectionId: PREVIOUS_PENDING_SECTION_ID,
        order: recovered.length + 1,
        description: response.customDescription || response.situationDescription || `Item ${response.itemId}`,
        weight: 1,
        isCritical: false,
      });
      represented.add(response.itemId);
    }
  }

  for (const section of sections) {
    section.items.sort((a, b) => a.order - b.order);
  }
  if (recovered.length > 0) {
    sections.push({
      id: PREVIOUS_PENDING_SECTION_ID,
      title: 'Pendências de inspeções anteriores',
      order: Math.max(0, ...sections.map(section => section.order)) + 1,
      items: recovered,
    });
  }

  return { ...template, sections };
}

export function customItemMeta(
  sectionId: string,
  order: number,
  isCritical: boolean,
  weight: CustomItemMeta['weight'],
): CustomItemMeta {
  return {
    sectionId,
    order,
    isCritical,
    weight: isCritical ? 10 : weight,
    state: 'active',
  };
}
