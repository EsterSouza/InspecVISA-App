import {
  LEGISLATION_LIBRARY,
  canonicalLegislationKey,
  extractBaseLegislation,
  type LegislationEntry,
} from '@visa/legislacao';
import { getLatestResponsesByItem } from './scoring';
import type { ChecklistTemplate, InspectionResponse } from '../types';

// A extração da citação livre e a chave canônica passaram para @visa/legislacao,
// onde a base unificada vive. Reexportadas aqui porque metade do app as importa
// deste caminho — e porque só fazem sentido junto com o resto deste arquivo.
export { canonicalLegislationKey, extractBaseLegislation };

// ── Ligação biblioteca ↔ roteiros (REF-02) ───────────────────────────────────
// O item do roteiro cita a norma em texto livre (`legislation`); a biblioteca é
// quem sabe a URL oficial. A chave canônica é a cola entre os dois, o que evita
// repetir URL item a item e faz uma correção na biblioteca valer para todos.

let libraryByKey: Map<string, LegislationEntry> | null = null;

function getLibraryIndex(): Map<string, LegislationEntry> {
  if (!libraryByKey) {
    libraryByKey = new Map();
    for (const entry of LEGISLATION_LIBRARY) {
      libraryByKey.set(canonicalLegislationKey(entry.name), entry);
    }
  }
  return libraryByKey;
}

export interface CitedLegislation {
  /** Grafia como aparece no item. */
  label: string;
  key: string;
  /** Entrada da biblioteca, quando o ato está catalogado. */
  entry?: LegislationEntry;
}

/** Atos citados por um item, na ordem da citação, já cruzados com a biblioteca. */
export function resolveCitedLegislations(raw?: string | null): CitedLegislation[] {
  const index = getLibraryIndex();
  return extractBaseLegislation(raw || '').map(label => {
    const key = canonicalLegislationKey(label);
    return { label, key, entry: index.get(key) };
  });
}

/**
 * URL oficial do primeiro ato citado que exista na biblioteca. É o fallback de
 * `checklist_items.legislation_url`: a coluna continua valendo como override
 * manual, mas nenhum item precisa dela para ter link.
 */
export function resolveLegislationUrl(raw?: string | null): string | undefined {
  return resolveCitedLegislations(raw).find(c => c.entry?.url)?.entry?.url;
}

/**
 * Normas citadas pelos itens efetivamente avaliados de uma inspeção — a lista que
 * fundamenta *aquele* relatório. Usada pelo PDF e pelo modal de geração, para que
 * os dois concordem sobre o que é "item avaliado" (antes o modal olhava todas as
 * respostas, inclusive as substituídas por uma reavaliação posterior).
 */
export function citedLegislations(
  template: ChecklistTemplate,
  responses: InspectionResponse[]
): string[] {
  const items = template.sections.flatMap(s => s.items);
  const evaluated = new Set(
    getLatestResponsesByItem(responses, new Set(items.map(i => i.id))).map(r => r.itemId)
  );

  const bases = new Set<string>();
  for (const item of items) {
    if (!evaluated.has(item.id) || !item.legislation) continue;
    for (const base of extractBaseLegislation(item.legislation)) bases.add(base);
  }
  return Array.from(bases).sort();
}

/** URL a exibir para um item de roteiro: override do item ou biblioteca. */
export function legislationUrlForItem(
  item: { legislation?: string | null; legislationUrl?: string | null }
): string | undefined {
  return item.legislationUrl || resolveLegislationUrl(item.legislation);
}
