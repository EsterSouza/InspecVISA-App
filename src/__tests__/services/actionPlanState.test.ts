import { describe, expect, test } from 'vitest';
import type { Inspection, InspectionResponse } from '../../types';
import { deriveOpenPendingItems, filterMissingPendingItems } from '../../utils/actionPlanState';

function inspection(id: string, day: number): Inspection {
  const at = new Date(`2026-08-${String(day).padStart(2, '0')}T12:00:00.000Z`);
  return {
    id,
    clientId: 'client-1',
    templateId: 'template-1',
    consultantName: 'Consultora',
    inspectionDate: at,
    status: 'completed',
    createdAt: at,
    updatedAt: at,
    completedAt: at,
    syncStatus: 'synced',
  };
}

function response(inspectionId: string, itemId: string, result: InspectionResponse['result'], day: number, overrides: Partial<InspectionResponse> = {}): InspectionResponse {
  const at = new Date(`2026-08-${String(day).padStart(2, '0')}T12:00:00.000Z`);
  return {
    id: `${inspectionId}-${itemId}`,
    inspectionId,
    itemId,
    result,
    createdAt: at,
    updatedAt: at,
    syncStatus: 'synced',
    ...overrides,
  };
}

describe('deriveOpenPendingItems', () => {
  test('a partially filled inspection receives only missing pending items', () => {
    const existing = response('current', 'already-filled', 'complies', 3, {
      situationDescription: 'não sobrescrever',
      photos: [{
        id: 'photo-1', responseId: 'current-already-filled', dataUrl: 'data:image/jpeg;base64,abc',
        takenAt: new Date('2026-08-03T12:00:00.000Z'), updatedAt: new Date('2026-08-03T12:00:00.000Z'), syncStatus: 'pending',
      }],
    });
    const missing = filterMissingPendingItems([
      { itemId: 'already-filled', description: 'histórico antigo' },
      { itemId: 'missing', description: 'inserir' },
    ], new Set([existing.itemId]));

    expect(missing).toEqual([{ itemId: 'missing', description: 'inserir' }]);
    expect(existing.situationDescription).toBe('não sobrescrever');
    expect(existing.photos).toHaveLength(1);
  });

  test('opens on NC and closes only on a later complies result', () => {
    const inspections = [inspection('i1', 1), inspection('i2', 2)];
    expect(deriveOpenPendingItems(inspections, [response('i1', 'a', 'not_complies', 1)]).has('a')).toBe(true);
    expect(deriveOpenPendingItems(inspections, [
      response('i1', 'a', 'not_complies', 1),
      response('i2', 'a', 'complies', 2),
    ]).has('a')).toBe(false);
  });

  test.each(['not_applicable', 'not_observed', 'not_evaluated'] as const)(
    '%s and a missing answer do not close an open pending item',
    result => {
      const pending = deriveOpenPendingItems(
        [inspection('i1', 1), inspection('i2', 2), inspection('i3', 3)],
        [response('i1', 'a', 'not_complies', 1), response('i2', 'a', result, 2)],
      );
      expect(pending.get('a')?.count).toBe(1);
    },
  );

  test('repeated NC updates occurrence and keeps the last non-empty technical data', () => {
    const pending = deriveOpenPendingItems(
      [inspection('i1', 1), inspection('i2', 2)],
      [
        response('i1', 'a', 'not_complies', 1, {
          situationDescription: 'situação original',
          correctiveAction: 'ação original',
          responsible: 'Maria',
        }),
        response('i2', 'a', 'not_complies', 2, {
          situationDescription: 'situação atualizada',
          correctiveAction: ' ',
        }),
      ],
    ).get('a');

    expect(pending?.count).toBe(2);
    expect(pending?.response.situationDescription).toBe('situação atualizada');
    expect(pending?.response.correctiveAction).toBe('ação original');
    expect(pending?.response.responsible).toBe('Maria');
  });

  test('discontinued custom item closes its historical pending state', () => {
    const meta = { sectionId: 's1', order: 3, weight: 5 as const, isCritical: false, state: 'active' as const };
    const pending = deriveOpenPendingItems(
      [inspection('i1', 1), inspection('i2', 2)],
      [
        response('i1', 'extra|s1|a', 'not_complies', 1, { customItemMeta: meta }),
        response('i2', 'extra|s1|a', 'not_observed', 2, {
          customItemMeta: { ...meta, state: 'discontinued' },
          deletedAt: new Date('2026-08-02T12:00:00.000Z'),
        }),
      ],
    );
    expect(pending.has('extra|s1|a')).toBe(false);
  });
});
