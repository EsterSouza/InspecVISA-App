import { supabase } from '../lib/supabase';

/**
 * P360-013 — painel operacional das consultoras.
 *
 * Só leitura, via as duas RPCs de `20260808113928_admin_operational_overview.sql`. A contagem
 * (`admin_operational_counts`) é uma chamada só, para os seis blocos de uma vez — é o que
 * alimenta os números do topo a cada troca de filtro. A lista (`admin_operational_items`) é
 * por bloco, paginada, carregada só quando a consultora expande aquele bloco — por isso as
 * duas ficam em métodos separados, nunca numa chamada combinada.
 */

export type OperationalBlock =
  | 'appointments'
  | 'appointment_requests_pending'
  | 'requests_new'
  | 'awaiting_client'
  | 'evidence_pending'
  | 'action_items_overdue'
  | 'financial_pending';

export interface OperationalBlockCount {
  count?: number;
  error?: boolean;
}

export type OperationalCounts = Record<OperationalBlock, OperationalBlockCount>;

export interface OperationalFilters {
  consultantName?: string | null;
  clientId?: string | null;
  daysAhead?: number;
}

export interface OperationalItemFilters extends OperationalFilters {
  type?: string | null;
  dueBefore?: string | null;
  limit?: number;
  offset?: number;
}

export interface OperationalItem {
  id: string;
  client_id: string;
  client_name?: string;
  title?: string;
  type?: string | null;
  due_at?: string | null;
  priority?: string | null;
  responsible?: string | null;
  assigned_to?: string | null;
  consultant_names?: string[] | null;
  request_number?: number;
  account_name?: string;
  payment_status?: string;
  client_names?: string[];
  [key: string]: unknown;
}

export interface OperationalItemsResult {
  items: OperationalItem[];
  total_count: number;
}

export const OperationalOverviewService = {
  async counts(filters: OperationalFilters = {}): Promise<OperationalCounts> {
    const { data, error } = await supabase.rpc('admin_operational_counts', {
      p_consultant_name: filters.consultantName || null,
      p_client_id: filters.clientId || null,
      p_days_ahead: filters.daysAhead ?? 14,
    });
    if (error) throw error;
    return data as OperationalCounts;
  },

  async items(block: OperationalBlock, filters: OperationalItemFilters = {}): Promise<OperationalItemsResult> {
    const { data, error } = await supabase.rpc('admin_operational_items', {
      p_block: block,
      p_consultant_name: filters.consultantName || null,
      p_client_id: filters.clientId || null,
      p_type: filters.type || null,
      p_due_before: filters.dueBefore || null,
      p_days_ahead: filters.daysAhead ?? 14,
      p_limit: filters.limit ?? 20,
      p_offset: filters.offset ?? 0,
    });
    if (error) throw error;
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error(String((data as { error: unknown }).error));
    }
    return data as OperationalItemsResult;
  },
};
