// ============================================================
// COND-03 — roteiro canônico único + congelamento na criação.
//
// Contrato: docs/contrato-aplicabilidade.md (§ 6.2, § 6.6).
// Mapa: docs/mapa-roteiro-inspecao.md (achados A2, A4, A9).
//
// O que estes testes travam:
//  1. composeCanonicalTemplate é a árvore COMPLETA (nunca filtrada por papel).
//  2. filterSectionsByRoleForDisplay é filtro de EXIBIÇÃO puro (não compõe).
//  3. Inspeção em andamento lê a REVISÃO CONGELADA — não recompõe do vivo (§ 6.2).
//  4. Sem snapshot, a composição aplica o MESMO corte de aposentados da execução
//     (createdAt), unificando execução e resumo (achado A9).
// ============================================================

import { describe, expect, test } from 'vitest';
import {
  composeCanonicalTemplate,
  filterSectionsByRoleForDisplay,
  getEffectiveTemplate,
  getTemplateById,
  getTotalItems,
} from '../../data/templates';
import { resolveReportTemplate } from '../../utils/reportTemplate';
import type { ChecklistTemplate, Client, Inspection } from '../../types';

const AS_OF = new Date('2026-08-18T12:00:00.000Z');

function ilpiRjClient(): Client {
  return {
    id: 'client-rj',
    name: 'ILPI RJ',
    category: 'ilpi',
    state: 'RJ',
    city: 'Rio de Janeiro',
  } as unknown as Client;
}

function inspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'inspection-1',
    clientId: 'client-rj',
    templateId: 'tpl-ilpi-federal-v1',
    consultantName: 'Consultora',
    inspectionDate: AS_OF,
    status: 'in_progress',
    state: 'RJ',
    city: 'Rio de Janeiro',
    clientCategory: 'ilpi',
    createdAt: AS_OF,
    updatedAt: AS_OF,
    syncStatus: 'synced',
    ...overrides,
  } as Inspection;
}

describe('COND-03 · composição canônica única', () => {
  test('é a árvore completa: idêntica a getEffectiveTemplate(full) e com a nutrição preservada', () => {
    const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
    const client = ilpiRjClient();

    const canonical = composeCanonicalTemplate(base, client, AS_OF);
    const full = getEffectiveTemplate(base, client, undefined, true, AS_OF);

    // Mesmo conjunto de itens que a composição completa de hoje (equivalência).
    expect(getTotalItems(canonical)).toBe(getTotalItems(full));
    expect(canonical.sections.map((s) => s.id)).toEqual(full.sections.map((s) => s.id));

    // A completa NUNCA recorta a nutrição — é isso que o papel passa a fazer só na exibição.
    expect(canonical.sections.some((s) => s.id === 'sec-fed-05')).toBe(true);

    // Suplemento regional aplicado: RJ acrescenta itens sobre a Base Federal.
    expect(getTotalItems(canonical)).toBeGreaterThan(getTotalItems(base));
    expect(canonical.name).toContain('RJ');
  });
});

describe('COND-03 · papel é filtro de exibição puro', () => {
  const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
  const sections = composeCanonicalTemplate(base, ilpiRjClient(), AS_OF).sections;

  test('saúde esconde a nutrição; nutrição mostra só a nutrição', () => {
    const saude = filterSectionsByRoleForDisplay(sections, 'saude');
    const nutricao = filterSectionsByRoleForDisplay(sections, 'nutricao');

    expect(saude.some((s) => s.id === 'sec-fed-05')).toBe(false);
    expect(saude.some((s) => s.id === 'sec-fed-06')).toBe(false);
    expect(nutricao.some((s) => s.id === 'sec-fed-05')).toBe(true);
    expect(nutricao.every((s) => ['sec-fed-05', 'sec-fed-06'].includes(s.id))).toBe(true);
  });

  test('ambos/vazio devolve tudo, sem tocar na entrada', () => {
    expect(filterSectionsByRoleForDisplay(sections, 'ambos')).toBe(sections);
    expect(filterSectionsByRoleForDisplay(sections, '')).toBe(sections);
    // Não muta a árvore completa (a nutrição continua lá depois de filtrar).
    filterSectionsByRoleForDisplay(sections, 'saude');
    expect(sections.some((s) => s.id === 'sec-fed-05')).toBe(true);
  });
});

describe('COND-03 · inspeção em andamento lê a revisão congelada', () => {
  test('usa o snapshot da inspeção e não recompõe do roteiro vivo (§ 6.2)', () => {
    const base = getTemplateById('tpl-ilpi-federal-v1') as ChecklistTemplate;
    const frozen: ChecklistTemplate = {
      ...base,
      name: 'Roteiro congelado na criação',
      sections: base.sections.slice(0, 1),
    };

    const resolved = resolveReportTemplate(
      base,
      inspection({ status: 'in_progress', reportTemplateSnapshot: frozen }),
      [],
    );

    // Se recompusesse do vivo, viriam todas as seções + suplemento RJ. Veio o congelado.
    expect(resolved.sections).toHaveLength(1);
    expect(resolved.name).toBe('Roteiro congelado na criação');
  });

  test('sem snapshot, compõe a canônica com o corte de aposentados da criação (achado A9)', () => {
    const baseWithRetired: ChecklistTemplate = {
      id: 'tpl-cond03-x',
      name: 'Roteiro teste',
      category: 'estetica',
      version: '1',
      sections: [
        {
          id: 's1',
          title: 'Seção 1',
          order: 1,
          items: [
            { id: 'a', sectionId: 's1', order: 1, description: 'Item A', weight: 5, isCritical: false },
            // Aposentado ANTES do início da inspeção → deve sair, igual à execução.
            { id: 'b', sectionId: 's1', order: 2, description: 'Item B', weight: 5, isCritical: false, retiredAt: '2026-01-01T00:00:00.000Z' },
            // Aposentado DEPOIS do início → grandfather, permanece.
            { id: 'c', sectionId: 's1', order: 3, description: 'Item C', weight: 5, isCritical: false, retiredAt: '2026-12-01T00:00:00.000Z' },
          ],
        },
      ],
    };

    const resolved = resolveReportTemplate(
      baseWithRetired,
      // Sem state → nenhum suplemento aplicado; sem snapshot → compõe a canônica.
      inspection({ status: 'in_progress', reportTemplateSnapshot: undefined, state: undefined, clientCategory: undefined }),
      [],
    );
    const ids = resolved.sections.flatMap((s) => s.items.map((i) => i.id));

    expect(ids).toContain('a');
    expect(ids).toContain('c');
    expect(ids).not.toContain('b');

    // É exatamente o mesmo corte que a execução aplica (getEffectiveTemplate com createdAt).
    const executed = getEffectiveTemplate(baseWithRetired, {} as Client, undefined, true, AS_OF);
    expect(ids).toEqual(executed.sections.flatMap((s) => s.items.map((i) => i.id)));
  });
});
