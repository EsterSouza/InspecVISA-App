import { describe, expect, test } from 'vitest';
import { calculateScore, getLatestResponsesByItem } from '../../utils/scoring';
import type { InspectionResponse, Section } from '../../types';

const sections: Section[] = [
  {
    id: 's1',
    title: 'Secao 1',
    order: 1,
    items: [
      { id: 'item-1', sectionId: 's1', order: 1, description: 'Item 1', weight: 1, isCritical: false },
      { id: 'item-2', sectionId: 's1', order: 2, description: 'Item 2', weight: 1, isCritical: false },
    ],
  },
];

function response(overrides: Partial<InspectionResponse>): InspectionResponse {
  return {
    id: overrides.id || crypto.randomUUID(),
    inspectionId: 'inspection-1',
    itemId: 'item-1',
    result: 'complies',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    syncStatus: 'synced',
    ...overrides,
  };
}

describe('calculateScore', () => {
  test('deduplicates repeated responses by item before counting evaluated items', () => {
    const score = calculateScore([
      response({ id: 'older', itemId: 'item-1', result: 'not_complies', updatedAt: new Date('2026-01-01T00:00:00.000Z') }),
      response({ id: 'latest', itemId: 'item-1', result: 'complies', updatedAt: new Date('2026-01-02T00:00:00.000Z') }),
      response({ id: 'other', itemId: 'item-2', result: 'not_applicable' }),
    ], sections);

    expect(score.totalItems).toBe(2);
    expect(score.evaluatedItems).toBe(2);
    expect(score.compliesCount).toBe(1);
    expect(score.notCompliesCount).toBe(0);
    expect(score.notEvaluatedCount).toBe(0);
  });

  test('ignores deleted and out-of-template responses in report response lists', () => {
    const latest = response({ id: 'latest', itemId: 'item-1', result: 'complies', updatedAt: new Date('2026-01-02T00:00:00.000Z') });
    const result = getLatestResponsesByItem([
      response({ id: 'deleted', itemId: 'item-1', result: 'not_complies', deletedAt: new Date('2026-01-03T00:00:00.000Z') }),
      latest,
      response({ id: 'ghost', itemId: 'not-in-template', result: 'not_complies' }),
    ], new Set(['item-1']));

    expect(result).toEqual([latest]);
  });

  test('keeps original items at one point and applies weight only to custom items', () => {
    const weightedSections: Section[] = [{
      ...sections[0],
      items: [
        { ...sections[0].items[0], weight: 10 },
        { id: 'extra|s1|1', sectionId: 's1', order: 2, description: 'Extra', weight: 5, isCritical: false },
      ],
    }];
    const score = calculateScore([
      response({ itemId: 'item-1', result: 'complies' }),
      response({
        itemId: 'extra|s1|1',
        result: 'not_complies',
        customItemMeta: { sectionId: 's1', order: 2, weight: 5, isCritical: false, state: 'active' },
      }),
    ], weightedSections);

    expect(score.scorePercentage).toBeCloseTo(100 / 6);
  });

  test('excludes not applicable and not observed from the weighted denominator', () => {
    const score = calculateScore([
      response({ itemId: 'item-1', result: 'complies' }),
      response({ itemId: 'item-2', result: 'not_applicable' }),
    ], sections);
    expect(score.scorePercentage).toBe(100);
  });
});
