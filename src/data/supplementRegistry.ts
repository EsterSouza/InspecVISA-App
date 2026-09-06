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
import { suplementoEsteticaRj } from './estetica/suplemento-rj';
import { suplementoEsteticaSpCapital } from './estetica/suplemento-sp-capital';
import { suplementoCompartilhamentoRioCapital } from './estetica/suplemento-compartilhamento-rio-capital';
import { suplementoSaudeParauapebas } from './estetica/suplemento-para-parauapebas';
import { suplementoPetropolis } from './saude/suplemento-petropolis';
import { suplementoAlimentosRioDeJaneiro } from './alimentos/suplemento-rio-de-janeiro';
import { isRioState, toUF } from '../utils/state';

function normalizeLocation(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function isBeloHorizonteClient(client: Client): boolean {
  return toUF(client.state) === 'MG' && normalizeLocation(client.city).includes('belo horizonte');
}

function isSaoPauloCapitalClient(client: Client): boolean {
  return toUF(client.state) === 'SP' && normalizeLocation(client.city) === 'sao paulo';
}

function isParauapebasClient(client: Client): boolean {
  return toUF(client.state) === 'PA' && normalizeLocation(client.city).includes('parauapebas');
}

function isPetropolisClient(client: Client): boolean {
  return toUF(client.state) === 'RJ' && normalizeLocation(client.city).includes('petropolis');
}

function isRioDeJaneiroCapitalClient(client: Client): boolean {
  return toUF(client.state) === 'RJ' && normalizeLocation(client.city) === 'rio de janeiro';
}

export function isIlpiFederalTemplate(template: ChecklistTemplate): boolean {
  // 1. Match by static ID (bundled template)
  if (template.id === 'tpl-ilpi-federal-v1') return true;
  // 2. Match by name — Supabase-seeded templates have UUID IDs but keep the same name
  if (/ILPI.*Base Federal/i.test(template.name || '')) return true;
  // 3. Match by static section IDs (fallback for older bundled templates)
  return (
    template.category === 'ilpi' &&
    template.sections.some(section => section.id === 'sec-fed-01') &&
    template.sections.some(section => section.id === 'sec-fed-13')
  );
}

function isEsteticaClinicaTemplate(template: ChecklistTemplate): boolean {
  return template.id === 'tpl-estetica-clinica-v1'
    || template.name === 'Roteiro de Inspeção — Clínica de Estética e Saúde';
}

function isServicosSaudeTemplate(template: ChecklistTemplate): boolean {
  return template.id === 'tpl-saude-servicos-v1'
    || template.name === 'Roteiro de Inspeção — Serviços de Saúde (Base Federal)';
}

export function isAlimentosFederalTemplate(template: ChecklistTemplate): boolean {
  if (template.id === 'tpl-alimentos-federal-v1') return true;
  if (template.name === 'Roteiro de Inspeção — Serviços de Alimentação (Nacional)') return true;
  return (
    template.category === 'alimentos' &&
    template.sections.some(section => section.id === 'sec-ali-fed-01') &&
    template.sections.some(section => section.id === 'sec-ali-fed-11')
  );
}

export interface SupplementRegistryEntry {
  supplement: ChecklistSupplement;
  appliesTo: (baseTemplate: ChecklistTemplate, client: Client) => boolean;
  nameSuffix: string;
}

export const supplementRegistry: SupplementRegistryEntry[] = [
  // Único suplemento que serve a dois roteiros: a Lei nº 5.834/2001 de Petrópolis
  // alcança consultório e clínica médica (art. 2º, XXVII) e instituto e salão de
  // beleza (art. 2º, XXX) — a mesma base municipal para os dois segmentos.
  {
    supplement: suplementoPetropolis,
    appliesTo: (template, client) =>
      (isEsteticaClinicaTemplate(template) || isServicosSaudeTemplate(template))
      && isPetropolisClient(client),
    nameSuffix: ' (+ Suplemento Petrópolis/RJ)',
  },
  {
    supplement: suplementoAlimentosRioDeJaneiro,
    appliesTo: (template, client) => isAlimentosFederalTemplate(template) && isRioDeJaneiroCapitalClient(client),
    nameSuffix: ' (+ Suplemento Alimentos — Rio de Janeiro)',
  },
  {
    supplement: suplementoSaudeParauapebas,
    appliesTo: (template, client) => isEsteticaClinicaTemplate(template) && isParauapebasClient(client),
    nameSuffix: ' (+ Suplemento Parauapebas/PA)',
  },
  {
    supplement: suplementoEsteticaSpCapital,
    appliesTo: (template, client) => isEsteticaClinicaTemplate(template) && isSaoPauloCapitalClient(client),
    nameSuffix: ' (+ Suplemento São Paulo Capital)',
  },
  {
    // O único suplemento deste arquivo cujo alcance é o MUNICÍPIO, e não o estado.
    // O Decreto Rio nº 57.501/2026 é municipal: os arts. 7º e 8º e o art. 9º, § 8º
    // resolvem sublocação, autônomo no espaço de terceiro e coworking com uma
    // regra concreta que não vale no interior do estado. Convive com o
    // `suplementoEsteticaRj` porque tocam itens diferentes: aquele substitui o
    // est-001 (licença do estabelecimento), este o est-117 (licença de quem ocupa).
    supplement: suplementoCompartilhamentoRioCapital,
    appliesTo: (template, client) =>
      isEsteticaClinicaTemplate(template) && isRioDeJaneiroCapitalClient(client),
    nameSuffix: ' (+ Compartilhamento — Município do Rio)',
  },
  {
    // Petrópolis fica de fora: o suplemento municipal substitui o MESMO item de
    // licença (est-001), e os dois juntos deixariam o roteiro com dois itens de
    // licença. A exclusão também corrige um alcance velho — o item deste
    // suplemento cita o Decreto Rio nº 57.501/2026, que é do MUNICÍPIO do Rio de
    // Janeiro e nunca valeu no interior do estado.
    supplement: suplementoEsteticaRj,
    appliesTo: (template, client) =>
      isEsteticaClinicaTemplate(template) && isRioState(client.state) && !isPetropolisClient(client),
    nameSuffix: ' (+ Suplemento RJ)',
  },
  {
    supplement: templateIlpiGoiasSuplement,
    appliesTo: (template, client) => isIlpiFederalTemplate(template) && toUF(client.state) === 'GO',
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
