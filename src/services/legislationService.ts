import { supabase } from '../lib/supabase';

export interface Legislation {
  id: string;
  name: string;
  summary?: string;
  url?: string;
  created_at: string;
}

export class LegislationService {
  static async listLegislations() {
    const { data, error } = await supabase
      .from('legislations')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data as Legislation[];
  }

  static async saveLegislation(legislation: Partial<Legislation>) {
    const { data, error } = await supabase
      .from('legislations')
      .upsert({
        ...legislation,
        name: legislation.name?.trim()
      })
      .select()
      .single();

    if (error) throw error;
    return data as Legislation;
  }

  static async deleteLegislation(id: string) {
    const { error } = await supabase
      .from('legislations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * Seed de legislações base sugeridas
   */
  static async seedStandardLegislations() {
    const baseList = [
      { name: 'RDC Nº 63/2011', summary: 'Requisitos de Boas Práticas de Funcionamento para Serviços de Saúde (ANVISA).', url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/res0063_25_11_2011.html' },
      { name: 'RDC Nº 15/2012', summary: 'Requisitos de Boas Práticas para o Processamento de Produtos para Saúde (Esterilização).', url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html' },
      { name: 'RDC Nº 502/2021', summary: 'Funcionamento de Instituições de Longa Permanência para Idosos (ILPI). Substituiu a RDC 283/05.', url: 'https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-502-de-27-de-maio-de-2021-322816954' },
      { name: 'RDC Nº 216/2004', summary: 'Regulamento Técnico de Boas Práticas para Serviços de Alimentação (Federal).', url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html' },
      { name: 'RDC Nº 222/2018', summary: 'Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde (RSS).', url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0222_28_03_2018.html' },
      { name: 'RDC Nº 50/2002', summary: 'Regulamento Técnico para planejamento, programação e elaboração de projetos físicos de EAS.', url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0050_21_02_2002.html' },
      { name: 'Lei Federal 6.437/1977', summary: 'Configura infrações à legislação sanitária federal e estabelece sanções.', url: 'https://www.planalto.gov.br/ccivil_03/leis/l6437.htm' },
      { name: 'NR 32', summary: 'Segurança e Saúde no Trabalho em Serviços de Saúde (Ministério do Trabalho).', url: 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/normas-regulamentadoras/nr-32.pdf' },
      { name: 'CVS 5/2013 (SP)', summary: 'Boas Práticas para estabelecimentos comerciais de alimentos e para serviços de alimentação (Estado de SP).', url: 'http://www.cvs.saude.sp.gov.br/zip/E_PT-CVS-05_090413.pdf' },
      { name: 'Portaria 2619/2011 (SP Capital)', summary: 'Regulamento Técnico de Boas Práticas para Alimentos na cidade de São Paulo.', url: 'https://www.prefeitura.sp.gov.br/cidade/secretarias/upload/chamadas/portaria_2619_2011_1323348123.pdf' },
      { name: 'Resolução SES Nº 1568/2017 (RJ)', summary: 'Estabelece critérios e procedimentos para o licenciamento sanitário no Estado do Rio de Janeiro.', url: 'https://www.saude.rj.gov.br' },
      { name: 'Decreto Municipal 1.601/1992 (RJ Capital)', summary: 'Aprova o Regulamento de Alimentos do Município do Rio de Janeiro.', url: 'http://www.rio.rj.gov.br/dlstatic/storage/proprio/arquivo/8/9/8/3134/Decreto1601.pdf' },
      { name: 'RDC Nº 7/2010', summary: 'Requisitos mínimos para o funcionamento de Unidades de Terapia Intensiva (UTI).', url: 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2010/res0007_24_02_2010.html' },
      { name: 'RDC Nº 509/2021', summary: 'Gerenciamento de tecnologias em saúde em estabelecimentos de saúde.', url: 'https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-509-de-27-de-maio-de-2021-322816990' },
    ];

    const { error } = await supabase
      .from('legislations')
      .upsert(baseList, { onConflict: 'name' });
    
    if (error) throw error;
  }

  /**
   * Tenta encontrar legislações citadas em um texto
   */
  static async findLegislationsInText(text: string) {
    const legislations = await this.listLegislations();
    // Procura por nomes de leis no texto (ex: RDC 63/2011)
    return legislations.filter(leg => 
      text.toLowerCase().includes(leg.name.toLowerCase())
    );
  }
}
