import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import type { ChecklistTemplate, ConsultantSettings, Inspection, InspectionResponse } from '../../types';
import { calculateScore } from '../../utils/scoring';
import { generatePDF } from '../../utils/pdfGenerator';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const at = new Date('2026-08-12T12:00:00.000Z');

const PARAGRAFO_LONGO =
  'O estabelecimento mantém o piso da área de manipulação em estado de conservação insuficiente, ' +
  'com trincas longitudinais que impedem a higienização adequada e favorecem o acúmulo de sujidade ' +
  'nas juntas, situação agravada pela drenagem deficiente observada no dia da visita técnica.';

const template: ChecklistTemplate = {
  id: 'template-checkpoints',
  name: 'Roteiro de tópicos',
  category: 'estetica',
  version: '1',
  sections: [{
    id: 's1',
    title: 'Estrutura',
    order: 1,
    items: [
      { id: 'com-topicos', sectionId: 's1', order: 1, description: 'Lavatório exclusivo para higienização das mãos', weight: 10, isCritical: true },
      { id: 'sem-topicos', sectionId: 's1', order: 2, description: 'Piso da área de manipulação íntegro e lavável', weight: 10, isCritical: true },
    ],
  }],
};

const inspection: Inspection = {
  id: 'inspection-checkpoints', clientId: 'client-checkpoints', templateId: template.id,
  consultantName: 'Consultora', clientName: 'Cliente sintético', clientCategory: 'estetica',
  inspectionDate: at, status: 'in_progress', createdAt: at, updatedAt: at, syncStatus: 'synced',
};

const responses: InspectionResponse[] = [
  {
    id: 'r-topicos', inspectionId: inspection.id, itemId: 'com-topicos', result: 'not_complies',
    situationDescription: 'Foi observado o seguinte na antessala:\n- Lavatório sem sabonete líquido\n- Lixeira sem acionamento por pedal',
    correctiveAction: '- Providenciar dispenser de sabonete líquido\n- Substituir a lixeira por uma com pedal\n- Implementar POP de higienização das mãos',
    deadline: '30 dias', responsible: 'Responsável Técnico (RT)',
    createdAt: at, updatedAt: at, syncStatus: 'synced',
  },
  {
    id: 'r-corrido', inspectionId: inspection.id, itemId: 'sem-topicos', result: 'not_complies',
    situationDescription: PARAGRAFO_LONGO,
    correctiveAction: 'Recuperar o revestimento do piso com material liso, impermeável e lavável, garantindo caimento para os ralos.',
    deadline: '60 dias', responsible: 'Equipe de Manutenção',
    createdAt: at, updatedAt: at, syncStatus: 'synced',
  },
];

/** Todos os fragmentos de texto do PDF, com a coordenada x em que foram desenhados. */
async function renderTextWithPositions(bytes: Uint8Array) {
  // Cópia: o pdf.js toma posse do buffer que recebe e o deixa destacado, então
  // quem tentasse gravar o PDF depois de ler gravava um arquivo de zero byte.
  const pdf = await getDocument({ data: bytes.slice(), disableWorker: true }).promise;
  const runs: { str: string; x: number; page: number }[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        runs.push({ str: item.str, x: item.transform[4], page: pageNumber });
      }
    }
  }
  return runs;
}

describe('tópicos do plano de ação viram retângulos no relatório', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:checkpoints');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test('cada tópico sai numa caixa própria, recuado, e o parágrafo corrido não vira caixa', async () => {
    const settings: ConsultantSettings = { name: 'Consultora', theme: 'light' };
    const score = calculateScore(responses, template.sections);
    const generated = await generatePDF(inspection, responses, template, score, settings, []);
    const bytes = new Uint8Array(await generated.blob.arrayBuffer());
    const runs = await renderTextWithPositions(bytes);
    const rendered = runs.map(run => run.str).join(' ');

    // Os três tópicos da ação chegaram inteiros ao papel...
    expect(rendered).toContain('Providenciar dispenser de sabonete líquido');
    expect(rendered).toContain('Substituir a lixeira por uma com pedal');
    expect(rendered).toContain('Implementar POP de higienização das mãos');
    // ...sem carregar o traço junto: o marcador virou a caixa, não texto.
    expect(rendered).not.toContain('- Providenciar');
    expect(rendered).not.toContain('- Substituir');

    // O texto que apresenta a lista continua sendo texto, não tarefa.
    expect(rendered).toContain('Foi observado o seguinte na antessala:');

    // Parágrafo sem marcador nenhum sai inteiro e sem virar caixa.
    expect(rendered).toContain('O estabelecimento mantém o piso da área de manipulação');

    const contexto = runs.find(run => run.str.startsWith('Foi observado o seguinte'));
    const tarefa = runs.find(run => run.str.startsWith('Providenciar dispenser'));
    const pontoDaSituacao = runs.find(run => run.str.startsWith('Lavatório sem sabonete'));
    const paragrafo = runs.find(run => run.str.startsWith('O estabelecimento mantém'));
    expect(contexto).toBeDefined();
    expect(tarefa).toBeDefined();
    expect(pontoDaSituacao).toBeDefined();
    expect(paragrafo).toBeDefined();

    // A tarefa é recuada duas vezes: a borda da caixa e a sangria do quadradinho.
    expect(tarefa!.x).toBeGreaterThan(contexto!.x + 5);
    // O ponto da situação entra na caixa, mas sem quadradinho — recuo menor.
    expect(pontoDaSituacao!.x).toBeGreaterThan(contexto!.x);
    expect(pontoDaSituacao!.x).toBeLessThan(tarefa!.x);
    // Parágrafo corrido nasce na margem do card, igual a antes desta mudança.
    expect(paragrafo!.x).toBeCloseTo(contexto!.x, 1);

    // Nada pode ter sido empurrado para fora da folha A4 (210mm).
    const pageWidthPt = 595;
    for (const run of runs) expect(run.x).toBeLessThan(pageWidthPt);

    if (process.env.CHECKPOINT_PDF_OUTPUT) {
      await writeFile(process.env.CHECKPOINT_PDF_OUTPUT, Buffer.from(bytes));
    }
  });
});
