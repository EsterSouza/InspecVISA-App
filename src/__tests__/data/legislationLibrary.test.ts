import { describe, expect, test } from 'vitest';
import { LEGISLATION_LIBRARY } from '../../data/legislationLibrary';
import { templates } from '../../data/templates';
import { supplementRegistry } from '../../data/supplementRegistry';
import {
  canonicalLegislationKey,
  legislationUrlForItem,
  resolveCitedLegislations,
} from '../../utils/legislationRefs';
import type { ChecklistItem, ChecklistTemplate } from '../../types';

function allItems(template: ChecklistTemplate): ChecklistItem[] {
  return template.sections.flatMap(s => s.items);
}

// Cobre tudo que a consultora pode aplicar em campo: os 6 roteiros base e os 5
// suplementos regionais. Um ato citado só pelo suplemento de BH ou do RJ entra
// no relatório de uma inspeção real igual a um da base.
const allTemplateItems: { item: ChecklistItem; origem: string }[] = [
  ...(templates as ChecklistTemplate[]).flatMap(tpl =>
    allItems(tpl).map(item => ({ item, origem: tpl.id }))
  ),
  ...supplementRegistry.flatMap(({ supplement }) => [
    ...supplement.sectionAdditions.flatMap(addition =>
      (addition.items || []).map(item => ({ item, origem: supplement.id }))
    ),
    ...(supplement.newSections || []).flatMap(section =>
      (section.items || []).map(item => ({ item, origem: supplement.id }))
    ),
  ]),
];

describe('biblioteca de legislações (REF-02)', () => {
  test('nenhum ato aparece duas vezes sob a mesma chave canônica', () => {
    const byKey = new Map<string, string[]>();
    LEGISLATION_LIBRARY.forEach(entry => {
      const key = canonicalLegislationKey(entry.name);
      byKey.set(key, [...(byKey.get(key) || []), entry.name]);
    });

    const collisions = [...byKey.entries()].filter(([, names]) => names.length > 1);
    expect(collisions, `chaves duplicadas: ${JSON.stringify(collisions)}`).toEqual([]);
  });

  test('toda entrada tem ementa, URL http(s) e vigência verificada', () => {
    LEGISLATION_LIBRARY.forEach(entry => {
      expect(entry.summary.trim(), `${entry.name} sem ementa`).not.toBe('');
      expect(entry.url, `${entry.name} com URL inválida`).toMatch(/^https?:\/\/\S+$/);
      expect(entry.verifiedAt, `${entry.name} sem data de verificação`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test('uf, quando preenchida, é sigla de duas letras maiúsculas', () => {
    LEGISLATION_LIBRARY.forEach(entry => {
      if (entry.uf != null) expect(entry.uf, `${entry.name} com uf inválida`).toMatch(/^[A-Z]{2}$/);
    });
  });

  test('norma estadual ou municipal declara UF', () => {
    // Sem UF, isLegislationApplicable trata a norma como federal e passa a
    // sugeri-la para clientes de qualquer estado.
    const regional = /municipal|estadual|\bRJ\b|\bSP\b|\bMG\b|\bGO\b|\bRio\b|IVISA-RIO|Belo Horizonte|Senador Canedo|SES\/|SMS|SMSA|CVS/i;
    LEGISLATION_LIBRARY.forEach(entry => {
      if (regional.test(entry.name)) {
        expect(entry.uf, `${entry.name} é regional e está sem uf`).toBeTruthy();
      }
    });
  });
});

describe('ligação entre roteiros e biblioteca (REF-02)', () => {
  test('todo item legal resolve uma URL de legislação', () => {
    const semUrl = allTemplateItems
      .filter(({ item }) => item.requirementType !== 'good_practice')
      .filter(({ item }) => !legislationUrlForItem(item))
      .map(({ item, origem }) => `${origem}/${item.id}: ${item.legislation}`);

    expect(semUrl, `itens legais sem URL:\n${semUrl.join('\n')}`).toEqual([]);
  });

  test('todo ato citado com forma normativa reconhecível está na biblioteca', () => {
    const faltando = new Map<string, string>();
    allTemplateItems.forEach(({ item }) => {
      resolveCitedLegislations(item.legislation).forEach(cited => {
        // Tipo OUTRO = a citação não tem forma normativa reconhecível ("Boas
        // Práticas", "manual do fabricante", "ROI ANVISA ILPI"). Não é ato
        // catalogável, então não conta contra a cobertura.
        if (cited.key.startsWith('OUTRO|') || cited.entry) return;
        faltando.set(cited.key, cited.label);
      });
    });

    expect([...faltando.entries()], 'atos citados fora da biblioteca').toEqual([]);
  });

  test('o override do item, quando existe, aponta para a mesma norma da biblioteca', () => {
    // Um legislation_url que discorde da biblioteca é a divergência que o REF-02
    // veio eliminar; se o item tem override, ele tem de ser a URL da biblioteca.
    const divergentes = allTemplateItems
      .filter(({ item }) => item.legislationUrl)
      .filter(({ item }) => {
        const daBiblioteca = resolveCitedLegislations(item.legislation).find(c => c.entry?.url);
        return daBiblioteca && daBiblioteca.entry!.url !== item.legislationUrl;
      })
      .map(({ item, origem }) => `${origem}/${item.id}`);

    expect(divergentes, `itens com URL divergente da biblioteca:\n${divergentes.join('\n')}`).toEqual([]);
  });
});
