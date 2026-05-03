import { supabase } from '../lib/supabase';
import type { Schedule } from '../types';
import { db } from '../db/database';
import { RepositoryService } from './repositoryService';
import { withLocalActor } from '../utils/localActor';

export function mapFromPostgres(row: any): Schedule {
  return {
    id: row.id,
    clientId: row.client_id,
    scheduledAt: new Date(row.scheduled_at),
    status: row.status,
    notes: row.notes || undefined,
    user_id: row.user_id,
    inspectionId: row.inspection_id,
    updatedAt: new Date(row.updated_at || row.scheduled_at),
    tenantId: row.tenant_id,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    syncStatus: 'synced',
    dataVerifiedAt: new Date()
  };
}

export function mapToPostgres(schedule: Schedule): any {
  return {
    id: schedule.id,
    client_id: schedule.clientId,
    scheduled_at: schedule.scheduledAt.toISOString(),
    status: schedule.status,
    notes: schedule.notes || null,
    user_id: schedule.user_id,
    inspection_id: schedule.inspectionId || null,
    updated_at: schedule.updatedAt.toISOString(),
    tenant_id: schedule.tenantId,
    deleted_at: schedule.deletedAt ? schedule.deletedAt.toISOString() : null
  };
}

export const ScheduleService = {
  mapToPostgres,
  mapFromPostgres,

  async getSchedules(): Promise<Schedule[]> {
    return RepositoryService.getAll<Schedule>(
      db.schedules,
      async () => {
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .is('deleted_at', null)
          .order('scheduled_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapFromPostgres);
      },
      2 * 60 * 1000 // 2m TTL
    );
  },

  subscribeToChanges(onChange: () => void): () => void {
    const channel = supabase
      .channel('schedules_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        void this.getSchedules().finally(onChange);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async saveSchedule(schedule: Schedule): Promise<Schedule> {
    return RepositoryService.upsert<Schedule>(
      'schedules',
      withLocalActor(schedule),
      db.schedules,
      mapToPostgres
    );
  },

  async deleteSchedule(id: string): Promise<void> {
    const now = new Date();
    await db.schedules.update(id, { 
      deletedAt: now, 
      syncStatus: 'pending', 
      updatedAt: now 
    });
    
    if (navigator.onLine) {
      const item = await db.schedules.get(id);
      if (item) {
        RepositoryService.pushToRemote('schedules', item, db.schedules, mapToPostgres);
      }
    }
  },

  async completeSchedule(id: string): Promise<void> {
    const local = await db.schedules.get(id);
    if (local) {
      const updated = { ...local, status: 'completed' as const, updatedAt: new Date(), syncStatus: 'pending' as const };
      await this.saveSchedule(updated);
    }
  },

  async linkInspection(id: string, inspectionId: string): Promise<void> {
    const local = await db.schedules.get(id);
    if (local) {
      const updated = { 
        ...local, 
        status: 'in_progress' as const, 
        inspectionId, 
        updatedAt: new Date(), 
        syncStatus: 'pending' as const 
      };
      await this.saveSchedule(updated);
    }
  },

  async completeWithInspection(id: string, inspectionId: string): Promise<void> {
    const local = await db.schedules.get(id);
    if (local) {
      const updated = { 
        ...local, 
        status: 'completed' as const, 
        inspectionId, 
        updatedAt: new Date(), 
        syncStatus: 'pending' as const 
      };
      await this.saveSchedule(updated);
    }
  }
};
