import { supabase } from '../lib/supabase';

export interface Legislation {
  id: string;
  name: string;
  summary?: string;
  url?: string;
  created_at: string;
}

const LEGISLATION_QUERY_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), timeoutMs);
    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

const DEFAULT_LEGISLATIONS: Omit<Legislation, 'id' | 'created_at'>[] = [
  {
    name: "RDC ANVISA nº 502/2021",
    summary: "Dispõe sobre o funcionamento de Instituição de Longa Permanência para Idosos (ILPI) e dá outras providências.",
    url: "https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-502-de-27-de-maio-de-2021-323004654"
  },
  {
    name: "RDC ANVISA nº 216/2004",
    summary: "Dispõe sobre Regulamento Técnico de Boas Práticas para Serviços de Alimentação.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html"
  },
  {
    name: "RDC ANVISA nº 63/2011",
    summary: "Dispõe sobre os Requisitos de Boas Práticas de Funcionamento para os Serviços de Saúde.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/res0063_25_11_2011.html"
  },
  {
    name: "RDC ANVISA nº 15/2012",
    summary: "Dispõe sobre requisitos de boas práticas para o processamento de produtos para saúde e dá outras providências.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html"
  },
  {
    name: "RDC ANVISA nº 222/2018",
    summary: "Regulamenta as Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde e dá outras providências.",
    url: "https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/25158812"
  },
  {
    name: "RDC ANVISA nº 36/2013",
    summary: "Institui ações para a segurança do paciente em serviços de saúde e dá outras providências.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2013/rdc0036_25_07_2013.html"
  },
  {
    name: "RDC ANVISA nº 50/2002",
    summary: "Dispõe sobre o Regulamento Técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0050_21_02_2002.html"
  },
  {
    name: "RDC ANVISA nº 751/2022",
    summary: "Dispõe sobre os requisitos sanitários aplicáveis aos serviços de saúde que utilizam equipamentos emissores de radiações ionizantes para fins de diagnóstico e guia procedimentos.",
    url: "https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-751-de-21-de-setembro-de-2022-430929547"
  },
  {
    name: "Lei Federal nº 10.741/2003",
    summary: "Dispõe sobre o Estatuto da Pessoa Idosa e dá outras providências.",
    url: "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741compilado.htm"
  },
  {
    name: "Lei Federal nº 14.423/2022",
    summary: "Atualiza a nomenclatura legal de idoso para pessoa idosa no Estatuto da Pessoa Idosa.",
    url: "https://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2022/Lei/L14423.htm"
  },
  {
    name: "Lei Federal nº 8.080/1990",
    summary: "Organiza o SUS e regula as ações e serviços de promoção, proteção e recuperação da saúde.",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
  },
  {
    name: "Lei Federal nº 8.842/1994",
    summary: "Institui a Política Nacional do Idoso e orienta ações para autonomia e integração social.",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8842.htm"
  },
  {
    name: "Lei Federal nº 8.078/1990",
    summary: "Institui o Código de Defesa do Consumidor, aplicável à relação contratual entre ILPI e residente ou família.",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8078.htm"
  },
  {
    name: "Lei Federal nº 6.437/1977",
    summary: "Configura infrações à legislação sanitária federal, estabelece as sanções respectivas, e dá outras providências.",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l6437.htm"
  },
  {
    name: "Portaria SVS/MS nº 344/1998",
    summary: "Aprova o Regulamento Técnico sobre substâncias e medicamentos sujeitos a controle especial.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/svs/1998/prt0344_12_05_1998_rep.html"
  },
  {
    name: "Portaria CVS 5/2013",
    summary: "Regulamento técnico sobre boas práticas para estabelecimentos comerciais de alimentos e para serviços de alimentação do Estado de São Paulo.",
    url: "https://www.cvs.saude.sp.gov.br/zip/A_Portaria%20CVS%205_2013.pdf"
  },
  {
    name: "NR-32",
    summary: "Segurança e Saúde no Trabalho em Serviços de Saúde.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/composicao/secretaria-de-trabalho/sst/normas-regulamentadoras/nr-32.pdf"
  },
  {
    name: "ABNT NBR 9050",
    summary: "Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos.",
    url: "https://www.abntcatalogo.com.br/norma.aspx?ID=461488"
  },
  {
    name: "Lei Ordinária RJ nº 8.049/2018",
    summary: "Dispõe sobre as Instituições de Longa Permanência para Idosos (ILPI) no Estado do Rio de Janeiro.",
    url: "https://leisestaduais.com.br/rj/lei-ordinaria-n-8049-2018-rio-de-janeiro-estabelece-normas-para-o-funcionamento-das-instituicoes-de-longa-permanencia-de-idosos-ilpis-no-ambito-do-estado-do-rio-de-janeiro"
  },
  {
    name: "Portaria SMS nº 12/2015 - Belo Horizonte",
    summary: "Estabelece o padrão mínimo de funcionamento das ILPIs no município de Belo Horizonte.",
    url: "https://www.legisweb.com.br/legislacao/?id=283029"
  },
  {
    name: "Lei Municipal nº 7.031/1996 - Belo Horizonte",
    summary: "Institui o Código Sanitário Municipal de Belo Horizonte e dá base à fiscalização sanitária.",
    url: "https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1996/704/7031/lei-ordinaria-n-7031-1996-dispoe-sobre-a-normatizacao-complementar-dos-procedimentos-relativos-a-saude-pelo-codigo-sanitario-municipal-e-da-outras-providencias"
  },
  {
    name: "Decreto Municipal nº 17.944/2022 - Belo Horizonte",
    summary: "Regulamenta os procedimentos para concessão do Alvará de Autorização Sanitária em Belo Horizonte.",
    url: "https://www.legisweb.com.br/legislacao/?legislacao=430959"
  },
  {
    name: "Portaria SMSA/SUS-BH nº 0221/2022",
    summary: "Define os procedimentos do licenciamento sanitário e classificação de risco em Belo Horizonte.",
    url: "https://visabh.webnode.page/portarias-visa-bh-/"
  },
  {
    name: "Resolução SES/MG nº 7.426/2021",
    summary: "Estabelece regras estaduais de licenciamento sanitário e prazos de liberação em Minas Gerais.",
    url: "https://www.saude.mg.gov.br/wp-content/uploads/2020/11/2.-Resolucao-n-7426_2021%E2%80%AF-1de.pdf"
  },
  {
    name: "Lei Municipal nº 7.930/1999 - Belo Horizonte",
    summary: "Institui a Política Municipal do Idoso em Belo Horizonte.",
    url: "https://leismunicipais.com.br/a/mg/b/belo-horizonte/lei-ordinaria/1999/793/7930/lei-ordinaria-n-7930-1999-institui-a-politica-municipal-do-idoso"
  },
  {
    name: "Resolução CNDI nº 33/2017",
    summary: "Define diretrizes para contrato de prestação de serviços entre ILPI ou casa-lar e pessoa idosa.",
    url: "https://www.gov.br/participamaisbrasil/resolucao-n-33-de-24-de-maio-de-2017"
  },
  {
    name: "CBO 5162-10 - Cuidador de Idosos",
    summary: "Descreve a ocupação de cuidador de idosos e suas atividades gerais de cuidado e apoio.",
    url: "https://www.ocupacoes.com.br/cbo-mte/516210-cuidador-de-idosos"
  },
  {
    name: "Resolução COFEN nº 619/2019",
    summary: "Normatiza a atuação da enfermagem em sondagem oro/nasogástrica e nasoentérica.",
    url: "https://www.cofen.gov.br/resolucao-cofen-no-619-2019/"
  },
  {
    name: "Resolução COFEN nº 450/2013",
    summary: "Normatiza o procedimento de sondagem vesical no âmbito da equipe de enfermagem.",
    url: "https://www.cofen.gov.br/resolucao-cofen-no-04502013-4/"
  },
  {
    name: "Resolução COFEN nº 557/2017",
    summary: "Normatiza a atuação da enfermagem no procedimento de aspiração de vias aéreas.",
    url: "https://www.cofen.gov.br/resolucao-cofen-no-05572017/"
  },
  {
    name: "Resolução COFEN nº 746/2024",
    summary: "Normatiza a contenção mecânica de pacientes, sob supervisão direta do enfermeiro.",
    url: "https://www.cofen.gov.br/resolucao-cofen-no-746-de-20-de-marco-de-2024/"
  },
  {
    name: "Resolução COFEN nº 787/2025",
    summary: "Regulamenta a atuação da enfermagem no cuidado a pessoas com lesões cutâneas.",
    url: "https://www.cofen.gov.br/resolucao-cofen-no-787-de-21-de-agosto-de-2025/"
  },
  {
    name: "Resolução COFEN nº 725/2023",
    summary: "Estabelece normas e diretrizes para o sistema de fiscalização dos Conselhos de Enfermagem.",
    url: "https://www.cofen.gov.br/resolucao-cofen-no-725-de-15-de-setembro-de-2023/"
  },
  {
    name: "Parecer COFEN nº 022/2022",
    summary: "Trata da capacitação de cuidador leigo pelo enfermeiro em assistência específica no domicílio.",
    url: "https://www.cofen.gov.br/parecer-de-camara-tecnica-no-0081-2021-ctln-cofen/"
  },
];

export const LegislationService = {
  async listLegislations(): Promise<Legislation[]> {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('legislations')
          .select('*')
          .order('name'),
        LEGISLATION_QUERY_TIMEOUT_MS,
        'ListLegislations'
      );
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[LegislationService] Falha ao buscar do Supabase, usando defaults:', err);
      // Return defaults with mock IDs so the UI doesn't crash
      return DEFAULT_LEGISLATIONS.map((leg, idx) => ({
        ...leg,
        id: `default-${idx}`,
        created_at: new Date().toISOString(),
      }));
    }
  },

  async seedStandardLegislations(): Promise<number> {
    const { data: existing = [], error: listError } = await withTimeout(
      supabase
        .from('legislations')
        .select('name'),
      LEGISLATION_QUERY_TIMEOUT_MS,
      'SeedLegislationsList'
    );
    if (listError) throw listError;

    const existingRows = existing || [];
    const existingNames = new Set(existingRows.map(l => l.name));
    
    const toAdd = DEFAULT_LEGISLATIONS.filter(l => !existingNames.has(l.name));
    
    if (toAdd.length === 0) return 0;

    const { error } = await supabase
      .from('legislations')
      .insert(toAdd);
    
    if (error) throw error;
    return toAdd.length;
  },

  async saveLegislation(leg: Omit<Legislation, 'id' | 'created_at'>): Promise<Legislation> {
    const { data, error } = await supabase
      .from('legislations')
      .insert([leg])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateLegislation(id: string, leg: Partial<Omit<Legislation, 'id' | 'created_at'>>): Promise<Legislation> {
    const { data, error } = await supabase
      .from('legislations')
      .update(leg)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteLegislation(id: string): Promise<void> {
    const { error } = await supabase
      .from('legislations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
