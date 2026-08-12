import { describe, expect, test } from 'vitest';
import { getTemplateById, getTotalItems } from '../../data/templates';
import { buildLegacyCompletedReportTemplate, resolveReportTemplate } from '../../utils/reportTemplate';
import type { ChecklistTemplate, Inspection, InspectionResponse } from '../../types';

function inspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'inspection-rj',
    clientId: 'client-rj',
    templateId: 'tpl-ilpi-federal-v1',
    consultantName: 'Consultora',
    inspectionDate: new Date('2026-05-25T10:00:00.000Z'),
    status: 'completed',
    state: 'RJ',
    createdAt: new Date('2026-05-25T10:00:00.000Z'),
    updatedAt: new Date('2026-05-25T10:37:00.000Z'),
    syncStatus: 'synced',
    ...overrides,
  };
}

function response(itemId: string): InspectionResponse {
  return {
    id: `response-${itemId}`,
    inspectionId: 'inspection-rj',
    itemId,
    result: 'complies',
    createdAt: new Date('2026-05-25T10:00:00.000Z'),
    updatedAt: new Date('2026-05-25T10:37:00.000Z'),
    syncStatus: 'synced',
  };
}

describe('completed report template stability', () => {
  test('keeps only regional items that were recorded in legacy completed reports', () => {
    const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
    const stable = buildLegacyCompletedReportTemplate(base, inspection(), [
      response('rj-s12-001'),
      response('rj-s12-002'),
    ]);

    expect(getTotalItems(stable)).toBe(getTotalItems(base) + 2);
    expect(stable.sections.flatMap(section => section.items.map(item => item.id))).not.toContain('rj-s12-003');
    expect(stable.name).toContain('Suplemento RJ');
  });

  test('does not turn responses outside the canonical template into a synthetic section', () => {
    const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
    const stable = buildLegacyCompletedReportTemplate(base, inspection(), [
      response('item-from-another-template'),
    ]);

    expect(stable.sections.map(section => section.id)).not.toContain('sec-report-recovered');
    expect(stable.sections.flatMap(section => section.items.map(item => item.id)))
      .not.toContain('item-from-another-template');
  });

  test('prefers the exact frozen template captured at completion', () => {
    const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
    const frozen = {
      ...base,
      name: 'Roteiro fechado',
      sections: base.sections.slice(0, 1),
    };

    expect(resolveReportTemplate(base, inspection({ reportTemplateSnapshot: frozen }), [])).toBe(frozen);
  });

  test('removes a synthetic recovery section from an old frozen snapshot at read time', () => {
    const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
    const frozen = {
      ...base,
      sections: [
        ...base.sections,
        {
          id: 'sec-report-recovered',
          title: 'Itens preservados do roteiro concluido',
          order: 99,
          items: [{
            id: 'orphan-item',
            sectionId: 'sec-report-recovered',
            order: 1,
            description: 'Item orphan-item',
            weight: 1,
            isCritical: false,
          }],
        },
      ],
    };

    const resolved = resolveReportTemplate(
      base,
      inspection({ reportTemplateSnapshot: frozen }),
      [response('orphan-item')],
    );

    expect(resolved.sections.map(section => section.id)).not.toContain('sec-report-recovered');
    expect(resolved.sections.flatMap(section => section.items.map(item => item.id)))
      .not.toContain('orphan-item');
    expect(frozen.sections.map(section => section.id)).toContain('sec-report-recovered');
  });
});
