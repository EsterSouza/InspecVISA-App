/** Normaliza UF/nome de estado (remove acentos, espaços nas bordas, caixa) para comparação. */
export function normalizeStateName(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

/** Nome do estado (já normalizado, sem acento) → sigla. */
const NAME_TO_UF: Record<string, string> = {
  ACRE: 'AC', ALAGOAS: 'AL', AMAPA: 'AP', AMAZONAS: 'AM', BAHIA: 'BA',
  CEARA: 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES', GOIAS: 'GO',
  MARANHAO: 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG', PARA: 'PA', PARAIBA: 'PB', PARANA: 'PR',
  PERNAMBUCO: 'PE', PIAUI: 'PI', 'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', RONDONIA: 'RO',
  RORAIMA: 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP', SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

/** Siglas válidas, para reconhecer o valor que já vem como UF. */
const UF_SET = new Set(Object.values(NAME_TO_UF));

/** Lista para popular selects de estado, na ordem alfabética do nome. */
export const UF_OPTIONS: { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' }, { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' }, { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' }, { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' }, { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' },
];

/**
 * Sigla da UF a partir de sigla ou nome por extenso, tolerando acento, caixa e
 * espaços. `client.state` é texto livre de origem ("Goias", "Sao Paulo", "rj "),
 * então comparar a string crua perde a legislação estadual do relatório.
 * Devolve '' quando não reconhece.
 */
export function toUF(value?: string | null): string {
  const normalized = normalizeStateName(value);
  if (UF_SET.has(normalized)) return normalized;
  return NAME_TO_UF[normalized] || '';
}

export function isRioState(value?: string | null): boolean {
  return toUF(value) === 'RJ';
}
