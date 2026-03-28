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

async function logSync(level: 'info' | 'warn' | 'error', message: string, details?: any) {
  console[level](`[Sync] ${message}`, details || '');
  try {
    await db.sync_logs.add({
      timestamp: new Date(),
      level,
      message,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined
    });
  } catch (e) {
    console.error('Failed to write sync log', e);
  }
}

export async function syncData(isManual: boolean = false) {
  const user = useAuthStore.getState().user;
  if (!user) return;

  if ((window as any).isSyncingGlobally) {
    if (isManual) alert('Uma sincronização já está em andamento.');
    return;
  }
  (window as any).isSyncingGlobally = true;

  try {
    await logSync('info', 'Iniciando Sincronização Segura...', { manual: isManual });

    // 1. Sync CLIENTS
    const pendingClients = await db.clients.where('synced').equals(0).toArray();
    if (pendingClients.length > 0) {
      await logSync('info', `Enviando ${pendingClients.length} clientes pendentes`);
      // Re-fetch to merge if needed
      const { data: remoteCnpjData, error: cnpjErr } = await withTimeout<any>(Promise.resolve(supabase.from('clients').select('id, cnpj')));
      if (cnpjErr) await logSync('warn', 'Erro ao buscar CNPJs para merge', cnpjErr);
      
      const remoteCnpjMap = new Map<string, string>(
        remoteCnpjData?.filter((c: any) => c.cnpj).map((c: any) => [c.cnpj, c.id]) || []
      );

      for (const localClient of pendingClients) {
        if (localClient.cnpj && remoteCnpjMap.has(localClient.cnpj)) {
          const canonicalRemoteId = remoteCnpjMap.get(localClient.cnpj)!;
          if (localClient.id !== canonicalRemoteId) {
            const oldId = localClient.id;
            await logSync('info', `Mesclando cliente duplicado: ${oldId} -> ${canonicalRemoteId}`);
            await db.inspections.where({ clientId: oldId }).modify({ clientId: canonicalRemoteId });
            await db.schedules.where({ clientId: oldId }).modify({ clientId: canonicalRemoteId });
            await db.clients.delete(oldId);
            localClient.id = canonicalRemoteId;
            await db.clients.put(localClient);
          }
        }
      }

      const clientsToPush = await db.clients.where('synced').equals(0).toArray();
      const { error: pushError } = await withTimeout<any>(Promise.resolve(supabase.from('clients').upsert(
        clientsToPush.map(c => ({
          id: c.id, name: c.name, cnpj: c.cnpj, address: c.address, category: c.category,
          food_types: c.foodTypes, responsible_name: c.responsibleName, phone: c.phone,
          email: c.email, created_at: c.createdAt, user_id: user.id
        }))
      )));
      
      if (!pushError) {
        await db.clients.where('id').anyOf(clientsToPush.map(c => c.id)).modify({ synced: true });
        await logSync('info', 'Clientes enviados com sucesso');
      } else {
        await logSync('error', 'Falha ao enviar Clientes', pushError);
      }
    }

    // PULL Clients
    const { data: remoteClients, error: cErr } = await withTimeout<any>(Promise.resolve(supabase.from('clients').select('*')));
    if (cErr) await logSync('error', 'Falha ao baixar Clientes', cErr);
    if (remoteClients) {
      for (const rc of remoteClients) {
        const local = await db.clients.get(rc.id);
        if (!local || local.synced !== false) {
          await db.clients.put({
            id: rc.id, name: rc.name, cnpj: rc.cnpj, address: rc.address,
            category: rc.category as any, foodTypes: rc.food_types,
            responsibleName: rc.responsible_name, phone: rc.phone, email: rc.email,
            createdAt: new Date(rc.created_at), city: rc.city, state: rc.state,
            synced: true
          });
        }
      }
    }

    // 2. Sync INSPECTIONS
    const pendingInspec = await db.inspections.where('synced').equals(0).toArray();
    if (pendingInspec.length > 0) {
      await logSync('info', `Enviando ${pendingInspec.length} inspeções`);
      const { error: insPushError } = await withTimeout<any>(Promise.resolve(supabase.from('inspections').upsert(
        pendingInspec.map(i => ({
          id: i.id, client_id: i.clientId, template_id: i.templateId,
          consultant_name: i.consultantName, inspection_date: i.inspectionDate,
          status: i.status, observations: i.observations, created_at: i.createdAt,
          completed_at: i.completedAt, user_id: user.id
        }))
      )));
      if (!insPushError) {
        await db.inspections.where('id').anyOf(pendingInspec.map(i => i.id)).modify({ synced: true });
      } else {
        await logSync('error', 'Falha ao enviar Inspeções', insPushError);
      }
    }

    const { data: remoteInspec, error: riErr } = await withTimeout<any>(Promise.resolve(supabase.from('inspections').select('*')));
    if (riErr) await logSync('error', 'Falha ao baixar Inspeções', riErr);
    if (remoteInspec) {
      for (const ri of remoteInspec) {
        const local = await db.inspections.get(ri.id);
        if (!local || local.synced !== false) {
          await db.inspections.put({
            id: ri.id, clientId: ri.client_id, templateId: ri.template_id,
            consultantName: ri.consultant_name, inspectionDate: new Date(ri.inspection_date),
            status: ri.status as any, observations: ri.observations,
            createdAt: new Date(ri.created_at), synced: true,
            completedAt: ri.completed_at ? new Date(ri.completed_at) : undefined
          });
        }
      }
    }

    // 3. Sync RESPONSES
    const pendingResponses = await db.responses.where('synced').equals(0).toArray();
    if (pendingResponses.length > 0) {
      await logSync('info', `Enviando ${pendingResponses.length} respostas`);
      const { error: resPushError } = await withTimeout<any>(Promise.resolve(supabase.from('responses').upsert(
        pendingResponses.map(r => ({
          id: r.id, inspection_id: r.inspectionId, item_id: r.itemId,
          result: r.result, situation_description: r.situationDescription,
          corrective_action: r.correctiveAction, created_at: r.createdAt,
          updated_at: r.updatedAt, user_id: user.id
        }))
      )));
      if (!resPushError) {
        await db.responses.where('id').anyOf(pendingResponses.map(r => r.id)).modify({ synced: true });
      } else {
        await logSync('error', 'Falha ao enviar Respostas', resPushError);
      }
    }

    const { data: remoteRes, error: rrErr } = await withTimeout<any>(Promise.resolve(supabase.from('responses').select('*')), 25000);
    if (rrErr) await logSync('error', 'Falha ao baixar Respostas', rrErr);
    if (remoteRes) {
      for (const rr of remoteRes) {
        const local = await db.responses.get(rr.id);
        if (!local || local.synced !== false) {
          await db.responses.put({
            id: rr.id, inspectionId: rr.inspection_id, itemId: rr.item_id,
            result: rr.result as any, situationDescription: rr.situation_description,
            correctiveAction: rr.corrective_action, createdAt: new Date(rr.created_at),
            updatedAt: new Date(rr.updated_at), photos: [], synced: true
          });
        }
      }
    }

    // Photo Upload (simplified for now, already robust with Storage)
    const localPhotos = await db.photos.toArray();
    for (const photo of localPhotos) {
      if (photo.dataUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(photo.dataUrl);
        const fileName = `shared/${photo.id}.jpg`;
        const { error: uploadError } = await withTimeout<any>(
          Promise.resolve(supabase.storage.from('photos').upload(fileName, blob, { 
            contentType: 'image/jpeg', upsert: true 
          })), 30000
        );
        if (!uploadError) {
           const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
           await db.photos.update(photo.id, { dataUrl: publicUrl });
        } else {
          await logSync('warn', `Falha no upload da foto ${photo.id}`, uploadError);
        }
      }
    }

    await logSync('info', 'Sincronização concluída com sucesso');
    if (isManual) alert('Sincronização concluída!');
  } catch (err) {
    await logSync('error', 'Erro inesperado na sincronização', err);
    if (isManual) alert('Erro na sincronização. Veja o log de debug.');
  } finally {
    (window as any).isSyncingGlobally = false;
  }
}
