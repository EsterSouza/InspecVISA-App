import { supabase } from '../lib/supabase';
import type { Client } from '../types';
import { db } from '../db/database';
import { RepositoryService } from './repositoryService';
import { withLocalActor } from '../utils/localActor';
import { belongsToActiveTenant, filterByActiveTenant } from '../utils/localScope';

/**
 * Maps a Postgres row to the local Client type.
 */
export function mapFromPostgres(row: any): Client {
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
    updatedAt: new Date(row.updated_at || row.created_at),
    tenantId: row.tenant_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    syncStatus: 'synced',
    dataVerifiedAt: new Date()
  };
}

/**
 * Maps a local Client to a Postgres row.
 */
export function mapToPostgres(client: Client): any {
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
    updated_at: client.updatedAt.toISOString(),
    created_at: client.createdAt.toISOString(),
    tenant_id: client.tenantId
  };
}

export const ClientService = {
  mapToPostgres,
  mapFromPostgres,

  /**
   * Fetch all active clients.
   * Hybrid approach: Returns Dexie data immediately + triggers background refresh.
   */
  async getClients(): Promise<Client[]> {
    // Always filter out soft-deleted clients from Dexie immediately
    const local = await db.clients
      .filter(c => !c.deletedAt)
      .toArray();

    // Background refresh from Supabase if online
    if (navigator.onLine) {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('clients')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (error || !data) return;
          for (const row of data) {
            await RepositoryService.mergeRemoteRecord(db.clients, mapFromPostgres(row), { label: 'clientes' });
          }
        } catch (err) {
          console.warn('[ClientService] Background refresh failed:', err);
        }
      })();
    }

    return filterByActiveTenant(local);
  },

  /**
   * Fetch a single client by ID.
   * Hybrid approach: Dexie first, then server if stale.
   */
  async getClientById(id: string): Promise<Client | null> {
    // 1. Return local immediately (never block the caller)
    const local = await db.clients.get(id);

    // 2. Background refresh if stale
    const isStale = !local?.dataVerifiedAt || (Date.now() - local.dataVerifiedAt.getTime() > 5 * 60 * 1000);
    if (isStale && navigator.onLine) {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('clients').select('*').eq('id', id).is('deleted_at', null).single();
          if (!error && data) {
            await RepositoryService.mergeRemoteRecord(db.clients, mapFromPostgres(data), { label: 'cliente' });
          }
        } catch { /* silent — local data still usable */ }
      })();
    }

    if (!local || local.deletedAt || !belongsToActiveTenant(local)) return null;
    return local;
  },

  /**
   * Save or Update a client.
   * Hybrid approach: Save locally immediately -> enfileira push.
   */
  async saveClient(client: Client): Promise<Client> {
    return RepositoryService.upsert<Client>(
      'clients',
      withLocalActor(client),
      db.clients,
      mapToPostgres
    );
  },

  /**
   * Soft delete a client.
   */
  async deleteClient(id: string): Promise<void> {
    const local = await db.clients.get(id);
    if (!belongsToActiveTenant(local)) return;

    const now = new Date();
    await db.clients.update(id, { 
      deletedAt: now, 
      syncStatus: 'pending', 
      updatedAt: now 
    });
    
    if (navigator.onLine) {
      const item = await db.clients.get(id);
      if (item) {
        RepositoryService.pushToRemote('clients', item, db.clients, mapToPostgres);
      }
    }
  },

  async restoreSoftDeletedClientsFromRemote(): Promise<void> {
    const { data: remoteClients, error } = await supabase
      .from('clients')
      .select('id')
      .is('deleted_at', null);

    if (error || !remoteClients?.length) return;

    const remoteIds = new Set(remoteClients.map((c: any) => c.id));
    const localClients = filterByActiveTenant(await db.clients.toArray());
    for (const client of localClients) {
      if (client.deletedAt && remoteIds.has(client.id) && client.syncStatus === 'synced') {
        console.log('[ClientService] Restoring incorrectly soft-deleted client:', client.name);
        await db.clients.update(client.id, { deletedAt: null, syncStatus: 'synced' as const, dataVerifiedAt: new Date() });
      }
    }
  }
};
