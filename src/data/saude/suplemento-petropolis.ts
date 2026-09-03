import type { ChecklistSupplement } from '../../types';

// ============================================================
// Suplemento municipal de Petrópolis/RJ
//
// Serve a DOIS roteiros: "Clínica de Estética e Saúde" e "Serviços de Saúde
// (Base Federal)". Isso é possível porque `applySupplement`
// (src/data/templates.ts) casa a seção de destino por id **ou por título**, e as
// seções herdadas dos dois roteiros têm exatamente os mesmos títulos.
//
// A base municipal também é a mesma para os dois: a Lei nº 5.834/2001 põe no
// art. 2º, XXVII os consultórios e clínicas médicas e no art. 2º, XXX os
// institutos e salões de beleza — um único código sanitário alcança o serviço
// de saúde e o de estética em Petrópolis.
//
// `baseTemplateId` fica no roteiro de estética por ser o mais antigo dos dois;
// quem decide a aplicação é o predicado do supplementRegistry, não este campo
// (nenhum código o lê — conferido em 03/09/2026).
//
// O item de licença usa `replacesItemId: 'est-001'`. No roteiro de saúde o id
// 'est-001' não existe, mas `applySupplement` resolve o equivalente pelo TEXTO
// normalizado do item — e `sau-001` foi escrito com a descrição idêntica à do
// `est-001` justamente para isso.
// ============================================================

export const suplementoPetropolis: ChecklistSupplement = {
  id: 'sup-petropolis-rj-v1',
  name: 'Suplemento Municipal — Petrópolis/RJ',
  baseTemplateId: 'tpl-estetica-clinica-v1',
  state: 'RJ',
  municipality: 'Petrópolis',
  version: '09/2026',
  sectionAdditions: [
    {
      targetSectionId: 'sec-est-01',
      targetSectionTitle: 'Documentação e Regularização',
      items: [
        {
          id: 'petro-001',
          sectionId: 'sec-est-01',
          order: 1,
          description: 'Possui Licença Sanitária vigente emitida pela Vigilância Sanitária de Petrópolis, compatível com as atividades declaradas?',
          legislation: 'Lei Municipal nº 5.834/2001 - Petrópolis, arts. 2º e 13; Resolução SES/RJ nº 1.058/2014',
          weight: 10,
          isCritical: true,
          replacesItemId: 'est-001',
        },
        {
          id: 'petro-002',
          sectionId: 'sec-est-01',
          order: 2,
          description: 'A atividade foi enquadrada por CNAE e grau de risco na classificação estadual, observada a vistoria prévia exigida para atividade de alto risco?',
          legislation: 'Resolução SES/RJ nº 2.191/2020, art. 3º',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'petro-003',
          sectionId: 'sec-est-01',
          order: 3,
          description: 'A taxa de inspeção sanitária municipal está quitada no exercício, observado o vencimento no último dia útil de julho?',
          legislation: 'Lei Municipal nº 5.834/2001 - Petrópolis, arts. 12 a 14',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'petro-004',
          sectionId: 'sec-est-01',
          order: 4,
          description: 'A construção, instalação ou reforma do estabelecimento foi submetida à Vigilância Sanitária municipal antes de o serviço entrar em funcionamento?',
          legislation: 'Lei Municipal nº 5.834/2001 - Petrópolis, art. 7º, III; RDC Anvisa nº 51/2011',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'petro-005',
          sectionId: 'sec-est-01',
          order: 5,
          description: 'A edificação ocupada possui licença de obras e Habite-se, ou processo municipal correspondente em andamento?',
          legislation: 'Lei Municipal nº 8.713/2024 - Petrópolis, arts. 55 a 58',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'petro-006',
          sectionId: 'sec-est-01',
          order: 6,
          description: 'As alterações de endereço e de responsável técnico são comunicadas à Vigilância Sanitária municipal pelo procedimento fixado em resolução da Secretaria?',
          legislation: 'Lei Municipal nº 5.834/2001 - Petrópolis, art. 13, § 6º',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'petro-007',
          sectionId: 'sec-est-01',
          order: 7,
          description: 'Mantém arquivadas as notificações e os autos de infração da Vigilância Sanitária municipal, com evidência do atendimento dentro do prazo de 45 dias?',
          legislation: 'Lei Municipal nº 5.834/2001 - Petrópolis, arts. 4º e 8º',
          weight: 5,
          isCritical: false,
        },
      ],
    },
    {
      targetSectionId: 'sec-est-03',
      targetSectionTitle: 'Infraestrutura Física',
      items: [
        {
          id: 'petro-008',
          sectionId: 'sec-est-03',
          order: 30,
          description: 'Os compartimentos de permanência prolongada possuem pé-direito mínimo de 2,60 m, e os de permanência transitória, de 2,40 m?',
          legislation: 'Lei Municipal nº 8.713/2024 - Petrópolis, arts. 132 e 133',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'petro-009',
          sectionId: 'sec-est-03',
          order: 31,
          description: 'Quando há mezanino ou jirau, a altura livre acima dele é de no mínimo 2,20 m e a projeção ocupa no máximo 50% da área do piso do compartimento?',
          legislation: 'Lei Municipal nº 8.713/2024 - Petrópolis, art. 134',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'petro-010',
          sectionId: 'sec-est-03',
          order: 32,
          description: 'A edificação promove acessibilidade conforme a NBR 9050, e os banheiros de uso público ou coletivo atendem à norma técnica?',
          legislation: 'Lei Municipal nº 8.713/2024 - Petrópolis, arts. 88 e 131; ABNT NBR 9050',
          weight: 5,
          isCritical: false,
        },
      ],
    },
    {
      targetSectionId: 'sec-est-11',
      targetSectionTitle: 'Requisitos Gerais',
      items: [
        {
          id: 'petro-011',
          sectionId: 'sec-est-11',
          order: 40,
          description: 'O letreiro, a publicidade externa e a ocupação do passeio observam as exigências do Código de Posturas do Município?',
          legislation: 'Lei Municipal nº 6.240/2005 - Petrópolis',
          weight: 2,
          isCritical: false,
          requirementType: 'good_practice',
        },
      ],
    },
  ],
};
