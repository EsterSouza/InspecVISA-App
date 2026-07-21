/** Normaliza UF/nome de estado (remove acentos, espaços nas bordas, caixa) para comparação. */
export function normalizeStateName(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

export function isRioState(value?: string | null): boolean {
  const normalized = normalizeStateName(value);
  return normalized === 'RJ' || normalized === 'RIO DE JANEIRO';
}
