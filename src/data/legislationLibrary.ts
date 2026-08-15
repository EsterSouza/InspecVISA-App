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
// 3. `status` + `verifiedAt` registram a checagem de vigência. Norma revogada fica
//    com `status: 'revogada'` e `replacedBy`: some das sugestões e, se algum item
//    ainda a citar, o relatório imprime a substituta em vez de tratá-la como vigente.
//    Ver docs/referencias/biblioteca.md para a evidência de cada linha.
// 4. `uf` nulo = abrangência federal/nacional. `segments` vazio = não é sugerida
//    automaticamente por segmento (entra pelo item que a cita).
// 5. `authority` é a autoria ABNT e é obrigatória: é a única fonte de órgão da
//    citação no PDF. Sem ela a norma é citada só pelo nome — o gerador não deduz.

export type LegislationSegment = 'estetica' | 'ilpi' | 'alimentos' | 'saude';

export type LegislationStatus = 'vigente' | 'vigente_com_alteracoes' | 'revogada';

export interface LegislationEntry {
  /** Grafia canônica do ato, usada no relatório e na biblioteca. */
  name: string;
  summary: string;
  url: string;
  /**
   * Entidade responsável pelo ato, na forma da entrada de autoria da ABNT NBR 6023
   * (ex.: 'BRASIL. Ministério da Saúde', 'RIO DE JANEIRO (Município)'). É a única
   * fonte de autoria da citação — o gerador de PDF não deduz órgão por conta própria.
   */
  authority: string;
  /** UF de abrangência; ausente/null = federal ou nacional. */
  uf?: string | null;
  /** Segmentos para sugestão automática; ausente = nenhum. */
  segments?: LegislationSegment[];
  status: LegislationStatus;
  /** Ato que substituiu este, quando `status` é 'revogada'. */
  replacedBy?: string;
  /** Data da última verificação de vigência (ISO, AAAA-MM-DD). */
  verifiedAt: string;
  /**
   * Cache de pesquisa: artigos já lidos, o que dizem e em que curadoria (REF-04/05/07)
   * foram usados. Existe para não repetir a mesma leitura de norma (e o mesmo gasto de
   * tokens) numa consulta futura — ver docs/referencias/biblioteca.md para o histórico
   * completo. Aparece na Biblioteca de Legislação do app (Admin → Legislações).
   */
  researchNotes?: string;
}

const V = '2026-08-05';

export const LEGISLATION_LIBRARY: LegislationEntry[] = [
  // ── ANVISA — estruturantes de serviço de saúde e estética ────────────────
  {
    name: 'RDC Anvisa nº 63/2011',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Dispõe sobre os Requisitos de Boas Práticas de Funcionamento para os Serviços de Saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/res0063_25_11_2011.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 50/2002',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Regulamento técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0050_21_02_2002.html',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 51/2011',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Requisitos mínimos para análise, avaliação e aprovação dos projetos físicos de estabelecimentos de saúde (Projeto Básico de Arquitetura).',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/rdc0051_06_10_2011.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 15/2012',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Requisitos de boas práticas para o processamento de produtos para saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 36/2013',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Institui ações para a segurança do paciente em serviços de saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2013/rdc0036_25_07_2013.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 222/2018',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Regulamenta as Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde (PGRSS). Substitui a RDC 306/2004, revogada.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0222_28_03_2018.pdf',
    segments: ['ilpi', 'saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 42/2010',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Obrigatoriedade de disponibilização de preparação alcoólica para fricção antisséptica das mãos pelos serviços de saúde.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0042_25_10_2010.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 156/2006',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Dispõe sobre o registro, rotulagem e reprocessamento de produtos médicos; obriga a rotulagem "proibido reprocessar" quando aplicável.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res0156_11_08_2006.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RE Anvisa nº 2.605/2006',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Estabelece a lista de produtos médicos enquadrados como de uso único cujo reprocessamento é proibido.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2006/res2605_11_08_2006.html',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 56/2009',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Proíbe em todo o território nacional o uso de equipamento de bronzeamento artificial com emissão de radiação ultravioleta para fins estéticos.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2009/rdc0056_09_11_2009.html',
    segments: ['estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 67/2007',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Boas Práticas de Manipulação de preparações magistrais e oficinais para uso humano em farmácias. É a norma de origem do produto manipulado que a clínica utiliza.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2007/rdc0067_08_10_2007.html',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 509/2021',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Dispõe sobre o gerenciamento de tecnologias em saúde em estabelecimentos de saúde, do recebimento ao descarte do equipamento.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0509_27_05_2021.pdf',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 751/2022',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    // A ementa cadastrada aqui era a da RDC 611/2022 (radiologia diagnóstica), não
    // a desta norma. Os itens que a citam falam de regularização de equipamento na
    // Anvisa, que é o objeto correto da 751. Conferido no texto oficial (datalegis).
    summary: 'Dispõe sobre a classificação de risco, os regimes de notificação e de registro, e os requisitos de rotulagem e instruções de uso de dispositivos médicos. Substituiu as RDC 185/2001, 15/2014 e 40/2015.',
    url: 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000751&seqAto=000&valorAno=2022&orgao=RDC%2FDC%2FANVISA%2FMS&codTipo=&desItem=&desItemFim=&cod_menu=1696&cod_modulo=134&pesquisa=true',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: '2026-08-14',
  },
  {
    name: 'Nota Técnica Anvisa nº 2/2024',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Esclarece a aplicação das normas sanitárias aos serviços de estética e delimita a fronteira entre embelezamento e serviço de saúde. Substitui a NT 15/2023.',
    url: 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-no-2-2024-sei-ggtes-dire3-anvisa-esclarecimentos-sobre-os-servicos-de-estetica-e-atendimento-as-normas-sanitarias-aplicaveis-a-esses-servicos',
    segments: ['estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Nº 7/2010',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Requisitos mínimos para o funcionamento de Unidades de Terapia Intensiva.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0007_24_02_2010.html',
    segments: ['saude'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── ANVISA — ILPI ────────────────────────────────────────────────────────
  {
    name: 'RDC Anvisa nº 502/2021',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Dispõe sobre o funcionamento de Instituição de Longa Permanência para Idosos (ILPI). Revogou as RDC 283/2005 e 94/2007.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0502_27_05_2021.pdf',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
    researchNotes:
      'Lido no REF-05 (06/08/2026), roteiro ILPI Base Federal: Art. 25 — circulações internas ' +
      'principais mín. 1,00m e secundárias mín. 0,80m; corrimão dos dois lados só passa a ser ' +
      'obrigatório a partir de 1,50m (§1º) — o 1,50m não é largura mínima, é limiar de corrimão. ' +
      'Art. 29 VI é a sala administrativa/reunião (não o almoxarifado, que é o XII). Banheiro do ' +
      'dormitório é o Art. 29 I item 5. Art. 16 II a/b/c separa a proporção de cuidadores por grau ' +
      'de dependência (I 1:20 8h/dia; II 1:10 e III 1:6 por turno) — carga horária diferenciada por ' +
      'grau, distinção que um item agregado único perde. Infraestrutura (mofo, esquadrias, ' +
      'hidrossanitário, vestiário, iluminação/ventilação, revestimentos, mobilidade): Art. 21 ' +
      '(habitabilidade/higiene/salubridade/segurança/acessibilidade), Art. 23 (instalações ' +
      'prediais), Art. 24 II (pisos), Art. 29 XIII (vestiário/banheiro de funcionários, 3,6m² e ' +
      '0,5m² exatos), Art. 46 IV, Art. 51. PAIS é Art. 36 (não confundir com PIA, que é Resolução ' +
      'CNAS 109/2009 + Art. 50 da Lei 10.741/2003).',
  },
  {
    name: 'RDC Anvisa nº 503/2021',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Fixa os requisitos mínimos exigidos para a Terapia de Nutrição Enteral (TNE).',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0503_27_05_2021.pdf',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'RDC Anvisa nº 430/2020',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Boas Práticas de Distribuição, Armazenagem e de Transporte de Medicamentos, incluindo controle de temperatura de termolábeis. Alterada pela RDC 653/2022.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2020/rdc0430_08_10_2020.pdf',
    segments: ['ilpi', 'saude'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },

  // ── ANVISA — alimentos ───────────────────────────────────────────────────
  {
    name: 'RDC Anvisa nº 216/2004',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Regulamento Técnico de Boas Práticas para Serviços de Alimentação. Aplica-se a qualquer serviço de alimentação, sem exceção por porte.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
    researchNotes:
      'Curadoria REF-05 (15/08/2026) do roteiro Nacional de Alimentos (97 itens): todos os 97 têm ' +
      'correspondência de conteúdo em algum subitem de 4.1 a 4.12 do texto oficial — 0 viraram ' +
      '`good_practice`. Atenção: a numeração usada em src/data/templates_alimentos.ts ("item ' +
      '4.1.1"…"4.7") NÃO bate com a numeração oficial (que vai até 4.1.17/4.8.20) — o roteiro parece ' +
      'ter vindo de uma cartilha derivada, não do Regulamento Técnico direto; a correspondência de ' +
      'conteúdo se mantém, só o número do item diverge. Detalhe item a item (id, citação atual, ' +
      'artigo lido, decisão) em docs/referencias/ref05-alimentos-nacional-draft.md. 8 itens com ' +
      'citação suspeita mas mantidos `legal` (a exigência existe, só pode estar na norma errada): ' +
      'ali-f-006 (escadas/elevadores), ali-f-009/ali-f-011 (conforto térmico/coifa), ali-f-014 ' +
      '(vaso sanitário com tampa), ali-f-034 (câmara fria com alarme — provável NR de segurança do ' +
      'trabalho), ali-f-061 (30min/2h entre 12–18°C — parâmetro não está na RDC 216), ali-f-084 ' +
      '(licenciamento de veículo — provável exigência municipal), ali-f-096 (contrato + PGR de ' +
      'resíduos).',
  },
  {
    name: 'RDC Anvisa nº 218/2005',
    authority: 'BRASIL. Agência Nacional de Vigilância Sanitária (ANVISA)',
    summary: 'Procedimentos higiênico-sanitários para manipulação de alimentos e bebidas preparados com vegetais.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2005/rdc0218_29_07_2005.html',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Leis federais ────────────────────────────────────────────────────────
  {
    name: 'Lei Federal nº 5.991/1973',
    authority: 'BRASIL',
    summary: 'Controle sanitário do comércio de drogas, medicamentos, insumos farmacêuticos e correlatos; identificação do medicamento e exigência de prescrição na dispensação.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l5991.htm',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: '2026-08-06',
  },
  {
    name: 'Lei Federal nº 6.360/1976',
    authority: 'BRASIL',
    summary: 'Vigilância sanitária a que ficam sujeitos os medicamentos, cosméticos, saneantes e produtos correlatos; exige regularização junto à Anvisa.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l6360.htm',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 6.437/1977',
    authority: 'BRASIL',
    summary: 'Configura infrações à legislação sanitária federal e estabelece as sanções respectivas.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l6437.htm',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.078/1990',
    authority: 'BRASIL',
    summary: 'Código de Defesa do Consumidor; base do dever de informação e do termo de consentimento na relação com o cliente.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.080/1990',
    authority: 'BRASIL',
    summary: 'Lei Orgânica da Saúde; organiza o SUS e as ações de promoção, proteção e recuperação da saúde.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8080.htm',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.742/1993',
    authority: 'BRASIL',
    summary: 'Lei Orgânica da Assistência Social (LOAS); organiza a assistência social e disciplina o registro das entidades no CNAS.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8742compilado.htm',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 8.842/1994',
    authority: 'BRASIL',
    summary: 'Institui a Política Nacional do Idoso e orienta ações de autonomia, integração e participação social.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8842.htm',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 9.294/1996',
    authority: 'BRASIL',
    summary: 'Restringe o uso de produtos fumígenos; com a redação da Lei 12.546/2011, proíbe fumar em recinto coletivo fechado.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9294.htm',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 10.741/2003',
    authority: 'BRASIL',
    summary: 'Estatuto da Pessoa Idosa; direitos da pessoa idosa e deveres das instituições de atendimento.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741compilado.htm',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 13.589/2018',
    authority: 'BRASIL',
    summary: 'Obriga edifícios de uso público e coletivo com climatização artificial a manter Plano de Manutenção, Operação e Controle (PMOC).',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13589.htm',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 13.709/2018',
    authority: 'BRASIL',
    summary: 'Lei Geral de Proteção de Dados Pessoais (LGPD); disciplina o tratamento de dados de saúde e o acesso ao prontuário.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 14.423/2022',
    authority: 'BRASIL',
    summary: 'Atualiza a nomenclatura legal de "idoso" para "pessoa idosa" no Estatuto da Pessoa Idosa.',
    url: 'https://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2022/Lei/L14423.htm',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Federal nº 14.602/2023',
    authority: 'BRASIL',
    summary: 'Altera a Lei do Exercício da Enfermagem para garantir local de descanso à equipe de enfermagem.',
    url: 'https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2023/Lei/L14602.htm',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Federal nº 9.013/2017',
    authority: 'BRASIL',
    summary: 'RIISPOA — Regulamento da Inspeção Industrial e Sanitária de Produtos de Origem Animal; base do registro SIF/SIE/SIM. Alterado pelo Decreto 10.468/2020, não revogado.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/d9013.htm',
    segments: ['alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },

  // ── Ministério da Saúde ──────────────────────────────────────────────────
  {
    name: 'Portaria SVS/MS nº 344/1998',
    authority: 'BRASIL. Ministério da Saúde',
    summary: 'Regulamento Técnico sobre substâncias e medicamentos sujeitos a controle especial.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/svs/1998/prt0344_12_05_1998_rep.html',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Portaria de Consolidação GM/MS nº 4/2017',
    authority: 'BRASIL. Ministério da Saúde',
    summary: 'Consolida as normas sobre os sistemas e subsistemas do SUS; o Anexo V traz a Lista Nacional de Notificação Compulsória, atualizada em 2026.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0004_03_10_2017.html',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Portaria de Consolidação GM/MS nº 2/2017',
    authority: 'BRASIL. Ministério da Saúde',
    summary: 'Consolida as políticas nacionais de saúde do SUS; o Anexo XXV reúne a Política Nacional de Práticas Integrativas e Complementares.',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0002_03_10_2017_comp.html',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: '2026-08-15',
    researchNotes: 'Referência conceitual e de nomenclatura das PICS no SUS. Não foi tratada como autorização profissional nem como regra autônoma de licenciamento de estabelecimento privado.',
  },
  {
    name: 'Portaria GM/MS nº 888/2021',
    authority: 'BRASIL. Ministério da Saúde',
    summary: 'Padrão de potabilidade e procedimentos de controle e vigilância da qualidade da água para consumo humano (Anexo XX da PRC 5/2017).',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2021/prt0888_07_05_2021.html',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Normas Regulamentadoras (MTE) ────────────────────────────────────────
  {
    name: 'NR-1',
    authority: 'BRASIL. Ministério do Trabalho e Emprego',
    summary: 'Disposições gerais de Segurança e Saúde no Trabalho e gerenciamento de riscos ocupacionais (PGR).',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-6',
    authority: 'BRASIL. Ministério do Trabalho e Emprego',
    summary: 'Equipamento de Proteção Individual (EPI); obriga o fornecimento gratuito e o registro de entrega, com CA válido.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-6-nr-6',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-7',
    authority: 'BRASIL. Ministério do Trabalho e Emprego',
    summary: 'Programa de Controle Médico de Saúde Ocupacional (PCMSO); exames admissional, periódico e demissional.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-7-nr-7',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-10',
    authority: 'BRASIL. Ministério do Trabalho e Emprego',
    summary: 'Segurança em instalações e serviços em eletricidade; medidas de controle e sistemas preventivos.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-24',
    authority: 'BRASIL. Ministério do Trabalho e Emprego',
    summary: 'Condições sanitárias e de conforto nos locais de trabalho: sanitários, vestiário e guarda de pertences.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-24-nr-24',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'NR-32',
    authority: 'BRASIL. Ministério do Trabalho e Emprego',
    summary: 'Segurança e Saúde no Trabalho em Serviços de Saúde; risco biológico, vacinação ocupacional e perfurocortantes.',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-32-nr-32',
    segments: ['saude', 'estetica', 'ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },

  // ── ABNT (normas pagas: link para a página oficial do catálogo) ───────────
  {
    name: 'ABNT NBR 9050',
    authority: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS (ABNT)',
    summary: 'Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos. Versão vigente: NBR 9050:2020, versão corrigida de 25/01/2021.',
    url: 'https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjkwNTA=',
    segments: ['ilpi', 'saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'ABNT NBR 13534',
    authority: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS (ABNT)',
    summary: 'Instalações elétricas de baixa tensão — requisitos específicos para estabelecimentos assistenciais de saúde. Versão vigente: 2008.',
    url: 'https://www.abntcatalogo.com.br/pnm.aspx?Q=czJRSjEzNTM0',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Rio de Janeiro — município ───────────────────────────────────────────
  {
    name: 'Portaria IVISA-RIO nº 002/2020',
    authority: 'RIO DE JANEIRO (Município). Instituto Municipal de Vigilância Sanitária (IVISA-RIO)',
    summary: 'Regulamento técnico de Boas Práticas para estabelecimentos de alimentos no município do Rio de Janeiro; complementa a RDC 216/2004.',
    url: 'https://vigilanciasanitaria.prefeitura.rio/licenciamento-sanitario/licenciamento-sanitario-legislacao/',
    uf: 'RJ',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
    researchNotes:
      'Texto oficial está no PDF, não na página de listagem que a URL do verbete aponta: ' +
      'vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2023/03/Portaria-N-I-VISA-Rio-' +
      '002-11.11.2020.pdf (baixar e ler com pdftotext -enc UTF-8). Artigos já lidos e usados no ' +
      'REF-07 (14–15/08/2026): Art. 90 (utensílios de consumação), Art. 97 (funcionário de caixa não ' +
      'manipula alimento — inclui parágrafo único, correspondência literal), Art. 39 §2º. Para os 3 ' +
      'itens sem base no Decreto-Rio 45.585 revogado: Art. 28 e Art. 49 (fluxo sem cruzamento e ' +
      'barreira entre área limpa/suja — correspondência APROXIMADA aceita para rj-exc-010, não é ' +
      'match literal); Art. 7º (visitantes na área de manipulação — correspondência APROXIMADA ' +
      'aceita para rj-exc-011, também não literal). Para rj-f-087 (exposição de gêneros fora da área ' +
      'física) não foi achado nenhum artigo correspondente nesta Portaria nem em outra norma.',
  },
  {
    name: 'Decreto Rio nº 45.585/2018',
    authority: 'RIO DE JANEIRO (Município)',
    summary: 'Regulamento administrativo do Código de Vigilância Sanitária do município do Rio de Janeiro: licenciamento sanitário e procedimentos fiscalizatórios.',
    url: 'http://www.rio.rj.gov.br/dlstatic/10112/10308893/4263216/DecretoRio455852018CONSOLIDADO06122019.pdf',
    uf: 'RJ',
    segments: ['alimentos', 'saude', 'estetica', 'ilpi'],
    // Art. 72, I do Decreto Rio nº 57.501/2026: "Ficam revogados, a partir de 02 de
    // fevereiro de 2026: I - o Decreto Rio nº 45.585, de 27 de dezembro de 2018".
    // 24 itens de roteiro ainda citam este decreto — ver docs/referencias/biblioteca.md.
    status: 'revogada',
    replacedBy: 'Decreto Rio nº 57.501/2026',
    verifiedAt: '2026-08-14',
  },
  {
    name: 'Decreto Rio nº 57.501/2026',
    authority: 'RIO DE JANEIRO (Município)',
    summary: 'Código Sanitário do município do Rio de Janeiro.',
    url: 'https://vigilanciasanitaria.prefeitura.rio/wp-content/uploads/sites/84/2026/04/Decreto-N%C2%B0-57501_2026.pdf',
    uf: 'RJ',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Municipal 1.601/1992 (RJ Capital)',
    authority: 'RIO DE JANEIRO (Município)',
    summary: 'Aprova o Regulamento de Alimentos do Município do Rio de Janeiro.',
    url: 'http://www.rio.rj.gov.br/dlstatic/storage/proprio/arquivo/8/9/8/3134/Decreto1601.pdf',
    uf: 'RJ',
    segments: ['alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal RJ nº 8.618/2024',
    authority: 'RIO DE JANEIRO (Município)',
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
    authority: 'RIO DE JANEIRO (Estado)',
    summary: 'Estabelece normas para o funcionamento das ILPI no âmbito do Estado do Rio de Janeiro.',
    url: 'https://leisestaduais.com.br/rj/lei-ordinaria-n-8049-2018-rio-de-janeiro-estabelece-normas-para-o-funcionamento-das-instituicoes-de-longa-permanencia-de-idosos-ilpis-no-ambito-do-estado-do-rio-de-janeiro',
    uf: 'RJ',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução SES/RJ nº 1.568/2017',
    authority: 'RIO DE JANEIRO (Estado). Secretaria de Estado de Saúde (SES/RJ)',
    summary: 'Critérios e procedimentos para o licenciamento sanitário no Estado do Rio de Janeiro.',
    url: 'https://www.saude.rj.gov.br/legislacao',
    uf: 'RJ',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução SES/RJ nº 1.822/2019',
    authority: 'RIO DE JANEIRO (Estado). Secretaria de Estado de Saúde (SES/RJ)',
    summary: 'Aprova a relação de documentos para regularização de estabelecimentos sujeitos à vigilância sanitária no Estado do Rio de Janeiro. Revogou a Resolução SES 1.480/2016.',
    url: 'https://sistemas.saude.rj.gov.br/protocoloonline/Documentos/Resolucoes/Res_1822.html',
    uf: 'RJ',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução CREMERJ nº 192/2021',
    authority: 'RIO DE JANEIRO (Estado). Conselho Regional de Medicina do Estado do Rio de Janeiro (CREMERJ)',
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
    authority: 'GOIÁS (Estado)',
    summary: 'Dispõe sobre o SUS no Estado de Goiás e sobre a organização, fiscalização e controle das ações e serviços de saúde nas esferas estadual e municipal.',
    url: 'https://legisla.casacivil.go.gov.br/pesquisa_legislacao/86552/lei-16140',
    uf: 'GO',
    segments: ['ilpi', 'saude', 'estetica', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal nº 1.812/2014 - Senador Canedo',
    authority: 'SENADOR CANEDO (GO)',
    summary: 'Institui o Código Sanitário do Município de Senador Canedo (GO); base municipal do licenciamento e da fiscalização sanitária local.',
    url: 'https://leismunicipais.com.br/a/go/s/senador-canedo/lei-ordinaria/2014/182/1812/lei-ordinaria-n-1812-2014-institui-o-codigo-sanitario-do-municipio-de-senador-canedo-e-da-outras-providencias',
    uf: 'GO',
    segments: ['ilpi', 'saude', 'estetica', 'alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },

  // ── São Paulo ────────────────────────────────────────────────────────────
  {
    name: 'Lei Estadual nº 10.083/1998 - São Paulo',
    authority: 'SÃO PAULO (Estado)',
    summary: 'Institui o Código Sanitário do Estado de São Paulo.',
    url: 'https://www.al.sp.gov.br/repositorio/legislacao/lei/1998/compilacao-lei-10083-23.09.1998.html',
    uf: 'SP',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: '2026-08-15',
  },
  {
    name: 'Portaria CVS nº 1/2024',
    authority: 'SÃO PAULO (Estado). Centro de Vigilância Sanitária (CVS)',
    summary: 'Disciplina o licenciamento sanitário e a classificação de risco dos estabelecimentos de interesse da saúde no Sevisa.',
    url: 'https://cvs.saude.sp.gov.br/zip/E_PT-CVS-1_050124.pdf',
    uf: 'SP',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente',
    verifiedAt: '2026-08-15',
    researchNotes: 'Usada na republicação de 03/05/2024. Revogou a Portaria CVS 11/2023. O CNAE 9602-5/02 varia de risco médio a alto conforme equipamentos, invasividade e responsável.',
  },
  {
    name: 'Portaria CVS nº 5/2025',
    authority: 'SÃO PAULO (Estado). Centro de Vigilância Sanitária (CVS)',
    summary: 'Relaciona as atividades de risco I isentas de licenciamento sanitário no Estado de São Paulo.',
    url: 'https://www.facilitasp.sp.gov.br/wp-content/uploads/2025/06/PORTARIA-CVS-No-5-DE-23-DE-MAIO-DE-2025.pdf',
    uf: 'SP',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: '2026-08-15',
    researchNotes: 'A republicação inclui o CNAE 8690-9/01 de práticas integrativas e complementares como risco I, com a condicionante de que não compete à vigilância sanitária. A retificação de 27/05/2025 não cita esse CNAE.',
  },
  {
    name: 'Portaria CVS nº 15/1999',
    authority: 'SÃO PAULO (Estado). Centro de Vigilância Sanitária (CVS)',
    summary: 'Aprova a norma técnica para procedimentos em estética, emagrecimento e prática ortomolecular em estabelecimentos de saúde.',
    url: 'https://cvs.saude.sp.gov.br/legis.asp?lg_dat=&lg_numero=15',
    uf: 'SP',
    segments: ['saude', 'estetica'],
    status: 'vigente_com_alteracoes',
    verifiedAt: '2026-08-15',
    researchNotes: 'Permanece listada pelo CVS e pela página municipal de clínicas de estética. A Portaria CVS 4/2011 revogou somente o Apêndice I; os demais dispositivos e apêndices não foram tratados como revogados.',
  },
  {
    name: 'Lei Municipal nº 13.725/2004 - São Paulo',
    authority: 'SÃO PAULO (Município)',
    summary: 'Institui o Código Sanitário do Município de São Paulo.',
    url: 'https://legislacao.prefeitura.sp.gov.br/lei-13725-de-09-de-janeiro-de-2004',
    uf: 'SP',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: '2026-08-15',
  },
  {
    name: 'Portaria SMS nº 266/2025',
    authority: 'SÃO PAULO (Município). Secretaria Municipal da Saúde',
    summary: 'Disciplina o licenciamento sanitário no Município de São Paulo, inclusive níveis de risco, CLI, DCA e documentos por atividade.',
    url: 'https://legislacao.prefeitura.sp.gov.br/portaria-secretaria-municipal-da-saude-sms-266-de-6-de-maio-de-2025/consolidado',
    uf: 'SP',
    segments: ['saude', 'estetica', 'ilpi', 'alimentos'],
    status: 'vigente_com_alteracoes',
    verifiedAt: '2026-08-15',
    researchNotes: 'Texto consolidado com a Portaria SMS 456/2025, vigente desde 11/08/2025. Anexo I consultado na revisão 39, de 19/01/2026.',
  },
  {
    name: 'Portaria SMS/COVISA nº 404/2024',
    authority: 'SÃO PAULO (Município). Coordenadoria de Vigilância em Saúde (COVISA)',
    summary: 'Institui a Declaração de Conformidade Físico-Funcional para as atividades municipais listadas em seu Anexo I.',
    url: 'https://legislacao.prefeitura.sp.gov.br/portaria-secretaria-municipal-da-saude-sms-covisa-404-de-20-de-junho-de-2024',
    uf: 'SP',
    segments: ['saude', 'estetica'],
    status: 'vigente',
    verifiedAt: '2026-08-15',
    researchNotes: 'O Anexo I inclui as Clínicas de Estética tipos I, II e III enquadradas no CNAE 8630-5/01. Não inclui o CNAE 9602-5/02 nem o CNAE 8690-9/03.',
  },
  {
    name: 'Portaria CVS 5/2013',
    authority: 'SÃO PAULO (Estado). Centro de Vigilância Sanitária (CVS)',
    summary: 'Boas práticas para estabelecimentos comerciais de alimentos e serviços de alimentação no Estado de São Paulo.',
    url: 'https://www.cvs.saude.sp.gov.br/zip/A_Portaria%20CVS%205_2013.pdf',
    uf: 'SP',
    segments: ['alimentos'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Portaria 2619/2011 (SP Capital)',
    authority: 'SÃO PAULO (Município). Secretaria Municipal da Saúde',
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
    authority: 'MINAS GERAIS (Estado). Secretaria de Estado de Saúde (SES/MG)',
    summary: 'Regras estaduais de licenciamento sanitário e prazos de liberação em Minas Gerais.',
    url: 'https://www.saude.mg.gov.br/wp-content/uploads/2020/11/2.-Resolucao-n-7426_2021%E2%80%AF-1de.pdf',
    uf: 'MG',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal nº 7.031/1996 - Belo Horizonte',
    authority: 'BELO HORIZONTE (MG)',
    summary: 'Institui o Código Sanitário Municipal de Belo Horizonte.',
    url: 'https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1996/704/7031/lei-ordinaria-n-7031-1996-dispoe-sobre-a-normatizacao-complementar-dos-procedimentos-relativos-a-saude-pelo-codigo-sanitario-municipal-e-da-outras-providencias',
    uf: 'MG',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Lei Municipal nº 7.930/1999 - Belo Horizonte',
    authority: 'BELO HORIZONTE (MG)',
    summary: 'Institui a Política Municipal do Idoso em Belo Horizonte.',
    url: 'https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1999/793/7930/lei-ordinaria-n-7930-1999-institui-a-politica-municipal-do-idoso',
    uf: 'MG',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Municipal nº 17.944/2022 - Belo Horizonte',
    authority: 'BELO HORIZONTE (MG)',
    summary: 'Regulamenta os procedimentos para concessão do Alvará de Autorização Sanitária em Belo Horizonte.',
    url: 'https://www.legisweb.com.br/legislacao/?legislacao=430959',
    uf: 'MG',
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Portaria SMS nº 12/2015 - Belo Horizonte',
    authority: 'BELO HORIZONTE (MG). Secretaria Municipal de Saúde (SMS)',
    summary: 'Padrão mínimo de funcionamento das ILPI no município de Belo Horizonte.',
    url: 'https://www.legisweb.com.br/legislacao/?id=283029',
    uf: 'MG',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Portaria SMSA/SUS-BH nº 0221/2022',
    authority: 'BELO HORIZONTE (MG). Secretaria Municipal de Saúde (SMSA/SUS-BH)',
    summary: 'Procedimentos do licenciamento sanitário e classificação de risco em Belo Horizonte.',
    url: 'https://visabh.webnode.page/portarias-visa-bh-/',
    uf: 'MG',
    status: 'vigente',
    verifiedAt: V,
  },

  // ── Conselhos profissionais e outros ─────────────────────────────────────
  {
    name: 'Resolução CNAS nº 109/2009',
    authority: 'BRASIL. Conselho Nacional de Assistência Social (CNAS)',
    summary: 'Aprova a Tipificação Nacional dos Serviços Socioassistenciais; enquadra o acolhimento institucional de pessoa idosa na proteção social especial de alta complexidade.',
    url: 'https://www.mds.gov.br/webarquivos/public/resolucao_cnas_n109_%202009.pdf',
    segments: ['ilpi'],
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Resolução CNDI nº 33/2017',
    authority: 'BRASIL. Conselho Nacional dos Direitos da Pessoa Idosa (CNDI)',
    summary: 'Diretrizes para o contrato de prestação de serviços entre ILPI ou casa-lar e pessoa idosa.',
    url: 'https://www.gov.br/participamaisbrasil/resolucao-n-33-de-24-de-maio-de-2017',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'CBO 5162-10 - Cuidador de Idosos',
    authority: 'BRASIL. Ministério do Trabalho e Emprego',
    summary: 'Descrição da ocupação de cuidador de idosos na Classificação Brasileira de Ocupações.',
    url: 'https://cbo.mte.gov.br/cbosite/pages/pesquisas/BuscaPorTitulo.jsf',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Decreto Federal nº 94.406/1987',
    authority: 'BRASIL',
    summary: 'Regulamenta a Lei 7.498/1986 (exercício da enfermagem) e delimita as atribuições de enfermeiro, técnico e auxiliar.',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto/1980-1989/d94406.htm',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Lei Complementar nº 123/2006',
    authority: 'BRASIL',
    summary: 'Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte; base do tratamento diferenciado em obrigações acessórias.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
    status: 'vigente_com_alteracoes',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 450/2013',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Normatiza o procedimento de sondagem vesical no âmbito da equipe de enfermagem.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-04502013-4/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 557/2017',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Normatiza a atuação da enfermagem no procedimento de aspiração de vias aéreas.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-05572017/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 619/2019',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Normatiza a atuação da enfermagem em sondagem oro/nasogástrica e nasoentérica.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-619-2019/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 582/2018',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Veda a participação do enfermeiro no ensino de práticas privativas de enfermagem em capacitação de cuidador de idosos.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-582-2018_64391.html',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 620/2019',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Normatiza as atribuições dos profissionais de enfermagem em Instituição de Longa Permanência para Idosos.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-620-2019/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 736/2024',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Dispõe sobre a implementação do Processo de Enfermagem. REVOGOU a Resolução COFEN 358/2009 e eliminou o termo "SAE".',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-736-de-17-de-janeiro-de-2024/',
    segments: ['ilpi', 'saude'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 725/2023',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Normas e diretrizes para o sistema de fiscalização dos Conselhos de Enfermagem.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-725-de-15-de-setembro-de-2023/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 746/2024',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Normatiza a contenção mecânica de pacientes, sob supervisão direta do enfermeiro.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-746-de-20-de-marco-de-2024/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Resolução COFEN nº 787/2025',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Regulamenta a atuação da enfermagem no cuidado a pessoas com lesões cutâneas.',
    url: 'https://www.cofen.gov.br/resolucao-cofen-no-787-de-21-de-agosto-de-2025/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
  {
    name: 'Parecer COFEN nº 022/2022',
    authority: 'BRASIL. Conselho Federal de Enfermagem (COFEN)',
    summary: 'Trata da capacitação de cuidador leigo pelo enfermeiro em assistência específica no domicílio.',
    url: 'https://www.cofen.gov.br/parecer-de-camara-tecnica-no-0081-2021-ctln-cofen/',
    segments: ['ilpi'],
    status: 'vigente',
    verifiedAt: V,
  },
];
