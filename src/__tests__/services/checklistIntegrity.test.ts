import { describe, expect, test } from 'vitest';
import { templates, getTemplateById, getTotalItems, getEffectiveTemplate } from '../../data/templates';
import { templateEsteticaClinica } from '../../data/estetica/roteiro-clinica';
import { templateEsteticaEmbelezamento } from '../../data/estetica/roteiro-embelezamento';
import type { ChecklistItem, ChecklistTemplate, Client } from '../../types';
import { canonicalLegislationKey, extractBaseLegislation, legislationUrlForItem } from '../../utils/legislationRefs';

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
  'tpl-estetica-clinica-v1': 114,
  'tpl-estetica-embelezamento-v1': 28,
  // REF-05 (06/08/2026): 97 → 106. Dez itens existiam só no banco e foram trazidos para o
  // código; os cuidadores voltaram a ser quatro itens, um por grau de dependência mais a
  // escala, como o Art. 16 II a/b/c da RDC 502/2021 os separa.
  'tpl-ilpi-federal-v1': 106,
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

        // REF-02: a URL deixou de ser copiada item a item; ela vem da biblioteca
        // pela chave canônica. O que importa continua sendo o item ter link.
        expect(legislationUrlForItem(item), `item ${item.id} sem URL de legislação`).toBeTruthy();
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

        // REF-02: a URL deixou de ser copiada item a item; ela vem da biblioteca
        // pela chave canônica. O que importa continua sendo o item ter link.
        expect(legislationUrlForItem(item), `item ${item.id} sem URL de legislação`).toBeTruthy();
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

  describe('integração dos roteiros de estética', () => {
    const clinica = templates.find(t => t.id === 'tpl-estetica-clinica-v1') as ChecklistTemplate;

    /**
     * O roteiro como a execução o carrega: vindo do Supabase, **todo** id é UUID —
     * template, seção e item. Trocar só o id do roteiro, como estes testes faziam
     * antes, não reproduzia nada do que quebra na prática.
     */
    function comIdsDoBanco(template: ChecklistTemplate): ChecklistTemplate {
      let n = 0;
      const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      return {
        ...template,
        id: uuid(),
        sections: template.sections.map(section => ({
          ...section,
          id: uuid(),
          items: section.items.map(item => ({ ...item, id: uuid() })),
        })),
      };
    }

    const rjClient = { id: 'test-est-rj', name: 'Clínica RJ', category: 'estetica', state: 'Rio de Janeiro' } as Client;
    const otherStateClient = { id: 'test-est-sp', name: 'Clínica SP', category: 'estetica', state: 'SP' } as Client;
    const saoPauloCapitalClient = { id: 'test-est-sp-capital', name: 'Clínica SP Capital', category: 'estetica', state: 'São Paulo', city: 'São Paulo' } as Client;
    const guarulhosClient = { id: 'test-est-guarulhos', name: 'Clínica Guarulhos', category: 'estetica', state: 'SP', city: 'Guarulhos' } as Client;

    test('mantém somente os dois roteiros-base de estética e preserva os aliases legados', () => {
      expect(templates.filter(t => t.category === 'estetica').map(t => t.id)).toEqual([
        'tpl-estetica-clinica-v1',
        'tpl-estetica-embelezamento-v1',
      ]);
      expect(getTemplateById('tpl-estetica-v1')?.id).toBe('tpl-estetica-clinica-v1');
      expect(getTemplateById('tpl-estetica')?.id).toBe('tpl-estetica-clinica-v1');
      expect(getTemplateById('tpl-estetica-federal')?.id).toBe('tpl-estetica-clinica-v1');
    });

    test('aplica somente o suplemento SP/SP ao roteiro federal da capital paulista', () => {
      const effectiveCapital = getEffectiveTemplate(clinica, saoPauloCapitalClient, undefined, true);
      const effectiveGuarulhos = getEffectiveTemplate(clinica, guarulhosClient, undefined, true);
      const capitalItems = allItems(effectiveCapital);

      expect(capitalItems.find(item => item.id === 'est-001')).toBeUndefined();
      expect(capitalItems.find(item => item.id === 'est-002')).toBeUndefined();
      expect(capitalItems.find(item => item.id === 'est-008')).toBeUndefined();
      expect(capitalItems.find(item => item.id === 'est-011')).toBeUndefined();
      expect(capitalItems.find(item => item.id === 'est-012')).toBeUndefined();
      expect(capitalItems.find(item => item.id === 'est-045')).toBeUndefined();
      expect(capitalItems.find(item => item.id === 'est-051')).toBeUndefined();
      expect(capitalItems.find(item => item.id === 'est-056')).toBeUndefined();
      expect(capitalItems.filter(item => item.id === 'sp-est-001')).toHaveLength(1);
      expect(capitalItems.filter(item => item.id === 'sp-est-002')).toHaveLength(1);
      expect(capitalItems.find(item => item.id === 'sp-est-003')).toBeTruthy();
      expect(capitalItems.find(item => item.id === 'sp-est-004')).toBeTruthy();
      expect(capitalItems.find(item => item.id === 'sp-est-005')).toBeTruthy();
      expect(effectiveCapital.sections.find(section => section.id === 'sec-int-13')?.items).toHaveLength(5);
      expect(capitalItems).toHaveLength(126);
      capitalItems.forEach(item => {
        expect(item.description.endsWith('?'), `item ${item.id} não está em forma de pergunta`).toBe(true);
      });
      assertNoNearDuplicates(effectiveCapital);
      expect(allItems(effectiveGuarulhos).find(item => item.id === 'est-001')).toBeTruthy();
      expect(allItems(effectiveGuarulhos).find(item => item.id === 'sp-est-001')).toBeUndefined();
      expect(effectiveGuarulhos.sections.find(section => section.id === 'sec-int-13')).toBeUndefined();
    });

    test('aplica o suplemento paulista ao roteiro federal seedado com UUID do Supabase', () => {
      const effective = getEffectiveTemplate(comIdsDoBanco(clinica), saoPauloCapitalClient, undefined, true);
      const items = allItems(effective);

      expect(items.find(item => item.id === 'sp-est-001')).toBeTruthy();
      // O item federal substituído não sobrevive só porque mudou de id: `replacesItemId`
      // aponta para 'est-001' e no banco o mesmo requisito é UUID. Enquanto isso casava
      // só por id, os dois ficavam lado a lado — 130 itens em vez de 122.
      expect(items).toHaveLength(126);
      assertNoNearDuplicates(effective);
    });

    test('substitui a licença federal uma única vez para cliente do RJ', () => {
      const effectiveRj = getEffectiveTemplate(clinica, rjClient, undefined, true);
      const effectiveOtherState = getEffectiveTemplate(clinica, otherStateClient, undefined, true);
      const rjItems = allItems(effectiveRj);

      expect(rjItems.filter(item => item.id === 'rj-est-001')).toHaveLength(1);
      expect(rjItems.find(item => item.id === 'est-001')).toBeUndefined();
      expect(allItems(effectiveOtherState).find(item => item.id === 'est-001')).toBeTruthy();
      expect(allItems(effectiveOtherState).find(item => item.id === 'rj-est-001')).toBeUndefined();
    });

    test('aplica o suplemento ao roteiro de clínica seedado com UUID do Supabase', () => {
      const effective = getEffectiveTemplate(comIdsDoBanco(clinica), rjClient, undefined, true);

      expect(allItems(effective).find(item => item.id === 'rj-est-001')).toBeTruthy();
      assertNoNearDuplicates(effective);
    });

    const parauapebasClient = { id: 'test-est-pbs', name: 'Consultório Parauapebas', category: 'estetica', state: 'Pará', city: 'Parauapebas' } as Client;
    const maraba1Client = { id: 'test-est-maraba', name: 'Consultório Marabá', category: 'estetica', state: 'PA', city: 'Marabá' } as Client;

    test('aplica o suplemento de Parauapebas só ao município e substitui os itens federais apontados', () => {
      const effective = getEffectiveTemplate(clinica, parauapebasClient, undefined, true);
      const items = allItems(effective);
      const outroMunicipio = allItems(getEffectiveTemplate(clinica, maraba1Client, undefined, true));

      ['est-001', 'est-003', 'est-010', 'est-014', 'est-073', 'est-085', 'est-086'].forEach(id => {
        expect(items.find(item => item.id === id), `${id} deveria ter sido substituído`).toBeUndefined();
      });
      ['pbs-est-001', 'pbs-est-002', 'pbs-est-003', 'pbs-est-004', 'pbs-est-005', 'pbs-est-020',
       'pbs-est-030', 'pbs-est-031', 'pbs-est-040', 'pbs-est-050', 'pbs-est-051', 'pbs-est-060',
       'pbs-est-061'].forEach(id => {
        expect(items.filter(item => item.id === id), `${id} deveria entrar uma única vez`).toHaveLength(1);
      });

      // 114 do roteiro-base − 7 substituídos + 13 do suplemento.
      expect(items).toHaveLength(120);
      items.forEach(item => {
        expect(item.description.endsWith('?'), `item ${item.id} não está em forma de pergunta`).toBe(true);
      });
      assertNoNearDuplicates(effective);

      // Outro município do Pará continua com o roteiro federal puro.
      expect(outroMunicipio.find(item => item.id === 'est-001')).toBeTruthy();
      expect(outroMunicipio.find(item => item.id === 'pbs-est-001')).toBeUndefined();
    });

    test('aplica o suplemento de Parauapebas ao roteiro seedado com UUID do Supabase', () => {
      const effective = getEffectiveTemplate(comIdsDoBanco(clinica), parauapebasClient, undefined, true);

      expect(allItems(effective)).toHaveLength(120);
      expect(allItems(effective).find(item => item.id === 'pbs-est-001')).toBeTruthy();
      assertNoNearDuplicates(effective);
    });

    test('todo item do suplemento de Parauapebas resolve URL de legislação', () => {
      const effective = getEffectiveTemplate(clinica, parauapebasClient, undefined, true);

      allItems(effective)
        .filter(item => item.id.startsWith('pbs-est-'))
        .forEach(item => {
          expect(legislationUrlForItem(item), `item ${item.id} sem URL de legislação`).toBeTruthy();
        });
    });
  });
});
