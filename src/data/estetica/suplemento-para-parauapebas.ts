import type { ChecklistSupplement } from '../../types';

/**
 * Suplemento de serviço de saúde de Parauapebas/PA.
 *
 * O licenciamento em Parauapebas é municipal: o Código Sanitário do Município
 * (Lei Complementar nº 8/2016) trata consultório privado como estabelecimento de
 * serviço de saúde (art. 19, I) e o Alvará Sanitário é ato privativo do órgão
 * sanitário municipal (arts. 13, I e 14). O Decreto Estadual PA nº 3.614/2023
 * entra como a regra estadual de validade da licença — a mesma de um ano do
 * art. 36 municipal —, e não como licenciamento paralelo.
 *
 * O art. 28 do Código Sanitário municipal ficou **de fora**. O caput fala em
 * "radiações ionizante e não ionizante", o que à primeira leitura alcançaria o
 * laser de fotobiomodulação, mas os incisos amarram o artigo ao radiodiagnóstico:
 * obedecer às normas da CNEN (II) e dispor de envoltórios radioprotetores (III)
 * não tem como ser cumprido com um laser terapêutico. Cobrar cadastro e
 * autorização desse equipamento com base nesse artigo produzia achado falso. A
 * regularização Anvisa do equipamento continua sendo cobrada pelo roteiro-base
 * (est-063), junto com manutenção e calibração.
 *
 * Quatro itens existem por causa do arranjo de consultório **sublocado dentro de
 * outra clínica**, que é a situação da unidade que originou este suplemento:
 * responsabilidade técnica única (art. 23, § 4º), contrato da sala e dos apoios
 * compartilhados, abrigo de resíduos do prédio e reservatório de água do prédio.
 * Estrutura compartilhada não transfere a obrigação: ela continua sendo do
 * serviço inspecionado, que precisa comprová-la.
 */
export const suplementoSaudeParauapebas: ChecklistSupplement = {
  id: 'sup-saude-parauapebas-v1',
  name: 'Suplemento de Serviço de Saúde — Parauapebas/PA',
  baseTemplateId: 'tpl-estetica-clinica-v1',
  state: 'PA',
  municipality: 'Parauapebas',
  version: '08/2026',
  sectionAdditions: [
    {
      targetSectionId: 'sec-est-01',
      targetSectionTitle: 'Documentação e Regularização',
      items: [
        {
          id: 'pbs-est-001',
          sectionId: 'sec-est-01',
          order: 1,
          description: 'Possui Alvará Sanitário municipal vigente, com validade de um ano contada da emissão, afixado em local de fácil visualização, e requereu a renovação nos 120 dias anteriores ao vencimento?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 36; Decreto Estadual PA nº 3.614/2023',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-001',
        },
        {
          id: 'pbs-est-002',
          sectionId: 'sec-est-01',
          order: 3,
          description: 'O responsável técnico permanece presente durante todo o horário de funcionamento, tem nome e inscrição profissional nas placas e anúncios, e responde como responsabilidade técnica única perante a autoridade sanitária, ainda que atuem nas dependências profissionais autônomos ou empresas prestadoras?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 23',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-003',
        },
        {
          id: 'pbs-est-003',
          sectionId: 'sec-est-01',
          order: 4,
          description: 'O consultório de enfermagem mantém registro no Conselho Regional de Enfermagem com jurisdição sobre o local de funcionamento?',
          legislation: 'Resolução COFEN nº 568/2018, art. 2º',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'pbs-est-004',
          sectionId: 'sec-est-01',
          order: 10,
          description: 'A instalação ou a reforma do ambiente foi precedida de autorização da autoridade sanitária municipal, com aprovação do projeto arquitetônico, inclusive quando houve mudança de fluxo ou de função de área já aprovada?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 27; RDC Anvisa nº 50/2002',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-010',
        },
        {
          id: 'pbs-est-005',
          sectionId: 'sec-est-01',
          order: 14,
          description: 'Quando ocupa sala em imóvel de terceiro, apresenta o contrato de locação ou sublocação e a cobertura documentada dos apoios compartilhados — abrigo de resíduos, DML, limpeza, controle de pragas e reservatório de água —, com identificação e regularidade de quem os executa?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 21; RDC Anvisa nº 63/2011',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-014',
        },
      ],
    },
    {
      targetSectionId: 'sec-est-02',
      targetSectionTitle: 'Saúde e Segurança do Trabalhador',
      items: [
        {
          id: 'pbs-est-020',
          sectionId: 'sec-est-02',
          order: 7,
          description: 'Dispõe do atestado de saúde ocupacional ou do exame que a autoridade sanitária pode exigir de quem exerce atividade no estabelecimento, inclusive do profissional que atua sem vínculo empregatício?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 22',
          weight: 5,
          isCritical: false,
        },
      ],
    },
    {
      targetSectionId: 'sec-est-07',
      targetSectionTitle: 'Equipamentos e Produtos',
      items: [
        {
          id: 'pbs-est-031',
          sectionId: 'sec-est-07',
          order: 11,
          description: 'Mantém o controle e o registro dos medicamentos sob regime especial empregados nos procedimentos, na forma da legislação vigente?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 21; Portaria SVS/MS nº 344/1998 e suas atualizações',
          weight: 5,
          isCritical: false,
          replacesItemId: 'est-073',
        },
      ],
    },
    {
      targetSectionId: 'sec-est-08',
      targetSectionTitle: 'Gestão de Resíduos',
      items: [
        {
          id: 'pbs-est-040',
          sectionId: 'sec-est-08',
          order: 8,
          description: 'Quando o abrigo de resíduos é do prédio ou da clínica que sedia o serviço, o PGRSS identifica esse abrigo e o serviço guarda os comprovantes de coleta e destinação do que ele próprio gerou?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 21; RDC Anvisa nº 222/2018',
          weight: 10,
          isCritical: true,
        },
      ],
    },
    {
      targetSectionId: 'sec-est-09',
      targetSectionTitle: 'Controle de Vetores e Qualidade da Água',
      items: [
        {
          id: 'pbs-est-050',
          sectionId: 'sec-est-09',
          order: 1,
          description: 'O controle integrado de pragas urbanas é executado por entidade especializada regularizada e o relatório fica disponível para apresentação ao fiscal sanitário quando solicitado?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 21; RDC Anvisa nº 63/2011, art. 23',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-085',
        },
        {
          id: 'pbs-est-051',
          sectionId: 'sec-est-09',
          order: 2,
          description: 'A limpeza e a desinfecção do reservatório de água ocorrem em intervalo não superior a seis meses e têm registro acessível, ainda que o reservatório seja do prédio?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 21; RDC Anvisa nº 63/2011, art. 39',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-086',
        },
      ],
    },
    {
      targetSectionId: 'sec-est-11',
      targetSectionTitle: 'Requisitos Gerais',
      items: [
        {
          id: 'pbs-est-060',
          sectionId: 'sec-est-11',
          order: 19,
          description: 'O ambiente fechado sem climatização artificial dispõe de sistema de renovação de ar filtrado?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 24',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'pbs-est-061',
          sectionId: 'sec-est-11',
          order: 20,
          description: 'O estabelecimento permanece livre de entulho e de materiais e produtos alheios à atividade?',
          legislation: 'Lei Complementar nº 8/2016 - Parauapebas, art. 21',
          weight: 5,
          isCritical: false,
        },
      ],
    },
  ],
};
