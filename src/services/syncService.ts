import { db } from '../db/database';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export async function syncData() {
  const user = useAuthStore.getState().user;
  if (!user) return;

  try {
    // 1. PUSH local changes to Supabase
    // We'll sync Clientes as an example. A full sync would include all tables.
    const localClients = await db.clients.toArray();
    
    if (localClients.length > 0) {
      const { error: pushError } = await supabase
        .from('clients')
        .upsert(
          localClients.map(c => ({
            id: c.id,
            name: c.name,
            cnpj: c.cnpj,
            address: c.address,
            category: c.category,
            food_types: c.foodTypes,
            responsible_name: c.responsibleName,
            phone: c.phone,
            email: c.email,
            created_at: c.createdAt,
            user_id: user.id
          })),
          { onConflict: 'id' }
        );
      
      if (pushError) console.error('Sync Push Error (Clients):', pushError);
    }

    // 2. PULL remote changes from Supabase
    const { data: remoteClients, error: pullError } = await supabase
      .from('clients')
      .select('*');

    if (pullError) {
      console.error('Sync Pull Error (Clients):', pullError);
    } else if (remoteClients) {
      // Update local Dexie with remote data
      await db.clients.bulkPut(remoteClients.map(c => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        address: c.address,
        category: c.category as any,
        foodTypes: c.food_types,
        responsibleName: c.responsible_name,
        phone: c.phone,
        email: c.email,
        createdAt: new Date(c.created_at)
      })));
    }

    // --- REPEAT for Inspections and Responses ---
    const localInspections = await db.inspections.toArray();
    if (localInspections.length > 0) {
      await supabase.from('inspections').upsert(
        localInspections.map(i => ({
          id: i.id,
          client_id: i.clientId,
          template_id: i.templateId,
          consultant_name: i.consultantName,
          inspection_date: i.inspectionDate,
          status: i.status,
          observations: i.observations,
          created_at: i.createdAt,
          completed_at: i.completedAt,
          user_id: user.id
        }))
      );
    }

    const { data: remoteInspections } = await supabase.from('inspections').select('*');
    if (remoteInspections) {
      await db.inspections.bulkPut(remoteInspections.map(i => ({
        id: i.id,
        clientId: i.client_id,
        templateId: i.template_id,
        consultantName: i.consultant_name,
        inspectionDate: new Date(i.inspection_date),
        status: i.status as any,
        observations: i.observations,
        createdAt: new Date(i.created_at),
        completedAt: i.completed_at ? new Date(i.completed_at) : undefined
      })));
    }

    // Sync Responses
    const localResponses = await db.responses.toArray();
    if (localResponses.length > 0) {
      await supabase.from('responses').upsert(
        localResponses.map(r => ({
          id: r.id,
          inspection_id: r.inspectionId,
          item_id: r.itemId,
          result: r.result,
          situation_description: r.situationDescription,
          corrective_action: r.correctiveAction,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
          user_id: user.id
        }))
      );
    }

    const { data: remoteResponses } = await supabase.from('responses').select('*');
    if (remoteResponses) {
      await db.responses.bulkPut(remoteResponses.map(r => ({
        id: r.id,
        inspectionId: r.inspection_id,
        itemId: r.item_id,
        result: r.result as any,
        situationDescription: r.situation_description,
        correctiveAction: r.corrective_action,
        createdAt: new Date(r.created_at),
        updatedAt: new Date(r.updated_at),
        photos: [] // Photos synced separately
      })));
    }

    // Sync schedules
    const localSchedules = await db.schedules.toArray();
    if (localSchedules.length > 0) {
      await supabase.from('schedules').upsert(
        localSchedules.map(s => ({
          id: s.id,
          client_id: s.clientId,
          scheduled_at: s.scheduledAt,
          status: s.status,
          notes: s.notes,
          user_id: user.id
        }))
      );
    }

    const { data: remoteSchedules } = await supabase.from('schedules').select('*');
    if (remoteSchedules) {
      await db.schedules.bulkPut(remoteSchedules.map(s => ({
        id: s.id,
        clientId: s.client_id,
        scheduledAt: new Date(s.scheduled_at),
        status: s.status as any,
        notes: s.notes,
        user_id: s.user_id
      })));
    }

    console.log('Sync completed at:', new Date().toLocaleTimeString());
  } catch (err) {
    console.error('Sync unexpected error:', err);
  }
}
