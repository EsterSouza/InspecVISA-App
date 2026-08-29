import { supabase } from '../lib/supabase';

/**
 * AGD-02 — "outros pontos" da agenda: marco avulso por unidade (`client_milestones`), sem
 * recorrência e sem categoria. A leitura vai direto na tabela — a RLS já filtra pelo tenant
 * (`private.my_tenant_ids()`/`is_tenant_staff`), sem RPC de listagem própria. A escrita passa
 * pelas quatro RPCs que resolvem o tenant a partir do cliente (ou do próprio marco), nunca de
 * um valor vindo do navegador.
 */
export interface ClientMilestone {
  id: string;
  clientId: string;
  title: string;
  note: string | null;
  /** "YYYY-MM-DD" */
  milestoneDate: string;
  doneAt: string | null;
  createdBy: string | null;
}

interface ClientMilestoneRow {
  id: string;
  client_id: string;
  title: string;
  note: string | null;
  milestone_date: string;
  done_at: string | null;
  created_by: string | null;
}

function fromRow(row: ClientMilestoneRow): ClientMilestone {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    note: row.note,
    milestoneDate: row.milestone_date,
    doneAt: row.done_at,
    createdBy: row.created_by,
  };
}

export const ClientMilestoneService = {
  /** `startDate`/`endDate` em "YYYY-MM-DD", inclusive dos dois lados. */
  async listForRange(startDate: string, endDate: string): Promise<ClientMilestone[]> {
    const { data, error } = await supabase
      .from('client_milestones')
      .select('id, client_id, title, note, milestone_date, done_at, created_by')
      .gte('milestone_date', startDate)
      .lte('milestone_date', endDate)
      .order('milestone_date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(params: {
    clientId: string;
    title: string;
    milestoneDate: string;
    note?: string | null;
    createdBy?: string | null;
  }): Promise<string> {
    const { data, error } = await supabase.rpc('admin_create_client_milestone', {
      p_client_id: params.clientId,
      p_title: params.title,
      p_milestone_date: params.milestoneDate,
      p_note: params.note || null,
      p_created_by: params.createdBy || null,
    });
    if (error) throw error;
    return (data as { id: string }).id;
  },

  async update(id: string, params: { title: string; milestoneDate: string; note?: string | null }): Promise<void> {
    const { error } = await supabase.rpc('admin_update_client_milestone', {
      p_id: id,
      p_title: params.title,
      p_milestone_date: params.milestoneDate,
      p_note: params.note || null,
    });
    if (error) throw error;
  },

  async setDone(id: string, done: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_client_milestone_done', { p_id: id, p_done: done });
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_client_milestone', { p_id: id });
    if (error) throw error;
  },
};
