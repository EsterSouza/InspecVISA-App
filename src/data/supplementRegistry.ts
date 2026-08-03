// ============================================================
// src/data/supplementRegistry.ts
// Registro declarativo de suplementos regionais/municipais.
//
// Substitui os antigos "3 ifs" hard-coded em getEffectiveTemplate
// (GO, BH, RJ — todos ILPI). Um novo suplemento (qualquer categoria,
// qualquer município) é uma entrada nova aqui, sem tocar em templates.ts.
// ============================================================

import type { Client, ChecklistSupplement, ChecklistTemplate } from '../types';
import { templateIlpiGoiasSuplement } from './templates-ilpi-goias-supplement';
import { templateIlpiBeloHorizonteSupplement } from './Roteiro_ILPI_BH';
import { templateIlpiRioDeJaneiroSupplement } from './Roteiro_ILPI_RJ';
import { isRioState } from '../utils/state';

function normalizeLocation(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function isBeloHorizonteClient(client: Client): boolean {
  const state = normalizeLocation(client.state);
  const city = normalizeLocation(client.city);
  return (state === 'mg' || state === 'minas gerais') && city.includes('belo horizonte');
}

export function isIlpiFederalTemplate(template: ChecklistTemplate): boolean {
  // 1. Match by static ID (bundled template)
  if (template.id === 'tpl-ilpi-federal-v1') return true;
  // 2. Match by name — Supabase-seeded templates have UUID IDs but keep the same name
  if (/ILPI.*Base Federal/i.test(template.name || '')) return true;
  // 3. Match by static section IDs (fallback for older bundled templates)
  return (
    template.category === 'ilpi' &&
    template.sections.some((section: any) => section.id === 'sec-fed-01') &&
    template.sections.some((section: any) => section.id === 'sec-fed-13')
  );
}

export interface SupplementRegistryEntry {
  supplement: ChecklistSupplement;
  appliesTo: (baseTemplate: ChecklistTemplate, client: Client) => boolean;
  nameSuffix: string;
}

export const supplementRegistry: SupplementRegistryEntry[] = [
  {
    supplement: templateIlpiGoiasSuplement as unknown as ChecklistSupplement,
    appliesTo: (template, client) => isIlpiFederalTemplate(template) && normalizeLocation(client.state) === 'go',
    nameSuffix: ' (+ Suplemento GO)',
  },
  {
    supplement: templateIlpiBeloHorizonteSupplement,
    appliesTo: (template, client) => isIlpiFederalTemplate(template) && isBeloHorizonteClient(client),
    nameSuffix: ' (+ Suplemento BH)',
  },
  {
    supplement: templateIlpiRioDeJaneiroSupplement,
    appliesTo: (template, client) => isIlpiFederalTemplate(template) && isRioState(client.state),
    nameSuffix: ' (+ Suplemento RJ)',
  },
];
