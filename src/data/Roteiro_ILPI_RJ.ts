// ============================================================
// src/data/Roteiro_ILPI_RJ.ts
// SUPLEMENTO REGIONAL - ILPI RIO DE JANEIRO (RJ)
//
// Comportamento: complemento ao tpl-ilpi-federal-v1.
// Fonte legada da raiz usada apenas como referencia; este arquivo e o
// suplemento ativo, em UTF-8 limpo.
// ============================================================

import type { ChecklistSupplement } from '../types';

export const templateIlpiRioDeJaneiroSupplement: ChecklistSupplement = {
  id: 'sup-ilpi-rj-v1',
  name: 'Suplemento ILPI - Rio de Janeiro (RJ)',
  baseTemplateId: 'tpl-ilpi-federal-v1',
  state: 'RJ',
  version: '2024',

  sectionAdditions: [
    {
      targetSectionId: 'sec-fed-12',
      targetSectionTitle: 'Recursos Humanos',
      items: [
        {
          id: 'rj-s12-001',
          sectionId: 'sec-fed-12',
          order: 101,
          description: 'A instituicao conta com medico habilitado, com numero de registro profissional no CREMERJ.',
          legislation: 'Lei Estadual RJ 8.049/2018; CREMERJ Resolucao 192/2021',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
        {
          id: 'rj-s12-002',
          sectionId: 'sec-fed-12',
          order: 102,
          description: 'A instituicao conta com enfermeiro habilitado e registrado no conselho profissional competente.',
          legislation: 'Lei Estadual RJ 8.049/2018',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
        {
          id: 'rj-s12-003',
          sectionId: 'sec-fed-12',
          order: 103,
          description: 'A instituicao conta com tecnicos de enfermagem em quantidade compativel com o grau de dependencia dos residentes.',
          legislation: 'Lei Estadual RJ 8.049/2018; COREN/RJ',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
        {
          id: 'rj-s12-005',
          sectionId: 'sec-fed-12',
          order: 105,
          description: 'A instituicao conta com nutricionista habilitado para acompanhamento das rotinas de alimentacao e nutricao dos residentes.',
          legislation: 'Lei Estadual RJ 8.049/2018',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
        {
          id: 'rj-s12-006',
          sectionId: 'sec-fed-12',
          order: 106,
          description: 'A instituicao conta com psicologo habilitado para acompanhamento dos residentes.',
          legislation: 'Lei Estadual RJ 8.049/2018',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
        {
          id: 'rj-s12-007',
          sectionId: 'sec-fed-12',
          order: 107,
          description: 'A instituicao conta com fisioterapeuta habilitado para acompanhamento dos residentes.',
          legislation: 'Lei Estadual RJ 8.049/2018',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
        {
          id: 'rj-s12-008',
          sectionId: 'sec-fed-12',
          order: 108,
          description: 'A instituicao conta com profissional de assistencia social para acompanhamento dos residentes.',
          legislation: 'Lei Estadual RJ 8.049/2018',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
        {
          id: 'rj-s12-009',
          sectionId: 'sec-fed-12',
          order: 109,
          description: 'A instituicao conta com terapeuta ocupacional habilitado para acompanhamento dos residentes.',
          legislation: 'Lei Estadual RJ 8.049/2018',
          weight: 10,
          isCritical: true,
          isRJOnly: true,
        },
      ],
    },
    {
      targetSectionId: 'sec-fed-13',
      targetSectionTitle: 'Gestao e Documentacao',
      items: [
        {
          id: 'rj-s13-001',
          sectionId: 'sec-fed-13',
          order: 101,
          description: 'O dimensionamento da equipe considera a Lei Estadual RJ 8.049/2018, incluindo cuidadores e tecnicos de enfermagem por turno.',
          legislation: 'Lei Estadual RJ 8.049/2018',
          weight: 5,
          isCritical: false,
          isRJOnly: true,
        },
      ],
    },
  ],
};
