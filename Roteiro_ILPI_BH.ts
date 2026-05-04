// ============================================================
// src/data/Roteiro_ILPI_BH.ts
// SUPLEMENTO REGIONAL — ILPI BELO HORIZONTE (MG)
//
// Comportamento: complemento ao tpl-ilpi-federal-v1
//   • sectionAdditions → itens adicionados a seções federais existentes,
//     quando BH exige algo não coberto pela base federal
//   • newSections → seções inteiramente novas sem equivalente federal
//
// Base normativa municipal/estadual:
//   Lei Municipal nº 7.031/1996 (Código Sanitário Municipal BH)
//   Decreto nº 17.944/2022 (Procedimentos de Licenciamento Sanitário BH)
//   Portaria SMS/BH nº 12/2015 (Padrão mínimo de funcionamento de ILPIs em BH)
//   Portaria SMSA/SUS-BH nº 0221/2022 (Licenciamento sanitário BH)
//   Roteiro de Vistoria Fiscal DVSA/SMSA — RVF_DVSA_90_VS (revisão ago/2022)
//
// Legislação federal referenciada (itens ausentes na base federal):
//   RDC ANVISA nº 502/2021 — artigos cobrados especificamente por BH
//   Resoluções COFEN (358/2009, 450/2013, 557/2017, 619/2019, 620/2019,
//     746/2024, 787/2025)
//   Decreto Federal nº 94.406/1987 (Lei do Exercício de Enfermagem)
//
// Criticidade (alinhada ao RVF_DVSA_90_VS):
//   CRÍTICO  → isCritical: true  | weight: 10
//   MAIOR    → isCritical: false | weight: 5
//   MENOR    → isCritical: false | weight: 2
// ============================================================

import type { ChecklistSupplement } from '../types';

export const templateIlpiBeloHorizonteSupplement: ChecklistSupplement = {
  id: 'sup-ilpi-bh-v1',
  name: 'Suplemento ILPI — Belo Horizonte (MG)',
  baseTemplateId: 'tpl-ilpi-federal-v1',
  version: '2024',

  sectionAdditions: [

    // ── ADIÇÕES À SEÇÃO FEDERAL: Estrutura Física Geral (sec-fed-01) ─────────
    // Itens exigidos pela PM 012/15 não cobertos pela RDC 502/2021 federal.
    {
      targetSectionId: 'sec-fed-01',
      items: [
        {
          id: 'bh-s01-001',
          sectionId: 'sec-fed-01',
          order: 15,
          description: 'Possui placa de identificação externa visível, atendendo à legislação vigente.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 5, §único',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s01-002',
          sectionId: 'sec-fed-01',
          order: 16,
          // Classificação CRÍTICO no RVF_DVSA_90_VS item 477
          description: 'Os acessos ao estabelecimento possuem cobertura apropriada para proteção do idoso contra a chuva.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 8, XV',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-s01-003',
          sectionId: 'sec-fed-01',
          order: 17,
          description: 'Há pátio externo para exposição dos idosos à luz solar e área verde.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 8, V',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s01-004',
          sectionId: 'sec-fed-01',
          order: 18,
          description: 'A iluminação e ventilação são suficientes para garantir o conforto térmico e visual para as atividades desenvolvidas em todos os ambientes.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 8, II; RDC 502/21 Art. 24, II',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s01-005',
          sectionId: 'sec-fed-01',
          order: 19,
          // PM 012/15 detalha mobiliário e equipamentos que a RDC 502 não especifica
          description: 'Há cômodo de convivência interior coberto, mobiliado confortavelmente com televisão, poltronas, mesas e demais instrumentos que favoreçam a socialização dos idosos, todos em bom estado de conservação.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 8, IV',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s01-006',
          sectionId: 'sec-fed-01',
          order: 20,
          // Classificação CRÍTICO no RVF_DVSA_90_VS item 10268
          description: 'A instituição oferece condições de higiene, salubridade, segurança e cuidado para com os idosos em todos os setores, procedimentos, equipamentos e utensílios.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 22; RDC 502/21 Art. 29, IX',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── ADIÇÕES À SEÇÃO FEDERAL: Dormitórios (sec-fed-02) ───────────────────
    {
      targetSectionId: 'sec-fed-02',
      items: [
        {
          id: 'bh-s02-001',
          sectionId: 'sec-fed-02',
          order: 7,
          // Classificação CRÍTICO no RVF_DVSA_90_VS item 10269
          description: 'As camas hospitalares destinadas a idosos com grau de dependência III e acamados possuem acoplamento para grade de proteção, em bom estado de conservação.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 10, II',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-s02-002',
          sectionId: 'sec-fed-02',
          order: 8,
          description: 'Os móveis de quarto estão em bom estado de conservação, com armários de compartimentos individuais em cada dormitório, com dimensões compatíveis para guarda de pertences pessoais do idoso.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 10, V',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s02-003',
          sectionId: 'sec-fed-02',
          order: 9,
          description: 'Cada leito está identificado com o nome do idoso.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 10, VII',
          weight: 2,
          isCritical: false,
        },
        {
          id: 'bh-s02-004',
          sectionId: 'sec-fed-02',
          order: 10,
          description: 'Existem dispositivos para facilitar a orientação do idoso, de fácil visualização e devidamente atualizados: relógio, calendário, cartaz com a data atual, lista de aniversariantes e cronograma de atividades semanais.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 10, VIII',
          weight: 2,
          isCritical: false,
        },
      ],
    },

    // ── ADIÇÕES À SEÇÃO FEDERAL: Banheiros (sec-fed-03) ─────────────────────
    // PM 012/15 é significativamente mais detalhada que a RDC 502/2021 neste ponto.
    {
      targetSectionId: 'sec-fed-03',
      items: [
        {
          id: 'bh-s03-001',
          sectionId: 'sec-fed-03',
          order: 5,
          // Classificação MAIOR no RVF_DVSA_90_VS item 10519
          description: 'As instalações sanitárias possuem paredes revestidas de cerâmica de cor clara, com altura mínima de 2 metros, e teto liso de cor clara.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 8, XVIII; RDC 502/21 Art. 29, I',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s03-002',
          sectionId: 'sec-fed-03',
          order: 6,
          // Classificação MAIOR no RVF_DVSA_90_VS item 487
          // PM 012/15 especifica proporção 1:10 e lista de insumos que a RDC 502 não detalha
          description: 'Há 1 (uma) instalação sanitária para cada grupo de 10 idosos, contendo: 1 vaso sanitário com tampa, papel higiênico, ducha higiênica, lavabo com papel toalha e sabonete líquido.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 9, I',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s03-003',
          sectionId: 'sec-fed-03',
          order: 7,
          // Classificação CRÍTICO no RVF_DVSA_90_VS item 488
          // BH adiciona exigência do mesmo pavimento, ausente na federal
          description: 'Os sanitários são separados por sexo e estão instalados no mesmo pavimento onde permanecem os idosos atendidos.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 9, II; RDC 502/21 Art. 29, XIII, a',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-s03-004',
          sectionId: 'sec-fed-03',
          order: 8,
          // Classificação MAIOR no RVF_DVSA_90_VS item 489
          description: 'As portas dos sanitários não possuem dispositivo de tranca.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 9, III; RDC 502/21 Art. 29, IV',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s03-005',
          sectionId: 'sec-fed-03',
          order: 9,
          // Classificação MAIOR no RVF_DVSA_90_VS item 491
          description: 'Os vasos sanitários possuem assentos elevadores ("elevadores de vaso"), em material adequado e impermeável, na proporção de 1 (um) para cada grupo de 10 idosos.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 9, V',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s03-006',
          sectionId: 'sec-fed-03',
          order: 10,
          // Classificação MAIOR no RVF_DVSA_90_VS item 493
          description: 'Há 1 (um) chuveiro para cada 12 idosos, obrigatoriamente dotado de água quente e fria.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 9, VI',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'bh-s03-007',
          sectionId: 'sec-fed-03',
          order: 11,
          // Classificação CRÍTICO no RVF_DVSA_90_VS item 496
          // Ausente na RDC 502/2021
          description: 'O banho dos idosos dependentes é obrigatoriamente acompanhado por um funcionário, de forma a prevenir acidentes.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 9, VII',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-s03-008',
          sectionId: 'sec-fed-03',
          order: 12,
          // Classificação CRÍTICO no RVF_DVSA_90_VS item 10266
          // A federal (fed-021) cobre barras em geral; BH inspeciona chuveiros especificamente
          description: 'Os chuveiros são dotados de barras de apoio instaladas conforme a NBR 9050.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 9, IV; NBR 9050',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── ADIÇÕES À SEÇÃO FEDERAL: Assistência Integral ao Residente (sec-fed-08)
    {
      targetSectionId: 'sec-fed-08',
      items: [
        {
          id: 'bh-s08-001',
          sectionId: 'sec-fed-08',
          order: 11,
          description: 'A ILPI cumpre todos os requisitos de prevenção a doenças infectocontagiosas, incluindo protocolos ativos para controle de surtos (COVID-19 e outras), conforme determinação vigente da vigilância sanitária e epidemiológica.',
          legislation: 'LM 7031/96 Art. 97, IV; RDC 502/21 Art. 37, III',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-s08-002',
          sectionId: 'sec-fed-08',
          order: 12,
          description: 'Respeita a proibição de admissão de residentes com menos de 60 (sessenta) anos de idade.',
          legislation: 'LM 7031/96 Art. 97, IV; PM 012/15 Art. 6, I; Lei 10.741/2003 Art. 1º',
          weight: 2,
          isCritical: false,
        },
      ],
    },

    // ── ADIÇÕES À SEÇÃO FEDERAL: SST (sec-fed-09) ───────────────────────────
    {
      targetSectionId: 'sec-fed-09',
      items: [
        {
          id: 'bh-s09-001',
          sectionId: 'sec-fed-09',
          order: 5,
          // BH inspeciona a separação por sexo explicitamente; federal cobre vestiário de forma genérica
          description: 'Possui vestiário e banheiro para funcionários, separados por sexo.',
          legislation: 'LM 7031/96 Art. 97, IV; RDC 502/21 Art. 29, XI',
          weight: 2,
          isCritical: false,
        },
      ],
    },

    // ── ADIÇÕES À SEÇÃO FEDERAL: Documentação Administrativa (sec-fed-13) ────
    {
      targetSectionId: 'sec-fed-13',
      items: [
        {
          id: 'bh-s13-001',
          sectionId: 'sec-fed-13',
          order: 9,
          // Federal cita CMDI ou CEDI (municipal ou estadual); BH exige especificamente o CMI de BH
          description: 'Possui comprovação de inscrição e registro de seus programas junto ao Conselho Municipal do Idoso (CMI) de Belo Horizonte.',
          legislation: 'LM 7031/96 Art. 97, IV; RDC 502/21 Art. 8; Lei 10.741/2003 Art. 48',
          weight: 2,
          isCritical: false,
        },
      ],
    },
  ],

  // ── NOVAS SEÇÕES (sem equivalente na base federal) ───────────────────────
  newSections: [

    // ── SEÇÃO BH-01 ─────────────────────────────────────────────────────────
    // Requisitos de enfermagem e segurança no cuidado direto ao idoso,
    // derivados de Resoluções COFEN e do Decreto Federal 94.406/1987.
    // Ausentes no template federal por este ter sido estruturado com foco na
    // RDC 502/2021 (ANVISA). São normas federais, não exclusividades de BH,
    // e devem migrar para a base federal em revisão futura.
    {
      id: 'sec-bh-enf',
      title: 'Enfermagem e Segurança no Cuidado Direto',
      order: 20,
      items: [
        {
          id: 'bh-enf-001',
          sectionId: 'sec-bh-enf',
          order: 1,
          // Decreto 94.406/1987 + Res. COFEN 620/2019
          description: 'A administração de medicamentos por via parenteral (intramuscular, endovenosa, subcutânea) é realizada exclusivamente por profissionais legalmente habilitados da equipe de enfermagem.',
          legislation: 'Decreto Federal nº 94.406/1987; Resolução COFEN nº 620/2019',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-enf-002',
          sectionId: 'sec-bh-enf',
          order: 2,
          // Res. COFEN 450/2013, 557/2017, 619/2019, 787/2025
          description: 'Procedimentos invasivos ou de maior complexidade técnica (sondagem vesical, passagem de sonda nasoentérica, aspiração de vias aéreas, curativos complexos) não são delegados a cuidadores sem habilitação de enfermagem.',
          legislation: 'Resoluções COFEN nº 450/2013, 557/2017, 619/2019 e 787/2025',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-enf-003',
          sectionId: 'sec-bh-enf',
          order: 3,
          // Res. COFEN 358/2009 + 620/2019
          description: 'O enfermeiro responsável realiza e documenta a Sistematização da Assistência de Enfermagem (SAE) e a evolução clínica individualizada para os residentes com graus de dependência II e III.',
          legislation: 'Resolução COFEN nº 358/2009; Resolução COFEN nº 620/2019',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-enf-004',
          sectionId: 'sec-bh-enf',
          order: 4,
          // Res. COFEN 746/2024
          description: 'A contenção mecânica de residente ocorre apenas em casos de extrema necessidade, mediante prescrição médica ou de enfermagem documentada, com monitoramento sistemático supervisionado pelo enfermeiro.',
          legislation: 'Resolução COFEN nº 746/2024',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'bh-enf-005',
          sectionId: 'sec-bh-enf',
          order: 5,
          // Res. COFEN 582/2018
          description: 'É vedado ao enfermeiro da ILPI o ensino de práticas técnico-científicas privativas de enfermagem na formação ou capacitação de cuidadores sem habilitação profissional.',
          legislation: 'Resolução COFEN nº 582/2018',
          weight: 10,
          isCritical: true,
        },
      ],
    },
  ],
};
