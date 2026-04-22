// ============================================================
// src/data/templates.ts
// ROTEIROS REAIS ÔÇö C&C CONSULTORIA SANIT├üRIA
// Gerado automaticamente a partir dos ROIs originais
// Est├®tica: V. atual (114 itens) | ILPI: V.11/2024 (81 itens)
// ============================================================

import type { ChecklistTemplate, Client } from '../types';
import { templateIlpiGoiasSuplement } from './templates-ilpi-goias-supplement';


// ÔöÇÔöÇ MAPEAMENTO DE PESOS ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Est├®tica:  Imprescind├¡vel=10 | Necess├írio=5 | Recomendado=2 | Sugerido=1
// ILPI:      Imprescind├¡vel=10 | Necess├írio=5 | Recomend├ível=2
// isCritical = true apenas para Imprescind├¡vel
// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export const templates: ChecklistTemplate[] = [

  // ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
  // TEMPLATE 1 ÔÇö EST├ëTICA E BELEZA
  // Base: RDC 63/2011, RDC 15/2012, RDC 222/2018, RDC 751/2022,
  //       RDC 36/2013, RDC 50/2002, NR 32 e legisla├º├Áes complementares
  // ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
  {
    id: 'tpl-estetica-v1',
    name: 'Roteiro de Inspe├º├úo ÔÇö Est├®tica e Beleza',
    category: 'estetica',
    version: '2024',
    sections: [

      // ÔöÇÔöÇ SE├ç├âO 1 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-01',
        title: 'Documenta├º├úo e Regulariza├º├úo',
        order: 1,
        items: [
          { id: 'est-001', sectionId: 'sec-est-01', order: 1, description: 'Possui Alvar├í ou Licen├ºa Sanit├íria vigente, compat├¡vel com as atividades declaradas e afixada em local vis├¡vel ao p├║blico.', legislation: 'Legisla├º├úo Sanit├íria Federal e Local', weight: 10, isCritical: true },
          { id: 'est-002', sectionId: 'sec-est-01', order: 2, description: 'Possui CNPJ e o CNAE ├® compat├¡vel com os servi├ºos prestados.', legislation: 'Legisla├º├úo Tribut├íria e Sanit├íria', weight: 10, isCritical: true },
          { id: 'est-003', sectionId: 'sec-est-01', order: 3, description: 'Possui Respons├ível T├®cnico (RT) de n├¡vel superior e legalmente habilitado, com comprova├º├úo de v├¡nculo e certid├úo do conselho de classe.', legislation: 'Nota T├®cnica 02/2024/ANVISA; Resolu├º├Áes de Conselhos Profissionais', weight: 10, isCritical: true },
          { id: 'est-004', sectionId: 'sec-est-01', order: 4, description: 'Apresenta o Plano de Gerenciamento de Res├¡duos de Servi├ºos de Sa├║de (PGRSS) implementado e seguido na pr├ítica.', legislation: 'RDC n┬║ 222/2018', weight: 10, isCritical: true },
          { id: 'est-005', sectionId: 'sec-est-01', order: 5, description: 'Apresenta o Plano de Seguran├ºa do Paciente (PSP) implantado, com os 6 protocolos b├ísicos estabelecidos.', legislation: 'RDC n┬║ 36/2013', weight: 10, isCritical: true },
          { id: 'est-006', sectionId: 'sec-est-01', order: 6, description: 'Possui Manual de Rotinas e Procedimentos (ou Manual de Biosseguran├ºa) contemplando todos os processos e condutas em caso de acidentes.', legislation: 'RDC n┬║ 63/2011; NR 32', weight: 10, isCritical: true },
          { id: 'est-007', sectionId: 'sec-est-01', order: 7, description: 'Possui Procedimentos Operacionais Padr├úo (POPs) para todas as atividades cr├¡ticas (limpeza, esteriliza├º├úo, uso de equipamentos, etc.).', legislation: 'RDC n┬║ 63/2011', weight: 10, isCritical: true },
          { id: 'est-008', sectionId: 'sec-est-01', order: 8, description: 'Apresenta prontu├írios dos pacientes preenchidos adequadamente, sem rasuras, com assinatura do profissional e arquivados de forma a garantir sigilo e seguran├ºa.', legislation: 'RDC 63/2011; LGPD', weight: 10, isCritical: true },
          { id: 'est-009', sectionId: 'sec-est-01', order: 9, description: 'Apresenta Termo de Consentimento Livre e Esclarecido (TCLE) espec├¡fico para cada procedimento invasivo realizado.', legislation: 'Resolu├º├úo CNS n┬║ 466/2012; C├│digo de ├ëtica Profissional', weight: 5, isCritical: false },
          { id: 'est-010', sectionId: 'sec-est-01', order: 10, description: 'Possui Projeto B├ísico de Arquitetura (PBA) ou Laudo T├®cnico de Avalia├º├úo (LTA) aprovado pela VISA, quando aplic├ível.', legislation: 'RDC n┬║ 50/2002', weight: 10, isCritical: true },
          { id: 'est-011', sectionId: 'sec-est-01', order: 11, description: 'Apresenta rela├º├úo formal de todos os profissionais que atuam no estabelecimento, com suas respectivas habilita├º├Áes.', legislation: 'RDC 63/2011 art. 29 e 30', weight: 10, isCritical: true },
          { id: 'est-012', sectionId: 'sec-est-01', order: 12, description: 'Apresenta Memorial Descritivo detalhando todos os procedimentos, t├®cnicas e tecnologias utilizadas no estabelecimento.', legislation: 'Boas Pr├íticas de Gest├úo', weight: 5, isCritical: false },
          { id: 'est-013', sectionId: 'sec-est-01', order: 13, description: 'Apresenta uma lista formal de todos os equipamentos, incluindo marca, modelo e n├║mero de registro na ANVISA.', legislation: 'RDC 63/2011; RDC 751/2022', weight: 5, isCritical: false },
          { id: 'est-014', sectionId: 'sec-est-01', order: 14, description: 'Possui contratos e licen├ºas sanit├írias de todas as empresas terceirizadas (coleta de res├¡duos, controle de pragas, lavanderia, ar-condicionado etc.).', legislation: 'RDC n┬║ 63/2011', weight: 10, isCritical: true },
          { id: 'est-015', sectionId: 'sec-est-01', order: 15, description: 'Possui processo de qualifica├º├úo de fornecedores para insumos cr├¡ticos, mantendo arquivada a documenta├º├úo legal de cada um (Alvar├í Sanit├írio, AFE) e notas fiscais de compra.', legislation: 'Boas Pr├íticas de Gest├úo', weight: 5, isCritical: false },
          { id: 'est-016', sectionId: 'sec-est-01', order: 16, description: 'Apresenta Laudo de Aterramento El├®trico para equipamentos de grande porte ou que emitam energia (ex: lasers, ultrassom).', legislation: 'NR 10; Manuais do Fabricante; ABNT NBR 13534', weight: 2, isCritical: false },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 2 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-02',
        title: 'Sa├║de e Seguran├ºa do Trabalhador',
        order: 2,
        items: [
          { id: 'est-017', sectionId: 'sec-est-02', order: 1, description: 'Apresenta PCMSO (Programa de Controle M├®dico de Sa├║de Ocupacional), obrigat├│rio para estabelecimentos com funcion├írios CLT.', legislation: 'NR-7', weight: 1, isCritical: false },
          { id: 'est-018', sectionId: 'sec-est-02', order: 2, description: 'Apresenta PGR (Programa de Gerenciamento de Riscos), incluindo Mapa de Risco do estabelecimento, obrigat├│rio para estabelecimentos com funcion├írios CLT.', legislation: 'NR-1', weight: 1, isCritical: false },
          { id: 'est-019', sectionId: 'sec-est-02', order: 3, description: 'Possui registro de entrega de EPIs para todos os funcion├írios, com o devido Certificado de Aprova├º├úo (CA).', legislation: 'NR-6', weight: 1, isCritical: false },
          { id: 'est-020', sectionId: 'sec-est-02', order: 4, description: 'Apresenta comprova├º├úo de vacina├º├úo dos profissionais (ex: Hepatite B e T├®tano) e controle de sa├║de (exame Anti-HBs).', legislation: 'NR-32', weight: 2, isCritical: false },
          { id: 'est-021', sectionId: 'sec-est-02', order: 5, description: 'Existe um programa de educa├º├úo permanente documentado para todos os funcion├írios, com cronograma definido.', legislation: 'RDC 63/2011 art. 32', weight: 5, isCritical: false },
          { id: 'est-022', sectionId: 'sec-est-02', order: 6, description: 'Possui vesti├írio com arm├írios individuais para guarda de pertences dos funcion├írios, e copa ou local para descanso e refei├º├Áes.', legislation: 'NR 24; RDC 50/2002', weight: 5, isCritical: false },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 3 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-03',
        title: 'Infraestrutura F├¡sica',
        order: 3,
        items: [
          { id: 'est-023', sectionId: 'sec-est-03', order: 1, description: 'Pisos, paredes e tetos de todas as ├íreas s├úo de material liso, lav├ível, imperme├ível e est├úo em bom estado de conserva├º├úo.', legislation: 'RDC n┬║ 50/2002', weight: 10, isCritical: true },
          { id: 'est-024', sectionId: 'sec-est-03', order: 2, description: 'Todo o mobili├írio (macas, bancadas, carrinhos, arm├írios) ├® de material liso, lav├ível, imperme├ível, ├¡ntegro e resistente.', legislation: 'RDC n┬║ 63/2011', weight: 10, isCritical: true },
          { id: 'est-025', sectionId: 'sec-est-03', order: 3, description: 'As instala├º├Áes (el├®tricas, hidr├íulicas) est├úo embutidas ou protegidas por calhas e em bom estado, sem fios expostos.', legislation: 'RDC n┬║ 50/2002; NR-10', weight: 10, isCritical: true },
          { id: 'est-026', sectionId: 'sec-est-03', order: 4, description: 'A ilumina├º├úo e ventila├º├úo (natural ou artificial) s├úo adequadas em todas as ├íreas, incluindo a sala de espera.', legislation: 'RDC n┬║ 50/2002', weight: 10, isCritical: true },
          { id: 'est-027', sectionId: 'sec-est-03', order: 5, description: 'Possui sanit├írios para funcion├írios e p├║blico, distintos, completos e em bom estado de funcionamento.', legislation: 'RDC n┬║ 50/2002', weight: 10, isCritical: true },
          { id: 'est-028', sectionId: 'sec-est-03', order: 6, description: 'A sala de procedimentos ├® exclusiva para este fim, com dimens├Áes adequadas e devidamente identificada.', legislation: 'RDC n┬║ 50/2002', weight: 10, isCritical: true },
          { id: 'est-029', sectionId: 'sec-est-03', order: 7, description: 'Possui lavat├│rio para higiene das m├úos na sala de procedimento, de uso exclusivo, dotado de todos os insumos (sabonete, papel, lixeira com pedal).', legislation: 'RDC n┬║ 63/2011; RDC 50/2002', weight: 10, isCritical: true },
          { id: 'est-030', sectionId: 'sec-est-03', order: 8, description: 'Possui Dep├│sito de Material de Limpeza (DML) com tanque e local exclusivo para guarda de saneantes.', legislation: 'RDC n┬║ 50/2002', weight: 10, isCritical: true },
          { id: 'est-031', sectionId: 'sec-est-03', order: 9, description: 'O estabelecimento est├í organizado, limpo e livre de materiais em desuso ou alheios ├á atividade.', legislation: 'Legisla├º├úo Sanit├íria Local', weight: 10, isCritical: true },
          { id: 'est-032', sectionId: 'sec-est-03', order: 10, description: 'O estabelecimento promove acessibilidade para pessoas com defici├¬ncia ou mobilidade reduzida.', legislation: 'NBR 9050', weight: 10, isCritical: true },
          { id: 'est-033', sectionId: 'sec-est-03', order: 11, description: 'A ├írea de recep├º├úo/espera ├® separada das ├íreas de procedimento e oferece condi├º├Áes de conforto e higiene.', legislation: 'RDC 50/2002', weight: 10, isCritical: true },
          { id: 'est-034', sectionId: 'sec-est-03', order: 12, description: 'As janelas das ├íreas cr├¡ticas possuem tela milim├®trica para prote├º├úo contra vetores.', legislation: 'RDC 50/2002', weight: 2, isCritical: false },
          { id: 'est-035', sectionId: 'sec-est-03', order: 13, description: 'Os ralos, se existentes em ├íreas cr├¡ticas, possuem sistema de fechamento (grelha ou similar).', legislation: 'RDC 50/2002', weight: 10, isCritical: true },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 4 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-04',
        title: 'Processamento de Artigos (CME)',
        order: 4,
        items: [
          { id: 'est-036', sectionId: 'sec-est-04', order: 1, description: 'Possui Central de Material e Esteriliza├º├úo (CME) ou ├írea de processamento com barreira f├¡sica e fluxo unidirecional (sujo/limpo).', legislation: 'RDC n┬║ 15/2012', weight: 10, isCritical: true },
          { id: 'est-037', sectionId: 'sec-est-04', order: 2, description: 'A limpeza de instrumentais utiliza detergente enzim├ítico regularizado na ANVISA, em cuba de imers├úo ou lavadora ultrass├┤nica.', legislation: 'RDC n┬║ 15/2012', weight: 10, isCritical: true },
          { id: 'est-038', sectionId: 'sec-est-04', order: 3, description: 'A pia de lavagem de instrumentais (expurgo) ├® exclusiva para este fim, com cuba profunda e separada da ├írea limpa.', legislation: 'RDC n┬║ 15/2012; RDC 50/2002', weight: 10, isCritical: true },
          { id: 'est-039', sectionId: 'sec-est-04', order: 4, description: 'A esteriliza├º├úo de artigos cr├¡ticos ├® feita exclusivamente por autoclave com registro na ANVISA, instalada em bancada apropriada.', legislation: 'RDC n┬║ 15/2012', weight: 10, isCritical: true },
          { id: 'est-040', sectionId: 'sec-est-04', order: 5, description: 'Apresenta valida├º├úo (qualifica├º├úo de instala├º├úo, opera├º├úo e desempenho) da autoclave, realizada por empresa especializada.', legislation: 'RDC 15/2012 art. 95-97', weight: 10, isCritical: true },
          { id: 'est-041', sectionId: 'sec-est-04', order: 6, description: 'Realiza monitoramento do processo de esteriliza├º├úo com indicadores qu├¡micos (em todos os pacotes) e biol├│gicos (frequ├¬ncia m├¡nima semanal).', legislation: 'RDC n┬║ 15/2012', weight: 10, isCritical: true },
          { id: 'est-042', sectionId: 'sec-est-04', order: 7, description: 'Mant├®m registros de todos os ciclos de esteriliza├º├úo e dos testes de monitoramento, garantindo rastreabilidade.', legislation: 'RDC n┬║ 15/2012', weight: 10, isCritical: true },
          { id: 'est-043', sectionId: 'sec-est-04', order: 8, description: 'Os materiais esterilizados possuem etiqueta com data de esteriliza├º├úo, validade, lote e respons├ível pelo preparo.', legislation: 'RDC 15/2012 art. 83', weight: 10, isCritical: true },
          { id: 'est-044', sectionId: 'sec-est-04', order: 9, description: 'O armazenamento de material est├®ril ├® feito em arm├írio fechado, exclusivo, limpo, seco e de acesso restrito.', legislation: 'RDC n┬║ 15/2012', weight: 10, isCritical: true },
          { id: 'est-045', sectionId: 'sec-est-04', order: 10, description: 'Os artigos de uso ├║nico s├úo descartados ap├│s o uso, sendo proibido seu reprocessamento.', legislation: 'RDC n┬║ 156/2006; RE 2605/2006', weight: 10, isCritical: true },
          { id: 'est-046', sectionId: 'sec-est-04', order: 11, description: 'As embalagens utilizadas para esteriliza├º├úo (grau cir├║rgico) s├úo apropriadas e regularizadas na ANVISA.', legislation: 'RDC 15/2012', weight: 10, isCritical: true },
          { id: 'est-047', sectionId: 'sec-est-04', order: 12, description: 'Possui registro da limpeza e desinfec├º├úo peri├│dica da ├írea de processamento de artigos (CME).', legislation: 'RDC 15/2012 art. 65', weight: 5, isCritical: false },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 5 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-05',
        title: 'Biosseguran├ºa',
        order: 5,
        items: [
          { id: 'est-048', sectionId: 'sec-est-05', order: 1, description: 'Os profissionais n├úo comem, bebem ou guardam alimentos nos postos de trabalho (bancadas e salas de procedimento).', legislation: 'NR 32', weight: 10, isCritical: true },
          { id: 'est-049', sectionId: 'sec-est-05', order: 2, description: 'Os profissionais utilizam EPIs completos e adequados para cada tipo de procedimento.', legislation: 'NR 32; RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-050', sectionId: 'sec-est-05', order: 3, description: 'Possui protocolo de Higiene das M├úos implantado e disponibiliza prepara├º├úo alco├│lica em pontos estrat├®gicos.', legislation: 'RDC n┬║ 36/2013; RDC 42/2010', weight: 5, isCritical: false },
          { id: 'est-051', sectionId: 'sec-est-05', order: 4, description: '├ë realizada a desinfec├º├úo de superf├¡cies (macas, bancadas, equipamentos) entre um paciente e outro.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-052', sectionId: 'sec-est-05', order: 5, description: 'Materiais perfurocortantes s├úo descartados em coletores r├¡gidos, localizados em suporte seguro e substitu├¡dos ao atingir o limite.', legislation: 'RDC n┬║ 222/2018; NR 32', weight: 10, isCritical: true },
          { id: 'est-053', sectionId: 'sec-est-05', order: 6, description: '├ë utilizada barreira de prote├º├úo descart├ível (len├ºol, filme PVC) em equipamentos e mobili├írio que entram em contato com o paciente.', legislation: 'Princ├¡pios de Biosseguran├ºa', weight: 10, isCritical: true },
          { id: 'est-054', sectionId: 'sec-est-05', order: 7, description: 'Os cal├ºados utilizados pelos profissionais na ├írea de procedimento s├úo fechados.', legislation: 'NR 32', weight: 10, isCritical: true },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 6 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-06',
        title: 'Seguran├ºa do Paciente',
        order: 6,
        items: [
          { id: 'est-055', sectionId: 'sec-est-06', order: 1, description: 'O estabelecimento (se aplic├ível) possui N├║cleo de Seguran├ºa do Paciente (NSP) formalmente institu├¡do.', legislation: 'RDC n┬║ 36/2013', weight: 2, isCritical: false },
          { id: 'est-056', sectionId: 'sec-est-06', order: 2, description: 'Possui protocolo para manejo de intercorr├¬ncias e emerg├¬ncias, com plano de encaminhamento definido.', legislation: 'RDC n┬║ 63/2011; Nota T├®cnica 02/2024/ANVISA', weight: 10, isCritical: true },
          { id: 'est-057', sectionId: 'sec-est-06', order: 3, description: 'Possui Maleta de Intercorr├¬ncias equipada para suporte b├ísico de vida, com materiais e medicamentos essenciais, controle de validade e em local de f├ícil acesso.', legislation: 'RDC 63/2011; Resolu├º├Áes de Conselhos Profissionais', weight: 5, isCritical: false },
          { id: 'est-058', sectionId: 'sec-est-06', order: 4, description: 'Realiza a notifica├º├úo de eventos adversos e queixas t├®cnicas de produtos e equipamentos no sistema NOTIVISA.', legislation: 'RDC n┬║ 36/2013; RDC 751/2022; RDC 864/2024', weight: 2, isCritical: false },
          { id: 'est-059', sectionId: 'sec-est-06', order: 5, description: 'Adota o protocolo de identifica├º├úo do paciente para garantir que o procedimento seja realizado na pessoa correta.', legislation: 'RDC n┬║ 36/2013', weight: 10, isCritical: true },
          { id: 'est-060', sectionId: 'sec-est-06', order: 6, description: 'Adota o protocolo de cirurgia segura (quando aplic├ível), com checagem de lateralidade, procedimento e materiais.', legislation: 'RDC n┬║ 36/2013', weight: 2, isCritical: false },
          { id: 'est-061', sectionId: 'sec-est-06', order: 7, description: 'As instru├º├Áes p├│s-procedimento s├úo fornecidas por escrito aos pacientes, com orienta├º├Áes claras e contatos de emerg├¬ncia.', legislation: 'C├│digo de Defesa do Consumidor; Boas Pr├íticas', weight: 10, isCritical: true },
          { id: 'est-062', sectionId: 'sec-est-06', order: 8, description: '├ë realizada a rastreabilidade dos produtos (lote, validade) e equipamentos utilizados em cada paciente, vinculada ao prontu├írio.', legislation: 'RDC 63/2011; RDC 36/2013', weight: 10, isCritical: true },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 7 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-07',
        title: 'Equipamentos e Produtos',
        order: 7,
        items: [
          { id: 'est-063', sectionId: 'sec-est-07', order: 1, description: 'Todos os equipamentos possuem registro ou notifica├º├úo na ANVISA e s├úo utilizados estritamente para a finalidade aprovada.', legislation: 'RDC n┬║ 751/2022', weight: 10, isCritical: true },
          { id: 'est-064', sectionId: 'sec-est-07', order: 2, description: 'Possui o manual de instru├º├Áes de todos os equipamentos em portugu├¬s e acess├¡vel aos operadores.', legislation: 'RDC n┬║ 751/2022', weight: 1, isCritical: false },
          { id: 'est-065', sectionId: 'sec-est-07', order: 3, description: 'Apresenta registros de manuten├º├úo preventiva e calibra├º├úo peri├│dica dos equipamentos, conforme manual do fabricante.', legislation: 'RDC n┬║ 63/2011', weight: 10, isCritical: true },
          { id: 'est-066', sectionId: 'sec-est-07', order: 4, description: 'Os saneantes utilizados para limpeza e desinfec├º├úo s├úo regularizados na ANVISA e utilizados conforme a dilui├º├úo e tempo corretos.', legislation: 'Lei n┬║ 6.360/1976', weight: 10, isCritical: true },
          { id: 'est-067', sectionId: 'sec-est-07', order: 5, description: 'Todos os cosm├®ticos e produtos para sa├║de s├úo regularizados na ANVISA, est├úo no prazo de validade e armazenados corretamente.', legislation: 'Lei n┬║ 6.360/1976', weight: 10, isCritical: true },
          { id: 'est-068', sectionId: 'sec-est-07', order: 6, description: 'Os produtos expostos ├á venda (cosm├®ticos, etc.) est├úo regularizados junto ├á ANVISA e armazenados de forma segregada dos de uso profissional.', legislation: 'Legisla├º├úo Municipal / Sanit├íria', weight: 10, isCritical: true },
          { id: 'est-069', sectionId: 'sec-est-07', order: 7, description: '├ë proibido o fracionamento de produtos, exceto se especificado pelo fabricante e seguindo crit├®rios t├®cnicos de biosseguran├ºa.', legislation: 'Boas Pr├íticas', weight: 10, isCritical: true },
          { id: 'est-070', sectionId: 'sec-est-07', order: 8, description: 'Produtos abertos ou fracionados possuem identifica├º├úo com nome, data de abertura e nova data de validade.', legislation: 'RDC n┬║ 63/2011', weight: 10, isCritical: true },
          { id: 'est-071', sectionId: 'sec-est-07', order: 9, description: 'Possui refrigerador exclusivo para medicamentos e termol├íbeis, com controle e registro di├írio de temperatura (m├¡nima e m├íxima).', legislation: 'RDC 63/2011; Boas Pr├íticas de Armazenamento', weight: 10, isCritical: true },
          { id: 'est-072', sectionId: 'sec-est-07', order: 10, description: 'Possui plano de conting├¬ncia para o armazenamento de produtos termol├íbeis em caso de falta de energia.', legislation: 'Boas Pr├íticas de Armazenamento', weight: 2, isCritical: false },
          { id: 'est-073', sectionId: 'sec-est-07', order: 11, description: 'Caso utilize medicamentos sujeitos a controle especial (Portaria 344/98), apresenta a Autoriza├º├úo de Funcionamento Especial (AFE).', legislation: 'Portaria SVS/MS n┬║ 344/98', weight: 1, isCritical: false },
          { id: 'est-074', sectionId: 'sec-est-07', order: 12, description: 'O local de armazenamento de medicamentos controlados ├® exclusivo, trancado com chave e de acesso restrito.', legislation: 'Portaria SVS/MS n┬║ 344/98', weight: 1, isCritical: false },
          { id: 'est-075', sectionId: 'sec-est-07', order: 13, description: 'Realiza e mant├®m os registros do Balan├ºo de Subst├óncias Psicoativas e Outras (BSPO), conforme legisla├º├úo.', legislation: 'Portaria SVS/MS n┬║ 344/98', weight: 1, isCritical: false },
          { id: 'est-076', sectionId: 'sec-est-07', order: 14, description: 'H├í controle de temperatura e integridade para amostras gr├ítis de medicamentos, sob responsabilidade do prescritor.', legislation: 'Boas Pr├íticas de Armazenamento', weight: 10, isCritical: true },
          { id: 'est-077', sectionId: 'sec-est-07', order: 15, description: 'Os medicamentos manipulados possuem r├│tulo com os dados da farm├ícia de manipula├º├úo e do paciente/cl├¡nica.', legislation: 'RDC 67/2007', weight: 10, isCritical: true },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 8 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-08',
        title: 'Gest├úo de Res├¡duos',
        order: 8,
        items: [
          { id: 'est-078', sectionId: 'sec-est-08', order: 1, description: 'Apresenta contrato com empresa licenciada para coleta, transporte e destina├º├úo final de res├¡duos de sa├║de (Grupos A, B, E).', legislation: 'RDC n┬║ 222/2018', weight: 10, isCritical: true },
          { id: 'est-079', sectionId: 'sec-est-08', order: 2, description: 'A segrega├º├úo dos res├¡duos (infectante, qu├¡mico, perfurocortante, comum) ├® realizada corretamente no momento e local de sua gera├º├úo.', legislation: 'RDC n┬║ 222/2018', weight: 10, isCritical: true },
          { id: 'est-080', sectionId: 'sec-est-08', order: 3, description: 'Os recipientes de descarte (lixeiras) s├úo adequados ao tipo de res├¡duo, com tampa de acionamento por pedal e simbologia correta.', legislation: 'RDC n┬║ 222/2018', weight: 10, isCritical: true },
          { id: 'est-081', sectionId: 'sec-est-08', order: 4, description: 'Os sacos de lixo utilizados correspondem ├á cor padronizada para cada tipo de res├¡duo.', legislation: 'RDC n┬║ 222/2018', weight: 10, isCritical: true },
          { id: 'est-082', sectionId: 'sec-est-08', order: 5, description: 'Os res├¡duos s├úo retirados das salas de procedimento quando o recipiente atingir 2/3 da capacidade ou no m├¡nimo a cada 48h.', legislation: 'RDC 222/2018 art. 14', weight: 10, isCritical: true },
          { id: 'est-083', sectionId: 'sec-est-08', order: 6, description: 'Possui abrigo externo de res├¡duos, em conformidade com a RDC 222/2018 (separado, identificado, protegido, com ponto de ├ígua).', legislation: 'RDC n┬║ 222/2018', weight: 10, isCritical: true },
          { id: 'est-084', sectionId: 'sec-est-08', order: 7, description: 'O descarte de medicamentos e qu├¡micos ├® realizado conforme o PGRSS, em conformidade com a RDC 222/2018.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 9 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-09',
        title: 'Controle de Vetores e Qualidade da ├ügua',
        order: 9,
        items: [
          { id: 'est-085', sectionId: 'sec-est-09', order: 1, description: 'Apresenta comprovante de controle de vetores e pragas urbanas, realizado por empresa licenciada e dentro da validade.', legislation: 'RDC 63/2011 art. 23', weight: 10, isCritical: true },
          { id: 'est-086', sectionId: 'sec-est-09', order: 2, description: 'Apresenta comprovante de limpeza e desinfec├º├úo do reservat├│rio de ├ígua, com periodicidade m├¡nima semestral.', legislation: 'RDC 63/2011 art. 39', weight: 10, isCritical: true },
          { id: 'est-087', sectionId: 'sec-est-09', order: 3, description: 'Apresenta laudos de potabilidade da ├ígua, conforme periodicidade semestral.', legislation: 'Portaria GM/MS N┬║ 888/2021', weight: 10, isCritical: true },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 10 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-10',
        title: 'Lavanderia',
        order: 10,
        items: [
          { id: 'est-088', sectionId: 'sec-est-10', order: 1, description: 'As roupas limpas s├úo armazenadas em local separado, limpo e fechado.', legislation: 'RDC 63/2011', weight: 1, isCritical: false },
          { id: 'est-089', sectionId: 'sec-est-10', order: 2, description: 'As roupas sujas s├úo acondicionadas em sacos imperme├íveis e transportadas separadamente das limpas.', legislation: 'RDC 63/2011', weight: 1, isCritical: false },
          { id: 'est-090', sectionId: 'sec-est-10', order: 3, description: 'Se o processamento de roupas ├® terceirizado, apresenta contrato com lavanderia que possua licen├ºa sanit├íria.', legislation: 'Boas Pr├íticas', weight: 1, isCritical: false },
          { id: 'est-091', sectionId: 'sec-est-10', order: 4, description: 'As toalhas de tecido, se utilizadas, s├úo de cor clara e de uso individual.', legislation: 'Legisla├º├úo Municipal; Resolu├º├Áes de Conselhos', weight: 1, isCritical: false },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 11 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-11',
        title: 'Considera├º├Áes Gerais',
        order: 11,
        items: [
          { id: 'est-092', sectionId: 'sec-est-11', order: 1, description: 'A publicidade e propaganda do estabelecimento n├úo s├úo enganosas e respeitam as normas dos conselhos profissionais.', legislation: 'C├│digo de Defesa do Consumidor; Resolu├º├Áes de Conselhos', weight: 2, isCritical: false },
          { id: 'est-093', sectionId: 'sec-est-11', order: 2, description: '├ë proibido o uso de equipamentos de bronzeamento artificial com emiss├úo de UV.', legislation: 'RDC 56/2009', weight: 10, isCritical: true },
          { id: 'est-094', sectionId: 'sec-est-11', order: 3, description: 'Os profissionais executam apenas os procedimentos para os quais est├úo legalmente habilitados.', legislation: 'Lei do Exerc├¡cio Profissional; Resolu├º├Áes de Conselhos', weight: 10, isCritical: true },
          { id: 'est-095', sectionId: 'sec-est-11', order: 4, description: 'O estabelecimento possui extintores de inc├¬ndio com carga e validade em dia e em locais sinalizados.', legislation: 'Normas do Corpo de Bombeiros', weight: 5, isCritical: false },
          { id: 'est-096', sectionId: 'sec-est-11', order: 5, description: 'As sa├¡das de emerg├¬ncia est├úo desobstru├¡das e sinalizadas.', legislation: 'Normas do Corpo de Bombeiros', weight: 2, isCritical: false },
          { id: 'est-097', sectionId: 'sec-est-11', order: 6, description: '├ë proibido fumar no interior do estabelecimento.', legislation: 'Lei Federal n┬║ 9.294/1996', weight: 10, isCritical: true },
          { id: 'est-098', sectionId: 'sec-est-11', order: 7, description: 'H├í bebedouro com ├ígua pot├ível dispon├¡vel para funcion├írios e clientes, com manuten├º├úo em dia.', legislation: 'Boas Pr├íticas', weight: 10, isCritical: true },
          { id: 'est-099', sectionId: 'sec-est-11', order: 8, description: 'O ar condicionado, se existente, possui plano de manuten├º├úo e registros de limpeza dos filtros.', legislation: 'Lei Federal n┬║ 13.589/2018', weight: 10, isCritical: true },
          { id: 'est-100', sectionId: 'sec-est-11', order: 9, description: 'A validade dos produtos saneantes ├® controlada e os mesmos s├úo armazenados em local pr├│prio (DML).', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-101', sectionId: 'sec-est-11', order: 10, description: 'Os uniformes dos funcion├írios est├úo limpos, em bom estado de conserva├º├úo e s├úo de uso exclusivo nas depend├¬ncias do servi├ºo.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'est-102', sectionId: 'sec-est-11', order: 11, description: 'A empresa possui Livro de Reclama├º├Áes do Consumidor, conforme exig├¬ncia local.', legislation: 'Legisla├º├úo do Consumidor', weight: 10, isCritical: true },
          { id: 'est-103', sectionId: 'sec-est-11', order: 12, description: 'A empresa notifica compulsoriamente os agravos ├á sa├║de de acordo com a legisla├º├úo.', legislation: 'Portaria de Consolida├º├úo n┬║ 4/2017 (GM/MS)', weight: 10, isCritical: true },
          { id: 'est-104', sectionId: 'sec-est-11', order: 13, description: 'O descarte de embalagens de produtos ├® realizado de forma a inutiliz├í-las para evitar o reuso.', legislation: 'Boas Pr├íticas', weight: 10, isCritical: true },
          { id: 'est-105', sectionId: 'sec-est-11', order: 14, description: 'Existe rotina de limpeza peri├│dica de todos os equipamentos (parte externa).', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-106', sectionId: 'sec-est-11', order: 15, description: 'O estabelecimento possui um local seguro para a guarda de pertences de clientes/pacientes.', legislation: 'Boas Pr├íticas de Atendimento', weight: 2, isCritical: false },
          { id: 'est-107', sectionId: 'sec-est-11', order: 16, description: 'O estabelecimento possui toda a sinaliza├º├úo vis├¡vel (nome do RT, telefones de emerg├¬ncia, direitos do paciente, etc.).', legislation: 'Legisla├º├úo Local; Boas Pr├íticas', weight: 1, isCritical: false },
          { id: 'est-108', sectionId: 'sec-est-11', order: 17, description: 'Os certificados de calibra├º├úo dos equipamentos est├úo dispon├¡veis e dentro da validade.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'est-109', sectionId: 'sec-est-11', order: 18, description: 'O estabelecimento possui e implementa um programa de gerenciamento de tecnologias em sa├║de.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
        ],
      },

      // ÔöÇÔöÇ SE├ç├âO 12 ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
      {
        id: 'sec-est-12',
        title: 'Gest├úo da Qualidade',
        order: 12,
        items: [
          { id: 'est-110', sectionId: 'sec-est-12', order: 1, description: 'A institui├º├úo avalia periodicamente seus processos e indicadores de qualidade e seguran├ºa.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'est-111', sectionId: 'sec-est-12', order: 2, description: 'Existe uma pol├¡tica institucional documentada que pro├¡be o reprocessamento de artigos de uso ├║nico.', legislation: 'RDC 63/2011; RE 2605/2006', weight: 10, isCritical: true },
          { id: 'est-112', sectionId: 'sec-est-12', order: 3, description: 'O servi├ºo realiza a vigil├óncia epidemiol├│gica de eventos adversos, incluindo surtos e infec├º├Áes relacionadas ├á assist├¬ncia.', legislation: 'RDC 36/2013; Portaria 2616/98', weight: 5, isCritical: false },
          { id: 'est-113', sectionId: 'sec-est-12', order: 4, description: 'Os profissionais possuem descri├º├úo de cargo com suas atribui├º├Áes, responsabilidades e autoridades.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'est-114', sectionId: 'sec-est-12', order: 5, description: 'A dire├º├úo do servi├ºo promove uma cultura de seguran├ºa, incentivando a comunica├º├úo e a notifica├º├úo de incidentes sem car├íter punitivo.', legislation: 'RDC 36/2013', weight: 2, isCritical: false },
        ],
      },
    ],
  },


  // ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
  // TEMPLATE 2 ÔÇö ROTEIRO ILPI : BASE FEDERAL (BRASIL)
  // Base: RDC ANVISA n┬║ 502/2021 (norma principal de ILPI)
  //   Lei Federal n┬║ 10.741/2003 (Estatuto da Pessoa Idosa)
  //   RDC ANVISA n┬║ 216/2004 (Boas Pr├íticas de Alimenta├º├úo)
  //   RDC ANVISA n┬║ 222/2018 (Gerenciamento de Res├¡duos)
  //   RDC ANVISA n┬║ 63/2011 (Boas Pr├íticas em Servi├ºos de Sa├║de)
  //   Portaria SVS/MS n┬║ 344/1998 (Medicamentos Controlados)
  //   Portaria de Consolida├º├úo MS n┬║ 4/2017 (DNC)
  //   Normas Regulamentadoras (NR 32, NR 7, NR 6, NR 24)
  // Classifica├º├úo: I=Imprescind├¡vel | N=Necess├írio | R=Recomend├ível
  // ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
  {
    id: 'tpl-ilpi-federal-v1',
    name: 'Roteiro de Inspe├º├úo ÔÇö ILPI (Base Federal)',
    category: 'ilpi',
    version: '06/2026',
    sections: [

      // SE├ç├âO 1 _______________________________________
      {
        id: 'sec-fed-01',
        title: 'Estrutura F├¡sica : Geral',
        order: 1,
        items: [
          { id: 'fed-001', sectionId: 'sec-fed-01', order: 1, description: 'O funcionamento da ILPI ├® autorizado mediante Alvar├í/Licen├ºa Sanit├íria vigente expedida pelo ├│rg├úo sanit├írio local, em conformidade com a Lei Federal n┬║ 6.437/1977.', legislation: 'Art. 8┬║ da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-001a', sectionId: 'sec-fed-01', order: 2, description: 'Possui Projeto B├ísico de Arquitetura (planta baixa) aprovado pela autoridade sanit├íria local, em caso de constru├º├úo, reforma ou adapta├º├úo.', legislation: 'Art. 19 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-001b', sectionId: 'sec-fed-01', order: 3, description: 'As instala├º├Áes prediais de prote├º├úo e combate a inc├¬ndio atendem ├ás exig├¬ncias locais (possui Certificado/Laudo do Corpo de Bombeiros vigente).', legislation: 'Art. 23 da RDC 502/2021; legisla├º├úo estadual', weight: 10, isCritical: true },
          { id: 'fed-002', sectionId: 'sec-fed-01', order: 4, description: 'A infraestrutura f├¡sica atende aos requisitos de habitabilidade, higiene, salubridade, seguran├ºa e garante a independ├¬ncia e mobilidade dos residentes.', legislation: 'Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-003', sectionId: 'sec-fed-01', order: 5, description: 'Quando o terreno apresenta desn├¡veis, a edifica├º├úo ├® dotada de rampas com corrim├úos para facilitar o acesso e a movimenta├º├úo dos residentes, em conformidade com a ABNT NBR 9050.', legislation: 'Art. 22 da RDC 502/2021; ABNT NBR 9050', weight: 10, isCritical: true },
          { id: 'fed-004', sectionId: 'sec-fed-01', order: 6, description: 'As circula├º├Áes internas principais possuem largura m├¡nima de 1,50m e as secund├írias, no m├¡nimo 1,00m, garantindo a passagem de cadeiras de rodas e macas.', legislation: 'Art. 25 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-005', sectionId: 'sec-fed-01', order: 7, description: 'Em caso de edifica├º├úo com mais de um pavimento que n├úo possua rampa com especifica├º├Áes da ABNT, disp├Áe de elevador.', legislation: 'Art. 26 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-006', sectionId: 'sec-fed-01', order: 8, description: 'Todas as portas possuem v├úo livre com largura m├¡nima de 1,10m e travamento simples, sem o uso de trancas ou chaves, permitindo abertura imediata em situa├º├úo de emerg├¬ncia.', legislation: 'Art. 27 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-007', sectionId: 'sec-fed-01', order: 9, description: 'Janelas e guarda-corpos possuem peitoris com altura m├¡nima de 1,00m, garantindo a seguran├ºa dos residentes contra quedas.', legislation: 'Art. 28 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-008', sectionId: 'sec-fed-01', order: 10, description: 'Possui sala de conviv├¬ncia com ├írea m├¡nima de 1,3 m┬▓ (um v├¡rgula tr├¬s metros quadrados) por residente.', legislation: 'Art. 29, Inciso II da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-009', sectionId: 'sec-fed-01', order: 11, description: 'Possui ambiente para guarda de material de limpeza (DML), provido de tanque e ├írea para guarda de saneantes e utens├¡lios.', legislation: 'Art. 29, Inciso XI da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-010', sectionId: 'sec-fed-01', order: 12, description: 'Possui sala para atividades de assist├¬ncia individualizada e sigilosa (assist├¬ncia social, psicol├│gica, sa├║de, etc).', legislation: 'Art. 29, Inciso II, item 3, da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-011', sectionId: 'sec-fed-01', order: 13, description: 'Possui espa├ºo destinado para os servi├ºos administrativos da institui├º├úo.', legislation: 'Art. 29, Inciso XII da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-012', sectionId: 'sec-fed-01', order: 14, description: 'As instala├º├Áes el├®tricas n├úo apresentam fia├º├úo exposta ou componentes danificados que ofere├ºam risco aos residentes e trabalhadores.', legislation: 'NR-10; Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 2 _______________________________________
      {
        id: 'sec-fed-02',
        title: 'Dormit├│rios',
        order: 2,
        items: [
          { id: 'fed-013', sectionId: 'sec-fed-02', order: 1, description: 'Dormit├│rios s├úo separados por sexo e possuem no m├íximo 4 (quatro) camas por ambiente.', legislation: 'Al├¡nea "a", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-014', sectionId: 'sec-fed-02', order: 2, description: 'Dormit├│rios para 1 (uma) pessoa possuem ├írea m├¡nima de 7,50 m┬▓ (sete v├¡rgula cinquenta metros quadrados).', legislation: 'Al├¡nea "a.1", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-015', sectionId: 'sec-fed-02', order: 3, description: 'Dormit├│rios de 2 a 4 pessoas possuem ├írea m├¡nima de 5,50 m┬▓ (cinco v├¡rgula cinquenta metros quadrados) por cama.', legislation: 'Al├¡nea "a.2", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-016', sectionId: 'sec-fed-02', order: 4, description: 'Dormit├│rios s├úo dotados de luz de vig├¡lia e campainha de alarme pr├│ximos a cada cama.', legislation: 'Al├¡nea "b", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-016a', sectionId: 'sec-fed-02', order: 5, description: 'Os colch├Áes, colchonetes e demais mobili├írios almofadados s├úo revestidos de material lav├ível e imperme├ível, sem furos ou rasgos.', legislation: 'Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-017', sectionId: 'sec-fed-02', order: 6, description: 'Existe dist├óncia m├¡nima de 0,80m (oitenta cent├¡metros) entre duas camas.', legislation: 'Al├¡nea "c", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 3  _______________________________________
      {
        id: 'sec-fed-03',
        title: 'Banheiros',
        order: 3,
        items: [
          { id: 'fed-018', sectionId: 'sec-fed-03', order: 1, description: 'Os banheiros possuem ├írea m├¡nima de 3,60 m┬▓.', legislation: 'Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-019', sectionId: 'sec-fed-03', order: 2, description: 'Cada banheiro ├® provido, no m├¡nimo, de 1 bacia sanit├íria, 1 lavat├│rio e 1 chuveiro, garantindo a privacidade do residente.', legislation: 'Al├¡nea "a", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-020', sectionId: 'sec-fed-03', order: 3, description: 'O piso do banheiro ├® projetado sem desn├¡vel em forma de degrau, utilizando caimento para escoamento da ├ígua.', legislation: 'Al├¡nea "b", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-021', sectionId: 'sec-fed-03', order: 4, description: 'Possui barras de apoio instaladas no lavat├│rio, na bacia sanit├íria e no chuveiro.', legislation: 'Al├¡nea "c", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 4 
      {
        id: 'sec-fed-04',
        title: 'Medicamentos',
        order: 4,
        items: [
          { id: 'fed-022', sectionId: 'sec-fed-04', order: 1, description: 'Os medicamentos em uso pelos idosos est├úo sob responsabilidade do Respons├ível T├®cnico (RT), respeitando os regulamentos de vigil├óncia sanit├íria quanto ├á guarda, sendo vedado o estoque sem prescri├º├úo m├®dica.', legislation: 'Art. 40 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-023', sectionId: 'sec-fed-04', order: 2, description: 'Medicamentos sujeitos a controle especial (psicotr├│picos) s├úo obrigatoriamente guardados sob chave ou outro dispositivo que ofere├ºa seguran├ºa, em local exclusivo, com registros de controle.', legislation: 'Art. 67 da Portaria SVS/MS 344/1998', weight: 10, isCritical: true },
          { id: 'fed-024', sectionId: 'sec-fed-04', order: 3, description: 'Possui geladeira exclusiva com term├┤metro e planilha de registro para controle di├írio de temperatura de medicamentos termol├íbeis.', legislation: 'Art. 40 da RDC 502/2021; RDC ANVISA n┬║ 430/2020', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 5 _______________________________________
      {
        id: 'sec-fed-05',
        title: 'Servi├ºo de Nutri├º├úo',
        order: 5,
        items: [
          { id: 'fed-025', sectionId: 'sec-fed-05', order: 1, description: '├ë garantido aos residentes o fornecimento de, no m├¡nimo, 6 (seis) refei├º├Áes di├írias.', legislation: 'Art. 44 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-026', sectionId: 'sec-fed-05', order: 2, description: 'A alimenta├º├úo ├® fornecida de acordo com as necessidades nutricionais e condi├º├Áes de sa├║de dos residentes.', legislation: 'Art. 44 e Art. 45 da RDC 502/2021; RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-027', sectionId: 'sec-fed-05', order: 3, description: 'O servi├ºo possui e implementa o Manual de Boas Pr├íticas e os Procedimentos Operacionais Padronizados (POPs), mantendo-os acess├¡veis aos funcion├írios envolvidos e ├á autoridade sanit├íria.', legislation: 'Itens 4.11.1 e 4.11.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-028', sectionId: 'sec-fed-05', order: 4, description: 'Caso realize preparo de Terapia de Nutri├º├úo Enteral (TNE) no local, possui ├írea exclusiva e adequada para esta manipula├º├úo.', legislation: 'Arts. 1┬║ e 101 da RDC ANVISA n┬║ 503/2021', weight: 5, isCritical: false },
          { id: 'fed-029', sectionId: 'sec-fed-05', order: 5, description: 'Instala├º├Áes f├¡sicas (piso, parede e teto) possuem revestimento liso, imperme├ível, lav├ível e em bom estado de conserva├º├úo.', legislation: 'Item 4.1.3 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-030', sectionId: 'sec-fed-05', order: 6, description: 'Acessos ├ás ├íreas de prepara├º├úo de alimentos s├úo controlados e independentes, n├úo sendo utilizados como passagem.', legislation: 'Item 4.1.1 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-031', sectionId: 'sec-fed-05', order: 7, description: 'Portas externas possuem fechamento autom├ítico e protetor de rodap├®. Janelas e aberturas s├úo dotadas de telas milim├®tricas remov├¡veis para facilitar a limpeza.', legislation: 'Item 4.1.4 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-032', sectionId: 'sec-fed-05', order: 8, description: 'Disp├Áe de lavat├│rio exclusivo para lavagem das m├úos na ├írea de manipula├º├úo, provido obrigatoriamente de sabonete l├¡quido inodoro, toalha de papel n├úo reciclado e lixeira com tampa de acionamento sem contato manual.', legislation: 'Item 4.1.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-033', sectionId: 'sec-fed-05', order: 9, description: 'Existem cartazes de orienta├º├úo sobre a correta higieniza├º├úo das m├úos afixados em locais de f├ícil visualiza├º├úo, inclusive nas instala├º├Áes sanit├írias e lavat├│rios.', legislation: 'Item 4.6.5 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-034', sectionId: 'sec-fed-05', order: 10, description: 'Os res├¡duos s├úo frequentemente coletados e estocados em local fechado e isolado da ├írea de prepara├º├úo, evitando a contamina├º├úo cruzada e atra├º├úo de pragas.', legislation: 'Item 4.5.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-035', sectionId: 'sec-fed-05', order: 11, description: 'Manipuladores de alimentos que apresentam les├Áes ou sintomas de enfermidades que possam comprometer a seguran├ºa dos alimentos s├úo afastados da atividade de manipula├º├úo.', legislation: 'Item 4.6.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-036', sectionId: 'sec-fed-05', order: 12, description: 'Manipuladores de alimentos apresentam-se com uniformes compat├¡veis ├á atividade, conservados e limpos, cabelos protegidos por redes ou toucas, unhas curtas e sem adornos.', legislation: 'Itens 4.6.3 e 4.6.6 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-037', sectionId: 'sec-fed-05', order: 13, description: 'Equipamentos e utens├¡lios que entram em contato com alimentos s├úo lisos, imperme├íveis, lav├íveis e mantidos em adequado estado de conserva├º├úo.', legislation: 'Item 4.1.17 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-038', sectionId: 'sec-fed-05', order: 14, description: 'Os utens├¡lios utilizados na higieniza├º├úo (esponjas, escovas) s├úo pr├│prios para a atividade, conservados e limpos, sem utiliza├º├úo de materiais que retenham res├¡duos ou liberem fragmentos f├¡sicos (como palha de a├ºo).', legislation: 'Item 4.1.11 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-039', sectionId: 'sec-fed-05', order: 15, description: 'Aus├¬ncia de objetos em desuso ou estranhos ao ambiente na ├írea de prepara├º├úo de alimentos.', legislation: 'Item 4.1.7 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-040', sectionId: 'sec-fed-05', order: 16, description: 'O fluxo de preparo e os procedimentos adotados evitam o contato direto ou indireto entre alimentos crus, semipreparados e prontos para o consumo, minimizando o risco de contamina├º├úo cruzada.', legislation: 'Item 4.8.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-041', sectionId: 'sec-fed-05', order: 17, description: 'Utiliza saneantes regularizados no Minist├®rio da Sa├║de para a higieniza├º├úo de hortifrut├¡colas.', legislation: 'Item 4.8.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-042n', sectionId: 'sec-fed-05', order: 18, description: 'O descongelamento de alimentos ├® efetuado em condi├º├Áes de refrigera├º├úo ├á temperatura inferior a 5┬║C ou em forno micro-ondas, sendo vedado o descongelamento ├á temperatura ambiente.', legislation: 'Item 4.8.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-043n', sectionId: 'sec-fed-05', order: 19, description: 'Os alimentos preparados conservados a quente s├úo mantidos ├á temperatura superior a 60┬║C (sessenta graus Celsius) por, no m├íximo, 6 (seis) horas.', legislation: 'Item 4.8.15 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-044n', sectionId: 'sec-fed-05', order: 20, description: 'A Institui├º├úo disp├Áe de condi├º├Áes para armazenamento, mantendo mat├®rias-primas em temperatura recomendada pelo fabricante.', legislation: 'Art. 45 da RDC 502/2021; Item 4.8.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-045n', sectionId: 'sec-fed-05', order: 21, description: 'Mat├®rias-primas e ingredientes que n├úo forem utilizados em sua totalidade est├úo adequadamente acondicionados e identificados com data de fracionamento e novo prazo de validade ap├│s a abertura.', legislation: 'Item 4.7.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-046n', sectionId: 'sec-fed-05', order: 22, description: 'Alimentos armazenados em local limpo, organizado, dispostos sobre paletes, estrados ou prateleiras adequadas, distantes do piso, paredes e teto.', legislation: 'Item 4.7.5 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },

      // SE├ç├âO 6 _______________________________________
      {
        id: 'sec-fed-06',
        title: 'Refeit├│rio',
        order: 6,
        items: [
          { id: 'fed-042', sectionId: 'sec-fed-06', order: 1, description: 'Refeit├│rio possui ├írea m├¡nima de 1,00 m┬▓ por usu├írio, acrescido de local para guarda de lanches, lavat├│rio para higieniza├º├úo das m├úos e luz de vig├¡lia.', legislation: 'Art. 29, Inciso VII da RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      // SE├ç├âO 7  _______________________________________
      {
        id: 'sec-fed-07',
        title: 'Lavanderia',
        order: 7,
        items: [
          { id: 'fed-043', sectionId: 'sec-fed-07', order: 1, description: 'Quando houver processamento de roupas na Institui├º├úo, possui ambientes distintos para lavagem e para guarda de roupas.', legislation: 'Art. 29, Inciso IX e X, da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-044', sectionId: 'sec-fed-07', order: 2, description: 'As roupas de uso pessoal dos residentes est├úo devidamente identificadas, visando a manuten├º├úo da individualidade e humaniza├º├úo.', legislation: 'Art. 49 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-044b', sectionId: 'sec-fed-07', order: 3, description: 'A Institui├º├úo mant├®m dispon├¡veis as rotinas t├®cnicas (POPs) do processamento de roupas de uso pessoal e coletivo, contemplando separa├º├úo, processamento e guarda e troca de roupas de uso coletivo.', legislation: 'Art. 47 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-044c', sectionId: 'sec-fed-07', order: 4, description: 'A Institui├º├úo possibilita aos idosos com grau de depend├¬ncia I (independentes) efetuarem o processamento de suas pr├│prias roupas de uso pessoal.', legislation: 'Art. 48 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'fed-045', sectionId: 'sec-fed-07', order: 5, description: 'Nos casos de terceiriza├º├úo do servi├ºo de lavanderia, a Institui├º├úo possui contrato formal e mant├®m c├│pia do alvar├í sanit├írio da empresa contratada.', legislation: 'Art. 14 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-046', sectionId: 'sec-fed-07', order: 6, description: 'Utiliza exclusivamente produtos saneantes devidamente regularizados na Anvisa.', legislation: 'Art. 50 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 8
      {
        id: 'sec-fed-08',
        title: 'Assist├¬ncia Integral ao Residente',
        order: 8,
        items: [
          { id: 'fed-048', sectionId: 'sec-fed-08', order: 1, description: 'O Respons├ível T├®cnico institui e mant├®m prontu├írio individual do residente, organizado e atualizado, contendo dados de identifica├º├úo, evolu├º├úo e intercorr├¬ncias.', legislation: 'Art. 33 da RDC 502/2021; Art. 50, Inciso XV, da Lei Federal n┬║ 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-049', sectionId: 'sec-fed-08', order: 2, description: 'Mant├®m o cart├úo de vacina├º├úo dos residentes atualizado, em conformidade com o calend├írio do Programa Nacional de Imuniza├º├Áes (PNI).', legislation: 'Art. 39 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-050', sectionId: 'sec-fed-08', order: 3, description: 'A ILPI desenvolve atividades f├¡sicas, recreativas e de lazer, com base no PAISI e nas condi├º├Áes dos residentes.', legislation: 'Art. 32 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-051', sectionId: 'sec-fed-08', order: 4, description: 'A institui├º├úo realiza a notifica├º├úo compuls├│ria de agravos e doen├ºas ├á vigil├óncia epidemiol├│gica e sanit├íria.', legislation: 'Art. 54 da RDC 502/2021; Portaria de Consolida├º├úo MS n┬║ 4/2017', weight: 10, isCritical: true },
          { id: 'fed-052', sectionId: 'sec-fed-08', order: 5, description: 'Possui registro e realiza a notifica├º├úo ├á autoridade sanit├íria local da ocorr├¬ncia de eventos sentinela (ex: quedas com les├Áes graves).', legislation: 'Art. 55 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-053', sectionId: 'sec-fed-08', order: 6, description: 'Garante a conviv├¬ncia familiar e comunit├íria, assegurando hor├írios e dias flex├¡veis para visitas.', legislation: 'Art. 6┬║, Inciso I, da RDC 502/2021; Art. 49, Inciso II, da Lei Federal n┬║ 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-054', sectionId: 'sec-fed-08', order: 7, description: 'Em caso de intercorr├¬ncia m├®dica, o Respons├ível T├®cnico providencia o encaminhamento imediato do idoso ao servi├ºo de sa├║de de refer├¬ncia.', legislation: 'Art. 42 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054a', sectionId: 'sec-fed-08', order: 8, description: 'A institui├º├úo comunica ├á Secretaria Municipal de Assist├¬ncia Social ou cong├¬nere, bem como ao Minist├®rio P├║blico, a situa├º├úo de abandono familiar do idoso ou a aus├¬ncia de identifica├º├úo civil.', legislation: 'Art. 34 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054b', sectionId: 'sec-fed-08', order: 9, description: 'A institui├º├úo elabora a cada 2 (dois) anos e avalia anualmente o Plano de Aten├º├úo Integral ├á Sa├║de dos Residentes (PAISI) para cada idoso.', legislation: 'Arts. 36 e 38 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054c', sectionId: 'sec-fed-08', order: 10, description: 'Possui arquivo de anota├º├Áes (livro de ocorr├¬ncias/plant├úo) contendo data e circunst├óncias do atendimento di├írio e intercorr├¬ncias de cada residente.', legislation: 'Art. 50, Inciso XV da Lei 10.741/2003; Art. 33 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 9
      {
        id: 'sec-fed-09',
        title: 'Sa├║de e Seguran├ºa do Trabalhador',
        order: 9,
        items: [
          { id: 'fed-058a', sectionId: 'sec-fed-09', order: 1, description: 'A institui├º├úo garante aos trabalhadores a avalia├º├úo de sa├║de admissional, peri├│dica e demissional, implementando o PCMSO e PGR.', legislation: 'NR-7; NR-1', weight: 5, isCritical: false },
          { id: 'fed-058b', sectionId: 'sec-fed-09', order: 2, description: 'A institui├º├úo fornece aos trabalhadores os Equipamentos de Prote├º├úo Individual (EPI), adequados aos riscos das atividades desenvolvidas.', legislation: 'NR-6; NR-32', weight: 10, isCritical: true },
          { id: 'fed-058c', sectionId: 'sec-fed-09', order: 3, description: 'Existe comprova├º├úo do esquema de vacina├º├úo atualizado dos profissionais da institui├º├úo.', legislation: 'NR-32', weight: 5, isCritical: false },
          { id: 'fed-058d', sectionId: 'sec-fed-09', order: 4, description: 'A institui├º├úo disp├Áe de instala├º├Áes sanit├írias, vesti├írios e locais para refei├º├Áes exclusivos para os trabalhadores.', legislation: 'NR-24', weight: 5, isCritical: false },
        ],
      },

      // SE├ç├âO 10
      {
        id: 'sec-fed-10',
        title: 'Gest├úo de Res├¡duos (PGRSS)',
        order: 10,
        items: [
          { id: 'fed-059', sectionId: 'sec-fed-10', order: 1, description: 'O servi├ºo elaborou, implantou e mant├®m atualizado o Plano de Gerenciamento de Res├¡duos de Servi├ºos de Sa├║de (PGRSS).', legislation: 'Art. 5┬║ da RDC 222/2018', weight: 10, isCritical: true },
          { id: 'fed-060', sectionId: 'sec-fed-10', order: 2, description: 'Possui abrigo de res├¡duos s├│lidos externo ├á edifica├º├úo para armazenamento tempor├írio.', legislation: 'Art. 29, Inciso XIV, da RDC 502/2021; RDC 222/2018', weight: 10, isCritical: true },
          { id: 'fed-061', sectionId: 'sec-fed-10', order: 3, description: 'Os materiais perfurocortantes s├úo descartados no local de gera├º├úo em recipientes r├¡gidos, providos de tampa.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
          { id: 'fed-062', sectionId: 'sec-fed-10', order: 4, description: 'Os recipientes para coleta interna de res├¡duos possuem tampa provida de sistema de abertura sem contato manual e s├úo identificados.', legislation: 'RDC 222/2018', weight: 5, isCritical: false },
          { id: 'fed-063', sectionId: 'sec-fed-10', order: 5, description: 'A institui├º├úo possui contrato formal com empresa licenciada para coleta, tratamento e destina├º├úo final de res├¡duos infectantes e perfurocortantes.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 11
      {
        id: 'sec-fed-11',
        title: '├ügua e Controle de Pragas',
        order: 11,
        items: [
          { id: 'fed-064', sectionId: 'sec-fed-11', order: 1, description: 'A institui├º├úo utiliza ├ígua pot├ível para consumo e preparo de alimentos, e o reservat├│rio de ├ígua ├® higienizado no m├¡nimo a cada 6 (seis) meses, mantendo-se o registro da opera├º├úo.', legislation: 'Art. 46 da RDC 502/2021; Item 4.3 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-065', sectionId: 'sec-fed-11', order: 2, description: 'Possui programa de controle de vetores e pragas urbanas executado por empresa especializada e licenciada.', legislation: 'Art. 46 da RDC 502/2021; Item 4.4.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-066', sectionId: 'sec-fed-11', order: 3, description: 'A edifica├º├úo, as instala├º├Áes e os equipamentos s├úo mantidos livres de vetores e pragas urbanas, sendo adotadas medidas preventivas como o uso de telas e ralos sifonados.', legislation: 'Item 4.4.1 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },

      // SE├ç├âO 12
      {
        id: 'sec-fed-12',
        title: 'Recursos Humanos',
        order: 12,
        items: [
          { id: 'fed-067', sectionId: 'sec-fed-12', order: 1, description: 'A ILPI conta com Respons├ível T├®cnico (RT) com forma├º├úo de n├¡vel superior, v├¡nculo formal de trabalho e carga hor├íria m├¡nima de 20 (vinte) horas semanais.', legislation: 'Arts. 10 e 11 e 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-068', sectionId: 'sec-fed-12', order: 2, description: 'A propor├º├úo de cuidadores para residentes de Grau de Depend├¬ncia I atende ao m├¡nimo exigido: 1 (um) cuidador para cada 20 (vinte) residentes, com carga hor├íria de 8h/dia.', legislation: 'Al├¡nea "a", Inciso I do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-069', sectionId: 'sec-fed-12', order: 3, description: 'A propor├º├úo de cuidadores para residentes de Grau de Depend├¬ncia II atende ao m├¡nimo exigido: 1 (um) cuidador para cada 10 (dez) residentes, por turno.', legislation: 'Al├¡nea "b", Inciso I do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-070', sectionId: 'sec-fed-12', order: 4, description: 'A propor├º├úo de cuidadores para residentes de Grau de Depend├¬ncia III atende ao m├¡nimo exigido: 1 (um) cuidador para cada 6 (seis) residentes, por turno.', legislation: 'Al├¡nea "c", Inciso I do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-071', sectionId: 'sec-fed-12', order: 5, description: 'A institui├º├úo disp├Áe de 1 (um) profissional para atividades de lazer para cada 40 (quarenta) residentes, com carga hor├íria de 12 (doze) horas semanais.', legislation: 'Inciso III do Art. 16 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-072', sectionId: 'sec-fed-12', order: 6, description: 'A institui├º├úo disp├Áe de 1 (um) profissional de limpeza para cada 100m┬▓ (cem metros quadrados) de ├írea interna ou fra├º├úo, por turno, diariamente.', legislation: 'Inciso IV do Art. 16 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-072b', sectionId: 'sec-fed-12', order: 7, description: 'Quando o servi├ºo de lavanderia for realizado internamente, a institui├º├úo disp├Áe de 1 (um) profissional para cada 30 (trinta) residentes ou fra├º├úo, diariamente.', legislation: 'Inciso VI do Art. 16 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'fed-073', sectionId: 'sec-fed-12', order: 8, description: 'A institui├º├úo disp├Áe de 1 (um) profissional no servi├ºo de alimenta├º├úo para cada 20 (vinte) residentes, garantindo a cobertura de 2 (dois) turnos de 8 (oito) horas.', legislation: 'Inciso V do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-074', sectionId: 'sec-fed-12', order: 9, description: 'A ILPI garante a capacita├º├úo e a educa├º├úo permanente dos profissionais envolvidos na presta├º├úo dos servi├ºos, mantendo registros dessa capacita├º├úo.', legislation: 'Art. 18 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-075a', sectionId: 'sec-fed-12', order: 10, description: 'Apresenta contratos que comprovem o v├¡nculo formal de trabalho de todos os recursos humanos atuantes na institui├º├úo.', legislation: 'Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-076a', sectionId: 'sec-fed-12', order: 11, description: 'Apresenta escala de trabalho atualizada comprovando o quantitativo m├¡nimo de cuidadores por turno exigido para o Grau I (1:20), Grau II (1:10) e Grau III (1:6).', legislation: 'Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SE├ç├âO 13
      {
        id: 'sec-fed-13',
        title: 'Documenta├º├úo Administrativa',
        order: 13,
        items: [
          { id: 'fed-075', sectionId: 'sec-fed-13', order: 1, description: 'Possui Estatuto ou Contrato Social e ata de elei├º├úo da diretoria atual (quando aplic├ível).', legislation: 'Incisos I e II do Art. 9┬║ da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-076', sectionId: 'sec-fed-13', order: 2, description: 'Possui Regimento Interno.', legislation: 'Inciso III do Art. 9┬║ da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-077', sectionId: 'sec-fed-13', order: 3, description: 'A institui├º├úo de longa perman├¬ncia possui inscri├º├úo e registro de seus programas junto ao Conselho Municipal da Pessoa Idosa (CMDI) ou Estadual (CEDI).', legislation: 'Art. 48 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-078', sectionId: 'sec-fed-13', order: 4, description: 'A ILPI celebra contrato formal e escrito de presta├º├úo de servi├ºos com o residente ou com seu representante legal, estabelecendo direitos, deveres, valores e forma de reajuste.', legislation: 'Art. 12 da RDC 502/2021; Art. 35 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-079', sectionId: 'sec-fed-13', order: 5, description: 'A ILPI possui Procedimentos Operacionais Padr├úo (POP) escritos, atualizados e implantados referentes a todas as atividades desenvolvidas na institui├º├úo.', legislation: 'Art. 41 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-080', sectionId: 'sec-fed-13', order: 6, description: 'A institui├º├úo possui Plano de Trabalho compat├¡vel com os princ├¡pios do Estatuto da Pessoa Idosa, apresentado no ato de inscri├º├úo no conselho competente.', legislation: 'Par├ígrafo ├║nico do Art. 48 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-081', sectionId: 'sec-fed-13', order: 7, description: 'A institui├º├úo realiza avalia├º├úo continuada de desempenho levando em conta, no m├¡nimo, os indicadores de taxa de mortalidade, e incid├¬ncia de DDA, escabiose, desidrata├º├úo, ├║lcera de dec├║bito e desnutri├º├úo.', legislation: 'Art. 59 e Anexo da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-082', sectionId: 'sec-fed-13', order: 8, description: 'A Institui├º├úo encaminha ├á Vigil├óncia Sanit├íria local, todo m├¬s de janeiro, o consolidado dos indicadores referentes ao ano anterior.', legislation: 'Art. 60 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },
    ],
  },
];

export function getTemplates(): ChecklistTemplate[] {
  return templates;
}

export function getTemplatesByCategory(category: string): ChecklistTemplate[] {
  return templates.filter(t => t.category === category);
}

export function getTemplateById(id: string): ChecklistTemplate | undefined {
  return templates.find(t => t.id === id);
}

/**
 * Enriches a base template with regional supplements based on client info.
 * Logic:
 * - If ILPI and state is GO -> Merge with templateIlpiGoiasSuplement
 */
export function enrichTemplate(template: ChecklistTemplate, client: Client): ChecklistTemplate {
  // 1. ILPI GOIAS Logic
  if (template.id === 'tpl-ilpi-federal-v1' && client.state === 'GO') {
    const supplement = templateIlpiGoiasSuplement;
    
    // Create a deep copy of sections to avoid mutating the base template
    const sections = JSON.parse(JSON.stringify(template.sections));

    // A. Apply Section Additions (Items that go into existing sections)
    supplement.sectionAdditions.forEach(addition => {
      const targetSection = sections.find((s: any) => s.id === addition.targetSectionId);
      if (targetSection) {
        // Merge items (preventing duplicate IDs if any)
        const existingIds = new Set(targetSection.items.map((i: any) => i.id));
        addition.items.forEach(newItem => {
          if (!existingIds.has(newItem.id)) {
            targetSection.items.push(newItem);
          }
        });
        // Sort items by order
        targetSection.items.sort((a: any, b: any) => a.order - b.order);
      }
    });

    // B. Apply New Sections
    if (supplement.newSections) {
      supplement.newSections.forEach(newSec => {
        if (!sections.find((s: any) => s.id === newSec.id)) {
          sections.push(newSec);
        }
      });
    }

    return {
      ...template,
      name: `${template.name} (+ Suplemento GO)`,
      sections: sections.sort((a: any, b: any) => a.order - b.order)
    };
  }

  // 2. RJ Items (Alimentos) are already baked into separate templates for now, 
  // but we could add dynamic logic here too if needed.

  return template;
}

export function getTotalItems(template: ChecklistTemplate): number {
  return template.sections.reduce((sum, s) => sum + s.items.length, 0);
}

export function getCriticalItemsCount(template: ChecklistTemplate): number {
  return template.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.isCritical).length, 0
  );
}

