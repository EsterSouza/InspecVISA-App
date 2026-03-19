import type { InspectionResponse, Section, InspectionScore, SectionScore, ScoreClassification } from '../types';

export function calculateScore(
  responses: InspectionResponse[],
  sections: Section[]
): InspectionScore {
  const responseMap = new Map(responses.map(r => [r.itemId, r]));
  const allItems = sections.flatMap(s => s.items);

  const compliesCount = responses.filter(r => r.result === 'complies').length;
  const notCompliesCount = responses.filter(r => r.result === 'not_complies').length;
  const notApplicableCount = responses.filter(r => r.result === 'not_applicable').length;
  const notEvaluatedCount = allItems.length - responses.filter(r => r.result !== 'not_evaluated').length;
  const evaluatedItems = responses.filter(r => r.result !== 'not_evaluated').length;

  const denominator = compliesCount + notCompliesCount;
  const scorePercentage = denominator > 0 ? (compliesCount / denominator) * 100 : 0;

  const classification: ScoreClassification =
    scorePercentage < 50 ? 'critical' :
    scorePercentage < 70 ? 'regular' :
    scorePercentage < 90 ? 'good' : 'excellent';

  const scoreBySection: SectionScore[] = sections.map((section: Section) => {
    const sectionItems = section.items;
    const sectionResponses = sectionItems.map((i: any) => responseMap.get(i.id)).filter(Boolean) as InspectionResponse[];
    const sComplies = sectionResponses.filter(r => r.result === 'complies').length;
    const sNotComplies = sectionResponses.filter(r => r.result === 'not_complies').length;
    const sNA = sectionResponses.filter(r => r.result === 'not_applicable').length;
    const sDenom = sComplies + sNotComplies;
    return {
      sectionId: section.id,
      sectionTitle: section.title,
      totalItems: sectionItems.length,
      evaluatedItems: sectionResponses.length,
      compliesCount: sComplies,
      notCompliesCount: sNotComplies,
      notApplicableCount: sNA,
      scorePercentage: sDenom > 0 ? (sComplies / sDenom) * 100 : 0,
    };
  });

  return {
    totalItems: allItems.length,
    evaluatedItems,
    compliesCount,
    notCompliesCount,
    notApplicableCount,
    notEvaluatedCount,
    scorePercentage,
    scoreBySection,
    classification,
  };
}

export function classificationLabel(c: ScoreClassification): string {
  return { critical: 'CRÍTICO', regular: 'REGULAR', good: 'BOM', excellent: 'EXCELENTE' }[c];
}

export function classificationColor(c: ScoreClassification): string {
  return {
    critical: '#EF4444',
    regular: '#F59E0B',
    good: '#84CC16',
    excellent: '#22C55E',
  }[c];
}
