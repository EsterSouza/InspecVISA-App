import { db } from '../db/database';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { dataUrlToBlob } from '../utils/imageUtils';

const withTimeout = <T>(promise: Promise<T>, ms: number = 15000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('SYNC_TIMEOUT')), ms))
  ]);
};

export async function syncData() {
  const user = useAuthStore.getState().user;
  if (!user) return;

  try {
    // 1. PUSH local changes to Supabase
    // We'll sync Clientes as an example. A full sync would include all tables.
    const localClients = await db.clients.toArray();
    
    if (localClients.length > 0) {
      const { error: pushError } = await withTimeout<any>(
        Promise.resolve(supabase.from('clients').upsert(
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
        )) // close Promise.resolve
      );
      
      if (pushError) console.error('Sync Push Error (Clients):', pushError);
    }

    // 2. PULL remote changes from Supabase
    const { data: remoteClients, error: pullError } = await withTimeout<any>(
      Promise.resolve(supabase.from('clients').select('*'))
    );

    if (pullError) {
      console.error('Sync Pull Error (Clients):', pullError);
    } else if (remoteClients) {
      // Update local Dexie with remote data
      await db.clients.bulkPut(remoteClients.map((c: any) => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        address: c.address,
        category: c.category as any,
        foodTypes: c.food_types,
        responsibleName: c.responsible_name,
        phone: c.phone,
        email: c.email,
        createdAt: new Date(c.created_at),
        city: c.city,
        state: c.state
      })));
    }

    // --- REPEAT for Inspections and Responses ---
    const localInspections = await db.inspections.toArray();
    if (localInspections.length > 0) {
      await withTimeout<any>(
        Promise.resolve(supabase.from('inspections').upsert(
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
      )));
    }

    const { data: remoteInspections } = await withTimeout<any>(Promise.resolve(supabase.from('inspections').select('*')));
    if (remoteInspections) {
      await db.inspections.bulkPut(remoteInspections.map((i: any) => ({
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
      await withTimeout<any>(
        Promise.resolve(supabase.from('responses').upsert(
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
      )));
    }

    const { data: remoteResponses } = await withTimeout<any>(Promise.resolve(supabase.from('responses').select('*')), 25000); // 25s for large response sets
    if (remoteResponses) {
      await db.responses.bulkPut(remoteResponses.map((r: any) => ({
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
      await withTimeout<any>(
        Promise.resolve(supabase.from('schedules').upsert(
        localSchedules.map(s => ({
          id: s.id,
          client_id: s.clientId,
          scheduled_at: s.scheduledAt,
          status: s.status,
          notes: s.notes,
          user_id: user.id
        }))
      )));
    }

    const { data: remoteSchedules } = await withTimeout<any>(Promise.resolve(supabase.from('schedules').select('*')));
    if (remoteSchedules) {
      await db.schedules.bulkPut(remoteSchedules.map((s: any) => ({
        id: s.id,
        clientId: s.client_id,
        scheduledAt: new Date(s.scheduled_at),
        status: s.status as any,
        notes: s.notes,
        user_id: s.user_id
      })));
    }

    // Sync Photos
    const localPhotos = await db.photos.toArray();
    for (const photo of localPhotos) {
      // Only upload if it's base64 (dataUrl)
      if (photo.dataUrl.startsWith('data:')) {
        try {
          const blob = dataUrlToBlob(photo.dataUrl);
          // NEW: Use shared folder instead of user-specific folder for multi-user sync
          const fileName = `shared/${photo.id}.jpg`;
          
          const { error: uploadError } = await withTimeout<any>(
            Promise.resolve(supabase.storage.from('photos').upload(fileName, blob, { 
              contentType: 'image/jpeg',
              upsert: true 
            })),
            30000 // 30s timeout for uploads
          );

          if (!uploadError) {
             const { data: { publicUrl } } = supabase.storage
               .from('photos')
               .getPublicUrl(fileName);
             
             // Update local record to use remote URL and free space
             await db.photos.update(photo.id, { dataUrl: publicUrl });
          } else {
            console.error('Photo Upload Error:', uploadError);
          }
        } catch (err) {
          console.error('Photo Process Error:', err);
        }
      }
    }

    // Sync Photo records to DB metadata table (if it exists, for now we just handle Storage)
    // In a full implementation, we'd also push/pull photo metadata to a 'photos' table in Postgres.

    console.log('Sync completed at:', new Date().toLocaleString());
  } catch (err) {
    console.error('Sync unexpected error:', err);
  }
}
