import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import type { ChecklistTemplate, ConsultantSettings, Inspection, InspectionResponse } from '../../types';
import { composeChecklistTemplate } from '../../utils/customItems';
import { calculateScore } from '../../utils/scoring';
import { generatePDF } from '../../utils/pdfGenerator';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const at = new Date('2026-08-12T12:00:00.000Z');
const baseTemplate: ChecklistTemplate = {
  id: 'template-card', name: 'Roteiro do card', category: 'estetica', version: '1',
  sections: [{
    id: 's1', title: 'Documentação', order: 1,
    items: [{ id: 'original', sectionId: 's1', order: 1, description: 'Item original', weight: 10, isCritical: false }],
  }],
};
const inspection: Inspection = {
  id: 'inspection-card', clientId: 'client-card', templateId: baseTemplate.id,
  consultantName: 'Consultora', clientName: 'Cliente sintético', clientCategory: 'estetica',
  inspectionDate: at, status: 'in_progress', createdAt: at, updatedAt: at, syncStatus: 'synced',
};
const responses: InspectionResponse[] = [
  {
    id: 'response-original', inspectionId: inspection.id, itemId: 'original', result: 'complies',
    createdAt: at, updatedAt: at, syncStatus: 'synced',
  },
  {
    id: 'response-extra', inspectionId: inspection.id, itemId: 'extra|s1|persistente', result: 'not_complies',
    customDescription: 'Item extra crítico persistente', situationDescription: 'Situação do item extra',
    correctiveAction: 'Corrigir e apresentar evidência',
    customItemMeta: { sectionId: 's1', order: 2, weight: 10, isCritical: true, state: 'active' },
    createdAt: at, updatedAt: at, syncStatus: 'synced',
  },
  {
    id: 'response-old', inspectionId: inspection.id, itemId: 'item-de-roteiro-anterior', result: 'not_complies',
    customDescription: 'Pendência de inspeção anterior', situationDescription: 'Ainda pendente',
    correctiveAction: 'Regularizar', createdAt: at, updatedAt: at, syncStatus: 'synced',
  },
];

describe('PDF do plano automático e itens extras', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:automatic-action-plan');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test('gera um PDF real a partir da estrutura composta e permite renderização externa', async () => {
    const template = composeChecklistTemplate(baseTemplate, responses);
    const score = calculateScore(responses, template.sections);
    const settings: ConsultantSettings = { name: 'Consultora', theme: 'light' };
    const generated = await generatePDF(inspection, responses, template, score, settings, []);
    const bytes = new Uint8Array(await generated.blob.arrayBuffer());
    const pdf = await getDocument({ data: bytes, disableWorker: true }).promise;
    const renderedText: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      renderedText.push(content.items.map(item => 'str' in item ? item.str : '').join(' '));
    }

    expect(generated.blob.type).toBe('application/pdf');
    expect(generated.blob.size).toBeGreaterThan(1000);
    expect(pdf.numPages).toBeGreaterThan(1);
    expect(renderedText.join(' ')).toContain('Item extra crítico persistente');
    expect(renderedText.join(' ')).not.toContain('Pendência de inspeção anterior');
    expect(template.sections.flatMap(section => section.items.map(item => item.id))).toEqual([
      'original', 'extra|s1|persistente',
    ]);

    if (process.env.CARD_PDF_OUTPUT) {
      await writeFile(process.env.CARD_PDF_OUTPUT, Buffer.from(bytes));
    }
  });
});
