import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { generatePDF } from '../../utils/pdfGenerator';
import { calculateScore } from '../../utils/scoring';
import type { ChecklistTemplate, ConsultantSettings, Inspection, InspectionResponse, ReferenceSource, Section } from '../../types';

// jsPDF anexa `text` como propriedade própria da instância (via mixin da API),
// não no prototype — spyOn(jsPDF.prototype, 'text') não intercepta nada. Em vez
// disso, o módulo 'jspdf' é substituído por uma subclasse que captura cada
// string desenhada, preservando o comportamento real (a subclasse chama super()
// e delega para o `text` original).
const capturedTexts: string[] = [];

vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  class SpyingJsPDF extends actual.default {
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args);
      const originalText = this.text.bind(this);
      this.text = ((...textArgs: Parameters<typeof originalText>) => {
        const value = textArgs[0];
        if (Array.isArray(value)) {
          value.forEach(v => { if (typeof v === 'string') capturedTexts.push(v); });
        } else if (typeof value === 'string') {
          capturedTexts.push(value);
        }
        return originalText(...textArgs);
      }) as typeof originalText;
    }
  }
  return { ...actual, default: SpyingJsPDF };
});

const sections: Section[] = [
  {
    id: 's1',
    title: 'Documentação',
    order: 1,
    items: [
      { id: 'item-1', sectionId: 's1', order: 1, description: 'Possui licença sanitária vigente?', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
    ],
  },
];

const template: ChecklistTemplate = {
  id: 'tpl-1',
  name: 'Roteiro de Teste',
  category: 'estetica',
  version: '1',
  sections,
};

const responses: InspectionResponse[] = [
  {
    id: 'resp-1',
    inspectionId: 'insp-1',
    itemId: 'item-1',
    result: 'complies',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    syncStatus: 'synced',
  },
];

const inspection: Inspection = {
  id: 'insp-1',
  clientId: 'client-1',
  templateId: 'tpl-1',
  consultantName: 'Ester Caiafa',
  clientName: 'Cliente Teste',
  clientCategory: 'estetica',
  inspectionDate: new Date('2026-08-01T00:00:00.000Z'),
  status: 'in_progress',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  syncStatus: 'synced',
};

const settings: ConsultantSettings = {
  name: 'Ester Caiafa',
  theme: 'light',
};

describe('REF-03 - drawConsultedSources (via generatePDF)', () => {
  beforeEach(() => {
    capturedTexts.length = 0;
    // savePdfWithFallback usa APIs de navegador que o jsdom não implementa
    // (ou implementa com um aviso de "navigation not implemented" no clique do link).
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('não gera a seção "FONTES CONSULTADAS" quando não há fontes', async () => {
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
    });

    expect(capturedTexts).not.toContain('FONTES CONSULTADAS');
  });

  test('gera a seção "FONTES CONSULTADAS" com título, URL e nota quando há fontes', async () => {
    const referenceSources: ReferenceSource[] = [
      { id: 'src-1', url: 'https://www.gov.br/anvisa/nota-tecnica', title: 'Nota técnica ANVISA', note: 'consultado em 05/08/2026' },
    ];
    const score = calculateScore(responses, sections);
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
      referenceSources,
    });

    expect(capturedTexts).toContain('FONTES CONSULTADAS');
    expect(capturedTexts).toContain('Nota técnica ANVISA');
    expect(capturedTexts.some(t => t.includes('Disponível em: <https://www.gov.br/anvisa/nota-tecnica>'))).toBe(true);
    expect(capturedTexts).toContain('consultado em 05/08/2026');
  });

  test('norma citada sem verbete na biblioteca ainda aparece em REFERÊNCIAS LEGISLATIVAS', async () => {
    const score = calculateScore(responses, sections);
    // biblioteca de legislações vazia — RDC 63/2011 não tem `summary` nem `url` cadastrados.
    await generatePDF(inspection, responses, template, score, settings, [], {
      selectedLegislations: ['RDC 63/2011'],
    });

    expect(capturedTexts).toContain('REFERÊNCIAS LEGISLATIVAS');
    expect(capturedTexts.some(t => t.includes('RDC n. 63'))).toBe(true);
  });
});
