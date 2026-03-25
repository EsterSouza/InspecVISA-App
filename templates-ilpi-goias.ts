// ============================================================
// src/data/templates-ilpi-goias.ts
// ROTEIRO ILPI — GOIÁS / SENADOR CANEDO
// C&C CONSULTORIA SANITÁRIA
//
// Base normativa:
//   Federal : RDC ANVISA nº 502/2021 (norma principal de ILPI)
//             Lei Federal nº 10.741/2003 (Estatuto da Pessoa Idosa)
//             RDC ANVISA nº 216/2004 (Boas Práticas de Alimentação)
//             RDC ANVISA nº 222/2018 (Gerenciamento de Resíduos)
//             RDC ANVISA nº 36/2013 (Segurança do Paciente)
//             Portaria de Consolidação MS nº 4/2017 (DNC)
//             NR-32 (Segurança e Saúde no Trabalho em Serv. de Saúde)
//             NR-7 (PCMSO) | NR-6 (EPI) | NR-24 (Cond. Sanitárias)
//             ROI ANVISA ILPI — Documento 11.1, versão 1.2, Dez/2022
//   Estadual: Goiás adota o ROI ANVISA desde 2023 (SES-GO / SVISA)
//             Não há lei estadual específica de ILPI em Goiás —
//             prevalece integralmente a RDC 502/2021.
//   Municipal: Lei Ordinária nº 1.812/2014 — Código Sanitário de
//              Senador Canedo (Cap. XV, Arts. 276–280 — ILPIs)
//   MP-GO  :  Roteiro UTPSS/MPGO — Unidade Técnico-Pericial em
//             Serviço Social (fiscalização extrajudicial de ILPIs)
//
// Pesos: Imprescindível=10 (isCritical:true) | Necessário=5 |
//        Recomendável=2 | Sugerido=1
// ============================================================

import { ChecklistTemplate } from '../types';

export const templateIlpiGoias: ChecklistTemplate = {

  id: 'tpl-ilpi-goias-v1',
  name: 'Roteiro de Inspeção — ILPI | Goiás / Senador Canedo',
  category: 'ilpi',
  version: '2025',

  sections: [

    // ── SEÇÃO 1 ──────────────────────────────────────────────
    // Documentação e Regularização
    // Base: RDC 502/2021 Arts. 8–13; Lei 10.741/2003 Arts. 48–50;
    //       Lei Municipal 1.812/2014 Art. 276; ROI ANVISA ILPI item 5/6
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-01',
      title: 'Documentação e Regularização',
      order: 1,
      items: [
        {
          id: 'go-001',
          sectionId: 'sec-go-01',
          order: 1,
          description: 'Possui Alvará Sanitário (Licença Sanitária) vigente, emitido pela Vigilância Sanitária Municipal de Senador Canedo, compatível com as atividades declaradas e afixado em local visível.',
          legislation: 'Art. 8º, RDC 502/2021; Art. 276, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-002',
          sectionId: 'sec-go-01',
          order: 2,
          description: 'Possui Alvará de Funcionamento da Prefeitura Municipal vigente.',
          legislation: 'Art. 276, Lei Municipal 1.812/2014; Art. 48, Lei Federal 10.741/2003',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-003',
          sectionId: 'sec-go-01',
          order: 3,
          description: 'Apresenta CNPJ ativo e o CNAE declarado é compatível com a atividade de ILPI.',
          legislation: 'Legislação Tributária Federal',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-004',
          sectionId: 'sec-go-01',
          order: 4,
          description: 'Possui Responsável Técnico (RT) de nível superior legalmente habilitado, com carga horária mínima de 20 horas semanais, comprovação de vínculo formal e registro ativo no respectivo conselho de classe.',
          legislation: 'Arts. 10–12, RDC 502/2021; Art. 276 I, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-005',
          sectionId: 'sec-go-01',
          order: 5,
          description: 'Possui Estatuto (entidades sem fins lucrativos) ou Contrato Social (sociedades empresárias) registrado em cartório.',
          legislation: 'Art. 48 II, Lei Federal 10.741/2003; Art. 9º, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-006',
          sectionId: 'sec-go-01',
          order: 6,
          description: 'Possui Regimento Interno da instituição, disponível para consulta por residentes, familiares e autoridades.',
          legislation: 'Art. 9º III, RDC 502/2021; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-007',
          sectionId: 'sec-go-01',
          order: 7,
          description: 'Possui inscrição no Conselho Municipal do Idoso (CMI) de Senador Canedo ou, na ausência deste, no Conselho Estadual do Idoso de Goiás.',
          legislation: 'Art. 48, parágrafo único, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-008',
          sectionId: 'sec-go-01',
          order: 8,
          description: 'Entidades sem fins lucrativos apresentam inscrição no Conselho Municipal de Assistência Social (CMAS) de Senador Canedo.',
          legislation: 'Lei Federal 8.742/1993; Art. 9º, RDC 502/2021; Roteiro MPGO/UTPSS',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-009',
          sectionId: 'sec-go-01',
          order: 9,
          description: 'Laudo do Corpo de Bombeiros Militar de Goiás (CBMGO) vigente, com certificado de conformidade para prevenção de incêndio.',
          legislation: 'Legislação Estadual de Goiás — CBMGO; Art. 276, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-010',
          sectionId: 'sec-go-01',
          order: 10,
          description: 'Possui planta baixa com memorial descritivo das atividades e obra, aprovada pela Vigilância Sanitária local.',
          legislation: 'Art. 276 IV, Lei Municipal 1.812/2014; RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-011',
          sectionId: 'sec-go-01',
          order: 11,
          description: 'Possui contratos vigentes com todas as empresas terceirizadas (alimentação, limpeza, lavanderia, coleta de resíduos, controle de pragas) e cópia do Alvará Sanitário de cada uma.',
          legislation: 'Art. 14, RDC 502/2021; ROI ANVISA ILPI item 6',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-012',
          sectionId: 'sec-go-01',
          order: 12,
          description: 'Possui contrato individual de prestação de serviços firmado com cada residente (ou responsável legal / curador), especificando os serviços, valores, direitos e obrigações.',
          legislation: 'Art. 35 e Art. 45 V, Lei Federal 10.741/2003; Art. 12, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── SEÇÃO 2 ──────────────────────────────────────────────
    // Infraestrutura Física Geral
    // Base: RDC 502/2021 Art. 29; Lei Municipal 1.812/2014 Arts. 276–279;
    //       ABNT NBR 9050; ROI ANVISA ILPI
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-02',
      title: 'Infraestrutura Física Geral',
      order: 2,
      items: [
        {
          id: 'go-013',
          sectionId: 'sec-go-02',
          order: 1,
          description: 'Pisos, paredes e tetos são de material liso, lavável, impermeável e estão em bom estado de conservação e higiene em todas as dependências.',
          legislation: 'Art. 29, RDC 502/2021; Art. 276 VI, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-014',
          sectionId: 'sec-go-02',
          order: 2,
          description: 'Iluminação e ventilação (natural ou artificial) são adequadas em todos os ambientes, sem ambientes escuros ou abafados.',
          legislation: 'Art. 29, RDC 502/2021; Art. 276 VI, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-015',
          sectionId: 'sec-go-02',
          order: 3,
          description: 'Possui condições de acessibilidade para pessoas com mobilidade reduzida: rampas, corrimão bilateral, barras de apoio, piso antiderrapante, sem desnível em forma de degrau.',
          legislation: 'Art. 29, RDC 502/2021; ABNT NBR 9050; Art. 3º, Lei Federal 10.741/2003',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-016',
          sectionId: 'sec-go-02',
          order: 4,
          description: 'Instalações elétricas e hidráulicas estão em bom estado, sem fios expostos, sem vazamentos ou infiltrações.',
          legislation: 'Art. 276 VI, Lei Municipal 1.812/2014; NR-10',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-017',
          sectionId: 'sec-go-02',
          order: 5,
          description: 'Não há tapetes, carpetes ou objetos soltos no chão que possam provocar quedas nos residentes.',
          legislation: 'Art. 29, RDC 502/2021; Roteiro MPGO/UTPSS — Infraestrutura',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-018',
          sectionId: 'sec-go-02',
          order: 6,
          description: 'Possui Depósito de Material de Limpeza (DML) com tanque de lavagem e local exclusivo para guarda de saneantes, separado de outras áreas.',
          legislation: 'Art. 29, RDC 502/2021; Art. 276 VI, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-019',
          sectionId: 'sec-go-02',
          order: 7,
          description: 'Possui área comum coberta para recreação, lazer e realização de eventos, separada das áreas de descanso.',
          legislation: 'Art. 29, RDC 502/2021; Art. 289, Lei Municipal 1.812/2014',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-020',
          sectionId: 'sec-go-02',
          order: 8,
          description: 'Possui sala técnica/administrativa com espaço adequado para guarda de prontuários e documentos sigilosos.',
          legislation: 'Art. 29, RDC 502/2021; Roteiro MPGO/UTPSS — Área Técnica',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-021',
          sectionId: 'sec-go-02',
          order: 9,
          description: 'Possui sistema de monitoramento por câmeras nas áreas coletivas, sem invasão de privacidade nos dormitórios e banheiros.',
          legislation: 'Roteiro MPGO/UTPSS; LGPD — Lei Federal 13.709/2018',
          weight: 2,
          isCritical: false,
        },
        {
          id: 'go-022',
          sectionId: 'sec-go-02',
          order: 10,
          description: 'Não há odores desagradáveis nos ambientes, indicando higienização inadequada ou problema estrutural.',
          legislation: 'Art. 276 VI, Lei Municipal 1.812/2014; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── SEÇÃO 3 ──────────────────────────────────────────────
    // Dormitórios e Banheiros
    // Base: RDC 502/2021 Art. 29; Lei Municipal 1.812/2014 Arts. 277–278;
    //       ROI ANVISA ILPI itens 51–56; Roteiro MPGO/UTPSS
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-03',
      title: 'Dormitórios e Banheiros',
      order: 3,
      items: [
        {
          id: 'go-023',
          sectionId: 'sec-go-03',
          order: 1,
          description: 'Dormitórios estão separados por sexo e possuem identificação visual.',
          legislation: 'Art. 29 I, RDC 502/2021; Art. 277, Lei Municipal 1.812/2014',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-024',
          sectionId: 'sec-go-03',
          order: 2,
          description: 'Cada dormitório possui no máximo 4 leitos, com distância mínima de 0,80 m entre camas e entre cama e parede.',
          legislation: 'Art. 29 I-4, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-025',
          sectionId: 'sec-go-03',
          order: 3,
          description: 'Camas são individuais; colchões e travesseiros possuem material impermeável e lavável, em bom estado de conservação.',
          legislation: 'Art. 29 I, RDC 502/2021; Art. 277, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-026',
          sectionId: 'sec-go-03',
          order: 4,
          description: 'Cada residente possui armário individual com espaço para guarda de roupas e pertences pessoais.',
          legislation: 'Art. 29 I, RDC 502/2021; Roteiro MPGO/UTPSS — Dormitórios',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-027',
          sectionId: 'sec-go-03',
          order: 5,
          description: 'Roupas de cama estão em condições adequadas de higiene e são trocadas com frequência compatível com as necessidades dos residentes.',
          legislation: 'Art. 29 IX, RDC 502/2021; ROI ANVISA ILPI',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-028',
          sectionId: 'sec-go-03',
          order: 6,
          description: 'Há campainha de alarme (ou dispositivo equivalente) ao alcance dos residentes em cada dormitório.',
          legislation: 'Art. 29, RDC 502/2021; Roteiro MPGO/UTPSS — Dormitórios',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-029',
          sectionId: 'sec-go-03',
          order: 7,
          description: 'Banheiros possuem área mínima de 3,60 m², com vaso sanitário, lavatório e chuveiro; sem desnível em forma de degrau para conter a água.',
          legislation: 'Art. 29 IV, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-030',
          sectionId: 'sec-go-03',
          order: 8,
          description: 'Banheiros possuem barras de apoio e adaptações para idosos com mobilidade reduzida; chuveiro com água quente; piso antiderrapante.',
          legislation: 'Art. 29 IV, RDC 502/2021; Art. 278, Lei Municipal 1.812/2014; ABNT NBR 9050',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-031',
          sectionId: 'sec-go-03',
          order: 9,
          description: 'Banheiros estão em condições adequadas de higiene, com funcionamento regular de descarga, chuveiro e torneiras.',
          legislation: 'Art. 278, Lei Municipal 1.812/2014; Roteiro MPGO/UTPSS — Banheiros',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-032',
          sectionId: 'sec-go-03',
          order: 10,
          description: 'Roupas de uso pessoal de cada residente estão devidamente identificadas (etiquetadas).',
          legislation: 'Art. 29 IX, RDC 502/2021; ROI ANVISA ILPI item — Roupas',
          weight: 5,
          isCritical: false,
        },
      ],
    },

    // ── SEÇÃO 4 ──────────────────────────────────────────────
    // Alimentação e Cozinha
    // Base: RDC 216/2004; RDC 502/2021 Arts. 41–45;
    //       Lei Municipal 1.812/2014 Art. 279; ROI ANVISA ILPI
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-04',
      title: 'Alimentação e Cozinha',
      order: 4,
      items: [
        {
          id: 'go-033',
          sectionId: 'sec-go-04',
          order: 1,
          description: 'A cozinha atende às disposições da RDC 216/2004 (Boas Práticas para Serviços de Alimentação): pisos, paredes e teto lisos, impermeáveis, laváveis, em bom estado; telas nas janelas; lixo separado da área de preparo.',
          legislation: 'Art. 279, Lei Municipal 1.812/2014; RDC 216/2004; Art. 41, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-034',
          sectionId: 'sec-go-04',
          order: 2,
          description: 'Possui nutricionista responsável pela elaboração do cardápio e supervisão da alimentação dos residentes.',
          legislation: 'Art. 43, RDC 502/2021; Roteiro MPGO/UTPSS — Cozinha',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-035',
          sectionId: 'sec-go-04',
          order: 3,
          description: 'São ofertadas no mínimo 6 refeições diárias; existe cardápio para residentes com dietas específicas ou restrições alimentares.',
          legislation: 'Art. 41, RDC 502/2021; Roteiro MPGO/UTPSS — Cozinha',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-036',
          sectionId: 'sec-go-04',
          order: 4,
          description: 'O refeitório possui área mínima de 1 m² por residente, com lavatório para higienização das mãos e luz de vigília.',
          legislation: 'Art. 29 II, RDC 502/2021; ROI ANVISA ILPI item 58',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-037',
          sectionId: 'sec-go-04',
          order: 5,
          description: 'Possui local exclusivo para estocagem de alimentos (despensa) com organização e controle de validade.',
          legislation: 'RDC 216/2004; Roteiro MPGO/UTPSS — Despensa',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-038',
          sectionId: 'sec-go-04',
          order: 6,
          description: 'Possui Manual de Boas Práticas e POPs para o serviço de alimentação, disponíveis para consulta.',
          legislation: 'RDC 216/2004; Art. 46, RDC 502/2021',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-039',
          sectionId: 'sec-go-04',
          order: 7,
          description: 'Quando terceirizado, o serviço de alimentação apresenta contrato vigente e cópia do Alvará Sanitário da empresa.',
          legislation: 'Art. 14, RDC 502/2021; ROI ANVISA ILPI item 6',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── SEÇÃO 5 ──────────────────────────────────────────────
    // Lavanderia
    // Base: RDC 502/2021 Arts. 14–15 e Art. 29 IX–X;
    //       ROI ANVISA ILPI item 6 (Terceirização) e item 20 (Infraestrutura)
    //       NOTA: A exigência de lavanderia "hospitalar" NÃO tem
    //       amparo na RDC 502/2021 nem na Lei 1.812/2014 (Art. 288
    //       desta lei refere-se a creches, Seção I Cap. XVI — não
    //       a ILPIs, que são tratadas no Cap. XV, Arts. 276–280,
    //       sem menção a lavanderia hospitalar). Verificar este
    //       ponto quando houver exigência indevida da fiscalização.
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-05',
      title: 'Lavanderia',
      order: 5,
      items: [
        {
          id: 'go-040',
          sectionId: 'sec-go-05',
          order: 1,
          description: 'Quando terceirizada (opção legal permitida): apresenta contrato formal vigente com a empresa de lavanderia E cópia do Alvará Sanitário da empresa contratada. Estes são os ÚNICOS requisitos exigidos pela norma federal.',
          legislation: 'Art. 14, RDC 502/2021; ROI ANVISA ILPI item 6',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-041',
          sectionId: 'sec-go-05',
          order: 2,
          description: 'Quando terceirizada: a ILPI está DISPENSADA de manter área física de lavanderia e quadro de pessoal próprio para o serviço — conforme autorização expressa da norma federal.',
          legislation: 'Art. 15, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-042',
          sectionId: 'sec-go-05',
          order: 3,
          description: 'Quando o processamento é realizado internamente (sem terceirização total): existe separação física entre área suja e área limpa, com fluxo unidirecional.',
          legislation: 'Art. 29 IX–X, RDC 502/2021; ROI ANVISA ILPI item 20',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-043',
          sectionId: 'sec-go-05',
          order: 4,
          description: 'Quando o processamento é realizado internamente: há local específico para guarda de roupa de uso coletivo, devidamente organizado e higienizado.',
          legislation: 'Art. 29 IX, RDC 502/2021; ROI ANVISA ILPI item 20',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-044',
          sectionId: 'sec-go-05',
          order: 5,
          description: 'Os produtos saneantes utilizados no processamento das roupas (internamente ou pela terceirizada) possuem registro ou notificação válidos na ANVISA.',
          legislation: 'Art. 50, RDC 502/2021',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-045',
          sectionId: 'sec-go-05',
          order: 6,
          description: 'Quando o processamento é realizado internamente: os funcionários da lavanderia utilizam EPIs completos (luvas, avental impermeável, botas) com Certificado de Aprovação (CA) válido.',
          legislation: 'ROI ANVISA ILPI item 33 e 42; NR-6',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-046',
          sectionId: 'sec-go-05',
          order: 7,
          description: 'Quando o processamento é realizado internamente: idosos com grau de dependência I têm possibilidade de efetuar o processamento de suas próprias roupas de uso pessoal.',
          legislation: 'Art. 29 X, RDC 502/2021; ROI ANVISA ILPI item 20',
          weight: 2,
          isCritical: false,
        },
      ],
    },

    // ── SEÇÃO 6 ──────────────────────────────────────────────
    // Medicamentos e Farmácia
    // Base: RDC 502/2021 Arts. 36–38; Portaria 344/1998;
    //       Roteiro MPGO/UTPSS — Farmácia
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-06',
      title: 'Medicamentos e Farmácia',
      order: 6,
      items: [
        {
          id: 'go-047',
          sectionId: 'sec-go-06',
          order: 1,
          description: 'Medicamentos são armazenados em local exclusivo, chaveado, identificado, com controle de temperatura e umidade, sob responsabilidade do RT.',
          legislation: 'Art. 36, RDC 502/2021; Roteiro MPGO/UTPSS — Farmácia',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-048',
          sectionId: 'sec-go-06',
          order: 2,
          description: 'É vedado o armazenamento de medicamentos sem prescrição médica.',
          legislation: 'Art. 36, RDC 502/2021; Roteiro MPGO/UTPSS — Farmácia',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-049',
          sectionId: 'sec-go-06',
          order: 3,
          description: 'Medicamentos controlados (Portaria 344/1998) estão em armário com chave exclusiva e com controle de receituário específico.',
          legislation: 'Art. 36, RDC 502/2021; Portaria SVS/MS 344/1998',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-050',
          sectionId: 'sec-go-06',
          order: 4,
          description: 'Há receituário de todos os medicamentos administrados a cada residente, atualizado e arquivado no prontuário individual.',
          legislation: 'Art. 36, RDC 502/2021; Roteiro MPGO/UTPSS — Saúde',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-051',
          sectionId: 'sec-go-06',
          order: 5,
          description: 'É realizado controle periódico de validade dos medicamentos, com descarte adequado dos vencidos conforme RDC 222/2018.',
          legislation: 'Art. 36, RDC 502/2021; RDC 222/2018',
          weight: 5,
          isCritical: false,
        },
      ],
    },

    // ── SEÇÃO 7 ──────────────────────────────────────────────
    // Assistência Integral ao Residente
    // Base: RDC 502/2021 Arts. 5–7, 31–35, 39–40;
    //       Lei Federal 10.741/2003 Arts. 2–3, 10, 17, 49–50;
    //       Roteiro MPGO/UTPSS — Saúde e Atividades
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-07',
      title: 'Assistência Integral ao Residente',
      order: 7,
      items: [
        {
          id: 'go-052',
          sectionId: 'sec-go-07',
          order: 1,
          description: 'Possui Plano de Atenção Integral à Saúde dos Residentes (PAISI), elaborado a cada 2 anos, avaliado anualmente, em articulação com o gestor local de saúde.',
          legislation: 'Arts. 30–32, RDC 502/2021; ROI ANVISA ILPI',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-053',
          sectionId: 'sec-go-07',
          order: 2,
          description: 'Cada residente possui prontuário individualizado, atualizado, com registro de dados pessoais, grau de dependência, histórico de saúde, laudos médicos e evolução multiprofissional.',
          legislation: 'Art. 33, RDC 502/2021; Art. 50 XV, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-054',
          sectionId: 'sec-go-07',
          order: 3,
          description: 'Caderneta de vacinação dos residentes está atualizada conforme o Calendário Nacional de Imunização do Ministério da Saúde.',
          legislation: 'Art. 39, RDC 502/2021; ROI ANVISA ILPI',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-055',
          sectionId: 'sec-go-07',
          order: 4,
          description: 'A instituição dispõe de atividades ocupacionais, físicas (fisioterápicas) e de lazer para os residentes, com registro de participação.',
          legislation: 'Art. 32, RDC 502/2021; Art. 3º, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-056',
          sectionId: 'sec-go-07',
          order: 5,
          description: 'A equipe de saúde notifica à Vigilância Epidemiológica Municipal as suspeitas de doenças de notificação compulsória.',
          legislation: 'Portaria de Consolidação MS nº 4/2017; Art. 40, RDC 502/2021; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-057',
          sectionId: 'sec-go-07',
          order: 6,
          description: 'A instituição notifica imediatamente à Vigilância Sanitária Municipal a ocorrência de eventos sentinela (queda com lesão, tentativa de suicídio e outros).',
          legislation: 'Art. 55, RDC 502/2021; ROI ANVISA ILPI; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-058',
          sectionId: 'sec-go-07',
          order: 7,
          description: 'Em casos de intercorrência médica, o RT comunica prontamente a família ou o representante legal do residente após encaminhamento ao serviço de saúde de referência.',
          legislation: 'Art. 33, RDC 502/2021; Art. 50, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-059',
          sectionId: 'sec-go-07',
          order: 8,
          description: 'A instituição possui plano de trabalho formalizado, com as rotinas técnicas descritas em POPs para: alimentação, higiene do residente, limpeza, administração de medicamentos e outras atividades críticas.',
          legislation: 'Art. 31, RDC 502/2021; Art. 276 V, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-060',
          sectionId: 'sec-go-07',
          order: 9,
          description: 'Casos de abandono familiar ou idosos sem identificação civil são comunicados à Secretaria Municipal de Assistência Social e ao Ministério Público.',
          legislation: 'Art. 34, RDC 502/2021; Art. 43 II, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-061',
          sectionId: 'sec-go-07',
          order: 10,
          description: 'A instituição possui ou faz uso de serviço de remoção (transporte de urgência) com contrato formalizado.',
          legislation: 'Art. 43, RDC 502/2021',
          weight: 5,
          isCritical: false,
        },
      ],
    },

    // ── SEÇÃO 8 ──────────────────────────────────────────────
    // Direitos e Convivência dos Residentes
    // Base: Lei Federal 10.741/2003 Arts. 2–17, 48–50;
    //       RDC 502/2021 Arts. 5–7; Roteiro MPGO/UTPSS Seções 7–8
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-08',
      title: 'Direitos e Convivência dos Residentes',
      order: 8,
      items: [
        {
          id: 'go-062',
          sectionId: 'sec-go-08',
          order: 1,
          description: 'Os residentes têm liberdade de ir e vir assegurada, salvo restrição fundamentada no Plano de Atenção à Saúde individual.',
          legislation: 'Art. 6º I, RDC 502/2021; Arts. 10 e 15, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-063',
          sectionId: 'sec-go-08',
          order: 2,
          description: 'É garantida a preservação da identidade e privacidade de cada residente, com ambiente de respeito e dignidade.',
          legislation: 'Art. 6º II, RDC 502/2021; Art. 17, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-064',
          sectionId: 'sec-go-08',
          order: 3,
          description: 'Cada residente tem acesso a vestuário individual adequado e a produtos de higiene pessoal.',
          legislation: 'Art. 5º, RDC 502/2021; Art. 50 IV, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-065',
          sectionId: 'sec-go-08',
          order: 4,
          description: 'A instituição possui espaço adequado para que os residentes recebam visitas de familiares, com horários flexíveis.',
          legislation: 'Art. 5º, RDC 502/2021; Art. 49 II, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-066',
          sectionId: 'sec-go-08',
          order: 5,
          description: 'São realizadas atividades de fortalecimento de vínculos familiares e comunitários (saídas, contatos telefônicos, participação de familiares em eventos).',
          legislation: 'Art. 32, RDC 502/2021; Arts. 3º e 49, Lei Federal 10.741/2003; Roteiro MPGO/UTPSS',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-067',
          sectionId: 'sec-go-08',
          order: 6,
          description: 'Não há evidências de violência, negligência, maus-tratos ou discriminação contra residentes.',
          legislation: 'Arts. 4º e 19–20, Lei Federal 10.741/2003; Art. 5º, RDC 502/2021; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-068',
          sectionId: 'sec-go-08',
          order: 7,
          description: 'A instituição atende apenas os graus de dependência declarados no Alvará Sanitário. Residentes com necessidade de assistência médica ou de enfermagem permanente (Grau III) não são mantidos em ILPI que não tenha habilitação para isso.',
          legislation: 'Art. 8º, RDC 502/2021; ROI ANVISA ILPI; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── SEÇÃO 9 ──────────────────────────────────────────────
    // Resíduos de Serviços de Saúde
    // Base: RDC 222/2018; RDC 502/2021 Art. 29 XIV;
    //       ROI ANVISA ILPI; Lei Municipal 1.812/2014
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-09',
      title: 'Gestão de Resíduos',
      order: 9,
      items: [
        {
          id: 'go-069',
          sectionId: 'sec-go-09',
          order: 1,
          description: 'Possui Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS) implementado, disponível para consulta.',
          legislation: 'RDC 222/2018; Art. 29 XIV, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-070',
          sectionId: 'sec-go-09',
          order: 2,
          description: 'Perfurocortantes (agulhas, lancetas) são descartados em coletores rígidos identificados, substituídos ao atingir 2/3 da capacidade.',
          legislation: 'RDC 222/2018; NR-32',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-071',
          sectionId: 'sec-go-09',
          order: 3,
          description: 'Possui contrato vigente com empresa licenciada para coleta e destinação final de resíduos de serviços de saúde, com cópia do Alvará Sanitário da empresa.',
          legislation: 'RDC 222/2018; Art. 14, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-072',
          sectionId: 'sec-go-09',
          order: 4,
          description: 'Abrigo externo à edificação para armazenamento temporário de resíduos até o momento da coleta, identificado, com acesso restrito e higienizado.',
          legislation: 'Art. 29 XIV, RDC 502/2021; RDC 222/2018',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-073',
          sectionId: 'sec-go-09',
          order: 5,
          description: 'Recipientes de coleta internos estão identificados por tipo de resíduo, íntegros e em número suficiente para a demanda.',
          legislation: 'RDC 222/2018; RDC 216/2004',
          weight: 5,
          isCritical: false,
        },
      ],
    },

    // ── SEÇÃO 10 ─────────────────────────────────────────────
    // Controle de Pragas e Qualidade da Água
    // Base: RDC 502/2021 Arts. 46–47;
    //       Lei Municipal 1.812/2014 Art. 276;
    //       ROI ANVISA ILPI; Portaria MS 888/2021
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-10',
      title: 'Controle de Pragas e Qualidade da Água',
      order: 10,
      items: [
        {
          id: 'go-074',
          sectionId: 'sec-go-10',
          order: 1,
          description: 'Comprovante de higienização do reservatório de água a cada 6 meses, realizado por empresa habilitada, com laudo assinado pelo responsável técnico da empresa.',
          legislation: 'Art. 46, RDC 502/2021; Art. 276, Lei Municipal 1.812/2014; ROI ANVISA ILPI',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-075',
          sectionId: 'sec-go-10',
          order: 2,
          description: 'Laudo de análise microbiológica da água realizado após a higienização do reservatório, com resultado dentro dos parâmetros de potabilidade.',
          legislation: 'Art. 46, RDC 502/2021; Portaria MS 888/2021',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-076',
          sectionId: 'sec-go-10',
          order: 3,
          description: 'Possui contrato vigente com empresa habilitada pela VISA local para controle de vetores e pragas urbanas (dedetização, desratização), com laudo técnico das aplicações.',
          legislation: 'Art. 47, RDC 502/2021; Art. 276, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── SEÇÃO 11 ─────────────────────────────────────────────
    // Recursos Humanos
    // Base: RDC 502/2021 Arts. 10–16; Lei Federal 10.741/2003;
    //       ROI ANVISA ILPI; Roteiro MPGO/UTPSS — RH;
    //       NOTA: Goiás não possui lei estadual específica de
    //       dimensionamento de RH para ILPI — prevalece a RDC 502/2021.
    //       Referências a "CRM-GO" substituem CREMERJ do template RJ.
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-11',
      title: 'Recursos Humanos',
      order: 11,
      items: [
        {
          id: 'go-077',
          sectionId: 'sec-go-11',
          order: 1,
          description: 'Responsável Técnico com formação de nível superior, registro ativo no conselho de classe (CRM-GO, COREN-GO, CRN-GO ou equivalente) e carga horária mínima de 20 horas semanais comprovada.',
          legislation: 'Arts. 10–12, RDC 502/2021; Art. 276 I, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-078',
          sectionId: 'sec-go-11',
          order: 2,
          description: 'Quantitativo de cuidadores atende à proporção mínima da RDC 502/2021: Grau I — 1 cuidador para 20 idosos (8h/dia); Grau II — 1 cuidador para 10 idosos por turno; Grau III — 1 cuidador para 6 idosos por turno.',
          legislation: 'Art. 16, RDC 502/2021; ROI ANVISA ILPI',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-079',
          sectionId: 'sec-go-11',
          order: 3,
          description: 'Quando o serviço de alimentação é interno: 1 profissional de alimentação para cada 20 idosos, cobrindo dois turnos de 8 horas.',
          legislation: 'Art. 16 V, RDC 502/2021; ROI ANVISA ILPI item 41',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-080',
          sectionId: 'sec-go-11',
          order: 4,
          description: 'Quando a lavanderia é interna: 1 profissional para cada 30 idosos (ou fração) diariamente.',
          legislation: 'Art. 16, RDC 502/2021; ROI ANVISA ILPI item 42',
          weight: 2,
          isCritical: false,
        },
        {
          id: 'go-081',
          sectionId: 'sec-go-11',
          order: 5,
          description: 'Todos os profissionais possuem vínculo formal de trabalho (CLT, estatutário ou contrato de prestação de serviço), com documentação arquivada.',
          legislation: 'Art. 16, RDC 502/2021; Legislação Trabalhista; Roteiro MPGO/UTPSS — RH',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-082',
          sectionId: 'sec-go-11',
          order: 6,
          description: 'Profissionais de saúde com registro ativo no respectivo conselho de classe (CRM-GO, COREN-GO, CRN-GO, CREFITO-GO, CRP-GO, CRESS-GO, COFFITO-GO).',
          legislation: 'Art. 16, RDC 502/2021; Legislação dos Conselhos Profissionais',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-083',
          sectionId: 'sec-go-11',
          order: 7,
          description: 'A ILPI realiza capacitação inicial e continuada para todos os profissionais, com registro de conteúdo programático e assinatura dos participantes, com frequência mínima semestral.',
          legislation: 'Art. 16, RDC 502/2021; Art. 276 III, Lei Municipal 1.812/2014',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-084',
          sectionId: 'sec-go-11',
          order: 8,
          description: 'Profissionais apresentam evolução registrada em prontuário multidisciplinar.',
          legislation: 'Art. 33, RDC 502/2021; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
      ],
    },

    // ── SEÇÃO 12 ─────────────────────────────────────────────
    // Saúde e Segurança do Trabalhador
    // Base: NR-32; NR-7; NR-6; NR-24; RDC 502/2021
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-12',
      title: 'Saúde e Segurança do Trabalhador',
      order: 12,
      items: [
        {
          id: 'go-085',
          sectionId: 'sec-go-12',
          order: 1,
          description: 'Apresenta PCMSO (Programa de Controle Médico de Saúde Ocupacional) com exames admissionais, periódicos e demissionais documentados.',
          legislation: 'NR-7',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-086',
          sectionId: 'sec-go-12',
          order: 2,
          description: 'Apresenta PGR (Programa de Gerenciamento de Riscos) com mapeamento dos riscos ocupacionais da ILPI.',
          legislation: 'NR-1',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-087',
          sectionId: 'sec-go-12',
          order: 3,
          description: 'Possui registro de entrega de EPIs para todos os funcionários, com Certificado de Aprovação (CA) válido e adequado à função.',
          legislation: 'NR-6; NR-32',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-088',
          sectionId: 'sec-go-12',
          order: 4,
          description: 'Comprovação de vacinação dos profissionais (Hepatite B, DT, Influenza) e controle de saúde com exame Anti-HBs.',
          legislation: 'NR-32',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-089',
          sectionId: 'sec-go-12',
          order: 5,
          description: 'Dispõe de local de descanso para a equipe, copa e banheiro/vestiário exclusivos para os funcionários.',
          legislation: 'NR-24; Roteiro MPGO/UTPSS — Área para Funcionários',
          weight: 5,
          isCritical: false,
        },
      ],
    },

    // ── SEÇÃO 13 ─────────────────────────────────────────────
    // Documentação Técnica e Registros
    // Base: RDC 502/2021 Arts. 13, 17, 33, 43, 55;
    //       Lei Federal 10.741/2003 Arts. 48–50;
    //       ROI ANVISA ILPI item 5; Roteiro MPGO/UTPSS Seção 4
    // ─────────────────────────────────────────────────────────
    {
      id: 'sec-go-13',
      title: 'Documentação Técnica e Registros',
      order: 13,
      items: [
        {
          id: 'go-090',
          sectionId: 'sec-go-13',
          order: 1,
          description: 'Documentos institucionais atualizados e de fácil acesso para fiscalização, avaliação e controle social.',
          legislation: 'Art. 13, RDC 502/2021; ROI ANVISA ILPI item 5',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-091',
          sectionId: 'sec-go-13',
          order: 2,
          description: 'Possui livro de registro atualizado de entradas e saídas de residentes, com informações sobre grau de dependência, altas e óbitos.',
          legislation: 'Art. 17, RDC 502/2021; Roteiro MPGO/UTPSS',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-092',
          sectionId: 'sec-go-13',
          order: 3,
          description: 'Mantém listagem atualizada com o levantamento dos graus de dependência de todos os residentes.',
          legislation: 'Art. 3º, RDC 502/2021; ROI ANVISA ILPI',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-093',
          sectionId: 'sec-go-13',
          order: 4,
          description: 'Registros de eventos sentinela (quedas com lesão, tentativas de suicídio e outros) arquivados e disponíveis para consulta da VISA.',
          legislation: 'Art. 55, RDC 502/2021; ROI ANVISA ILPI',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-094',
          sectionId: 'sec-go-13',
          order: 5,
          description: 'Indicadores de desempenho calculados e encaminhados mensalmente à Vigilância Sanitária local (taxa de mortalidade, incidência de DDA, escabiose, desidratação, lesão por pressão, desnutrição).',
          legislation: 'Arts. 54–57, RDC 502/2021; ROI ANVISA ILPI',
          weight: 5,
          isCritical: false,
        },
        {
          id: 'go-095',
          sectionId: 'sec-go-13',
          order: 6,
          description: 'Instrução para higienização das mãos afixada em locais visíveis (banheiros, cozinha, farmácia, postos de cuidado).',
          legislation: 'RDC 36/2013; ROI ANVISA ILPI',
          weight: 2,
          isCritical: false,
        },
        {
          id: 'go-096',
          sectionId: 'sec-go-13',
          order: 7,
          description: 'Plano de Trabalho da ILPI elaborado com participação dos residentes, compatível com os princípios da RDC 502/2021.',
          legislation: 'Arts. 31–32, RDC 502/2021; Roteiro MPGO/UTPSS — Plano de Trabalho',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-097',
          sectionId: 'sec-go-13',
          order: 8,
          description: 'Possui POPs elaborados, aprovados pelo RT e disponíveis para todos os profissionais, contemplando no mínimo: alimentação, higiene do residente, limpeza ambiental, processamento de roupas e administração de medicamentos.',
          legislation: 'Art. 31, RDC 502/2021; Art. 276 V, Lei Municipal 1.812/2014',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-098',
          sectionId: 'sec-go-13',
          order: 9,
          description: 'Possui registro diário de intercorrências, assinado pelo profissional responsável pelo turno.',
          legislation: 'Art. 33, RDC 502/2021; Roteiro MPGO/UTPSS',
          weight: 10,
          isCritical: true,
        },
        {
          id: 'go-099',
          sectionId: 'sec-go-13',
          order: 10,
          description: 'Notificação de Doenças de Notificação Compulsória (DNC) registrada e arquivada.',
          legislation: 'Portaria de Consolidação MS nº 4/2017; Art. 40, RDC 502/2021',
          weight: 10,
          isCritical: true,
        },
      ],
    },

  ], // fim sections
}; // fim templateIlpiGoias
