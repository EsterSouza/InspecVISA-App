// ============================================================
// src/domain/applicability/values.ts
// COND-02 — comparação de valores. Puro, determinístico, sem relógio.
// ============================================================

import { normalizeStateName } from '../../utils/state';
import type { ConditionValue, ValueType } from './schema';

/**
 * Normalizador de texto: sem acento, sem espaço nas bordas, sem caixa.
 * Reusa o de `utils/state` — o nome é de UF por acidente histórico, a função é
 * genérica e já é a que o app inteiro usa para casar texto digitado à mão.
 *
 * Comparação de texto normalizada é **decisão normativa** deste motor: o
 * cadastro é texto livre ("Goias", "sao paulo ", "RJ"), e as regras hardcoded de
 * hoje já normalizam antes de comparar (`supplementRegistry.ts`,
 * `templates.ts:normalizeSectionTitle`). Número, booleano e data comparam estrito.
 */
export function normalizeText(value: unknown): string {
  return normalizeStateName(String(value ?? ''));
}

/** Número a partir de número ou texto numérico. `null` quando não dá para ler. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Milissegundos de uma data ISO-8601. `null` quando não parseia. */
export function toTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/** Ordena escalares comparáveis. `null` quando algum lado não é legível. */
export function compareScalar(type: ValueType, a: unknown, b: unknown): number | null {
  if (type === 'date') {
    const left = toTimestamp(a);
    const right = toTimestamp(b);
    if (left === null || right === null) return null;
    return left === right ? 0 : left < right ? -1 : 1;
  }
  const left = toNumber(a);
  const right = toNumber(b);
  if (left === null || right === null) return null;
  return left === right ? 0 : left < right ? -1 : 1;
}

/** Igualdade por tipo: texto normalizado, número numérico, data por instante. */
export function equalScalar(type: ValueType, a: unknown, b: unknown): boolean {
  if (type === 'boolean') return toBoolean(a) === toBoolean(b);
  if (type === 'number' || type === 'date') return compareScalar(type, a, b) === 0;
  return normalizeText(a) === normalizeText(b);
}

export function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const text = normalizeText(value);
  if (text === 'TRUE' || text === 'SIM') return true;
  if (text === 'FALSE' || text === 'NAO') return false;
  return null;
}

export function asArray(value: ConditionValue | null | undefined): Array<string | number> {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || typeof value === 'boolean') return [];
  return [value];
}

/** Texto legível de um valor, para a explicação. */
export function describeValue(value: unknown): string {
  if (value === undefined || value === null) return '(vazio)';
  if (Array.isArray(value)) return value.length === 0 ? '(vazio)' : value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string' && value.trim() === '') return '(vazio)';
  return String(value);
}
