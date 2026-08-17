import type { ChecklistTemplate } from '../types';

/**
 * O mesmo requisito com id diferente.
 *
 * `responses.item_id` guarda o id do roteiro usado **naquela** visita, e o mesmo
 * requisito tem id diferente em roteiros diferentes: as inspeções até 12/06/2026
 * rodaram no roteiro estático (`tpl-ilpi-federal-v1`, ids `fed-009`), as de agora
 * rodam no roteiro do banco (ids UUID). Comparar só por id fazia a reincidência
 * desaparecer — a pendência de junho não era encontrada na visita de agosto.
 *
 * O texto do requisito é o que sobrevive à troca: medido em 17/08/2026, as 106
 * descrições do roteiro estático casam exatamente com as 106 do banco.
 */
export function normalizeRequirementText(text: string | undefined): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Índice descrição normalizada → id do item no roteiro.
 *
 * Descrição repetida no mesmo roteiro fica **fora** do índice: casar com um dos
 * dois seria escolher no escuro, e é melhor não marcar reincidência do que
 * marcar no item errado.
 */
export function buildRequirementIndex(template: Pick<ChecklistTemplate, 'sections'>): Map<string, string> {
  const byText = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const section of template.sections || []) {
    for (const item of section.items || []) {
      const key = normalizeRequirementText(item.description);
      if (!key) continue;
      if (byText.has(key)) ambiguous.add(key);
      else byText.set(key, item.id);
    }
  }

  for (const key of ambiguous) byText.delete(key);
  return byText;
}

/** Índice título da seção normalizado → id da seção. Mesma regra do ambíguo. */
function buildSectionIndex(template: Pick<ChecklistTemplate, 'sections'>): Map<string, string> {
  const byTitle = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const section of template.sections || []) {
    const key = normalizeRequirementText(section.title);
    if (!key) continue;
    if (byTitle.has(key)) ambiguous.add(key);
    else byTitle.set(key, section.id);
  }

  for (const key of ambiguous) byTitle.delete(key);
  return byTitle;
}

/**
 * Troca o `itemId` de pendências antigas pelo id equivalente no roteiro atual.
 *
 * Só age quando o id antigo **não existe** no roteiro de agora: id que ainda
 * existe é a fonte mais confiável e não é tocado. Item sem equivalente sai
 * inalterado — quem filtra depois (`filterPendingItemsForTemplate`) decide se
 * ele entra na tela.
 *
 * Item extra (acrescentado na visita) não tem equivalente para procurar: o que
 * quebra nele é a **seção**, que também mudou de id. Aí o que se remapeia é o
 * `customItemMeta.sectionId`, casando pelo título da seção — sem isso, "Item
 * acrescentado na cozinha" da visita passada não tem onde morar no roteiro novo
 * e some.
 */
export function remapItemsToTemplate<
  T extends {
    itemId: string;
    description?: string;
    sectionTitle?: string;
    customItemMeta?: { sectionId: string };
  },
>(
  items: Iterable<T>,
  template: Pick<ChecklistTemplate, 'sections'>,
): T[] {
  const index = buildRequirementIndex(template);
  const sectionIndex = buildSectionIndex(template);
  const currentIds = new Set(
    (template.sections || []).flatMap(section => (section.items || []).map(item => item.id)),
  );
  const currentSections = new Set((template.sections || []).map(section => section.id));
  const titleById = new Map((template.sections || []).map(section => [section.id, section.title]));

  return [...items].map(item => {
    const meta = item.customItemMeta;
    if (meta && !currentSections.has(meta.sectionId)) {
      const equivalentSection = sectionIndex.get(normalizeRequirementText(sectionTitleOf(item, titleById)));
      if (equivalentSection) return { ...item, customItemMeta: { ...meta, sectionId: equivalentSection } };
      return item;
    }
    if (currentIds.has(item.itemId)) return item;
    const equivalent = index.get(normalizeRequirementText(item.description));
    return equivalent ? { ...item, itemId: equivalent } : item;
  });
}

/**
 * O título da seção de onde o item extra veio. `PreviousNCContext` carrega
 * `sectionTitle`; quando não carrega, não há como casar e o item fica de fora.
 */
function sectionTitleOf(
  item: { sectionTitle?: string; customItemMeta?: { sectionId: string } },
  titleById: Map<string, string>,
): string {
  return item.sectionTitle || titleById.get(item.customItemMeta?.sectionId || '') || '';
}
