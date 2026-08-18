import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/network';
import {
  LEGISLATION_LIBRARY,
  isApplicable,
  type LegislationSegment,
  type LegislationStatus,
} from '@visa/legislacao';

export type { LegislationSegment, LegislationStatus };

export interface Legislation {
  id: string;
  name: string;
  summary?: string;
  url?: string;
  /** Autoria ABNT do ato. Sem ela a citação sai sem órgão — nunca deduzida. */
  authority?: string | null;
  /** 'revogada' tira o ato das sugestões e faz o PDF apontar `replaced_by`. */
  status?: LegislationStatus | null;
  replaced_by?: string | null;
  /** Referência ABNT NBR 6023 completa, quando o verbete tem uma escrita à mão. */
  abnt?: string | null;
  /** UF de abrangência (ex.: 'RJ', 'MG', 'SP'). Vazio/null = federal/nacional. */
  uf?: string | null;
  /** Município de abrangência; exige `uf`. Vazio = alcança a UF inteira. */
  municipio?: string | null;
  /** Segmentos aplicáveis. Vazio/null = aplica a todos os segmentos. */
  segments?: LegislationSegment[] | null;
  /** Cache de pesquisa: artigos já lidos e o que dizem, para não repetir a leitura numa consulta futura. */
  research_notes?: string | null;
  created_at: string;
}

/**
 * Decide se uma legislação deve ser sugerida automaticamente para uma inspeção.
 * A regra mora em @visa/legislacao para que InspecVISA e PastaVISA não divirjam
 * sobre o que se aplica a um estabelecimento. Este wrapper só mantém a
 * assinatura que o app já usava.
 */
export function isLegislationApplicable(
  leg: Pick<Legislation, 'uf' | 'municipio' | 'segments' | 'status'>,
  state?: string | null,
  category?: string | null,
  municipio?: string | null
): boolean {
  return isApplicable(
    {
      name: '',
      summary: '',
      url: '',
      authority: '',
      uf: leg.uf,
      municipio: leg.municipio,
      segments: leg.segments || undefined,
      status: leg.status || 'nao_verificado',
    },
    { uf: state, municipio, segment: category }
  );
}

const LEGISLATION_QUERY_TIMEOUT_MS = 2500;

// A biblioteca curada vive em src/data/legislationLibrary.ts (REF-02). Aqui ela
// vira apenas o fallback local usado quando o Supabase não responde.
const DEFAULT_LEGISLATIONS: Omit<Legislation, 'id' | 'created_at'>[] = LEGISLATION_LIBRARY.map(
  ({ name, summary, url, authority, abnt, uf, municipio, segments, status, replacedBy, researchNotes }) => ({
    name,
    summary,
    url,
    authority,
    abnt: abnt ?? null,
    uf: uf ?? null,
    municipio: municipio ?? null,
    segments: segments && segments.length ? segments : null,
    status,
    replaced_by: replacedBy ?? null,
    research_notes: researchNotes ?? null,
  })
);

function defaultLegislations(): Legislation[] {
  const createdAt = new Date().toISOString();
  return DEFAULT_LEGISLATIONS.map((leg, idx) => ({
    ...leg,
    id: `default-${idx}`,
    created_at: createdAt,
  }));
}

let cachedLegislations: Legislation[] | null = null;
let lastListWarningAt = 0;

export const LegislationService = {
  async listLegislations(): Promise<Legislation[]> {
    if (cachedLegislations) return cachedLegislations;

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
      cachedLegislations = data?.length ? data : defaultLegislations();
      return cachedLegislations;
    } catch (err) {
      const now = Date.now();
      if (now - lastListWarningAt > 60_000) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[LegislationService] Supabase indisponivel; usando biblioteca padrao local:', message);
        lastListWarningAt = now;
      }
      cachedLegislations = defaultLegislations();
      return cachedLegislations;
    }
  },

  /**
   * Alinha a tabela com a biblioteca curada de @visa/legislacao.
   *
   * Antes só inseria o que faltava, então as linhas antigas nunca recebiam campo
   * novo: quando a base unificada trouxe `abnt` e `municipio`, os 77 verbetes que
   * já estavam na tabela ficariam sem os dois para sempre. Agora também atualiza
   * o que existe.
   *
   * Autoria, ementa, URL e notas só são gravadas onde estão vazias — são
   * editáveis no admin e uma correção feita lá não pode ser desfeita por uma
   * ressemeadura. Vigência, alcance e segmento vêm sempre da biblioteca: são a
   * curadoria que o pacote existe para centralizar.
   */
  async seedStandardLegislations(): Promise<{ inseridas: number; atualizadas: number }> {
    const { data: existing = [], error: listError } = await withTimeout(
      supabase
        .from('legislations')
        .select('id,name,authority,summary,url,abnt,research_notes'),
      LEGISLATION_QUERY_TIMEOUT_MS,
      'SeedLegislationsList'
    );
    if (listError) throw listError;

    const porNome = new Map((existing || []).map(l => [l.name, l]));

    const inserir = DEFAULT_LEGISLATIONS.filter(l => !porNome.has(l.name));
    if (inserir.length > 0) {
      const { error } = await supabase.from('legislations').insert(inserir);
      if (error) throw error;
    }

    let atualizadas = 0;
    for (const curada of DEFAULT_LEGISLATIONS) {
      const atual = porNome.get(curada.name);
      if (!atual) continue;

      const patch = {
        authority: atual.authority || curada.authority,
        summary: atual.summary || curada.summary,
        url: atual.url || curada.url,
        abnt: atual.abnt || curada.abnt,
        research_notes: atual.research_notes || curada.research_notes,
        uf: curada.uf,
        municipio: curada.municipio,
        segments: curada.segments,
        status: curada.status,
        replaced_by: curada.replaced_by,
      };

      const { error } = await supabase.from('legislations').update(patch).eq('id', atual.id);
      if (error) throw error;
      atualizadas++;
    }

    cachedLegislations = null;
    return { inseridas: inserir.length, atualizadas };
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
