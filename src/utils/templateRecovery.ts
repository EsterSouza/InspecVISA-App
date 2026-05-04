import type { ChecklistTemplate, Inspection, InspectionResponse } from '../types';

export function buildRecoveryTemplate(
  inspection: Inspection,
  responses: InspectionResponse[]
): ChecklistTemplate {
  const items = responses
    .filter(response => response.itemId && !response.deletedAt)
    .map((response, index) => ({
      id: response.itemId,
      sectionId: 'sec-recovery-local',
      order: index + 1,
      description:
        response.customDescription ||
        response.situationDescription ||
        `Item recuperado localmente (${response.itemId})`,
      legislation: response.syncStatus === 'synced'
        ? undefined
        : `Status local: ${response.syncStatus || 'pendente'}`,
      weight: 1,
      isCritical: false,
    }));

  return {
    id: inspection.templateId,
    name: 'Roteiro local de recuperação',
    category: inspection.clientCategory || 'ilpi',
    version: 'local',
    sections: [
      {
        id: 'sec-recovery-local',
        title: 'Itens recuperados localmente',
        order: 1,
        items,
      },
    ],
  };
}
