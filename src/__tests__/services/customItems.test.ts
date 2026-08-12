import { describe, expect, test } from 'vitest';
import type { ChecklistTemplate, InspectionResponse } from '../../types';
import {
  composeChecklistTemplate,
  customItemMeta,
  nextCustomItemOrder,
  normalizeCustomItems,
} from '../../utils/customItems';

const template: ChecklistTemplate = {
  id: 'template-1',
  name: 'Roteiro',
  category: 'other',
  version: 1,
  isActive: true,
  sections: [{
    id: 's1',
    title: 'Seção',
    order: 1,
    items: [{ id: 'original', sectionId: 's1', order: 1, description: 'Original', weight: 9, isCritical: false }],
  }],
};

function response(itemId: string, overrides: Partial<InspectionResponse> = {}): InspectionResponse {
  return {
    id: `response-${itemId}`,
    inspectionId: 'inspection-1',
    itemId,
    result: 'not_complies',
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    syncStatus: 'synced',
    ...overrides,
  };
}

describe('persistent custom checklist items', () => {
  test('keeps the stable position when editing and forces critical items to weight ten', () => {
    expect(customItemMeta('s1', 7, true, 2)).toEqual({
      sectionId: 's1', order: 7, weight: 10, isCritical: true, state: 'active',
    });
    expect(customItemMeta('s1', 7, false, 5)).toEqual({
      sectionId: 's1', order: 7, weight: 5, isCritical: false, state: 'active',
    });
  });

  test('normalizes only legacy extras with stable sequential order and default weight one', () => {
    const normalized = normalizeCustomItems([
      response('extra|s1|old-1'),
      response('extra|s1|old-2', { createdAt: new Date('2026-08-02T12:00:00.000Z') }),
    ], template.sections);

    expect(normalized.map(item => item.customItemMeta)).toEqual([
      { sectionId: 's1', order: 2, weight: 1, isCritical: false, state: 'active' },
      { sectionId: 's1', order: 3, weight: 1, isCritical: false, state: 'active' },
    ]);
    expect(nextCustomItemOrder('s1', template, normalized)).toBe(4);
  });

  test('composes active custom items once and does not reintroduce items outside the effective template', () => {
    const custom = response('extra|s1|new', {
      customDescription: 'Extra persistente',
      customItemMeta: { sectionId: 's1', order: 2, weight: 5, isCritical: false, state: 'active' },
    });
    const composed = composeChecklistTemplate(template, [
      custom,
      response('nutrition-item', { customDescription: 'Item de outro recorte profissional' }),
      response('untitled-item', { result: 'complies' }),
    ]);

    expect(composed.sections[0].items.map(item => item.id)).toEqual(['original', 'extra|s1|new']);
    expect(composed.sections.map(section => section.title)).not.toContain('Pendências de inspeções anteriores');
  });

  test('keeps a previous pending response in its normal section when the item belongs to the effective template', () => {
    const composed = composeChecklistTemplate(template, [
      response('original', { customDescription: 'Texto copiado da inspeção anterior' }),
    ]);

    expect(composed.sections).toHaveLength(1);
    expect(composed.sections[0].items).toEqual(template.sections[0].items);
  });

  test('does not render soft-deleted or discontinued extras', () => {
    const discontinued = response('extra|s1|gone', {
      customItemMeta: { sectionId: 's1', order: 2, weight: 10, isCritical: true, state: 'discontinued' },
      deletedAt: new Date('2026-08-02T12:00:00.000Z'),
    });
    expect(composeChecklistTemplate(template, [discontinued]).sections[0].items).toHaveLength(1);
  });
});
