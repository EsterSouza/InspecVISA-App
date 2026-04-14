import { supabase } from '../lib/supabase';

export interface Legislation {
  id: string;
  name: string;
  summary?: string;
  url?: string;
  created_at: string;
}

const DEFAULT_LEGISLATIONS = [
  {
    name: "RDC ANVISA Nº 216/2004",
    summary: "Dispõe sobre Regulamento Técnico de Boas Práticas para Serviços de Alimentação.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html"
  },
  {
    name: "RDC ANVISA Nº 509/2021 (ILPI)",
    summary: "Dispõe sobre o Regulamento Técnico para o funcionamento de Instituições de Longa Permanência para Idosos.",
    url: "https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-509-de-27-de-maio-de-2021-323004654"
  },
  {
    name: "RDC ANVISA Nº 15/2012",
    summary: "Estabelece requisitos de boas práticas para o processamento de produtos para saúde.",
    url: "https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html"
  },
  {
    name: "Portaria CVS 5/2013",
    summary: "Regulamento técnico sobre boas práticas para estabelecimentos comerciais de alimentos e para serviços de alimentação.",
    url: "https://www.cvs.saude.sp.gov.br/zip/A_Portaria%20CVS%205_2013.pdf"
  },
  {
    name: "Lei Federal nº 6.437/1977",
    summary: "Configura infrações à legislação sanitária federal, estabelece as sanções respectivas, e dá outras providências.",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l6437.htm"
  }
];

export const LegislationService = {
  async listLegislations(): Promise<Legislation[]> {
    const { data, error } = await supabase
      .from('legislations')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
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

  async deleteLegislation(id: string): Promise<void> {
    const { error } = await supabase
      .from('legislations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
