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
      /\b(?:RDC|IN|RE|RN|RT)\s*(?:ANVISA\s*)?(?:n[oº.]?\s*)?(\d+)(?:[-/]\d{4})?/i,
      /\bPortaria\s+(?:(?:GM|SVS|MS|CVS|SES|SMS)[/\s]*)?(?:n[oº.]?\s*)?(\d[\d.]*(?:[-/]\d{4})?)/i,
      /\bLei\s+(?:Federal\s+|Estadual\s+|Complementar\s+)?(?:n[oº.]?\s*)?([\d.]+(?:[-/]\d{4})?)/i,
      /\bDecreto(?:-Lei)?\s+(?:n[oº.]?\s*)?([\d.]+(?:[-/]\d{4})?)/i,
      /\bNR[.\s-]?(\d+)/i,
      /\bABNT\s+NBR\s+(\d+)/i,
      /\bInstru[cç][aã]o\s+Normativa\s+(?:n[oº.]?\s*)?(\d+(?:[-/]\d{4})?)/i,
      /\bNota\s+T[eé]cnica\b[^;,]*/i,
      /\bResolu[cç][aã]o\s+(?:n[oº.]?\s*)?([\d.]+(?:[-/]\d{4})?)/i,
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

    if (!matched && s.length > 3) {
      const clean = s
        .replace(/[,\s]+(al[íi]nea|inciso|artigo|art\.|§|par[aá]grafo|item|subitem).*/i, '')
        .trim();
      if (clean) bases.add(clean);
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

  const typeMatch = up.match(/\bRDC\b|\bPORTARIA\b|\bDECRETO\b|\bLEI\b|\bNR\b|\bNBR\b|\bINSTRU[cC][aA]O NORMATIVA\b|\bIN\b|\bRESOLU[cC][aA]O\b|\bNOTA T[eE]CNICA\b|\bPARECER\b|\bCBO\b/);
  const type = typeMatch ? typeMatch[0].replace(/\s+/g, ' ') : 'OUTRO';

  const yearMatch = up.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';

  // Número principal: primeira sequência de dígitos diferente do ano.
  const nums = (up.match(/\d[\d.]*/g) || []).map(n => n.replace(/\./g, ''));
  const number = nums.find(n => n !== year) || nums[0] || '';

  return `${type}|${number}|${year}`;
}
