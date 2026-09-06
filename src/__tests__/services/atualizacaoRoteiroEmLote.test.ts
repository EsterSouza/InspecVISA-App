import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ChecklistTemplate, Inspection, InspectionResponse } from '../../types';

// Dexie mockado por tabela: `where(...).equals(...).toArray()` é o único caminho
// de leitura que o serviço usa, e `update` é a única escrita.
const tabelas = {
  inspections: [] as Inspection[],
  responses: [] as InspectionResponse[],
  templates: [] as ChecklistTemplate[],
};
const gravacoes: Array<{ id: string; patch: Partial<Inspection> }> = [];

vi.mock('../../db/database', () => ({
  db: {
    inspections: {
      where: (campo: string) => ({
        equals: (valor: unknown) => ({
          toArray: async () => tabelas.inspections.filter(i => (i as unknown as Record<string, unknown>)[campo] === valor),
        }),
      }),
      update: async (id: string, patch: Partial<Inspection>) => {
        gravacoes.push({ id, patch });
        return 1;
      },
    },
    responses: {
      where: (campo: string) => ({
        equals: (valor: unknown) => ({
          toArray: async () => tabelas.responses.filter(r => (r as unknown as Record<string, unknown>)[campo] === valor),
        }),
      }),
    },
    templates: {
      get: async (id: string) => tabelas.templates.find(t => t.id === id),
    },
  },
}));

const { atualizarRoteiros, levantarInspecoesDesatualizadas } = await import('../../services/atualizacaoRoteiroEmLote');

const ROTEIRO_VIVO = {
  id: 'tpl-x',
  name: 'Roteiro',
  category: 'estetica',
  sections: [
    {
      id: 'sec-1',
      title: 'Documentação',
      order: 1,
      items: [
        { id: 'a', sectionId: 'sec-1', order: 1, description: 'Pergunta a?', weight: 10, isCritical: false, requiredAction: '- Providenciar.' },
        { id: 'b', sectionId: 'sec-1', order: 2, description: 'Pergunta b?', weight: 10, isCritical: false },
      ],
    },
  ],
} as unknown as ChecklistTemplate;

function congelado(): ChecklistTemplate {
  return {
    ...ROTEIRO_VIVO,
    sections: [
      {
        ...ROTEIRO_VIVO.sections[0],
        items: [{ id: 'a', sectionId: 'sec-1', order: 1, description: 'Pergunta a?', weight: 10, isCritical: false }],
      },
    ],
  } as unknown as ChecklistTemplate;
}

function inspecao(extra: Partial<Inspection> = {}): Inspection {
  return {
    id: 'insp-1',
    clientId: 'cli-1',
    clientName: 'Cliente Um',
    templateId: 'tpl-x',
    status: 'in_progress',
    createdAt: new Date('2026-09-04T12:00:00Z'),
    reportTemplateSnapshot: congelado(),
    ...extra,
  } as unknown as Inspection;
}

beforeEach(() => {
  tabelas.inspections = [];
  tabelas.responses = [];
  tabelas.templates = [ROTEIRO_VIVO];
  gravacoes.length = 0;
});

describe('atualização de roteiro em lote', () => {
  test('lista as vistorias em andamento que ficaram para trás', async () => {
    tabelas.inspections = [inspecao()];

    const alvos = await levantarInspecoesDesatualizadas();
    expect(alvos).toHaveLength(1);
    expect(alvos[0].cliente).toBe('Cliente Um');
    expect({ novos: alvos[0].itensNovos, textos: alvos[0].textosNovos }).toEqual({ novos: 1, textos: 1 });
  });

  test('inspeção sem revisão congelada fica de fora — ela já nasce em dia', async () => {
    tabelas.inspections = [inspecao({ reportTemplateSnapshot: undefined })];
    expect(await levantarInspecoesDesatualizadas()).toEqual([]);
  });

  test('inspeção na lixeira fica de fora', async () => {
    tabelas.inspections = [inspecao({ deletedAt: new Date() } as Partial<Inspection>)];
    expect(await levantarInspecoesDesatualizadas()).toEqual([]);
  });

  test('roteiro que sumiu do aparelho não trava o levantamento', async () => {
    tabelas.templates = [];
    tabelas.inspections = [inspecao({ templateId: 'tpl-que-nao-existe' })];
    expect(await levantarInspecoesDesatualizadas()).toEqual([]);
  });

  test('gravar não mexe em syncStatus nem em updatedAt: a revisão é local', async () => {
    tabelas.inspections = [inspecao()];
    tabelas.responses = [{ id: 'r1', inspectionId: 'insp-1', itemId: 'a' } as unknown as InspectionResponse];

    const gravadas = await atualizarRoteiros(await levantarInspecoesDesatualizadas());
    expect(gravadas).toBe(1);
    expect(gravacoes).toHaveLength(1);
    expect(Object.keys(gravacoes[0].patch)).toEqual(['reportTemplateSnapshot']);

    const novo = gravacoes[0].patch.reportTemplateSnapshot as ChecklistTemplate;
    const itens = novo.sections.flatMap(s => s.items);
    expect(itens.map(i => i.id)).toEqual(['a', 'b']);
    expect(itens.find(i => i.id === 'a')?.requiredAction).toBe('- Providenciar.');
  });
});
