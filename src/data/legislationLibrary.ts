// ============================================================
// Biblioteca de legislações — fonte única de verdade (REF-02)
// ============================================================
// Cada entrada é um ato normativo distinto, com a grafia canônica que o app usa
// ao citar a norma, ementa curta, URL oficial e a situação de vigência apurada.
//
// REGRAS DESTE ARQUIVO
// 1. Uma entrada por ato. Duas grafias do mesmo ato (ex.: "RDC 502/2021" e
//    "RDC ANVISA nº 502/2021") são a mesma linha — a deduplicação é feita por
//    `canonicalLegislationKey` (src/utils/legislationRefs.ts), e o teste
//    legislationLibrary.test.ts falha se duas entradas colidirem na mesma chave.
// 2. `url` aponta para fonte oficial e estável. Ordem de preferência:
//    planalto.gov.br > bvsms.saude.gov.br (Saúde Legis) > in.gov.br >
//    gov.br/<órgão> > portal oficial do ente federativo. Links profundos de
//    anvisalegis.datalegis.net só quando não houver equivalente — a query string
//    deles quebra com facilidade.
// 3. `status` + `verifiedAt` registram a checagem de vigência. Norma revogada
//    NÃO entra como vigente; se for revogada, aponte a substituta em `summary`.
//    Ver docs/referencias/biblioteca.md para a evidência de cada linha.
// 4. `uf` nulo = abrangência federal/nacional. `segments` vazio = não é sugerida
//    automaticamente por segmento (entra pelo item que a cita).

export type LegislationSegment = 'estetica' | 'ilpi' | 'alimentos' | 'saude';

export type LegislationStatus = 'vigente' | 'vigente_com_alteracoes';

export interface LegislationEntry {
  /** Grafia canônica do ato, usada no relatório e na biblioteca. */
  name: string;
  summary: string;
  url: string;
  /** UF de abrangência; ausente/null = federal ou nacional. */
  uf?: string | null;
  /** Segmentos para sugestão automática; ausente = nenhum. */
  segments?: LegislationSegment[];
  status: LegislationStatus;
  /** Data da última verificação de vigência (ISO, AAAA-MM-DD). */
  verifiedAt: string;
}

const V = '2026-08-05';

export const LEGISLATION_LIBRARY: LegislationEntry[] = [
  // ── ANVISA — estruturantes de serviço de saúde e estética ────────────────
  {
    name: 'RDC Anvisa nº 63/2011',
    summary: 'Dispõe sobre os Requisitos de Boas Práticas de Funcionamento para os Serviços de Saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/res0063_25_11_2011.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 50/2002',
    summary: 'Regulamento técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0050_21_02_2002.html',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 51/2011',
    summary: 'Requisitos mínimos para análise, avaliação e aprovação dos projetos físicos de estabelecimentos de saúde (Projeto Básico de Arquitetura).',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/rdc0051_06_10_2011.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 15/2012',
    summary: 'Requisitos de boas práticas para o processamento de produtos para saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 36/2013',
    summary: 'Institui ações para a segurança do paciente em serviços de saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2013/rdc0036_25_07_2013.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 222/2018',
    summary: 'Regulamenta as Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde (PGRSS). Substitui a RDC 306/2004, revogada.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0222_28_03_2018.pdf',
    segments: ['ilpi', 'saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 42/2010',
    summary: 'Obrigatoriedade de disponibilização de preparação alcoólica para fricção antisséptica das mãos pelos serviços de saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0042_25_10_2010.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 156/2006',
    summary: 'Dispõe sobre o registro, rotulagem e reprocessamento de produtos médicos; obriga a rotulagem "proibido reprocessar" quando aplicável.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res0156_11_08_2006.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RE Anvisa nº 2.605/2006',
    summary: 'Estabelece a lista de produtos médicos enquadrados como de uso único cujo reprocessamento é proibido.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res2605_11_08_2006.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 56/2009',
    summary: 'Proíbe em todo o território nacional o uso de equipamento de bronzeamento artificial com emissão de radiação ultravioleta para fins estéticos.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2009/rdc0056_09_11_2009.html',
    segments: ['estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 67/2007',
    summary: 'Boas Práticas de Manipulação de preparações magistrais e oficinais para uso humano em farmácias. É a norma de origem do produto manipulado que a clínica utiliza.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2007/rdc0067_08_10_2007.html',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 509/2021',
    summary: 'Dispõe sobre o gerenciamento de tecnologias em saúde em estabelecimentos de saúde, do recebimento ao descarte do equipamento.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0509_27_05_2021.pdf',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 751/2022',
    summary: 'Requisitos sanitários aplicáveis aos serviços de saúde que utilizam equipamentos emissores de radiações ionizantes para diagnóstico.',
    url: 'https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-751-de-21-de-setembro-de-2022-430929547',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Nota Técnica Anvisa nº 2/2024',
    summary: 'Esclarece a aplicação das normas sanitárias aos serviços de estética e delimita a fronteira entre embelezamento e serviço de saúde. Substitui a NT 15/2023.',
    url: 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos',
    segments: ['estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Nº 7/2010',
    summary: 'Requisitos mínimos para o funcionamento de Unidades de Terapia Intensiva.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0007_24_02_2010.html',
    segments: ['saude'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── ANVISA — ILPI ────────────────────────────────────────────────────────
  {
    name: 'RDC Anvisa nº 502/2021',
    summary: 'Dispõe sobre o funcionamento de Instituição de Longa Permanência para Idosos (ILPI). Revogou as RDC 283/2005 e 94/2007.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0502_27_05_2021.pdf',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 503/2021',
    summary: 'Fixa os requisitos mínimos exigidos para a Terapia de Nutrição Enteral (TNE).',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0503_27_05_2021.pdf',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 430/2020',
    summary: 'Boas Práticas de Distribuição, Armazenagem e de Transporte de Medicamentos, incluindo controle de temperatura de termolábeis. Alterada pela RDC 653/2022.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0430_08_10_2020.pdf',
    segments: ['ilpi', 'saude'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },

  // ── ANVISA — alimentos ───────────────────────────────────────────────────
  {
    name: 'RDC Anvisa nº 216/2004',
    summary: 'Regulamento Técnico de Boas Práticas para Serviços de Alimentação. Aplica-se a qualquer serviço de alimentação, sem exceção por porte.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 218/2005',
    summary: 'Procedimentos higiênico-sanitários para manipulação de alimentos e bebidas preparados com vegetais.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2005/rdc0218_29_07_2005.html',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Leis federais ────────────────────────────────────────────────────────
  {
    name: 'Lei Federal nº 6.360/1976',
    summary: 'Vigilância sanitária a que ficam sujeitos os medicamentos, cosméticos, saneantes e produtos correlatos; exige regularização junto à Anvisa.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l6360.htm',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 6.437/1977',
    summary: 'Configura infrações à legislação sanitária federal e estabelece as sanções respectivas.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l6437.htm',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.078/1990',
    summary: 'Código de Defesa do Consumidor; base do dever de informação e do termo de consentimento na relação com o cliente.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.080/1990',
    summary: 'Lei Orgânica da Saúde; organiza o SUS e as ações de promoção, proteção e recuperação da saúde.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8080.htm',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.742/1993',
    summary: 'Lei Orgânica da Assistência Social (LOAS); organiza a assistência social e disciplina o registro das entidades no CNAS.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8742compilado.htm',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.842/1994',
    summary: 'Institui a Política Nacional do Idoso e orienta ações de autonomia, integração e participação social.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8842.htm',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 9.294/1996',
    summary: 'Restringe o uso de produtos fumígenos; com a redação da Lei 12.546/2011, proíbe fumar em recinto coletivo fechado.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9294.htm',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 10.741/2003',
    summary: 'Estatuto da Pessoa Idosa; direitos da pessoa idosa e deveres das instituições de atendimento.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741compilado.htm',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 13.589/2018',
    summary: 'Obriga edifícios de uso público e coletivo com climatização artificial a manter Plano de Manutenção, Operação e Controle (PMOC).',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13589.htm',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 13.709/2018',
    summary: 'Lei Geral de Proteção de Dados Pessoais (LGPD); disciplina o tratamento de dados de saúde e o acesso ao prontuário.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 14.423/2022',
    summary: 'Atualiza a nomenclatura legal de "idoso" para "pessoa idosa" no Estatuto da Pessoa Idosa.',
    url: 'https://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2022/Lei/L14423.htm',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 14.602/2023',
    summary: 'Altera a Lei do Exercício da Enfermagem para garantir local de descanso à equipe de enfermagem.',
    url: 'https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2023/Lei/L14602.htm',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Federal nº 9.013/2017',
    summary: 'RIISPOA — Regulamento da Inspeção Industrial e Sanitária de Produtos de Origem Animal; base do registro SIF/SIE/SIM. Alterado pelo Decreto 10.468/2020, não revogado.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/d9013.htm',
    segments: ['alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },

  // ── Ministério da Saúde ──────────────────────────────────────────────────
  {
    name: 'Portaria SVS/MS nº 344/1998',
    summary: 'Regulamento Técnico sobre substâncias e medicamentos sujeitos a controle especial.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/svs/1998/prt0344_12_05_1998_rep.html',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Portaria de Consolidação GM/MS nº 4/2017',
    summary: 'Consolida as normas sobre os sistemas e subsistemas do SUS; o Anexo V traz a Lista Nacional de Notificação Compulsória, atualizada em 2026.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0004_03_10_2017.html',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Portaria GM/MS nº 888/2021',
    summary: 'Padrão de potabilidade e procedimentos de controle e vigilância da qualidade da água para consumo humano (Anexo XX da PRC 5/2017).',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2021/prt0888_07_05_2021.html',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Normas Regulamentadoras (MTE) ────────────────────────────────────────
  {
    name: 'NR-1',
    summary: 'Disposições gerais de Segurança e Saúde no Trabalho e gerenciamento de riscos ocupacionais (PGR).',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-6',
    summary: 'Equipamento de Proteção Individual (EPI); obriga o fornecimento gratuito e o registro de entrega, com CA válido.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-6',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-7',
    summary: 'Programa de Controle Médico de Saúde Ocupacional (PCMSO); exames admissional, periódico e demissional.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-7',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-10',
    summary: 'Segurança em instalações e serviços em eletricidade; medidas de controle e sistemas preventivos.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-10',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-24',
    summary: 'Condições sanitárias e de conforto nos locais de trabalho: sanitários, vestiário e guarda de pertences.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-24',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-32',
    summary: 'Segurança e Saúde no Trabalho em Serviços de Saúde; risco biológico, vacinação ocupacional e perfurocortantes.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-32',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },

  // ── ABNT (normas pagas: link para a página oficial do catálogo) ───────────
  {
    name: 'ABNT NBR 9050',
    summary: 'Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos. Versão vigente: NBR 9050:2020, versão corrigida de 25/01/2021.',
    url: 'https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjkwNTA=',
    segments: ['ilpi', 'saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'ABNT NBR 13534',
    summary: 'Instalações elétricas de baixa tensão — requisitos específicos para estabelecimentos assistenciais de saúde. Versão vigente: 2008.',
    url: 'https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjEzNTM0',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Rio de Janeiro — município ───────────────────────────────────────────
  {
    name: 'Portaria IVISA-RIO nº 002/2020',
    summary: 'Regulamento técnico de Boas Práticas para estabelecimentos de alimentos no município do Rio de Janeiro; complementa a RDC 216/2004.',
    url: 'https://vigilanciasanitaria.prefeitura.rio/licenciamento-sanitario/licenciamento-sanitario-legislacao/',
    uf: 'RJ',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Rio nº 45.585/2018',
    summary: 'Regulamento administrativo do Código de Vigilância Sanitária do município do Rio de Janeiro: licenciamento sanitário e procedimentos fiscalizatórios.',
    url: 'http://www.rio.rj.gov.br/dlstatic/10112/10308893/4263216/DecretoRio455852018CONSOLIDADO06122019.pdf',
    uf: 'RJ',
    segments: ['alimentos', 'saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Decreto Rio nº 57.501/2026',
    summary: 'Código Sanitário do município do Rio de Janeiro.',
    url: 'https://vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2026/04/Decreto-N%C2%B0-57501_2026.pdf',
    uf: 'RJ',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Municipal 1.601/1992 (RJ Capital)',
    summary: 'Aprova o Regulamento de Alimentos do Município do Rio de Janeiro.',
    url: 'http://www.rio.rj.gov.br/dlstatic/storage/proprio/arquivo/8/9/8/3134/Decreto1601.pdf',
    uf: 'RJ',
    segments: ['alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal RJ nº 8.618/2024',
    summary: 'Obriga sala ou local de descanso para a equipe de enfermagem em estabelecimentos de saúde do município do Rio de Janeiro.',
    url: 'https://www.cofen.gov.br/prefeitura-do-rio-de-janeiro-sanciona-lei-de-descanso-digno-para-a-categoria/',
    uf: 'RJ',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Rio de Janeiro — estado ──────────────────────────────────────────────
  {
    name: 'Lei Ordinária RJ nº 8.049/2018',
    summary: 'Estabelece normas para o funcionamento das ILPI no âmbito do Estado do Rio de Janeiro.',
    url: 'https://leisestaduais.com.br/rj/lei-ordinaria-n-8049-2018-rio-de-janeiro-estabelece-normas-para-o-funcionamento-das-instituicoes-de-longa-permanencia-de-idosos-ilpis-no-ambito-do-estado-do-rio-de-janeiro',
    uf: 'RJ',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução SES/RJ nº 1.568/2017',
    summary: 'Critérios e procedimentos para o licenciamento sanitário no Estado do Rio de Janeiro.',
    url: 'https://www.saude.rj.gov.br/legislacao',
    uf: 'RJ',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução SES/RJ nº 1.822/2019',
    summary: 'Aprova a relação de documentos para regularização de estabelecimentos sujeitos à vigilância sanitária no Estado do Rio de Janeiro. Revogou a Resolução SES 1.480/2016.',
    url: 'https://sistemas.saude.rj.gov.br/protocoloonline/Documentos/Resolucoes/Res_1822.html',
    uf: 'RJ',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução CREMERJ nº 192/2021',
    summary: 'Disciplina a direção técnica e a responsabilidade técnica médica nos estabelecimentos de saúde do Estado do Rio de Janeiro.',
    url: 'https://www.cremerj.org.br/resolucoes/',
    uf: 'RJ',
    segments: ['saude', 'ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Goiás ────────────────────────────────────────────────────────────────
  {
    name: 'Lei Estadual nº 16.140/2007 - Goiás',
    summary: 'Dispõe sobre o SUS no Estado de Goiás e sobre a organização, fiscalização e controle das ações e serviços de saúde nas esferas estadual e municipal.',
    url: 'https://legisla.casacivil.go.gov.br/pesquisa_legislacao/86552/lei-16140',
    uf: 'GO',
    segments: ['ilpi', 'saude', 'estetica', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal nº 1.812/2014 - Senador Canedo',
    summary: 'Institui o Código Sanitário do Município de Senador Canedo (GO); base municipal do licenciamento e da fiscalização sanitária local.',
    url: 'https://leismunicipais.com.br/a/go/s/senador-canedo/lei-ordinaria/2014/182/1812/lei-ordinaria-n-1812-2014-institui-o-codigo-sanitario-do-municipio-de-senador-canedo-e-da-outras-providencias',
    uf: 'GO',
    segments: ['ilpi', 'saude', 'estetica', 'alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── São Paulo ────────────────────────────────────────────────────────────
  {
    name: 'Portaria CVS 5/2013',
    summary: 'Boas práticas para estabelecimentos comerciais de alimentos e serviços de alimentação no Estado de São Paulo.',
    url: 'https://www.cvs.saude.sp.gov.br/zip/A_Portaria%20CVS%205_2013.pdf',
    uf: 'SP',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Portaria 2619/2011 (SP Capital)',
    summary: 'Regulamento Técnico de Boas Práticas para alimentos no município de São Paulo.',
    url: 'https://www.prefeitura.sp.gov.br/cidade/secretarias/upload/chamadas/portaria_2619_2011_1323348123.pdf',
    uf: 'SP',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Minas Gerais ─────────────────────────────────────────────────────────
  {
    name: 'Resolução SES/MG nº 7.426/2021',
    summary: 'Regras estaduais de licenciamento sanitário e prazos de liberação em Minas Gerais.',
    url: 'https://www.saude.mg.gov.br/wp-content/uploads/2020/11/2.-Resolucao-n-7426_2021%E2%80%AF-1de.pdf',
    uf: 'MG',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal nº 7.031/1996 - Belo Horizonte',
    summary: 'Institui o Código Sanitário Municipal de Belo Horizonte.',
    url: 'https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1996/704/7031/lei-ordinaria-n-7031-1996-dispoe-sobre-a-normatizacao-complementar-dos-procedimentos-relativos-a-saude-pelo-codigo-sanitario-municipal-e-da-outras-providencias',
    uf: 'MG',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal nº 7.930/1999 - Belo Horizonte',
    summary: 'Institui a Política Municipal do Idoso em Belo Horizonte.',
    url: 'https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1999/793/7930/lei-ordinaria-n-7930-1999-institui-a-politica-municipal-do-idoso',
    uf: 'MG',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Municipal nº 17.944/2022 - Belo Horizonte',
    summary: 'Regulamenta os procedimentos para concessão do Alvará de Autorização Sanitária em Belo Horizonte.',
    url: 'https://www.legisweb.com.br/legislacao/?legislacao=430959',
    uf: 'MG',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Portaria SMS nº 12/2015 - Belo Horizonte',
    summary: 'Padrão mínimo de funcionamento das ILPI no município de Belo Horizonte.',
    url: 'https://www.legisweb.com.br/legislacao/?id=283029',
    uf: 'MG',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Portaria SMSA/SUS-BH nº 0221/2022',
    summary: 'Procedimentos do licenciamento sanitário e classificação de risco em Belo Horizonte.',
    url: 'https://visabh.webnode.page/portarias-visa-bh-/',
    uf: 'MG',
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Conselhos profissionais e outros ─────────────────────────────────────
  {
    name: 'Resolução CNAS nº 109/2009',
    summary: 'Aprova a Tipificação Nacional dos Serviços Socioassistenciais; enquadra o acolhimento institucional de pessoa idosa na proteção social especial de alta complexidade.',
    url: 'https://www.mds.gov.br/webarquivos/public/resolucao_cnas_n109_%202009.pdf',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Resolução CNDI nº 33/2017',
    summary: 'Diretrizes para o contrato de prestação de serviços entre ILPI ou casa-lar e pessoa idosa.',
    url: 'https://www.gov.br/participamaisbrasil/resolucao-n-33-de-24-de-maio-de-2017',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'CBO 5162-10 - Cuidador de Idosos',
    summary: 'Descrição da ocupação de cuidador de idosos na Classificação Brasileira de Ocupações.',
    url: 'https://cbo.mte.gov.br/cbosite/pages/pesquisas/BuscaPorTitulo.jsf',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Federal nº 94.406/1987',
    summary: 'Regulamenta a Lei 7.498/1986 (exercício da enfermagem) e delimita as atribuições de enfermeiro, técnico e auxiliar.',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto/1980-1989/d94406.htm',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Complementar nº 123/2006',
    summary: 'Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte; base do tratamento diferenciado em obrigações acessórias.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 450/2013',
    summary: 'Normatiza o procedimento de sondagem vesical no âmbito da equipe de enfermagem.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-04502013-4/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 557/2017',
    summary: 'Normatiza a atuação da enfermagem no procedimento de aspiração de vias aéreas.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-05572017/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 619/2019',
    summary: 'Normatiza a atuação da enfermagem em sondagem oro/nasogástrica e nasoentérica.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-619-2019/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 582/2018',
    summary: 'Veda a participação do enfermeiro no ensino de práticas privativas de enfermagem em capacitação de cuidador de idosos.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-582-2018_64391.html',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 620/2019',
    summary: 'Normatiza as atribuições dos profissionais de enfermagem em Instituição de Longa Permanência para Idosos.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-620-2019/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 736/2024',
    summary: 'Dispõe sobre a implementação do Processo de Enfermagem. REVOGOU a Resolução COFEN 358/2009 e eliminou o termo "SAE".',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-736-de-17-de-janeiro-de-2024/',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 725/2023',
    summary: 'Normas e diretrizes para o sistema de fiscalização dos Conselhos de Enfermagem.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-725-de-15-de-setembro-de-2023/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 746/2024',
    summary: 'Normatiza a contenção mecânica de pacientes, sob supervisão direta do enfermeiro.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-746-de-20-de-marco-de-2024/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 787/2025',
    summary: 'Regulamenta a atuação da enfermagem no cuidado a pessoas com lesões cutâneas.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-787-de-21-de-agosto-de-2025/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Parecer COFEN nº 022/2022',
    summary: 'Trata da capacitação de cuidador leigo pelo enfermeiro em assistência específica no domicílio.',
    url: 'https://www.cofen.gov.br/parecer-de-camara-tecnica-no-0081-2021-ctln-cofen/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
];
