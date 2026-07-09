import { db } from '../db/database';
import { InspectionService } from '../services/inspectionService';
import { filterByActiveTenant } from './localScope';

export interface FieldSuggestions {
  situationDescription: string[];
  correctiveAction: string[];
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function rankTexts(entries: { text: string; updatedAt: Date }[]): string[] {
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
    .slice(0, 5)
    .map((entry) => entry.text);
}

/**
 * Sugestões de "Situação encontrada" / "Ação corretiva" já escritas antes para
 * este MESMO item (em qualquer cliente/visita), pra evitar redigitar achados
 * comuns. Itens "extra|..." têm id único por inserção e raramente terão
 * histórico — limitação aceitável, não é o caso de uso principal.
 * Hidrata antes pra funcionar em dispositivo novo/cache limpo (mesmo padrão de
 * actionPlanContext.ts). Ver memória sync-no-full-response-hydration.
 */
export async function getFieldSuggestions(itemId: string): Promise<FieldSuggestions> {
  await InspectionService.hydrateTenantResponses().catch(() => {});

  const responses = filterByActiveTenant(await db.responses
    .where('itemId')
    .equals(itemId)
    .filter((response) => !response.deletedAt)
    .toArray());

  return {
    situationDescription: rankTexts(responses
      .filter((r) => r.situationDescription?.trim())
      .map((r) => ({ text: r.situationDescription as string, updatedAt: r.updatedAt }))),
    correctiveAction: rankTexts(responses
      .filter((r) => r.correctiveAction?.trim())
      .map((r) => ({ text: r.correctiveAction as string, updatedAt: r.updatedAt }))),
  };
}
