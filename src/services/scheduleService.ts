import { supabase } from '../lib/supabase';
import type { Schedule } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export const ScheduleService = {
  async getSchedules(): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: false });

    if (error) {
      console.error('Error fetching schedules:', error);
      throw new Error('Falha ao carregar agendamentos do servidor.');
    }

    return (data || []).map(row => ({
      id: row.id,
      clientId: row.client_id,
      scheduledAt: new Date(row.scheduled_at),
      status: row.status,
      notes: row.notes || undefined,
      user_id: row.user_id,
      createdAt: new Date(row.created_at || row.scheduled_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      tenantId: row.tenant_id,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      synced: 1
    }));
  },

  async saveSchedule(schedule: Schedule): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Usuário não autenticado.');

    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;

    const pgData: any = {
      id: schedule.id,
      client_id: schedule.clientId,
      scheduled_at: schedule.scheduledAt.toISOString(),
      status: schedule.status,
      notes: schedule.notes || null,
      user_id: userData.user.id,
      updated_at: new Date().toISOString()
    };
    
    if (tenantId) {
      pgData.tenant_id = tenantId;
    }

    const { error } = await supabase
      .from('schedules')
      .upsert(pgData);

    if (error) {
      console.error('Error saving schedule:', error);
      throw new Error(`Falha ao salvar agendamento: ${error.message}`);
    }
  },

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting schedule:', error);
      throw new Error('Falha ao excluir agendamento no servidor.');
    }
  },

  async completeSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error completing schedule:', error);
      throw new Error('Falha ao concluir agendamento no servidor.');
    }
  }
};
