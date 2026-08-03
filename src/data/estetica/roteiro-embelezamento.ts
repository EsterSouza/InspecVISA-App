import type { ChecklistTemplate } from '../../types';

const URLS = {
  nt2: 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos',
  rdc15: 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000015&seqAto=000&valorAno=2012&orgao=RDC%2FDC%2FANVISA%2FMS&cod_menu=9434&cod_modulo=310&pesquisa=true',
  re2605: 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RE&numeroAto=00002605&seqAto=000&valorAno=2006&orgao=RE%2FANVISA%2FMS&cod_menu=9434&cod_modulo=310&pesquisa=true',
  rdc751: 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000751&seqAto=000&valorAno=2022&orgao=RDC%2FDC%2FANVISA%2FMS&cod_menu=9434&cod_modulo=310&pesquisa=true',
  lei6360: 'https://www.planalto.gov.br/ccivil_03/leis/l6360.htm',
  rdc56: 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000056&seqAto=000&valorAno=2009&orgao=RDC%2FDC%2FANVISA%2FMS&cod_menu=9434&cod_modulo=310&pesquisa=true',
  rdc222: 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000222&seqAto=000&valorAno=2018&orgao=RDC%2FDC%2FANVISA%2FMS&cod_menu=9434&cod_modulo=310&pesquisa=true',
  trabalho: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadoras-vigentes',
  lei13589: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13589.htm',
  lei9294: 'https://www.planalto.gov.br/ccivil_03/leis/l9294.htm',
} as const;

export const templateEsteticaEmbelezamento: ChecklistTemplate = {
  id: 'tpl-estetica-embelezamento-v1', name: 'Roteiro de Inspeção — Embelezamento e Beleza', category: 'estetica', version: '08/2026',
  sections: [
    { id: 'sec-emb-01', title: 'Escopo e regularização', order: 1, items: [
      { id: 'emb-001', sectionId: 'sec-emb-01', order: 1, description: 'A atividade declarada e a documentação sanitária disponível correspondem aos serviços efetivamente prestados?', legislation: 'Critério técnico de coerência cadastral e de escopo operacional', weight: 2, isCritical: false, requirementType: 'good_practice' },
      { id: 'emb-002', sectionId: 'sec-emb-01', order: 2, description: 'Realiza procedimento invasivo ou que exija profissional de saúde, como aplicação de toxina, micropigmentação ou lash lifting?', legislation: 'Lei nº 6.360/1976; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.lei6360, weight: 10, isCritical: true },
      { id: 'emb-003', sectionId: 'sec-emb-01', order: 3, description: 'Quando a resposta anterior for positiva, o estabelecimento foi encaminhado para aplicação do roteiro de Clínica de Estética e Saúde?', legislation: 'Lei nº 6.360/1976; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.nt2, weight: 10, isCritical: true },
      { id: 'emb-004', sectionId: 'sec-emb-01', order: 4, description: 'Mantém relação atualizada das pessoas que executam os serviços e das respectivas funções?', legislation: 'Critério técnico de identificação das pessoas que executam os serviços', weight: 2, isCritical: false, requirementType: 'good_practice' },
    ] },
    { id: 'sec-emb-02', title: 'Ambientes e higiene', order: 2, items: [
      { id: 'emb-005', sectionId: 'sec-emb-02', order: 1, description: 'Pisos, paredes, bancadas e mobiliários estão íntegros, limpos e permitem higienização?', legislation: 'Critério técnico de limpeza e conservação do ambiente', weight: 2, isCritical: false, requirementType: 'good_practice' },
      { id: 'emb-006', sectionId: 'sec-emb-02', order: 2, description: 'A pia destinada à higiene das mãos está abastecida com água corrente, sabonete líquido e meio de secagem?', legislation: 'Critério técnico de higiene das mãos', weight: 2, isCritical: false, requirementType: 'good_practice' },
      { id: 'emb-007', sectionId: 'sec-emb-02', order: 3, description: 'As cubas e lavatórios usados nos atendimentos são higienizados entre usos quando aplicável?', legislation: 'Critério técnico de prevenção de contaminação cruzada', weight: 2, isCritical: false, requirementType: 'good_practice' },
      { id: 'emb-008', sectionId: 'sec-emb-02', order: 4, description: 'A cabine ou área de esmaltação e acetona possui ventilação compatível com os vapores gerados?', legislation: 'NR-1', legislationUrl: URLS.trabalho, weight: 5, isCritical: false },
      { id: 'emb-009', sectionId: 'sec-emb-02', order: 5, description: 'Quando há climatização artificial em ambiente de uso público ou coletivo, possui PMOC?', legislation: 'Lei nº 13.589/2018', legislationUrl: URLS.lei13589, weight: 5, isCritical: false },
      { id: 'emb-010', sectionId: 'sec-emb-02', order: 6, description: 'O recinto coletivo fechado permanece livre de fumaça de produtos fumígenos?', legislation: 'Lei nº 9.294/1996', legislationUrl: URLS.lei9294, weight: 5, isCritical: false },
    ] },
    { id: 'sec-emb-03', title: 'Instrumentos e materiais', order: 3, items: [
      { id: 'emb-011', sectionId: 'sec-emb-03', order: 1, description: 'Alicates, pinças e outros instrumentos reutilizáveis são limpos antes do processamento?', legislation: 'RDC Anvisa nº 15/2012; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.rdc15, weight: 10, isCritical: true },
      { id: 'emb-012', sectionId: 'sec-emb-03', order: 2, description: 'Alicates, pinças e outros instrumentos semicríticos são esterilizados antes de novo uso?', legislation: 'RDC Anvisa nº 15/2012; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.rdc15, weight: 10, isCritical: true },
      { id: 'emb-013', sectionId: 'sec-emb-03', order: 3, description: 'Os instrumentos processados permanecem protegidos até o uso?', legislation: 'RDC Anvisa nº 15/2012; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.rdc15, weight: 5, isCritical: false },
      { id: 'emb-014', sectionId: 'sec-emb-03', order: 4, description: 'Lâminas e demais materiais de uso único são descartados após cada cliente, sem reutilização?', legislation: 'RE Anvisa nº 2.605/2006', legislationUrl: URLS.re2605, weight: 10, isCritical: true },
      { id: 'emb-015', sectionId: 'sec-emb-03', order: 5, description: 'Os materiais de atendimento são separados ou higienizados entre clientes para evitar contaminação cruzada?', legislation: 'Critério técnico de prevenção de contaminação cruzada', weight: 2, isCritical: false, requirementType: 'good_practice' },
    ] },
    { id: 'sec-emb-04', title: 'Produtos e equipamentos', order: 4, items: [
      { id: 'emb-016', sectionId: 'sec-emb-04', order: 1, description: 'Cosméticos, saneantes e produtos de higiene utilizados estão regularizados e dentro do prazo de validade?', legislation: 'Lei nº 6.360/1976', legislationUrl: URLS.lei6360, weight: 10, isCritical: true },
      { id: 'emb-017', sectionId: 'sec-emb-04', order: 2, description: 'Os saneantes são mantidos identificados e usados conforme as instruções do fabricante?', legislation: 'Lei nº 6.360/1976', legislationUrl: URLS.lei6360, weight: 5, isCritical: false },
      { id: 'emb-018', sectionId: 'sec-emb-04', order: 3, description: 'Os equipamentos utilizados estão regularizados quando aplicável e são operados conforme o manual do fabricante?', legislation: 'RDC Anvisa nº 751/2022; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.rdc751, weight: 10, isCritical: true },
      { id: 'emb-019', sectionId: 'sec-emb-04', order: 4, description: 'Há manutenção e limpeza registradas para os equipamentos conforme as instruções do fabricante?', legislation: 'Critério técnico de manutenção e uso seguro de equipamentos', weight: 2, isCritical: false, requirementType: 'good_practice' },
      { id: 'emb-020', sectionId: 'sec-emb-04', order: 5, description: 'O estabelecimento não utiliza nem disponibiliza equipamento de bronzeamento artificial por radiação ultravioleta para fins estéticos?', legislation: 'RDC Anvisa nº 56/2009', legislationUrl: URLS.rdc56, weight: 10, isCritical: true },
    ] },
    { id: 'sec-emb-05', title: 'Resíduos e proteção do trabalhador', order: 5, items: [
      { id: 'emb-021', sectionId: 'sec-emb-05', order: 1, description: 'Quando gera resíduos de serviços de saúde, mantém PGRSS proporcional aos resíduos efetivamente gerados?', legislation: 'RDC Anvisa nº 222/2018; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.rdc222, weight: 10, isCritical: true },
      { id: 'emb-022', sectionId: 'sec-emb-05', order: 2, description: 'Os perfurocortantes são descartados imediatamente após o uso em recipiente rígido, resistente à punctura e identificado?', legislation: 'RDC Anvisa nº 222/2018; NR-1; NR-6', legislationUrl: URLS.rdc222, weight: 10, isCritical: true },
      { id: 'emb-023', sectionId: 'sec-emb-05', order: 3, description: 'Quando gera resíduos de serviços de saúde, possui contrato e comprovação de destinação por coletora licenciada?', legislation: 'RDC Anvisa nº 222/2018; Nota Técnica nº 2/2024/SEI/GGTES/DIRE3/ANVISA', legislationUrl: URLS.rdc222, weight: 5, isCritical: false },
      { id: 'emb-024', sectionId: 'sec-emb-05', order: 4, description: 'Os trabalhadores recebem EPIs adequados aos riscos das atividades e orientação para seu uso?', legislation: 'NR-6', legislationUrl: URLS.trabalho, weight: 5, isCritical: false },
      { id: 'emb-025', sectionId: 'sec-emb-05', order: 5, description: 'Quando possui empregados abrangidos, mantém PGR ou a documentação simplificada admitida para microempresa ou empresa de pequeno porte de grau de risco 1 ou 2?', legislation: 'NR-1', legislationUrl: URLS.trabalho, weight: 5, isCritical: false },
      { id: 'emb-026', sectionId: 'sec-emb-05', order: 6, description: 'Quando possui empregados abrangidos, mantém PCMSO compatível com os riscos identificados?', legislation: 'NR-7', legislationUrl: URLS.trabalho, weight: 5, isCritical: false },
    ] },
    { id: 'sec-emb-06', title: 'Água e controle de vetores', order: 6, items: [
      { id: 'emb-027', sectionId: 'sec-emb-06', order: 1, description: 'O estabelecimento adota medidas para prevenir a presença de vetores e pragas urbanas?', legislation: 'Critério técnico de prevenção de vetores e pragas urbanas', weight: 2, isCritical: false, requirementType: 'good_practice' },
      { id: 'emb-028', sectionId: 'sec-emb-06', order: 2, description: 'Quando utiliza empresa especializada para controle de vetores e pragas, mantém comprovante do serviço executado?', legislation: 'Critério técnico de controle de prestador especializado', weight: 2, isCritical: false, requirementType: 'good_practice' },
    ] },
  ],
};
