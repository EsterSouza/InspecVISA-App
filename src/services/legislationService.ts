import { supabase } from '../lib/supabase';

export interface Legislation {
  id: string;
  name: string;
  summary?: string;
  url?: string;
  created_at: string;
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
    url: "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741.htm"
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
    url: "https://www.abntcatalogo.com.br/norma.aspx?ID=345048"
  },
  {
    name: "Lei 8.049/2018",
    summary: "Dispõe sobre as Instituições de Longa Permanência para Idosos (ILPI) no Estado do Rio de Janeiro.",
    url: ""
  },
];

export const LegislationService = {
  async listLegislations(): Promise<Legislation[]> {
    try {
      const { data, error } = await supabase
        .from('legislations')
        .select('*')
        .order('name');
      
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
    const existing = await this.listLegislations();
    const existingNames = new Set(existing.map(l => l.name));
    
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
