// Leitura paginada e o formato das linhas que os scripts de manutenção leem.
//
// Os três `readAll` idênticos que existiam em ref02/ref04/ref05 viraram este `lerTudo`.
// O cliente do Supabase aqui não tem tipos gerados (o projeto não usa `supabase gen types`),
// então o formato do que volta é o que o `select` pediu — e é por isso que quem chama diz
// qual recorte espera, normalmente com um `Pick<…>` da linha completa.
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lê a tabela inteira, em páginas. Sem isso o PostgREST devolve só as primeiras mil linhas
 * e o script trabalha com um recorte silencioso.
 */
export async function lerTudo<T>(
  sb: SupabaseClient,
  tabela: string,
  select: string,
  ordem = 'id',
  pagina = 1000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pagina) {
    const { data, error } = await sb.from(tabela).select(select).order(ordem).range(from, from + pagina - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    const linhas = (data ?? []) as T[];
    out.push(...linhas);
    if (linhas.length < pagina) break;
  }
  return out;
}

/** `checklist_items`, em colunas de banco (snake_case). */
export type LinhaItem = {
  id: string;
  section_id: string;
  description: string | null;
  legislation_name: string | null;
  legislation_url: string | null;
  requirement_type: string | null;
  weight: number | null;
  is_critical: boolean | null;
  order: number | null;
  created_at: string;
};

/** `checklist_sections`. */
export type LinhaSecao = {
  id: string;
  template_id: string;
  title: string | null;
  order: number | null;
};

/** `checklist_templates`. */
export type LinhaRoteiro = {
  id: string;
  name: string | null;
  category: string | null;
  version: string | null;
};

/** `inspections`. */
export type LinhaInspecao = {
  id: string;
  client_id: string;
  template_id: string | null;
  status: string | null;
  consultant_name: string | null;
  inspection_date: string | null;
  created_at: string;
  deleted_at: string | null;
  tenant_id: string | null;
};

/** `clients`. */
export type LinhaCliente = {
  id: string;
  name: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  food_types: string[] | null;
};

/** `responses`. */
export type LinhaResposta = {
  id: string;
  inspection_id: string;
  item_id: string;
  result: string | null;
  situation_description: string | null;
  custom_description: string | null;
  created_at: string;
  deleted_at: string | null;
};
