import { supabase } from '../lib/supabase';
import type { Client } from '../types';

/**
 * Maps a Postgres row to the local Client type.
 */
function mapFromPostgres(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    category: row.category,
    foodTypes: row.food_types || undefined,
    responsibleName: row.responsible_name || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    tenantId: row.tenant_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    synced: 1
  };
}

/**
 * Maps a local Client to a Postgres row.
 */
function mapToPostgres(client: Client): any {
  return {
    id: client.id,
    name: client.name,
    cnpj: client.cnpj || null,
    address: client.address || null,
    city: client.city || null,
    state: client.state || null,
    category: client.category,
    food_types: client.foodTypes || null,
    responsible_name: client.responsibleName || null,
    phone: client.phone || null,
    email: client.email || null,
    deleted_at: client.deletedAt ? client.deletedAt.toISOString() : null,
    // created_at and updated_at are handled by the database defaults or explicitly
  };
}

export const ClientService = {
  /**
   * Fetch all active clients for the current tenant.
   * RLS automatically filters by tenant.
   */
  async getClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      throw new Error('Falha ao carregar clientes do servidor.');
    }

    return (data || []).map(mapFromPostgres);
  },

  /**
   * Fetch a single client by ID
   */
  async getClientById(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching client by ID:', error);
      throw new Error('Falha ao carregar dados do cliente.');
    }

    return data ? mapFromPostgres(data) : null;
  },

  /**
   * Save or Update a client directly in Supabase.
   */
  async saveClient(client: Client): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Usuário não autenticado.');

    const pgData = mapToPostgres(client);
    
    // Explicitly set updated_at
    pgData.updated_at = new Date().toISOString();
    
    // Se for novo, garantir que tem o user_id. (O tenant_id é injetado pelo trigger ou RLS se configurado,
    // mas por segurança podemos passar. Mas a migration recente de RLS já garante isso ou o app envia.
    // O backend já faz isso via `user_id` em muitos casos.
    pgData.user_id = userData.user.id;

    const { error } = await supabase
      .from('clients')
      .upsert(pgData);

    if (error) {
      console.error('Error saving client:', error);
      throw new Error(`Falha ao salvar cliente: ${error.message}`);
    }
  },

  /**
   * Soft delete a client directly in Supabase.
   */
  async deleteClient(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting client:', error);
      throw new Error('Falha ao excluir cliente no servidor.');
    }
  }
};
