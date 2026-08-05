import { LEGISLATION_LIBRARY, type LegislationEntry } from '../data/legislationLibrary';

/** Segmento que é só referência a artigo/inciso/parágrafo, sem nomear ato algum. */
const ONLY_SUBREFERENCE = /^(?:art\.?|artigo|inciso|§|par[aá]grafo|item|subitem|cap[íi]tulo|anexo)\b[\s\d.,ºªivxlcIVXLC-]*$/i;

/**
 * Extrai apenas a legislacao base de um texto bruto, descartando sub-referencias
 * como alineas, incisos, artigos e paragrafos.
 */
export function extractBaseLegislation(raw: string): string[] {
  const bases = new Set<string>();

  for (const segment of raw.split(';')) {
    const s = segment.trim();
    if (!s) continue;

    const patterns = [
      // O número aceita ponto de milhar ("RE Anvisa nº 2.605/2006") e ano de 2 ou 4
      // dígitos ("RDC 216/04"), senão o ato é cortado no primeiro ponto.
      /\b(?:RDC|IN|RE|RN|RT)\s*(?:ANVISA\s*)?(?:n[oº.]?\s*)?([\d.]+)(?:[-/]\d{2,4})?/i,
      /\bPortaria\s+(?:(?:GM|SVS|MS|CVS|SES|SMS)[/\s]*)?(?:n[oº.]?\s*)?(\d[\d.]*(?:[-/]\d{2,4})?)/i,
      /\bLei\s+(?:Federal\s+|Estadual\s+|Municipal\s+|Complementar\s+|Ordin[aá]ria\s+)?(?:[A-Z]{2}\s+)?(?:n[oº.]?\s*)?([\d.]+(?:[-/]\d{2,4})?)/i,
      /\bDecreto(?:-Lei)?\s+(?:n[oº.]?\s*)?([\d.]+(?:[-/]\d{2,4})?)/i,
      /\bNR[.\s-]?(\d+)/i,
      /\bABNT\s+NBR\s+(\d+)/i,
      /\bInstru[cç][aã]o\s+Normativa\s+(?:n[oº.]?\s*)?(\d+(?:[-/]\d{2,4})?)/i,
      /\bNota\s+T[eé]cnica\b[^;,]*/i,
      /\bResolu[cç][aã]o\s+(?:n[oº.]?\s*)?([\d.]+(?:[-/]\d{2,4})?)/i,
    ];

    let matched = false;
    for (const pattern of patterns) {
      const match = s.match(pattern);
      if (!match) continue;

      const clean = match[0]
        .trim()
        .replace(/[,\s]+(al[íi]nea|inciso|artigo|art\.|§|par[aá]grafo|item|subitem|cap[íi]tulo).*/i, '')
        .trim();
      if (clean) bases.add(clean);
      matched = true;
      break;
    }

    if (!matched && s.length > 3 && !ONLY_SUBREFERENCE.test(s)) {
      const clean = s
        .replace(/[,\s]+(al[íi]nea|inciso|artigo|art\.|§|par[aá]grafo|item|subitem).*/i, '')
        .trim();
      if (clean && !ONLY_SUBREFERENCE.test(clean)) bases.add(clean);
    }
  }

  return Array.from(bases);
}

/**
 * Chave canônica de uma legislação, para deduplicar variações do mesmo ato
 * (ex.: "RDC 502/2021", "RDC ANVISA nº 502/2021", "RDC nº 502/2021" → mesma chave).
 * Reduz a tipo + número + ano, ignorando "ANVISA", "nº", artigos e acentos.
 */
export function canonicalLegislationKey(raw: string): string {
  const up = (raw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const typeMatch = up.match(/\bRDC\b|\bPORTARIA\b|\bDECRETO\b|\bLEI\b|\bNR\b|\bNBR\b|\bINSTRU[cC][aA]O NORMATIVA\b|\bIN\b|\bRESOLU[cC][aA]O\b|\bNOTA T[eE]CNICA\b|\bPARECER\b|\bCBO\b|\bRE\b/);
  const type = typeMatch ? typeMatch[0].replace(/\s+/g, ' ') : 'OUTRO';

  // Trecho a partir do tipo reconhecido — não do início da string. Um texto como
  // "Art. 276, Lei Municipal 1.812/2014" não pode ter o "276" do artigo
  // confundido com o número da lei.
  const searchFrom = typeMatch ? typeMatch.index! + typeMatch[0].length : 0;
  const tail = up.slice(searchFrom);

  // Ano de 4 dígitos quando existir; senão, ano de 2 dígitos colado ao número do
  // ato por barra ("Portaria SVS/MS nº 344/98", "Decreto-Rio 45585/18"). Exige-se
  // número de ato com 3+ dígitos e separador "/" para não ler "NR-32" nem
  // "CBO 5162-10" como ano.
  const yearMatch = up.match(/\b(19|20)\d{2}\b/);
  let year = yearMatch ? yearMatch[0] : '';
  if (!year) {
    const short = tail.match(/\d[\d.]{2,}\/(\d{2})\b/);
    if (short) {
      const yy = Number(short[1]);
      year = String(yy >= 30 ? 1900 + yy : 2000 + yy);
    }
  }

  // Número principal: primeira sequência de dígitos diferente do ano, sem ponto de
  // milhar e sem zeros à esquerda ("002/2020" e "2/2020" são o mesmo ato).
  const nums = (tail.match(/\d[\d.]*/g) || [])
    .map(n => n.replace(/\./g, '').replace(/^0+(?=\d)/, ''));
  const yearShort = year ? year.slice(2) : '';
  const number = nums.find(n => n !== year && n !== yearShort) || nums[0] || '';

  return `${type}|${number}|${year}`;
}

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

/** URL a exibir para um item de roteiro: override do item ou biblioteca. */
export function legislationUrlForItem(
  item: { legislation?: string | null; legislationUrl?: string | null }
): string | undefined {
  return item.legislationUrl || resolveLegislationUrl(item.legislation);
}
