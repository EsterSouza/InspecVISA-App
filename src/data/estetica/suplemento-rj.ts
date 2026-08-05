import type { ChecklistSupplement } from '../../types';

export const suplementoEsteticaRj: ChecklistSupplement = {
  id: 'sup-estetica-rj-v1',
  name: 'Suplemento de Estética — Rio de Janeiro',
  baseTemplateId: 'tpl-estetica-clinica-v1',
  state: 'RJ',
  version: '08/2026',
  sectionAdditions: [
    {
      targetSectionId: 'sec-est-01',
      targetSectionTitle: 'Documentação e Regularização',
      items: [
        {
          id: 'rj-est-001',
          sectionId: 'sec-est-01',
          order: 1,
          description: 'Possui licença sanitária vigente e compatível com as atividades declaradas, solicitada em até 30 dias após a emissão do alvará e revalidada até o último dia útil de abril?',
          legislation: 'RDC Anvisa nº 63/2011, art. 10; Resolução SES/RJ nº 1.822/2019; Decreto Rio nº 57.501/2026, art. 9º',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-001',
        },
      ],
    },
  ],
};
