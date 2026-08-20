// ============================================================
// src/domain/applicability/context.ts
// COND-05 — o contexto congelado da inspeção.
//
// Congelado quer dizer: fotografado na criação da inspeção e nunca mais lido do
// cadastro vivo (contrato § 4 e § 6.2). Mudar o endereço do cliente amanhã não
// pode mexer na árvore de uma inspeção de ontem.
//
// Puro: sem relógio, sem rede, sem banco. A data de início chega por parâmetro —
// nunca `new Date()` aqui dentro, senão o congelamento deixaria de ser
// determinístico.
//
// Regra do contrato § 4.1 (não perguntar o que o sistema já sabe): tudo o que
// entra aqui é dado que o cadastro/wizard já tem. Pergunta de roteamento existe
// só para o que **não** dá para derivar deste objeto.
// ============================================================

import { toUF } from '../../utils/state';
import { isAbsent } from './schema';
import type { InspectionContext } from './schema';

/**
 * A origem do contexto, na forma frouxa em que os dados existem no app: `Client`
 * e `Inspection` misturam texto livre ("Goias", "rj "), número em string e campo
 * ausente. Normalizar é trabalho deste módulo, não de quem chama.
 */
export interface FrozenContextSource {
  /** `client.state` cru — texto livre. Vira sigla por `toUF()`. */
  state?: string | null;
  city?: string | null;
  category?: string | null;
  foodTypes?: readonly string[] | null;
  ilpiCapacity?: number | string | null;
  residentsTotal?: number | string | null;
  usableAreaM2?: number | string | null;
  /** Início da inspeção: o mesmo `createdAt` que fixa o corte de aposentados. */
  startedAt?: Date | string | null;
}

function texto(value: string | null | undefined): string | undefined {
  const limpo = (value || '').trim();
  return limpo === '' ? undefined : limpo;
}

function numero(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Data em texto ISO. `Date` vira ISO; texto que já parseia segue como veio (o
 * motor compara por instante, não por formato). Nada de `new Date()` aqui: ler o
 * relógio dentro do congelamento acabaria com o determinismo do pacote.
 */
function instante(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

/**
 * Monta o contexto congelado. As chaves são as de `CONTEXT_FIELDS` — o validador
 * recusa condição sobre chave que não esteja lá, então nomear errado aqui vira
 * erro visível, não regra silenciosamente falsa.
 *
 * **Campo ausente não vira valor:** ele simplesmente não entra no objeto. Dado
 * em branco é indeterminado (contrato § 4.1, última linha), nunca "assume não".
 */
export function buildInspectionContext(source: FrozenContextSource): InspectionContext {
  const context: InspectionContext = {};

  const uf = toUF(source.state);
  if (!isAbsent(uf)) context.uf = uf;

  const municipio = texto(source.city);
  if (municipio) context.municipio = municipio;

  const categoria = texto(source.category);
  if (categoria) context.categoria = categoria;

  const tipos = (source.foodTypes || []).map((tipo) => String(tipo).trim()).filter((tipo) => tipo !== '');
  if (tipos.length > 0) context.tiposDeAlimento = tipos;

  const capacidade = numero(source.ilpiCapacity);
  if (capacidade !== undefined) context.capacidadeIlpi = capacidade;

  const residentes = numero(source.residentsTotal);
  if (residentes !== undefined) context.residentesTotal = residentes;

  const area = numero(source.usableAreaM2);
  if (area !== undefined) context.areaUtilM2 = area;

  const inicio = instante(source.startedAt);
  if (inicio) context.inicioDaInspecao = inicio;

  return context;
}
