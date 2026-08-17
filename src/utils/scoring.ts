import type { InspectionResponse, Section, InspectionScore, SectionScore, ScoreClassification, ChecklistItem } from '../types';

/**
 * MARP Calculation - Potential Risk Matrix
 * Scale 0-3 (Binary: Conforms=3, NotConforms=0)
 */
function calcMARPValues(items: ChecklistItem[], responseMap: Map<string, InspectionResponse>) {
  const binaryScore = (id: string) => {
    const res = responseMap.get(id);
    if (!res || (res.result as string) === 'not_evaluated') return 3;
    // Actually, if it's evaluated as not_complies, it's 0. In MARP binary, we assume not_applicable/not_observed as "neutral" (3) or we filter them out.
    // Let's filter out NA/NO from the items list before calling this or treat as 3.
    if (res.result === 'not_applicable' || res.result === 'not_observed') return 3;
    return res.result === 'complies' ? 3 : 0;
  };

  const criticals = items.filter((i: ChecklistItem) => i.isCritical);
  const nonCriticals = items.filter((i: ChecklistItem) => !i.isCritical);

  // 1. IC (Índice Crítico) - Média Geométrica
  let ic = 3; 
  if (criticals.length > 0) {
    const product = criticals.reduce((acc: number, item: ChecklistItem) => acc * binaryScore(item.id), 1);
    ic = Math.pow(product, 1 / criticals.length);
  }

  // 2. INC (Índice Não Crítico) - Média Aritmética Ponderada
  let inc = 3;
  if (nonCriticals.length > 0) {
    const activeNonCriticals = nonCriticals.filter((i: ChecklistItem) => {
      const r = responseMap.get(i.id);
      return !r || (r.result !== 'not_applicable' && r.result !== 'not_observed');
    });

    if (activeNonCriticals.length > 0) {
      const weightedSum = activeNonCriticals.reduce((acc: number, item: ChecklistItem) => {
        return acc + (binaryScore(item.id) * item.weight);
      }, 0);
      const totalWeight = activeNonCriticals.reduce((acc: number, item: ChecklistItem) => acc + item.weight, 0);
      inc = totalWeight > 0 ? weightedSum / totalWeight : 3;
    }
  }

  // 3. CR (Coeficiente de Risco)
  // Pesos normatizados: IC=0.6, INC=0.4
  const cr = (ic * 0.6) + (inc * 0.4);

  // 4. RP (Risco Potencial) - Escala 0 a 15
  // No MARP federal, o valor máximo é 15 (3.0 * 5)
  const rp = cr * 5;

  return { ic, inc, cr, rp };
}

function responseTime(response: InspectionResponse) {
  return response.updatedAt?.getTime?.() || response.createdAt?.getTime?.() || 0;
}

function scoreWeight(response: InspectionResponse) {
  return response.customItemMeta?.state === 'active'
    ? response.customItemMeta.weight
    : 1;
}

export function getLatestResponsesByItem(
  responses: InspectionResponse[],
  itemIds?: Set<string>
): InspectionResponse[] {
  const byItemId = new Map<string, InspectionResponse>();

  for (const response of responses) {
    if (!response?.itemId || response.deletedAt) continue;
    if (itemIds && !itemIds.has(response.itemId)) continue;

    const current = byItemId.get(response.itemId);
    if (!current || responseTime(response) >= responseTime(current)) {
      byItemId.set(response.itemId, response);
    }
  }

  return Array.from(byItemId.values());
}

/**
 * Main score calculation for the entire inspection
 */
export function calculateScore(responses: InspectionResponse[], sections: Section[]): InspectionScore {
  const allItems = sections.flatMap((s: Section) => s.items);
  const itemIds = new Set(allItems.map((i: ChecklistItem) => i.id));
  
  // ISOLATION: Only consider responses for items that exist in the CURRENT template sections
  // This avoids "ghost" responses from other templates or versions.
  const relevantResponses = getLatestResponsesByItem(responses, itemIds);

  const responseMap = new Map<string, InspectionResponse>(
    relevantResponses.map((r: InspectionResponse) => [r.itemId, r] as [string, InspectionResponse])
  );

  // Global counts for valid responses (Bug 3: items with no response or 'not_evaluated' are ignored here)
  const evaluatedResponses = relevantResponses.filter((r: InspectionResponse) => r.result && r.result !== 'not_evaluated');
  
  const compliesCount = evaluatedResponses.filter((r: InspectionResponse) => r.result === 'complies').length;
  const notCompliesCount = evaluatedResponses.filter((r: InspectionResponse) => r.result === 'not_complies').length;
  const criticalNotCompliesCount = evaluatedResponses.filter((r: InspectionResponse) => {
    if (r.result !== 'not_complies') return false;
    const item = allItems.find((i: ChecklistItem) => i.id === r.itemId);
    return item?.isCritical;
  }).length;
  
  const notApplicableCount = evaluatedResponses.filter((r: InspectionResponse) => r.result === 'not_applicable').length;
  const notObservedCount = evaluatedResponses.filter((r: InspectionResponse) => r.result === 'not_observed').length;
  
  // Bug 1: totalItems is strictly the items present in the composed sections (the 97)
  const totalItemsCount = allItems.length;
  
  // X / Y where X is the count of items with ANY definitive answer (C, NC, NA, NO)
  const evaluatedCount = evaluatedResponses.length;
  const notEvaluatedCount = Math.max(0, totalItemsCount - evaluatedCount);

  // Bug 2: scorePercentage denominator = only items that ARE C or NC (exclude NA/NO/Unanswered)
  const compliesPoints = evaluatedResponses
    .filter((r: InspectionResponse) => r.result === 'complies')
    .reduce((sum, response) => sum + scoreWeight(response), 0);
  const notCompliesPoints = evaluatedResponses
    .filter((r: InspectionResponse) => r.result === 'not_complies')
    .reduce((sum, response) => sum + scoreWeight(response), 0);
  const scoreDenominator = compliesPoints + notCompliesPoints;
  const scorePercentage = scoreDenominator > 0 ? (compliesPoints / scoreDenominator) * 100 : 0;

  // Global MARP calculation
  const globalMarp = calcMARPValues(allItems, responseMap);

  // Section-by-section MARP calculation
  const scoreBySection: SectionScore[] = sections.map((s: Section) => {
    const sectionItems = s.items;
    const sItemIds = new Set(sectionItems.map((i: ChecklistItem) => i.id));
    const sectionResponses = relevantResponses.filter((r: InspectionResponse) => sItemIds.has(r.itemId));
    
    const sEvaluated = sectionResponses.filter((r: InspectionResponse) => r.result && r.result !== 'not_evaluated');
    const sComplies = sEvaluated.filter((r: InspectionResponse) => r.result === 'complies').length;
    const sNotComplies = sEvaluated.filter((r: InspectionResponse) => r.result === 'not_complies').length;
    
    // Action-oriented counts
    const sUrgent = sEvaluated.filter((r: InspectionResponse) => {
      if (r.result !== 'not_complies') return false;
      const item = sectionItems.find((i: ChecklistItem) => i.id === r.itemId);
      return item?.isCritical; // Weight 10
    }).length;

    const sImportant = sEvaluated.filter((r: InspectionResponse) => {
      if (r.result !== 'not_complies') return false;
      const item = sectionItems.find((i: ChecklistItem) => i.id === r.itemId);
      return !item?.isCritical && (item?.weight || 0) >= 5; // Weight 5
    }).length;

    const sCriticalNC = sUrgent;
    
    const sCompliesPoints = sEvaluated
      .filter((r: InspectionResponse) => r.result === 'complies')
      .reduce((sum, response) => sum + scoreWeight(response), 0);
    const sNotCompliesPoints = sEvaluated
      .filter((r: InspectionResponse) => r.result === 'not_complies')
      .reduce((sum, response) => sum + scoreWeight(response), 0);
    const sDenom = sCompliesPoints + sNotCompliesPoints;
    
    const sectionMarp = calcMARPValues(sectionItems, responseMap);

    return {
      sectionId: s.id,
      sectionTitle: s.title,
      totalItems: sectionItems.length,
      evaluatedItems: sEvaluated.length,
      compliesCount: sComplies,
      notCompliesCount: sNotComplies,
      criticalNotCompliesCount: sCriticalNC,
      urgentActionsCount: sUrgent,
      importantActionsCount: sImportant,
      notApplicableCount: sEvaluated.filter((r: InspectionResponse) => r.result === 'not_applicable').length,
      notObservedCount: sEvaluated.filter((r: InspectionResponse) => r.result === 'not_observed').length,
      scorePercentage: sDenom > 0 ? (sCompliesPoints / sDenom) * 100 : 0,
      ...sectionMarp
    };
  });

  // Global counts
  const urgentActionsCount = scoreBySection.reduce((acc, s) => acc + s.urgentActionsCount, 0);
  const importantActionsCount = scoreBySection.reduce((acc, s) => acc + s.importantActionsCount, 0);

  // Classificação pelo % de conformidade. NCs críticas NÃO derrubam a unidade:
  // apenas impedem o selo de topo (uma casa com 92% nunca é "inaceitável";
  // as críticas aparecem separadamente como ações urgentes / plano de ação).
  const classification: ScoreClassification = (() => {
    const tier: ScoreClassification =
      scorePercentage >= 90 ? 'excellent' :
      scorePercentage >= 75 ? 'good' :
      scorePercentage >= 60 ? 'regular' : 'critical';
    // Havendo qualquer NC crítica, o máximo é "ACEITÁVEL" (não "ALTO PADRÃO").
    if (criticalNotCompliesCount > 0 && tier === 'excellent') return 'good';
    return tier;
  })();

  return {
    totalItems: totalItemsCount,
    evaluatedItems: evaluatedCount,
    compliesCount,
    notCompliesCount,
    criticalNotCompliesCount,
    urgentActionsCount,
    importantActionsCount,
    notApplicableCount,
    notObservedCount,
    notEvaluatedCount,
    scorePercentage,
    scoreBySection,
    classification,
    ...globalMarp
  };
}

/**
 * Separação por ÁREA de responsabilidade dentro de uma mesma inspeção ILPI:
 * a parte sanitária (avaliada pela consultora sanitária, ex.: Ester) e a parte
 * de nutrição/cozinha (avaliada pela nutricionista, ex.: Ana). O score GLOBAL
 * continua somando tudo junto (críticos e não-críticos das duas áreas); cada
 * área ganha seu próprio % e classificação MARP para acompanhamento.
 */
export type ConsultantArea = 'sanitary' | 'nutrition';

function normalizeSectionTitle(title: string): string {
  return (title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Uma seção é "de nutrição" (responsabilidade da nutricionista) quando trata de
 * serviço de nutrição, cozinha, refeitório ou dietética. No roteiro ILPI atual
 * isso casa "Serviço de Nutrição" e "Refeitório". Casa por TÍTULO normalizado
 * (ids são UUID e variam entre roteiros). Ver ilpi-roteiro-section-matching.
 */
export function isNutritionSection(title: string): boolean {
  const t = normalizeSectionTitle(title);
  return /nutri|cozinha|refeit|dietetic/.test(t);
}

export interface AreaScore {
  area: ConsultantArea;
  /** Rótulo da área ("Sanitária" / "Nutrição"). */
  areaLabel: string;
  /** Consultora que mais preencheu itens desta área (derivado de lastEditedBy). */
  consultant?: string;
  score: InspectionScore;
  /** true quando a área tem ao menos 1 item avaliado nesta inspeção. */
  hasResponses: boolean;
}

export interface InspectionAreaScores {
  global: InspectionScore;
  sanitary: AreaScore;
  nutrition: AreaScore;
  /** true quando ambas as áreas têm itens avaliados — vale exibir a separação. */
  isSplit: boolean;
}

const AREA_LABELS: Record<ConsultantArea, string> = {
  sanitary: 'Sanitária',
  nutrition: 'Nutrição',
};

/** Remove o sufixo de transferência ("(transf.)") usado em dados antigos. */
function cleanAuthorName(name?: string): string {
  return (name || '').replace(/\s*\(transf\.\)\s*/i, '').trim();
}

/** Consultora dominante (mais respostas autoradas) entre os itens informados. */
function dominantAuthor(responses: InspectionResponse[], itemIds: Set<string>): string | undefined {
  const counts = new Map<string, number>();
  for (const response of getLatestResponsesByItem(responses, itemIds)) {
    const name = cleanAuthorName(response.lastEditedBy);
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [name, n] of counts) {
    if (n > bestN) { best = name; bestN = n; }
  }
  return best;
}

/**
 * Conjunto de itemIds que pertencem a seções de nutrição em uma lista de seções.
 * Útil para atribuição por área fora do cálculo de score (ex.: dashboard).
 */
export function nutritionItemIds(sections: Section[]): Set<string> {
  const ids = new Set<string>();
  for (const section of sections) {
    if (!isNutritionSection(section.title)) continue;
    for (const item of section.items || []) ids.add(item.id);
  }
  return ids;
}

/**
 * Calcula o score global da inspeção e, separadamente, o score da parte
 * sanitária e da parte de nutrição. Reusa calculateScore sobre o subconjunto
 * de seções de cada área (mesma lógica MARP/%/classificação por área).
 */
export function calculateAreaScores(responses: InspectionResponse[], sections: Section[]): InspectionAreaScores {
  const nutritionSections = sections.filter((s) => isNutritionSection(s.title));
  const sanitarySections = sections.filter((s) => !isNutritionSection(s.title));

  const global = calculateScore(responses, sections);
  const sanitaryScore = calculateScore(responses, sanitarySections);
  const nutritionScore = calculateScore(responses, nutritionSections);

  const sanitaryItemIds = new Set(sanitarySections.flatMap((s) => s.items.map((i) => i.id)));
  const nutritionIds = new Set(nutritionSections.flatMap((s) => s.items.map((i) => i.id)));

  const sanitary: AreaScore = {
    area: 'sanitary',
    areaLabel: AREA_LABELS.sanitary,
    consultant: dominantAuthor(responses, sanitaryItemIds),
    score: sanitaryScore,
    hasResponses: sanitaryScore.evaluatedItems > 0,
  };
  const nutrition: AreaScore = {
    area: 'nutrition',
    areaLabel: AREA_LABELS.nutrition,
    consultant: dominantAuthor(responses, nutritionIds),
    score: nutritionScore,
    hasResponses: nutritionScore.evaluatedItems > 0,
  };

  return {
    global,
    sanitary,
    nutrition,
    isSplit: sanitary.hasResponses && nutrition.hasResponses,
  };
}

/**
 * Classificação derivada apenas do % de conformidade (sem dados de NC crítica).
 * Usada no Portal do Cliente, onde só temos o compliance_score. Mesmas faixas
 * de % da classificação completa (o "teto por crítica" não se aplica aqui).
 */
export function classificationFromPercent(pct: number): ScoreClassification {
  if (pct >= 90) return 'excellent';
  if (pct >= 75) return 'good';
  if (pct >= 60) return 'regular';
  return 'critical';
}

/**
 * Mesma classificação por %, mas aplicando o teto do `calculateScore`: havendo
 * NC crítica, o máximo é "ACEITÁVEL" (nunca "ALTO PADRÃO"). Usada no portal do
 * cliente/resumo de rede, onde agora temos o count de críticas junto com o score.
 */
export function classificationFromPercentAndCritical(pct: number, criticalCount: number): ScoreClassification {
  const tier = classificationFromPercent(pct);
  if (criticalCount > 0 && tier === 'excellent') return 'good';
  return tier;
}

export function classificationLabel(c: ScoreClassification): string {
  return { 
    critical: 'INACEITÁVEL', 
    regular: 'TOLERÁVEL', 
    good: 'ACEITÁVEL', 
    excellent: 'ALTO PADRÃO' 
  }[c];
}

/**
 * Paleta da nota. Decisão 27 do FE-23 (Artefato E): **quatro classificações,
 * três cores**. Os valores são os tokens da marca (`--danger` / `--amber` /
 * `--success` em docs/prototipos/_src/tokens.css), não a paleta padrão do
 * Tailwind que estava escrita aqui em hexadecimal.
 */
export const SCORE_COLORS = {
  danger: '#B3261E',
  attention: '#D99721',
  success: '#0E7A4A',
} as const;

/**
 * "Bom" e "excelente" compartilham o verde e se separam pela palavra e pelo
 * número — a faixa lima `#84CC16` não tinha equivalente na marca e some.
 * Nenhuma informação passa a depender só da cor (regra 2 do Manual 2.0): o
 * selo de classificação sempre acompanha o tom.
 */
export function classificationColor(c: ScoreClassification): string {
  return {
    critical: SCORE_COLORS.danger,
    regular: SCORE_COLORS.attention,
    good: SCORE_COLORS.success,
    excellent: SCORE_COLORS.success,
  }[c];
}

/**
 * Os mesmos três tons, na versão de **texto**. `--amber #D99721` é cor de
 * preenchimento: como texto sobre branco dá 2,5:1 e reprova AA. Número grande,
 * rótulo e selo usam estes tons escuros; barra e ponto continuam com o
 * `classificationColor`.
 */
export const SCORE_INK = {
  danger: '#8C1D17',
  attention: '#7A5210',
  success: '#0A5734',
} as const;

export function classificationInk(c: ScoreClassification): string {
  return {
    critical: SCORE_INK.danger,
    regular: SCORE_INK.attention,
    good: SCORE_INK.success,
    excellent: SCORE_INK.success,
  }[c];
}

/** Classes do selo de classificação: fundo suave + tinta escura, sempre AA. */
export function classificationBadgeClasses(c: ScoreClassification): string {
  return {
    critical: 'bg-danger-soft text-danger-soft-ink',
    regular: 'bg-amber-soft text-amber-soft-ink',
    good: 'bg-success-soft text-success-soft-ink',
    excellent: 'bg-success-soft text-success-soft-ink',
  }[c];
}
