import { supabase } from '../lib/supabase';
import type { Schedule } from '../types';
import { db } from '../db/database';
import { RepositoryService } from './repositoryService';
import { withLocalActor } from '../utils/localActor';
import { belongsToActiveTenant, filterByActiveTenant } from '../utils/localScope';

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

/**
 * Avança o status da solicitação do portal público vinculada a este Schedule,
 * para a linha do tempo do cliente acompanhar a inspeção real automaticamente.
 * Nunca regride status nem mexe em report_available/cancelled.
 */
async function syncLinkedAppointmentRequest(
  scheduleId: string,
  status: 'in_progress' | 'completed'
): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const fromStatuses =
      status === 'in_progress' ? ['confirmed', 'rescheduled'] : ['confirmed', 'rescheduled', 'in_progress'];
    const { error } = await supabase
      .from('appointment_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('schedule_id', scheduleId)
      .in('status', fromStatuses);
    if (error) throw error;
  } catch (err) {
    console.warn('[ScheduleService] Falha ao sincronizar status do portal (não-fatal):', err);
  }
}

export const ScheduleService = {
  mapToPostgres,
  mapFromPostgres,

  async getSchedules(): Promise<Schedule[]> {
    const schedules = await RepositoryService.getAll<Schedule>(
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

    return filterByActiveTenant(schedules).filter(schedule => !schedule.deletedAt);
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
    const local = await db.schedules.get(id);
    if (!belongsToActiveTenant(local)) return;

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
    if (belongsToActiveTenant(local)) {
      const updated = { ...local, status: 'completed' as const, updatedAt: new Date(), syncStatus: 'pending' as const };
      await this.saveSchedule(updated);
      void syncLinkedAppointmentRequest(id, 'completed');
    }
  },

  async linkInspection(id: string, inspectionId: string): Promise<void> {
    const local = await db.schedules.get(id);
    if (belongsToActiveTenant(local)) {
      const updated = {
        ...local,
        status: 'in_progress' as const,
        inspectionId,
        updatedAt: new Date(),
        syncStatus: 'pending' as const
      };
      await this.saveSchedule(updated);
      void syncLinkedAppointmentRequest(id, 'in_progress');
    }
  },

  async completeWithInspection(id: string, inspectionId: string): Promise<void> {
    const local = await db.schedules.get(id);
    if (belongsToActiveTenant(local)) {
      const updated = {
        ...local,
        status: 'completed' as const,
        inspectionId,
        updatedAt: new Date(),
        syncStatus: 'pending' as const
      };
      await this.saveSchedule(updated);
      void syncLinkedAppointmentRequest(id, 'completed');
    }
  }
};
