import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/network';
import { LEGISLATION_LIBRARY, type LegislationSegment } from '../data/legislationLibrary';

export type { LegislationSegment };

export interface Legislation {
  id: string;
  name: string;
  summary?: string;
  url?: string;
  /** UF de abrangência (ex.: 'RJ', 'MG', 'SP'). Vazio/null = federal/nacional. */
  uf?: string | null;
  /** Segmentos aplicáveis. Vazio/null = aplica a todos os segmentos. */
  segments?: LegislationSegment[] | null;
  created_at: string;
}

/**
 * Decide se uma legislação da biblioteca deve ser sugerida automaticamente
 * para uma inspeção, com base na UF e na categoria do estabelecimento.
 * - Estaduais/municipais (uf preenchida) só entram quando a UF bate.
 * - Federais (uf vazia) só entram quando o segmento foi curado para a categoria.
 */
export function isLegislationApplicable(
  leg: Pick<Legislation, 'uf' | 'segments'>,
  state?: string | null,
  category?: string | null
): boolean {
  const ufNorm = (leg.uf || '').trim().toUpperCase();
  const stateNorm = (state || '').trim().toUpperCase();
  const stateAliases = stateNorm === 'RIO DE JANEIRO' ? 'RJ'
    : stateNorm === 'MINAS GERAIS' ? 'MG'
    : stateNorm === 'SAO PAULO' || stateNorm === 'SÃO PAULO' ? 'SP'
    : stateNorm;
  const segments = leg.segments || [];
  const segmentMatches = segments.length === 0
    ? false // federais sem segmento curado não inflam a lista; entram via citação no item
    : !!category && segments.includes(category as LegislationSegment);

  if (ufNorm) {
    // Estadual/municipal: precisa casar a UF; se tiver segmento curado, respeita-o.
    if (ufNorm !== stateAliases) return false;
    return segments.length === 0 ? true : (!!category && segments.includes(category as LegislationSegment));
  }
  // Federal: sugere apenas as curadas para o segmento da inspeção.
  return segmentMatches;
}

const LEGISLATION_QUERY_TIMEOUT_MS = 2500;

// A biblioteca curada vive em src/data/legislationLibrary.ts (REF-02). Aqui ela
// vira apenas o fallback local usado quando o Supabase não responde.
const DEFAULT_LEGISLATIONS: Omit<Legislation, 'id' | 'created_at'>[] = LEGISLATION_LIBRARY.map(
  ({ name, summary, url, uf, segments }) => ({
    name,
    summary,
    url,
    uf: uf ?? null,
    segments: segments && segments.length ? segments : null,
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
