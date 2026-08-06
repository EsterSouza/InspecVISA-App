// REF-06 — roteiros históricos reconstruídos do git, para congelar relatórios antigos.
//
// Estes dois roteiros não existem mais em `src/data/templates.ts` nem no banco, mas há
// inspeções concluídas cujas respostas foram gravadas contra eles. Sem o texto das
// perguntas, o relatório entregue renderiza o item degradado ("Item preservado do
// relatorio concluido (<id>)"). Copiados sem alteração de:
//
//   roteiroIlpiV1        — `tpl-ilpi-v1`, commit e6ee078 (105 itens, 13 seções).
//                          Confere com as 105 respostas da inspeção da ILHA DO GOVERNADOR.
//   roteiroIlpiFederal97 — `tpl-ilpi-federal-v1`, commit d76b234 (97 itens, 13 seções).
//                          Confere seção a seção com o Resumo Executivo do PDF entregue ao
//                          Lar Recanto do Sossego em 14/04/2026 (14/6/4/3/22/1/6/10/4/5/3/11/8).
//
// NÃO EDITAR. O valor deste arquivo é ser fiel ao que a consultora respondeu na época.
import type { ChecklistTemplate } from '../../src/types';

export const roteiroIlpiV1: ChecklistTemplate = {
    id: 'tpl-ilpi-v1',
    name: 'Roteiro de Inspeção — ILPI (RDC 502/2021)',
    category: 'ilpi',
    version: '11/2024',
    sections: [

      // ── SEÇÃO 1 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-01',
        title: 'Estrutura Física — Geral',
        order: 1,
        items: [
          { id: 'ilpi-001', sectionId: 'sec-ilpi-01', order: 1,  description: 'Identificação externa do estabelecimento visível.', legislation: 'Parágrafo 2º do Art. 37 da Lei Federal 10.741/2003', weight: 5, isCritical: false },
          { id: 'ilpi-002', sectionId: 'sec-ilpi-01', order: 2,  description: 'Instalações físicas em condições adequadas de habitabilidade, higiene, salubridade, segurança e organização.', legislation: 'Capítulo II, Seção IV, Art. 21 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-003', sectionId: 'sec-ilpi-01', order: 3,  description: 'Acessos independentes (pelo menos dois).', legislation: 'Capítulo II, Seção IV, Art. 24, item I – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-004', sectionId: 'sec-ilpi-01', order: 4,  description: 'Janelas e guarda-corpos com peitoris de no mínimo 1,00m.', legislation: 'Capítulo II, Seção IV, Art. 28 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-005', sectionId: 'sec-ilpi-01', order: 5,  description: 'Pisos internos e externos (inclusive rampas e escadas) de fácil limpeza e conservação, uniformes, com mecanismo antiderrapante.', legislation: 'Capítulo II, Seção IV, Art. 24, Item II – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-006', sectionId: 'sec-ilpi-01', order: 6,  description: 'Possui elevador que segue especificações da ABNT NBR 9050/2015.', legislation: 'Capítulo II, Seção IV, Art. 26 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-007', sectionId: 'sec-ilpi-01', order: 7,  description: 'Possui rampas de acesso adequadas (inclinação, dimensionamento, corrimão e sinalização).', legislation: 'Capítulo II, Seção IV, Art. 24, Item III – RDC 502/2021; NBR 9050/ABNT', weight: 5, isCritical: false },
          { id: 'ilpi-008', sectionId: 'sec-ilpi-01', order: 8,  description: 'Escadas adequadas (dimensionamento, corrimão e sinalização).', legislation: 'Capítulo II, Seção IV, Art. 24, Item III – RDC 502/2021; NBR 9050/ABNT', weight: 5, isCritical: false },
          { id: 'ilpi-009', sectionId: 'sec-ilpi-01', order: 9,  description: 'Circulações internas principais com largura mínima de 1,00m e secundárias com largura mínima de 0,80m, com luz de vigília permanente.', legislation: 'Capítulo II, Seção IV, Art. 25 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-010', sectionId: 'sec-ilpi-01', order: 10, description: 'Possui Depósito de Material de Limpeza (DML).', legislation: 'Capítulo II, Seção IV, Art. 29, Item XI – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-011', sectionId: 'sec-ilpi-01', order: 11, description: 'Portas com vão livre de 0,20m na parte inferior, largura mínima de 1,10m, com travamento simples sem uso de trancas ou chaves (circulações internas).', legislation: 'Capítulo II, Seção IV, Art. 27 – RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-012', sectionId: 'sec-ilpi-01', order: 12, description: 'Ausência de fiação exposta ou fios danificados em qualquer dependência.', legislation: 'Art. 65º da Lei Municipal 13725/2004', weight: 10, isCritical: true },
          { id: 'ilpi-013', sectionId: 'sec-ilpi-01', order: 13, description: 'Atestado de funcionamento emitido pelo Corpo de Bombeiros (CBMERJ).', legislation: 'CBMERJ', weight: 10, isCritical: true },
          { id: 'ilpi-014', sectionId: 'sec-ilpi-01', order: 14, description: 'Possui sala de convivência com área mínima de 1,3m² por pessoa.', legislation: 'Seção II, Art. 29 item 2 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-015', sectionId: 'sec-ilpi-01', order: 15, description: 'Possui cozinha.', legislation: 'Seção IV, Art. 29, Item VIII – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-016', sectionId: 'sec-ilpi-01', order: 16, description: 'Possui despensa organizada e adequada.', legislation: 'RDC 216/2004; Seção IV, Art. 29 item VIII da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-017', sectionId: 'sec-ilpi-01', order: 17, description: 'Possui refeitório com área mínima de 1m² por usuário, acrescido de lavatório.', legislation: 'Art. 29, Item VII da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-018', sectionId: 'sec-ilpi-01', order: 18, description: 'Consultório para atendimento individualizado, incluindo o serviço social.', legislation: 'Seção I, Art. 6º II da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-019', sectionId: 'sec-ilpi-01', order: 19, description: 'Possui posto de enfermagem organizado, provido de lavatório e anexos.', legislation: 'RDC 50/2002; Art. 17 da RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-020', sectionId: 'sec-ilpi-01', order: 20, description: 'Lixeira com tampa com acionamento sem contato manual em todos os ambientes.', legislation: 'Portaria SUBVISA 385/2018', weight: 5, isCritical: false },
          { id: 'ilpi-021', sectionId: 'sec-ilpi-01', order: 21, description: 'Ralos sifonados, dotados de dispositivos que impeçam a entrada de vetores.', legislation: 'Item 20.5.1 – Portaria Municipal 1210/2006', weight: 5, isCritical: false },
        ],
      },

      // ── SEÇÃO 2 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-02',
        title: 'Dormitórios',
        order: 2,
        items: [
          { id: 'ilpi-022', sectionId: 'sec-ilpi-02', order: 1, description: 'Dormitórios separados por sexo, para no máximo 4 pessoas, dotados de banheiros.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-023', sectionId: 'sec-ilpi-02', order: 2, description: 'Dormitórios de 01 pessoa com área mínima de 7,50m².', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 1 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-024', sectionId: 'sec-ilpi-02', order: 3, description: 'Dormitórios de 02 a 04 pessoas com área mínima de 5,50m² por cama.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 2 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-025', sectionId: 'sec-ilpi-02', order: 4, description: 'Colchões, colchonetes e demais mobiliários almofadados revestidos de material lavável e impermeável, sem furos, rasgos, sulcos ou reentrâncias.', legislation: 'Art. 56 – RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-026', sectionId: 'sec-ilpi-02', order: 5, description: 'O serviço de saúde estabelece estratégias e ações voltadas para Segurança do Paciente, incluindo mecanismos para prevenção de úlceras por pressão.', legislation: 'Art. 8° RDC 63/2011; VII', weight: 10, isCritical: true },
          { id: 'ilpi-027', sectionId: 'sec-ilpi-02', order: 6, description: 'Dormitórios dotados de luz de vigília e campainha de alarme.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 3 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-028', sectionId: 'sec-ilpi-02', order: 7, description: 'Distância mínima de 0,80m entre duas camas e 0,50m entre a lateral da cama e a parede paralela.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 4 – RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      // ── SEÇÃO 3 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-03',
        title: 'Banheiros',
        order: 3,
        items: [
          { id: 'ilpi-029', sectionId: 'sec-ilpi-03', order: 1, description: 'Banheiros possuem área mínima de 3,60m², com 1 bacia, 1 lavatório e 1 chuveiro, com privacidade.', legislation: 'Capítulo II, Seção IV, Art. 29, Item I: 5 – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-030', sectionId: 'sec-ilpi-03', order: 2, description: 'Banheiros coletivos separados por sexo, com no mínimo um box para vaso sanitário com adaptações para cadeira de rodas e separação entre chuveiro e sanitários.', legislation: 'Capítulo II, Seção IV, Art. 29, Item IV – RDC 502/2021; NBR 9050/ABNT', weight: 5, isCritical: false },
        ],
      },

      // ── SEÇÃO 4 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-04',
        title: 'Medicamentos',
        order: 4,
        items: [
          { id: 'ilpi-031', sectionId: 'sec-ilpi-04', order: 1, description: 'Medicamentos com registro na ANVISA e dentro do prazo de validade, armazenados conforme recomendação do fabricante (umidade, abrigo da luz solar e temperatura).', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
          { id: 'ilpi-032', sectionId: 'sec-ilpi-04', order: 2, description: 'Medicamentos psicotrópicos armazenados em local com acesso restrito e com registros de controle de estoque.', legislation: 'Portaria MS 344/1998', weight: 10, isCritical: true },
          { id: 'ilpi-033', sectionId: 'sec-ilpi-04', order: 3, description: 'Geladeira exclusiva, termômetro digital e planilha com controle de temperatura.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
        ],
      },

      // ── SEÇÃO 5 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-05',
        title: 'Serviço de Nutrição',
        order: 5,
        items: [
          { id: 'ilpi-034', sectionId: 'sec-ilpi-05', order: 1,  description: 'São servidas no mínimo seis refeições diárias.', legislation: 'RDC 502/2021, Capítulo II, Subseção III, Art. 44', weight: 10, isCritical: true },
          { id: 'ilpi-035', sectionId: 'sec-ilpi-05', order: 2,  description: 'Dispõe de pia para lavagem das mãos com dispensadores de sabão líquido, suporte para papel toalha e lixeira com tampa de acionamento sem contato manual.', legislation: 'RDC 216/2004', weight: 10, isCritical: true },
          { id: 'ilpi-036', sectionId: 'sec-ilpi-05', order: 3,  description: 'Dietas especiais conforme necessidade do residente.', legislation: 'RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-037', sectionId: 'sec-ilpi-05', order: 4,  description: 'Dietas enterais são manipuladas em copa exclusiva, dotada de bancada, pia e lavatório OU em horário alternativo ao uso da cozinha.', legislation: 'RDC 63/2000', weight: 5, isCritical: false },
          { id: 'ilpi-038', sectionId: 'sec-ilpi-05', order: 5,  description: 'Paredes e piso de fácil higienização.', legislation: 'Tópico 4.1.3 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-039', sectionId: 'sec-ilpi-05', order: 6,  description: 'Portas teladas e/ou com mecanismos de proteção contra insetos e roedores.', legislation: 'Tópico 4.1.4 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-040', sectionId: 'sec-ilpi-05', order: 7,  description: 'Janelas teladas (as telas devem ser removíveis e de fácil limpeza).', legislation: 'Tópico 4.1.4 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-041', sectionId: 'sec-ilpi-05', order: 8,  description: 'Manipuladores paramentados adequadamente (uniforme fechado, cor clara, sapatos fechados, touca).', legislation: 'Tópico 4.6.3 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-042', sectionId: 'sec-ilpi-05', order: 9,  description: 'Ausência de materiais e equipamentos em desuso e/ou estranhos à atividade.', legislation: 'Tópico 4.1.7 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-043', sectionId: 'sec-ilpi-05', order: 10, description: 'Mobiliários, equipamentos e utensílios constituídos de material de fácil limpeza e higienização, livres de resíduos, em perfeito estado de funcionamento e conservação.', legislation: 'Tópico 4.1.17 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-044', sectionId: 'sec-ilpi-05', order: 11, description: 'Armazenamento dos alimentos em temperatura adequada (geladeira com controle de temperatura registrado). Congelamento: -18°C; Refrigeração: hortifruti até 10°C, carne até 4°C, pescado até 2°C.', legislation: 'RDC 502/2021, Capítulo II, Subseção III, Art. 45', weight: 10, isCritical: true },
          { id: 'ilpi-045', sectionId: 'sec-ilpi-05', order: 12, description: 'Trânsito restrito de pessoas não essenciais à produção de alimentos.', legislation: 'Item 8.1.1 e 8.5 – Portaria Municipal 1210/2006', weight: 5, isCritical: false },
          { id: 'ilpi-046', sectionId: 'sec-ilpi-05', order: 13, description: 'Estoque de alimentos em quantidade suficiente para atender a demanda institucional.', legislation: 'RDC 502/2021, Capítulo II, Subseção III, Art. 46', weight: 10, isCritical: true },
          { id: 'ilpi-047', sectionId: 'sec-ilpi-05', order: 14, description: 'Alimentos armazenados de forma organizada, em local limpo e livre de pragas.', legislation: 'Tópico 4.7.5 – RDC 216/2004; RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-048', sectionId: 'sec-ilpi-05', order: 15, description: 'Dispõe de sanitizante próprio para higienização de hortifrutícolas, com registro na ANVISA e POP para tal procedimento.', legislation: 'RDC 216/2006; Portaria IVISA 002/2020', weight: 10, isCritical: true },
        ],
      },

      // ── SEÇÃO 6 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-06',
        title: 'Refeitório',
        order: 6,
        items: [
          { id: 'ilpi-049', sectionId: 'sec-ilpi-06', order: 1, description: 'Refeitório com área mínima de 1m² por usuário, acrescido de local para guarda de lanches, lavatório para higienização das mãos e luz de vigília.', legislation: 'Capítulo II, Seção IV, Art. 29, Item VII – RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      // ── SEÇÃO 7 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-07',
        title: 'Lavanderia',
        order: 7,
        items: [
          { id: 'ilpi-050', sectionId: 'sec-ilpi-07', order: 1, description: 'Separação de área física (suja e limpa).', legislation: 'Capítulo II, Seção IV, Art. 29, item IX – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-051', sectionId: 'sec-ilpi-07', order: 2, description: 'Possui lavanderia terceirizada e apresentou contrato.', legislation: 'Seção IV, Art. 29, Item IX – RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-052', sectionId: 'sec-ilpi-07', order: 3, description: 'Identificação de roupas de uso pessoal.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-053', sectionId: 'sec-ilpi-07', order: 4, description: 'Produtos utilizados no processamento das roupas possuem registro na ANVISA/MS.', legislation: 'ANVISA', weight: 5, isCritical: false },
        ],
      },

      // ── SEÇÃO 8 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-08',
        title: 'Assistência ao Idoso',
        order: 8,
        items: [
          { id: 'ilpi-054', sectionId: 'sec-ilpi-08', order: 1, description: 'Possui serviço de remoção/contrato estabelecido em Plano.', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-055', sectionId: 'sec-ilpi-08', order: 2, description: 'Elaboração bianual do Plano de Atenção Integral à Saúde dos residentes (PAISI).', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-056', sectionId: 'sec-ilpi-08', order: 3, description: 'Dispõe de atividades ocupacionais.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-057', sectionId: 'sec-ilpi-08', order: 4, description: 'Carteira de Vacinação dos Idosos atualizada.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-058', sectionId: 'sec-ilpi-08', order: 5, description: 'Prontuário individualizado e organizado.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-059', sectionId: 'sec-ilpi-08', order: 6, description: 'Avaliação multiprofissional atualizada.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // ── SEÇÃO 9 ─────────────────────────────────────────────
      {
        id: 'sec-ilpi-09',
        title: 'Saúde do Trabalhador',
        order: 9,
        items: [
          { id: 'ilpi-060', sectionId: 'sec-ilpi-09', order: 1, description: 'Utilização de Equipamentos de Proteção Individual e Coletiva.', legislation: 'NR 32', weight: 5, isCritical: false },
          { id: 'ilpi-061', sectionId: 'sec-ilpi-09', order: 2, description: 'Dispõe de local de descanso para equipe de enfermagem adequado à demanda.', legislation: 'NR 24', weight: 5, isCritical: false },
        ],
      },

      // ── SEÇÃO 10 ────────────────────────────────────────────
      {
        id: 'sec-ilpi-10',
        title: 'Resíduos',
        order: 10,
        items: [
          { id: 'ilpi-062', sectionId: 'sec-ilpi-10', order: 1, description: 'Abrigo externo à edificação para armazenamento de resíduos até o momento da coleta.', legislation: 'Capítulo II, Seção IV, Art. 29, Item XIV – RDC 502/2021; RDC 222/2018', weight: 5, isCritical: false },
          { id: 'ilpi-063', sectionId: 'sec-ilpi-10', order: 2, description: 'Dispor de recipientes identificados e íntegros, de fácil higienização e transporte, em número e capacidade suficientes para conter os resíduos.', legislation: 'Tópico 4.5.1 – RDC 216/2004; RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-064', sectionId: 'sec-ilpi-10', order: 3, description: 'Coletores utilizados para deposição dos resíduos das áreas de preparação e armazenamento de alimentos dotados de tampas acionadas sem contato manual.', legislation: 'Tópico 4.5.3 – RDC 216/2004', weight: 5, isCritical: false },
          { id: 'ilpi-065', sectionId: 'sec-ilpi-10', order: 4, description: 'Descarte de resíduos perfurocortantes em recipiente rígido em saco branco leitoso. Contrato com empresa / PGRSS.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
        ],
      },

      // ── SEÇÃO 11 ────────────────────────────────────────────
      {
        id: 'sec-ilpi-11',
        title: 'Água e Controle de Pragas',
        order: 11,
        items: [
          { id: 'ilpi-066', sectionId: 'sec-ilpi-11', order: 1, description: 'Registro de limpeza do reservatório de água a cada 6 meses.', legislation: 'Lei municipal 10.770/89 arts. 4 e 6', weight: 10, isCritical: true },
          { id: 'ilpi-067', sectionId: 'sec-ilpi-11', order: 2, description: 'Laudo de análise microbiológica da água após limpeza do reservatório.', legislation: 'Lei municipal 10.770/89 arts. 4 e 6', weight: 10, isCritical: true },
          { id: 'ilpi-068', sectionId: 'sec-ilpi-11', order: 3, description: 'Ações eficazes e contínuas de controle de vetores e pragas urbanas. Registro de controle de pragas fornecido por empresa cadastrada no INEA.', legislation: 'RDC 63/2011', weight: 10, isCritical: true },
        ],
      },

      // ── SEÇÃO 12 ────────────────────────────────────────────
      {
        id: 'sec-ilpi-12',
        title: 'Recursos Humanos',
        order: 12,
        items: [
          { id: 'ilpi-069', sectionId: 'sec-ilpi-12', order: 1,  description: 'Médico com número registrado (CREMERJ).', legislation: 'Lei 8049/18; CREMERJ nº 192/2021', weight: 10, isCritical: true },
          { id: 'ilpi-070', sectionId: 'sec-ilpi-12', order: 2,  description: 'Enfermeiro.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-071', sectionId: 'sec-ilpi-12', order: 3,  description: 'Técnicos de enfermagem.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-072', sectionId: 'sec-ilpi-12', order: 4,  description: 'Responsável Técnico.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-073', sectionId: 'sec-ilpi-12', order: 5,  description: 'Documento de responsabilidade técnica do Enfermeiro.', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-074', sectionId: 'sec-ilpi-12', order: 6,  description: 'Cuidadores.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-075', sectionId: 'sec-ilpi-12', order: 7,  description: 'Nutricionista.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-076', sectionId: 'sec-ilpi-12', order: 8,  description: 'Psicólogo.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-077', sectionId: 'sec-ilpi-12', order: 9,  description: 'Fisioterapeuta.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-078', sectionId: 'sec-ilpi-12', order: 10, description: 'Assistência social.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-079', sectionId: 'sec-ilpi-12', order: 11, description: 'Terapeuta Ocupacional.', legislation: 'Lei 8049/18', weight: 10, isCritical: true },
          { id: 'ilpi-080', sectionId: 'sec-ilpi-12', order: 12, description: 'Profissionais apresentam evolução em prontuário multidisciplinar.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // ── SEÇÃO 13 ────────────────────────────────────────────
      {
        id: 'sec-ilpi-13',
        title: 'Documentação',
        order: 13,
        items: [
          { id: 'ilpi-081', sectionId: 'sec-ilpi-13', order: 1,  description: 'O responsável técnico possui curso superior.', legislation: 'Capítulo II, Seção II, Art. 10 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-082', sectionId: 'sec-ilpi-13', order: 2,  description: 'Cadastro no Conselho Municipal de Assistência Social – COMDEPI.', legislation: 'Legislação Municipal', weight: 5, isCritical: false },
          { id: 'ilpi-083', sectionId: 'sec-ilpi-13', order: 3,  description: 'Alvará de Funcionamento.', legislation: 'Legislação Municipal', weight: 10, isCritical: true },
          { id: 'ilpi-084', sectionId: 'sec-ilpi-13', order: 4,  description: 'Licença Sanitária.', legislation: 'Legislação Sanitária', weight: 10, isCritical: true },
          { id: 'ilpi-085', sectionId: 'sec-ilpi-13', order: 5,  description: 'CNPJ.', legislation: 'Legislação Federal', weight: 10, isCritical: true },
          { id: 'ilpi-086', sectionId: 'sec-ilpi-13', order: 6,  description: 'Contrato Social.', legislation: 'Inciso III, Art. 48 da Lei Federal 10741/2003', weight: 10, isCritical: true },
          { id: 'ilpi-087', sectionId: 'sec-ilpi-13', order: 7,  description: 'Eventos sentinela registrados.', legislation: 'Capítulo III, Art. 55 – RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-088', sectionId: 'sec-ilpi-13', order: 8,  description: 'Processo de Enfermagem (SAE).', legislation: 'Resolução COFEN 736/2024', weight: 10, isCritical: true },
          { id: 'ilpi-089', sectionId: 'sec-ilpi-13', order: 9,  description: 'Plano Individual de Atendimento – PIA.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-090', sectionId: 'sec-ilpi-13', order: 10, description: 'Plano de Atendimento Singular – PAS.', legislation: 'RDC 29/2011', weight: 10, isCritical: true },
          { id: 'ilpi-091', sectionId: 'sec-ilpi-13', order: 11, description: 'Programa de Atenção Integral à Saúde do Idoso – PAISI.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-092', sectionId: 'sec-ilpi-13', order: 12, description: 'Dimensionamento da equipe de acordo com a Lei 8049/2018.', legislation: 'Lei 8049/2018', weight: 5, isCritical: false },
          { id: 'ilpi-093', sectionId: 'sec-ilpi-13', order: 13, description: 'Protocolo de contenção ambiental (idoso).', legislation: 'Resolução COFEN 746/2024', weight: 5, isCritical: false },
          { id: 'ilpi-094', sectionId: 'sec-ilpi-13', order: 14, description: 'Manual de Boas Práticas e POPs do serviço de Nutrição e Enfermagem.', legislation: 'RDC 63/2011', weight: 2, isCritical: false },
          { id: 'ilpi-095', sectionId: 'sec-ilpi-13', order: 15, description: 'Estatuto registrado.', legislation: 'Item 4.5.2 – RDC 283/2005; Inciso II, Art. 48º da Lei Federal 10741/2003', weight: 5, isCritical: false },
          { id: 'ilpi-096', sectionId: 'sec-ilpi-13', order: 16, description: 'Contratos de Serviços de Recursos Humanos / vínculo formal de trabalho.', legislation: 'Legislação Trabalhista', weight: 5, isCritical: false },
          { id: 'ilpi-097', sectionId: 'sec-ilpi-13', order: 17, description: 'Contratos de serviços terceirizados e cópia do Alvará Sanitário da empresa terceirizada.', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-098', sectionId: 'sec-ilpi-13', order: 18, description: 'Manual de Normas, Rotinas e Procedimentos.', legislation: 'RDC 63/2011', weight: 5, isCritical: false },
          { id: 'ilpi-099', sectionId: 'sec-ilpi-13', order: 19, description: 'Livro de registro de entradas e saídas atualizado.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-100', sectionId: 'sec-ilpi-13', order: 20, description: 'Livro de registro de informações sobre o idoso (grau de dependência, direitos previdenciários, alta, óbito).', legislation: 'RDC 502/2021', weight: 2, isCritical: false },
          { id: 'ilpi-101', sectionId: 'sec-ilpi-13', order: 21, description: 'Prontuários de pacientes com a devida evolução.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-102', sectionId: 'sec-ilpi-13', order: 22, description: 'Registro diário de intercorrências.', legislation: 'RDC 502/2021', weight: 10, isCritical: true },
          { id: 'ilpi-103', sectionId: 'sec-ilpi-13', order: 23, description: 'Contrato de prestação de serviços do idoso com a instituição.', legislation: 'RDC 502/2021', weight: 5, isCritical: false },
          { id: 'ilpi-104', sectionId: 'sec-ilpi-13', order: 24, description: 'Notificação das Doenças de Notificação Compulsória (DNC).', legislation: 'Portaria de Consolidação nº 4/2017', weight: 10, isCritical: true },
          { id: 'ilpi-105', sectionId: 'sec-ilpi-13', order: 25, description: 'Instruções para higienização das mãos em local visível.', legislation: 'RDC 36/2013', weight: 2, isCritical: false },
        ],
      },
    ],
  };

export const roteiroIlpiFederal97: ChecklistTemplate = {
    id: 'tpl-ilpi-federal-v1',
    name: 'Roteiro de Inspeção — ILPI (Base Federal)',
    category: 'ilpi',
    version: '06/2026',
    sections: [

      // SEÇÃO 1 _______________________________________
      {
        id: 'sec-fed-01',
        title: 'Estrutura Física : Geral',
        order: 1,
        items: [
          { id: 'fed-001', sectionId: 'sec-fed-01', order: 1, description: 'O funcionamento da ILPI é autorizado mediante Alvará/Licença Sanitária vigente expedida pelo órgão sanitário local, em conformidade com a Lei Federal nº 6.437/1977.', legislation: 'Art. 8º da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-001a', sectionId: 'sec-fed-01', order: 2, description: 'Possui Projeto Básico de Arquitetura (planta baixa) aprovado pela autoridade sanitária local, em caso de construção, reforma ou adaptação.', legislation: 'Art. 19 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-001b', sectionId: 'sec-fed-01', order: 3, description: 'As instalações prediais de proteção e combate a incêndio atendem às exigências locais (possui Certificado/Laudo do Corpo de Bombeiros vigente).', legislation: 'Art. 23 da RDC 502/2021; legislação estadual', weight: 10, isCritical: true },
          { id: 'fed-002', sectionId: 'sec-fed-01', order: 4, description: 'A infraestrutura física atende aos requisitos de habitabilidade, higiene, salubridade, segurança e garante a independência e mobilidade dos residentes.', legislation: 'Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-003', sectionId: 'sec-fed-01', order: 5, description: 'Quando o terreno apresenta desníveis, a edificação é dotada de rampas com corrimãos para facilitar o acesso e a movimentação dos residentes, em conformidade com a ABNT NBR 9050.', legislation: 'Art. 22 da RDC 502/2021; ABNT NBR 9050', weight: 10, isCritical: true },
          { id: 'fed-004', sectionId: 'sec-fed-01', order: 6, description: 'As circulações internas principais possuem largura mínima de 1,50m e as secundárias, no mínimo 1,00m, garantindo a passagem de cadeiras de rodas e macas.', legislation: 'Art. 25 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-005', sectionId: 'sec-fed-01', order: 7, description: 'Em caso de edificação com mais de um pavimento que não possua rampa com especificações da ABNT, dispõe de elevador.', legislation: 'Art. 26 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-006', sectionId: 'sec-fed-01', order: 8, description: 'Todas as portas possuem vão livre com largura mínima de 1,10m e travamento simples, sem o uso de trancas ou chaves, permitindo abertura imediata em situação de emergência.', legislation: 'Art. 27 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-007', sectionId: 'sec-fed-01', order: 9, description: 'Janelas e guarda-corpos possuem peitoris com altura mínima de 1,00m, garantindo a segurança dos residentes contra quedas.', legislation: 'Art. 28 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-008', sectionId: 'sec-fed-01', order: 10, description: 'Possui sala de convivência com área mínima de 1,3 m² (um vírgula três metros quadrados) por residente.', legislation: 'Art. 29, Inciso II da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-009', sectionId: 'sec-fed-01', order: 11, description: 'Possui ambiente para guarda de material de limpeza (DML), provido de tanque e área para guarda de saneantes e utensílios.', legislation: 'Art. 29, Inciso XI da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-010', sectionId: 'sec-fed-01', order: 12, description: 'Possui sala para atividades de assistência individualizada e sigilosa (assistência social, psicológica, saúde, etc).', legislation: 'Art. 29, Inciso II, item 3, da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-011', sectionId: 'sec-fed-01', order: 13, description: 'Possui espaço destinado para os serviços administrativos da instituição.', legislation: 'Art. 29, Inciso XII da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-012', sectionId: 'sec-fed-01', order: 14, description: 'As instalações elétricas não apresentam fiação exposta ou componentes danificados que ofereçam risco aos residentes e trabalhadores.', legislation: 'NR-10; Art. 21 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 2 _______________________________________
      {
        id: 'sec-fed-02',
        title: 'Dormitórios',
        order: 2,
        items: [
          { id: 'fed-013', sectionId: 'sec-fed-02', order: 1, description: 'Dormitórios são separados por sexo e possuem no máximo 4 (quatro) camas por ambiente.', legislation: 'Alínea "a", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-014', sectionId: 'sec-fed-02', order: 2, description: 'Dormitórios para 1 (uma) pessoa possuem área mínima de 7,50 m² (sete vírgula cinquenta metros quadrados).', legislation: 'Alínea "a.1", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-015', sectionId: 'sec-fed-02', order: 3, description: 'Dormitórios de 2 a 4 pessoas possuem área mínima de 5,50 m² (cinco vírgula cinquenta metros quadrados) por cama.', legislation: 'Alínea "a.2", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-016', sectionId: 'sec-fed-02', order: 4, description: 'Dormitórios são dotados de luz de vigília e campainha de alarme próximos a cada cama.', legislation: 'Alínea "b", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-016a', sectionId: 'sec-fed-02', order: 5, description: 'Os colchões, colchonetes e demais mobiliários almofadados são revestidos de material lavável e impermeável, sem furos ou rasgos.', legislation: 'Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-017', sectionId: 'sec-fed-02', order: 6, description: 'Existe distância mínima de 0,80m (oitenta centímetros) entre duas camas.', legislation: 'Alínea "c", Inciso I do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 3  _______________________________________
      {
        id: 'sec-fed-03',
        title: 'Banheiros',
        order: 3,
        items: [
          { id: 'fed-018', sectionId: 'sec-fed-03', order: 1, description: 'Os banheiros possuem área mínima de 3,60 m².', legislation: 'Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-019', sectionId: 'sec-fed-03', order: 2, description: 'Cada banheiro é provido, no mínimo, de 1 bacia sanitária, 1 lavatório e 1 chuveiro, garantindo a privacidade do residente.', legislation: 'Alínea "a", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-020', sectionId: 'sec-fed-03', order: 3, description: 'O piso do banheiro é projetado sem desnível em forma de degrau, utilizando caimento para escoamento da água.', legislation: 'Alínea "b", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-021', sectionId: 'sec-fed-03', order: 4, description: 'Possui barras de apoio instaladas no lavatório, na bacia sanitária e no chuveiro.', legislation: 'Alínea "c", Inciso IV do Art. 29 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 4 
      {
        id: 'sec-fed-04',
        title: 'Medicamentos',
        order: 4,
        items: [
          { id: 'fed-022', sectionId: 'sec-fed-04', order: 1, description: 'Os medicamentos em uso pelos idosos estão sob responsabilidade do Responsável Técnico (RT), respeitando os regulamentos de vigilância sanitária quanto à guarda, sendo vedado o estoque sem prescrição médica.', legislation: 'Art. 40 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-023', sectionId: 'sec-fed-04', order: 2, description: 'Medicamentos sujeitos a controle especial (psicotrópicos) são obrigatoriamente guardados sob chave ou outro dispositivo que ofereça segurança, em local exclusivo, com registros de controle.', legislation: 'Art. 67 da Portaria SVS/MS 344/1998', weight: 10, isCritical: true },
          { id: 'fed-024', sectionId: 'sec-fed-04', order: 3, description: 'Possui geladeira exclusiva com termômetro e planilha de registro para controle diário de temperatura de medicamentos termolábeis.', legislation: 'Art. 40 da RDC 502/2021; RDC ANVISA nº 430/2020', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 5 _______________________________________
      {
        id: 'sec-fed-05',
        title: 'Serviço de Nutrição',
        order: 5,
        items: [
          { id: 'fed-025', sectionId: 'sec-fed-05', order: 1, description: 'É garantido aos residentes o fornecimento de, no mínimo, 6 (seis) refeições diárias.', legislation: 'Art. 44 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-026', sectionId: 'sec-fed-05', order: 2, description: 'A alimentação é fornecida de acordo com as necessidades nutricionais e condições de saúde dos residentes.', legislation: 'Art. 44 e Art. 45 da RDC 502/2021; RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-027', sectionId: 'sec-fed-05', order: 3, description: 'O serviço possui e implementa o Manual de Boas Práticas e os Procedimentos Operacionais Padronizados (POPs), mantendo-os acessíveis aos funcionários envolvidos e à autoridade sanitária.', legislation: 'Itens 4.11.1 e 4.11.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-028', sectionId: 'sec-fed-05', order: 4, description: 'Caso realize preparo de Terapia de Nutrição Enteral (TNE) no local, possui área exclusiva e adequada para esta manipulação.', legislation: 'Arts. 1º e 101 da RDC ANVISA nº 503/2021', weight: 5, isCritical: false },
          { id: 'fed-029', sectionId: 'sec-fed-05', order: 5, description: 'Instalações físicas (piso, parede e teto) possuem revestimento liso, impermeável, lavável e em bom estado de conservação.', legislation: 'Item 4.1.3 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-030', sectionId: 'sec-fed-05', order: 6, description: 'Acessos às áreas de preparação de alimentos são controlados e independentes, não sendo utilizados como passagem.', legislation: 'Item 4.1.1 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-031', sectionId: 'sec-fed-05', order: 7, description: 'Portas externas possuem fechamento automático e protetor de rodapé. Janelas e aberturas são dotadas de telas milimétricas removíveis para facilitar a limpeza.', legislation: 'Item 4.1.4 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-032', sectionId: 'sec-fed-05', order: 8, description: 'Dispõe de lavatório exclusivo para lavagem das mãos na área de manipulação, provido obrigatoriamente de sabonete líquido inodoro, toalha de papel não reciclado e lixeira com tampa de acionamento sem contato manual.', legislation: 'Item 4.1.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-033', sectionId: 'sec-fed-05', order: 9, description: 'Existem cartazes de orientação sobre a correta higienização das mãos afixados em locais de fácil visualização, inclusive nas instalações sanitárias e lavatórios.', legislation: 'Item 4.6.5 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-034', sectionId: 'sec-fed-05', order: 10, description: 'Os resíduos são frequentemente coletados e estocados em local fechado e isolado da área de preparação, evitando a contaminação cruzada e atração de pragas.', legislation: 'Item 4.5.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-035', sectionId: 'sec-fed-05', order: 11, description: 'Manipuladores de alimentos que apresentam lesões ou sintomas de enfermidades que possam comprometer a segurança dos alimentos são afastados da atividade de manipulação.', legislation: 'Item 4.6.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-036', sectionId: 'sec-fed-05', order: 12, description: 'Manipuladores de alimentos apresentam-se com uniformes compatíveis à atividade, conservados e limpos, cabelos protegidos por redes ou toucas, unhas curtas e sem adornos.', legislation: 'Itens 4.6.3 e 4.6.6 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-037', sectionId: 'sec-fed-05', order: 13, description: 'Equipamentos e utensílios que entram em contato com alimentos são lisos, impermeáveis, laváveis e mantidos em adequado estado de conservação.', legislation: 'Item 4.1.17 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-038', sectionId: 'sec-fed-05', order: 14, description: 'Os utensílios utilizados na higienização (esponjas, escovas) são próprios para a atividade, conservados e limpos, sem utilização de materiais que retenham resíduos ou liberem fragmentos físicos (como palha de aço).', legislation: 'Item 4.1.11 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-039', sectionId: 'sec-fed-05', order: 15, description: 'Ausência de objetos em desuso ou estranhos ao ambiente na área de preparação de alimentos.', legislation: 'Item 4.1.7 da RDC 216/2004', weight: 5, isCritical: false },
          { id: 'fed-040', sectionId: 'sec-fed-05', order: 16, description: 'O fluxo de preparo e os procedimentos adotados evitam o contato direto ou indireto entre alimentos crus, semipreparados e prontos para o consumo, minimizando o risco de contaminação cruzada.', legislation: 'Item 4.8.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-041', sectionId: 'sec-fed-05', order: 17, description: 'Utiliza saneantes regularizados no Ministério da Saúde para a higienização de hortifrutícolas.', legislation: 'Item 4.8.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-042n', sectionId: 'sec-fed-05', order: 18, description: 'O descongelamento de alimentos é efetuado em condições de refrigeração à temperatura inferior a 5ºC ou em forno micro-ondas, sendo vedado o descongelamento à temperatura ambiente.', legislation: 'Item 4.8.14 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-043n', sectionId: 'sec-fed-05', order: 19, description: 'Os alimentos preparados conservados a quente são mantidos à temperatura superior a 60ºC (sessenta graus Celsius) por, no máximo, 6 (seis) horas.', legislation: 'Item 4.8.15 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-044n', sectionId: 'sec-fed-05', order: 20, description: 'A Instituição dispõe de condições para armazenamento, mantendo matérias-primas em temperatura recomendada pelo fabricante.', legislation: 'Art. 45 da RDC 502/2021; Item 4.8.1 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-045n', sectionId: 'sec-fed-05', order: 21, description: 'Matérias-primas e ingredientes que não forem utilizados em sua totalidade estão adequadamente acondicionados e identificados com data de fracionamento e novo prazo de validade após a abertura.', legislation: 'Item 4.7.4 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-046n', sectionId: 'sec-fed-05', order: 22, description: 'Alimentos armazenados em local limpo, organizado, dispostos sobre paletes, estrados ou prateleiras adequadas, distantes do piso, paredes e teto.', legislation: 'Item 4.7.5 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 6 _______________________________________
      {
        id: 'sec-fed-06',
        title: 'Refeitório',
        order: 6,
        items: [
          { id: 'fed-042', sectionId: 'sec-fed-06', order: 1, description: 'Refeitório possui área mínima de 1,00 m² por usuário, acrescido de local para guarda de lanches, lavatório para higienização das mãos e luz de vigília.', legislation: 'Art. 29, Inciso VII da RDC 502/2021', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 7  _______________________________________
      {
        id: 'sec-fed-07',
        title: 'Lavanderia',
        order: 7,
        items: [
          { id: 'fed-043', sectionId: 'sec-fed-07', order: 1, description: 'Quando houver processamento de roupas na Instituição, possui ambientes distintos para lavagem e para guarda de roupas.', legislation: 'Art. 29, Inciso IX e X, da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-044', sectionId: 'sec-fed-07', order: 2, description: 'As roupas de uso pessoal dos residentes estão devidamente identificadas, visando a manutenção da individualidade e humanização.', legislation: 'Art. 49 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-044b', sectionId: 'sec-fed-07', order: 3, description: 'A Instituição mantém disponíveis as rotinas técnicas (POPs) do processamento de roupas de uso pessoal e coletivo, contemplando separação, processamento e guarda e troca de roupas de uso coletivo.', legislation: 'Art. 47 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-044c', sectionId: 'sec-fed-07', order: 4, description: 'A Instituição possibilita aos idosos com grau de dependência I (independentes) efetuarem o processamento de suas próprias roupas de uso pessoal.', legislation: 'Art. 48 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'fed-045', sectionId: 'sec-fed-07', order: 5, description: 'Nos casos de terceirização do serviço de lavanderia, a Instituição possui contrato formal e mantém cópia do alvará sanitário da empresa contratada.', legislation: 'Art. 14 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-046', sectionId: 'sec-fed-07', order: 6, description: 'Utiliza exclusivamente produtos saneantes devidamente regularizados na Anvisa.', legislation: 'Art. 50 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 8
      {
        id: 'sec-fed-08',
        title: 'Assistência Integral ao Residente',
        order: 8,
        items: [
          { id: 'fed-048', sectionId: 'sec-fed-08', order: 1, description: 'O Responsável Técnico institui e mantém prontuário individual do residente, organizado e atualizado, contendo dados de identificação, evolução e intercorrências.', legislation: 'Art. 33 da RDC 502/2021; Art. 50, Inciso XV, da Lei Federal nº 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-049', sectionId: 'sec-fed-08', order: 2, description: 'Mantém o cartão de vacinação dos residentes atualizado, em conformidade com o calendário do Programa Nacional de Imunizações (PNI).', legislation: 'Art. 39 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-050', sectionId: 'sec-fed-08', order: 3, description: 'A ILPI desenvolve atividades físicas, recreativas e de lazer, com base no PAISI e nas condições dos residentes.', legislation: 'Art. 32 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-051', sectionId: 'sec-fed-08', order: 4, description: 'A instituição realiza a notificação compulsória de agravos e doenças à vigilância epidemiológica e sanitária.', legislation: 'Art. 54 da RDC 502/2021; Portaria de Consolidação MS nº 4/2017', weight: 10, isCritical: true },
          { id: 'fed-052', sectionId: 'sec-fed-08', order: 5, description: 'Possui registro e realiza a notificação à autoridade sanitária local da ocorrência de eventos sentinela (ex: quedas com lesões graves).', legislation: 'Art. 55 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-053', sectionId: 'sec-fed-08', order: 6, description: 'Garante a convivência familiar e comunitária, assegurando horários e dias flexíveis para visitas.', legislation: 'Art. 6º, Inciso I, da RDC 502/2021; Art. 49, Inciso II, da Lei Federal nº 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-054', sectionId: 'sec-fed-08', order: 7, description: 'Em caso de intercorrência médica, o Responsável Técnico providencia o encaminhamento imediato do idoso ao serviço de saúde de referência.', legislation: 'Art. 42 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054a', sectionId: 'sec-fed-08', order: 8, description: 'A instituição comunica à Secretaria Municipal de Assistência Social ou congênere, bem como ao Ministério Público, a situação de abandono familiar do idoso ou a ausência de identificação civil.', legislation: 'Art. 34 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054b', sectionId: 'sec-fed-08', order: 9, description: 'A instituição elabora a cada 2 (dois) anos e avalia anualmente o Plano de Atenção Integral à Saúde dos Residentes (PAISI) para cada idoso.', legislation: 'Arts. 36 e 38 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-054c', sectionId: 'sec-fed-08', order: 10, description: 'Possui arquivo de anotações (livro de ocorrências/plantão) contendo data e circunstâncias do atendimento diário e intercorrências de cada residente.', legislation: 'Art. 50, Inciso XV da Lei 10.741/2003; Art. 33 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 9
      {
        id: 'sec-fed-09',
        title: 'Saúde e Segurança do Trabalhador',
        order: 9,
        items: [
          { id: 'fed-058a', sectionId: 'sec-fed-09', order: 1, description: 'A instituição garante aos trabalhadores a avaliação de saúde admissional, periódica e demissional, implementando o PCMSO e PGR.', legislation: 'NR-7; NR-1', weight: 5, isCritical: false },
          { id: 'fed-058b', sectionId: 'sec-fed-09', order: 2, description: 'A instituição fornece aos trabalhadores os Equipamentos de Proteção Individual (EPI), adequados aos riscos das atividades desenvolvidas.', legislation: 'NR-6; NR-32', weight: 10, isCritical: true },
          { id: 'fed-058c', sectionId: 'sec-fed-09', order: 3, description: 'Existe comprovação do esquema de vacinação atualizado dos profissionais da instituição.', legislation: 'NR-32', weight: 5, isCritical: false },
          { id: 'fed-058d', sectionId: 'sec-fed-09', order: 4, description: 'A instituição dispõe de instalações sanitárias, vestiários e locais para refeições exclusivos para os trabalhadores.', legislation: 'NR-24', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 10
      {
        id: 'sec-fed-10',
        title: 'Gestão de Resíduos (PGRSS)',
        order: 10,
        items: [
          { id: 'fed-059', sectionId: 'sec-fed-10', order: 1, description: 'O serviço elaborou, implantou e mantém atualizado o Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS).', legislation: 'Art. 5º da RDC 222/2018', weight: 10, isCritical: true },
          { id: 'fed-060', sectionId: 'sec-fed-10', order: 2, description: 'Possui abrigo de resíduos sólidos externo à edificação para armazenamento temporário.', legislation: 'Art. 29, Inciso XIV, da RDC 502/2021; RDC 222/2018', weight: 10, isCritical: true },
          { id: 'fed-061', sectionId: 'sec-fed-10', order: 3, description: 'Os materiais perfurocortantes são descartados no local de geração em recipientes rígidos, providos de tampa.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
          { id: 'fed-062', sectionId: 'sec-fed-10', order: 4, description: 'Os recipientes para coleta interna de resíduos possuem tampa provida de sistema de abertura sem contato manual e são identificados.', legislation: 'RDC 222/2018', weight: 5, isCritical: false },
          { id: 'fed-063', sectionId: 'sec-fed-10', order: 5, description: 'A instituição possui contrato formal com empresa licenciada para coleta, tratamento e destinação final de resíduos infectantes e perfurocortantes.', legislation: 'RDC 222/2018', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 11
      {
        id: 'sec-fed-11',
        title: 'Água e Controle de Pragas',
        order: 11,
        items: [
          { id: 'fed-064', sectionId: 'sec-fed-11', order: 1, description: 'A instituição utiliza água potável para consumo e preparo de alimentos, e o reservatório de água é higienizado no mínimo a cada 6 (seis) meses, mantendo-se o registro da operação.', legislation: 'Art. 46 da RDC 502/2021; Item 4.3 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-065', sectionId: 'sec-fed-11', order: 2, description: 'Possui programa de controle de vetores e pragas urbanas executado por empresa especializada e licenciada.', legislation: 'Art. 46 da RDC 502/2021; Item 4.4.2 da RDC 216/2004', weight: 10, isCritical: true },
          { id: 'fed-066', sectionId: 'sec-fed-11', order: 3, description: 'A edificação, as instalações e os equipamentos são mantidos livres de vetores e pragas urbanas, sendo adotadas medidas preventivas como o uso de telas e ralos sifonados.', legislation: 'Item 4.4.1 da RDC 216/2004', weight: 5, isCritical: false },
        ],
      },

      // SEÇÃO 12
      {
        id: 'sec-fed-12',
        title: 'Recursos Humanos',
        order: 12,
        items: [
          { id: 'fed-067', sectionId: 'sec-fed-12', order: 1, description: 'A ILPI conta com Responsável Técnico (RT) com formação de nível superior, vínculo formal de trabalho e carga horária mínima de 20 (vinte) horas semanais.', legislation: 'Arts. 10 e 11 e 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-068', sectionId: 'sec-fed-12', order: 2, description: 'A proporção de cuidadores para residentes de Grau de Dependência I atende ao mínimo exigido: 1 (um) cuidador para cada 20 (vinte) residentes, com carga horária de 8h/dia.', legislation: 'Alínea "a", Inciso I do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-069', sectionId: 'sec-fed-12', order: 3, description: 'A proporção de cuidadores para residentes de Grau de Dependência II atende ao mínimo exigido: 1 (um) cuidador para cada 10 (dez) residentes, por turno.', legislation: 'Alínea "b", Inciso I do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-070', sectionId: 'sec-fed-12', order: 4, description: 'A proporção de cuidadores para residentes de Grau de Dependência III atende ao mínimo exigido: 1 (um) cuidador para cada 6 (seis) residentes, por turno.', legislation: 'Alínea "c", Inciso I do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-071', sectionId: 'sec-fed-12', order: 5, description: 'A instituição dispõe de 1 (um) profissional para atividades de lazer para cada 40 (quarenta) residentes, com carga horária de 12 (doze) horas semanais.', legislation: 'Inciso III do Art. 16 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-072', sectionId: 'sec-fed-12', order: 6, description: 'A instituição dispõe de 1 (um) profissional de limpeza para cada 100m² (cem metros quadrados) de área interna ou fração, por turno, diariamente.', legislation: 'Inciso IV do Art. 16 da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-072b', sectionId: 'sec-fed-12', order: 7, description: 'Quando o serviço de lavanderia for realizado internamente, a instituição dispõe de 1 (um) profissional para cada 30 (trinta) residentes ou fração, diariamente.', legislation: 'Inciso VI do Art. 16 da RDC 502/2021', weight: 2, isCritical: false },
          { id: 'fed-073', sectionId: 'sec-fed-12', order: 8, description: 'A instituição dispõe de 1 (um) profissional no serviço de alimentação para cada 20 (vinte) residentes, garantindo a cobertura de 2 (dois) turnos de 8 (oito) horas.', legislation: 'Inciso V do Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-074', sectionId: 'sec-fed-12', order: 9, description: 'A ILPI garante a capacitação e a educação permanente dos profissionais envolvidos na prestação dos serviços, mantendo registros dessa capacitação.', legislation: 'Art. 18 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-075a', sectionId: 'sec-fed-12', order: 10, description: 'Apresenta contratos que comprovem o vínculo formal de trabalho de todos os recursos humanos atuantes na instituição.', legislation: 'Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-076a', sectionId: 'sec-fed-12', order: 11, description: 'Apresenta escala de trabalho atualizada comprovando o quantitativo mínimo de cuidadores por turno exigido para o Grau I (1:20), Grau II (1:10) e Grau III (1:6).', legislation: 'Art. 16 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },

      // SEÇÃO 13
      {
        id: 'sec-fed-13',
        title: 'Documentação Administrativa',
        order: 13,
        items: [
          { id: 'fed-075', sectionId: 'sec-fed-13', order: 1, description: 'Possui Estatuto ou Contrato Social e ata de eleição da diretoria atual (quando aplicável).', legislation: 'Incisos I e II do Art. 9º da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-076', sectionId: 'sec-fed-13', order: 2, description: 'Possui Regimento Interno.', legislation: 'Inciso III do Art. 9º da RDC 502/2021', weight: 5, isCritical: false },
          { id: 'fed-077', sectionId: 'sec-fed-13', order: 3, description: 'A instituição de longa permanência possui inscrição e registro de seus programas junto ao Conselho Municipal da Pessoa Idosa (CMDI) ou Estadual (CEDI).', legislation: 'Art. 48 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-078', sectionId: 'sec-fed-13', order: 4, description: 'A ILPI celebra contrato formal e escrito de prestação de serviços com o residente ou com seu representante legal, estabelecendo direitos, deveres, valores e forma de reajuste.', legislation: 'Art. 12 da RDC 502/2021; Art. 35 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-079', sectionId: 'sec-fed-13', order: 5, description: 'A ILPI possui Procedimentos Operacionais Padrão (POP) escritos, atualizados e implantados referentes a todas as atividades desenvolvidas na instituição.', legislation: 'Art. 41 da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-080', sectionId: 'sec-fed-13', order: 6, description: 'A instituição possui Plano de Trabalho compatível com os princípios do Estatuto da Pessoa Idosa, apresentado no ato de inscrição no conselho competente.', legislation: 'Parágrafo único do Art. 48 da Lei 10.741/2003', weight: 10, isCritical: true },
          { id: 'fed-081', sectionId: 'sec-fed-13', order: 7, description: 'A instituição realiza avaliação continuada de desempenho levando em conta, no mínimo, os indicadores de taxa de mortalidade, e incidência de DDA, escabiose, desidratação, úlcera de decúbito e desnutrição.', legislation: 'Art. 59 e Anexo da RDC 502/2021', weight: 10, isCritical: true },
          { id: 'fed-082', sectionId: 'sec-fed-13', order: 8, description: 'A Instituição encaminha à Vigilância Sanitária local, todo mês de janeiro, o consolidado dos indicadores referentes ao ano anterior.', legislation: 'Art. 60 da RDC 502/2021', weight: 10, isCritical: true },
        ],
      },
    ],
  };
