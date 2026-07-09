import { db } from '../db/database';
import { InspectionService } from '../services/inspectionService';
import { getTemplates } from '../data/templates';
import { filterByActiveTenant } from './localScope';

export interface FieldSuggestions {
  situationDescription: string[];
  correctiveAction: string[];
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function rankTexts(entries: { text: string; updatedAt: Date }[], limit: number): string[] {
  const byKey = new Map<string, { text: string; count: number; lastUpdatedAt: number }>();
  for (const entry of entries) {
    const key = normalize(entry.text);
    if (!key) continue;
    const updatedAtMs = entry.updatedAt?.getTime?.() || 0;
    const current = byKey.get(key);
    if (current) {
      current.count += 1;
      if (updatedAtMs > current.lastUpdatedAt) current.lastUpdatedAt = updatedAtMs;
    } else {
      byKey.set(key, { text: entry.text.trim(), count: 1, lastUpdatedAt: updatedAtMs });
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.count - a.count || b.lastUpdatedAt - a.lastUpdatedAt)
    .slice(0, limit)
    .map((entry) => entry.text);
}

// Mapa descrição normalizada -> itemIds. O mesmo requisito legal (ex.: "PAISI")
// tem ids DIFERENTES em cada variante de roteiro (RJ, BH, outras cidades/roteiros
// customizados), então casar só pelo itemId exato perdia a maior parte do
// histórico de uma consultora que atende clientes em roteiros diferentes.
// Casando pelo texto da descrição, pega o histórico de TODOS os roteiros que
// têm esse mesmo item, de qualquer cliente. Construído uma vez por sessão
// (templates não mudam durante o uso).
let descriptionToItemIdsCache: Map<string, string[]> | null = null;

async function buildDescriptionToItemIdsMap(): Promise<Map<string, string[]>> {
  if (descriptionToItemIdsCache) return descriptionToItemIdsCache;

  const map = new Map<string, string[]>();
  const add = (description: string | undefined, id: string) => {
    if (!description) return;
    const key = normalize(description);
    if (!key) return;
    const list = map.get(key) || [];
    if (!list.includes(id)) list.push(id);
    map.set(key, list);
  };

  for (const template of getTemplates()) {
    for (const section of template.sections || []) {
      for (const item of section.items || []) add(item.description, item.id);
    }
  }

  const dynamicTemplates = await db.templates.toArray().catch(() => []);
  for (const template of dynamicTemplates) {
    for (const section of template.sections || []) {
      for (const item of section.items || []) add(item.description, item.id);
    }
  }

  descriptionToItemIdsCache = map;
  return map;
}

/**
 * Sugestões de "Situação encontrada" / "Ação corretiva" já escritas antes para
 * este item — em QUALQUER cliente/visita e QUALQUER variante de roteiro que
 * tenha o mesmo texto de requisito (não só o mesmo itemId exato). Hidrata antes
 * pra funcionar em dispositivo novo/cache limpo (mesmo padrão de
 * actionPlanContext.ts). Ver memória sync-no-full-response-hydration.
 */
export async function getFieldSuggestions(itemId: string, description: string, limit = 8): Promise<FieldSuggestions> {
  await InspectionService.hydrateTenantResponses().catch(() => {});

  const descriptionMap = await buildDescriptionToItemIdsMap();
  const matchingIds = Array.from(new Set([itemId, ...(descriptionMap.get(normalize(description)) || [])]));

  const responses = filterByActiveTenant(await db.responses
    .where('itemId')
    .anyOf(matchingIds)
    .filter((response) => !response.deletedAt)
    .toArray());

  return {
    situationDescription: rankTexts(responses
      .filter((r) => r.situationDescription?.trim())
      .map((r) => ({ text: r.situationDescription as string, updatedAt: r.updatedAt })), limit),
    correctiveAction: rankTexts(responses
      .filter((r) => r.correctiveAction?.trim())
      .map((r) => ({ text: r.correctiveAction as string, updatedAt: r.updatedAt })), limit),
  };
}
