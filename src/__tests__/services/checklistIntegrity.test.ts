import { describe, expect, test } from 'vitest';
import { templates, getTotalItems, getEffectiveTemplate } from '../../data/templates';
import { templateEsteticaClinica } from '../../data/estetica/roteiro-clinica';
import { templateEsteticaEmbelezamento } from '../../data/estetica/roteiro-embelezamento';
import type { ChecklistItem, ChecklistTemplate, Client } from '../../types';
import { canonicalLegislationKey, extractBaseLegislation } from '../../utils/legislationRefs';

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'um', 'uma', 'uns', 'umas',
  'para', 'com', 'no', 'na', 'nos', 'nas', 'que', 'ao', 'aos', 'a', 'as', 'e', 'ou', 'por', 'se',
  'sua', 'seu', 'suas', 'seus', 'sao', 'como', 'ha', 'the', 'is', 'ser', 'estar', 'nao', 'todos',
  'toda', 'todas', 'todo',
]);

function tokenize(text: string): Set<string> {
  const normalized = (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  a.forEach(t => { if (b.has(t)) intersection += 1; });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function allItems(template: ChecklistTemplate): ChecklistItem[] {
  return template.sections.flatMap(s => s.items);
}

function assertNoNearDuplicates(template: ChecklistTemplate, threshold = 0.75) {
  const items = allItems(template);
  const tokenized = items.map(item => ({ item, tokens: tokenize(item.description) }));

  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const a = tokenized[i];
      const b = tokenized[j];
      const similarity = jaccard(a.tokens, b.tokens);
      if (similarity >= threshold) {
        throw new Error(
          `Itens quase-duplicados em "${template.name}": [${a.item.id}] "${a.item.description}" `
          + `x [${b.item.id}] "${b.item.description}" (similaridade ${similarity.toFixed(2)})`
        );
      }
    }
  }
}

const EXPECTED_ITEM_COUNTS: Record<string, number> = {
  'tpl-estetica-v1': 114,
  'tpl-estetica-clinica-v1': 113,
  'tpl-estetica-embelezamento-v1': 28,
  'tpl-ilpi-federal-v1': 97,
  'tpl-ilpi-go-v1': 79,
  'tpl-alimentos-federal-v1': 97,
  'tpl-alimentos-rj-v1': 114,
};

const templatesUnderTest = [...templates, templateEsteticaClinica, templateEsteticaEmbelezamento];

describe('checklist integrity — todos os roteiros de src/data', () => {
  templatesUnderTest.forEach(template => {
    describe(`${template.id} — ${template.name}`, () => {
      test('ids de item e de seção são únicos dentro do roteiro', () => {
        const sectionIds = template.sections.map(s => s.id);
        expect(new Set(sectionIds).size).toBe(sectionIds.length);

        const itemIds = allItems(template).map(i => i.id);
        expect(new Set(itemIds).size).toBe(itemIds.length);
      });

      test('todo item tem description e legislation preenchidas', () => {
        allItems(template).forEach(item => {
          expect(item.description?.trim(), `item ${item.id} sem description`).not.toBe('');
          expect(item.legislation?.trim(), `item ${item.id} sem legislation`).not.toBe('');
        });
      });

      test('good_practice nunca é crítica e tem peso baixo', () => {
        allItems(template).forEach(item => {
          if (item.requirementType === 'good_practice') {
            expect(item.isCritical, `item ${item.id} good_practice não pode ser crítico`).toBe(false);
            expect(item.weight, `item ${item.id} good_practice deve ter weight <= 2`).toBeLessThanOrEqual(2);
          }
        });
      });

      test('item crítico sempre tem peso 10', () => {
        allItems(template).forEach(item => {
          if (item.isCritical) {
            expect(item.weight, `item ${item.id} é crítico mas weight !== 10`).toBe(10);
          }
        });
      });

      const expectedCount = EXPECTED_ITEM_COUNTS[template.id];
      if (expectedCount !== undefined) {
        test(`contagem de itens é ${expectedCount} (trava mudança silenciosa)`, () => {
          expect(getTotalItems(template)).toBe(expectedCount);
        });
      }
    });
  });

  describe('roteiro de clínica de estética', () => {
    test('cada descrição é uma pergunta verificável em campo', () => {
      allItems(templateEsteticaClinica).forEach(item => {
        expect(item.description.endsWith('?'), `item ${item.id} não está em forma de pergunta`).toBe(true);
      });
    });

    test('não contém itens quase-duplicados', () => {
      assertNoNearDuplicates(templateEsteticaClinica);
    });

    test('itens legais têm URL e usam uma única grafia para cada norma', () => {
      const labelsByKey = new Map<string, string>();

      allItems(templateEsteticaClinica).forEach(item => {
        if (item.requirementType === 'good_practice') return;

        expect(item.legislationUrl, `item ${item.id} sem legislationUrl`).toBeTruthy();
        extractBaseLegislation(item.legislation || '').forEach(label => {
          const key = canonicalLegislationKey(label);
          const previous = labelsByKey.get(key);
          if (previous) expect(label, `grafia divergente para ${key}`).toBe(previous);
          else labelsByKey.set(key, label);
        });
      });
    });
  });

  describe('roteiro de embelezamento e beleza', () => {
    test('cada descrição é uma pergunta verificável em campo', () => {
      allItems(templateEsteticaEmbelezamento).forEach(item => {
        expect(item.description.endsWith('?'), `item ${item.id} não está em forma de pergunta`).toBe(true);
      });
    });

    test('não contém itens quase-duplicados', () => {
      assertNoNearDuplicates(templateEsteticaEmbelezamento);
    });

    test('itens legais têm URL e usam uma única grafia para cada norma', () => {
      const labelsByKey = new Map<string, string>();

      allItems(templateEsteticaEmbelezamento).forEach(item => {
        if (item.requirementType === 'good_practice') return;

        expect(item.legislationUrl, `item ${item.id} sem legislationUrl`).toBeTruthy();
        extractBaseLegislation(item.legislation || '').forEach(label => {
          const key = canonicalLegislationKey(label);
          const previous = labelsByKey.get(key);
          if (previous) expect(label, `grafia divergente para ${key}`).toBe(previous);
          else labelsByKey.set(key, label);
        });
      });
    });
  });

  describe('anti-duplicata em roteiro efetivo (base + suplemento regional)', () => {
    const ilpiFederal = templates.find(t => t.id === 'tpl-ilpi-federal-v1') as ChecklistTemplate;
    const rjClient = { id: 'test-rj', name: 'Cliente RJ', category: 'ilpi', state: 'RJ' } as Client;
    const otherStateClient = { id: 'test-sp', name: 'Cliente SP', category: 'ilpi', state: 'SP' } as Client;

    test('roteiro efetivo para cliente do RJ não tem itens quase-duplicados', () => {
      const effective = getEffectiveTemplate(ilpiFederal, rjClient, undefined, true);
      assertNoNearDuplicates(effective);
    });

    test('roteiro efetivo para cliente de outro estado não tem itens quase-duplicados', () => {
      const effective = getEffectiveTemplate(ilpiFederal, otherStateClient, undefined, true);
      assertNoNearDuplicates(effective);
    });
  });
});
