import { db } from '../db/database';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

const withTimeout = <T>(promise: Promise<T>, ms: number = 45000): Promise<T> => {
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

async function safeBatchUpsert(tableName: string, records: any[]): Promise<{ successIds: string[], errors: any[] }> {
  if (records.length === 0) return { successIds: [], errors: [] };
  
  const CHUNK_SIZE = 50;
  const successIds: string[] = [];
  const errors: any[] = [];

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    
    const { error: bulkError } = await withTimeout<any>(
      Promise.resolve(supabase.from(tableName).upsert(chunk))
    );

    if (!bulkError) {
      successIds.push(...chunk.map(r => r.id));
      continue;
    }

    await logSync('warn', `Chunk upsert falhou na tabela ${tableName}, processando 1 por 1.`, bulkError);
    
    for (const record of chunk) {
      const { error } = await withTimeout<any>(
        Promise.resolve(supabase.from(tableName).upsert([record]))
      );
      if (!error) {
        successIds.push(record.id);
      } else {
        errors.push({ id: record.id, error });
        if (error.code === '23503') {
          await logSync('error', `FK Violation on ${tableName} ID ${record.id}: Parent record missing on server.`);
        }
      }
    }
  }

  return { successIds, errors };
}

/**
 * Merge inteligente: Servidor ganha SE for mais novo
 * Local ganha SE for mais novo
 * Evita perda de dados em concorrência
 */
function shouldUpdateLocal(serverDate: Date, localDate: Date | undefined): boolean {
  if (!localDate) return true; // Não existe local, baixa do servidor
  return serverDate > localDate; // Servidor é mais atualizado
}

async function pullAllPages(
  tableName: string,
  orderBy: string = 'updated_at'
): Promise<any[]> {
  const all: any[] = [];
  const PAGE_SIZE = 500;
  let page = 0;

  while (true) {
    const { data, error } = await withTimeout<any>(
      Promise.resolve(
        supabase
          .from(tableName)
          .select('*')
          // ✅ SEM FILTRO DE TENANT - CONTA UNificada
          .order(orderBy, { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      )
    );

    if (error) {
      await logSync('error', `Falha ao baixar página ${page} de ${tableName}`, error);
      break;
    }

    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

async function cleanupOrphans() {
  await logSync('info', 'Limpando registros órfãos locais...');
  
  // 1. Respostas sem Inspeção
  const responses = await db.responses.toArray();
  for (const r of responses) {
    const parent = await db.inspections.get(r.inspectionId);
    if (!parent) {
      await db.responses.delete(r.id);
      await logSync('warn', `Removida resposta órfã: ${r.id}`);
    }
  }

  // 2. Fotos sem Resposta
  const photos = await db.photos.toArray();
  for (const p of photos) {
    const parent = await db.responses.get(p.responseId);
    if (!parent) {
      await db.photos.delete(p.id);
      await logSync('warn', `Removida foto órfã: ${p.id}`);
    }
  }

  // 3. Inspeções sem Cliente
  const inspections = await db.inspections.toArray();
  for (const i of inspections) {
    const parent = await db.clients.get(i.clientId);
    if (!parent) {
      await db.inspections.delete(i.id);
      await logSync('warn', `Removida inspeção órfã: ${i.id}`);
    }
  }

  // 4. Schedules sem Cliente
  const schedules = await db.schedules.toArray();
  for (const s of schedules) {
    const parent = await db.clients.get(s.clientId);
    if (!parent) {
      await db.schedules.delete(s.id);
      await logSync('warn', `Removido schedule órfão: ${s.id}`);
    }
  }
}

async function processPendingDeletions() {
  const deletions = await db.deletions_sync.toArray();
  if (deletions.length === 0) return;

  await logSync('info', `Processando ${deletions.length} exclusões pendentes...`);
  
  for (const del of deletions) {
    try {
      const { error } = await supabase.from(del.table).delete().eq('id', del.recordId);
      if (!error || error.code === 'PGRST116' || error.code === '404') {
        await db.deletions_sync.delete(del.id!);
      }
    } catch (err) {
      console.warn(`Failed to sync deletion for ${del.table}:${del.recordId}`, err);
    }
  }
}

export async function syncData(isManual: boolean = false) {
  const { user } = useAuthStore.getState();
  if (!user) {
    if (isManual) alert('Faça login antes de sincronizar.');
    return;
  }

  if ((window as any).isSyncingGlobally) {
    if (isManual) alert('Uma sincronização já está em andamento.');
    return;
  }
  (window as any).isSyncingGlobally = true;

  try {
    await logSync('info', 'Iniciando Sincronização Compartilhada...', { manual: isManual });

    // A. Sync Deletions First
    await processPendingDeletions();
    const activeDeletions = await db.deletions_sync.toArray();
    const deletedIds = new Set(activeDeletions.map(d => d.recordId));

    // 0. Sync PROFILE
    const { settings } = (await import('../store/useSettingsStore')).useSettingsStore.getState();
    if (settings.name) {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: settings.name,
        coren: settings.professionalId,
        phone: settings.phone,
        consultant_role: settings.consultantRole,
        updated_at: new Date()
      });
    }

    // ============================================================
    // 1. CLIENTES
    // ============================================================
    
    // PUSH
    const clientQuery = isManual 
      ? db.clients.filter(c => c.synced !== 1)
      : db.clients.where('synced').equals(0);
    
    let pendingClients = await clientQuery.toArray();
    
    if (pendingClients.length > 0) {
      await logSync('info', `Enviando ${pendingClients.length} clientes pendentes...`);
      
      const clientsToPush = pendingClients.map(c => ({
        id: c.id, name: c.name, cnpj: c.cnpj, address: c.address, category: c.category,
        food_types: c.foodTypes, responsible_name: c.responsibleName, phone: c.phone,
        email: c.email, created_at: c.createdAt, updated_at: c.updatedAt || new Date(),
        user_id: user.id, city: c.city, state: c.state
        // tenant_id removido
      }));

      const { error: pushError } = await withTimeout<any>(
        Promise.resolve(supabase.from('clients').upsert(clientsToPush))
      );
      
      if (!pushError) {
        await db.clients.where('id').anyOf(clientsToPush.map(c => c.id)).modify({ synced: 1 });
        await logSync('info', 'Clientes enviados com sucesso');
      } else {
        await logSync('error', 'Falha ao enviar Clientes', pushError);
      }
    }

    // PULL CLIENTES
    const remoteClients = await pullAllPages('clients');
    if (remoteClients.length > 0) {
      await logSync('info', `Baixados ${remoteClients.length} clientes da nuvem`);
      
      for (const rc of remoteClients) {
        if (deletedIds.has(rc.id)) continue;
        
        const local = await db.clients.get(rc.id);
        const serverUpdate = new Date(rc.updated_at || rc.created_at);
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt) : undefined;

        if (shouldUpdateLocal(serverUpdate, localUpdate)) {
          await db.clients.put({
            id: rc.id, name: rc.name, cnpj: rc.cnpj, address: rc.address,
            category: rc.category as any, foodTypes: rc.food_types,
            responsibleName: rc.responsible_name, phone: rc.phone, email: rc.email,
            createdAt: new Date(rc.created_at), updatedAt: serverUpdate,
            city: rc.city, state: rc.state, tenantId: rc.tenant_id, synced: 1
          });
        } else if (local && localUpdate && serverUpdate <= localUpdate && local.synced === 0) {
          // Local mais novo, mas servidor confirmou recepção (edge case, mantido safe)
          await db.clients.update(rc.id, { synced: 1 });
        }
      }
    }

    // ============================================================
    // 2. INSPEÇÕES
    // ============================================================
    
    // PUSH
    const inspecQuery = isManual 
      ? db.inspections.filter(i => i.synced !== 1) 
      : db.inspections.where('synced').equals(0);
    
    const allPendingInspec = await inspecQuery.toArray();
    
    const pendingInspec = [];
    for (const i of allPendingInspec) {
      const client = await db.clients.get(i.clientId);
      if (client && client.synced === 1) {
        pendingInspec.push(i);
      } else {
        await logSync('warn', `Inspeção ${i.id} aguardando cliente ${i.clientId} sincronizar`);
      }
    }

    if (pendingInspec.length > 0) {
      await logSync('info', `Enviando ${pendingInspec.length} inspeções...`);
      
      const recordsToPush = pendingInspec.map(i => ({
        id: i.id, client_id: i.clientId, template_id: i.templateId,
        consultant_name: i.consultantName, inspection_date: i.inspectionDate,
        status: i.status, observations: i.observations, created_at: i.createdAt,
        completed_at: i.completedAt, user_id: user.id,
        ilpi_capacity: i.ilpiCapacity, residents_total: i.residentsTotal,
        residents_male: i.residentsMale, residents_female: i.residentsFemale,
        dependency_level1: i.dependencyLevel1, dependency_level2: i.dependencyLevel2,
        dependency_level3: i.dependencyLevel3, accompanist_name: i.accompanistName,
        accompanist_role: i.accompanistRole, signature_data_url: i.signatureDataUrl,
        updated_at: i.updatedAt || new Date()
      }));
      
      const { successIds, errors } = await safeBatchUpsert('inspections', recordsToPush);
      if (successIds.length > 0) await db.inspections.where('id').anyOf(successIds).modify({ synced: 1 });
      if (errors.length > 0) await logSync('error', 'Falha em algumas inspeções', errors[0].error);
    }

    // PULL INSPEÇÕES
    const remoteInspec = await pullAllPages('inspections');
    if (remoteInspec.length > 0) {
      await logSync('info', `Baixados ${remoteInspec.length} inspeções da nuvem`);
      
      for (const ri of remoteInspec) {
        if (deletedIds.has(ri.id)) continue;
        
        const local = await db.inspections.get(ri.id);
        const serverUpdate = new Date(ri.updated_at || ri.created_at);
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt) : undefined;

        if (shouldUpdateLocal(serverUpdate, localUpdate)) {
          await db.inspections.put({
            id: ri.id, clientId: ri.client_id, templateId: ri.template_id,
            consultantName: ri.consultant_name, inspectionDate: new Date(ri.inspection_date),
            status: ri.status as any, observations: ri.observations,
            createdAt: new Date(ri.created_at), updatedAt: serverUpdate,
            completedAt: ri.completed_at ? new Date(ri.completed_at) : undefined,
            ilpiCapacity: ri.ilpi_capacity, residentsTotal: ri.residents_total,
            residentsMale: ri.residents_male, residentsFemale: ri.residents_female,
            dependencyLevel1: ri.dependency_level1, dependencyLevel2: ri.dependency_level2,
            dependencyLevel3: ri.dependency_level3, accompanistName: ri.accompanist_name,
            accompanistRole: ri.accompanist_role, signatureDataUrl: ri.signature_data_url,
            tenantId: ri.tenant_id, synced: 1
          });
        } else if (local && localUpdate && serverUpdate <= localUpdate && local.synced === 0) {
          await db.inspections.update(ri.id, { synced: 1 });
        }
      }
    }

    // ============================================================
    // 3. RESPOSTAS
    // ============================================================
    
    // PUSH
    const resQuery = isManual ? db.responses.filter(r => r.synced !== 1) : db.responses.where('synced').equals(0);
    const allPendingResponses = await resQuery.toArray();

    const pendingResponses = [];
    for (const r of allPendingResponses) {
      const parent = await db.inspections.get(r.inspectionId);
      if (parent && parent.synced === 1) {
        pendingResponses.push(r);
      }
    }

    if (pendingResponses.length > 0) {
      await logSync('info', `Enviando ${pendingResponses.length} respostas...`);
      
      const recordsToPush = pendingResponses.map(r => ({
        id: r.id, inspection_id: r.inspectionId, item_id: r.itemId,
        result: r.result, situation_description: r.situationDescription,
        corrective_action: r.correctiveAction, created_at: r.createdAt,
        updated_at: r.updatedAt || new Date(), user_id: user.id, 
        custom_description: r.customDescription
      }));
      
      const { successIds } = await safeBatchUpsert('responses', recordsToPush);
      if (successIds.length > 0) await db.responses.where('id').anyOf(successIds).modify({ synced: 1 });
    }

    // PULL RESPOSTAS
    const remoteRes = await pullAllPages('responses');
    if (remoteRes.length > 0) {
      await logSync('info', `Baixados ${remoteRes.length} respostas da nuvem`);
      
      for (const rr of remoteRes) {
        if (deletedIds.has(rr.id)) continue;
        
        const local = await db.responses.get(rr.id);
        const serverUpdate = new Date(rr.updated_at || rr.created_at);
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt) : undefined;

        if (shouldUpdateLocal(serverUpdate, localUpdate)) {
          await db.responses.put({
            id: rr.id, inspectionId: rr.inspection_id, itemId: rr.item_id,
            result: rr.result as any, situationDescription: rr.situation_description,
            correctiveAction: rr.corrective_action, createdAt: new Date(rr.created_at),
            updatedAt: serverUpdate, photos: [], tenantId: rr.tenant_id, synced: 1,
            customDescription: rr.custom_description
          });
        } else if (local && localUpdate && serverUpdate <= localUpdate && local.synced === 0) {
          await db.responses.update(rr.id, { synced: 1 });
        }
      }
    }

    // ============================================================
    // 4. FOTOS
    // ============================================================
    
    // PUSH
    const photoQuery = isManual ? db.photos.filter(p => p.synced !== 1) : db.photos.where('synced').equals(0);
    const allPendingPhotos = await photoQuery.toArray();

    const pendingPhotos = [];
    for (const p of allPendingPhotos) {
      const parent = await db.responses.get(p.responseId);
      if (parent && parent.synced === 1) {
        pendingPhotos.push(p);
      }
    }

    if (pendingPhotos.length > 0) {
      await logSync('info', `Enviando ${pendingPhotos.length} fotos...`);
      
      const recordsToPush = pendingPhotos.map(p => ({
        id: p.id, response_id: p.responseId, data_url: p.dataUrl,
        caption: p.caption, taken_at: p.takenAt, user_id: user.id,
        updated_at: p.updatedAt || new Date()
      }));
      
      const { successIds } = await safeBatchUpsert('photos', recordsToPush);
      if (successIds.length > 0) await db.photos.where('id').anyOf(successIds).modify({ synced: 1 });
    }

    // PULL FOTOS
    const remotePh = await pullAllPages('photos', 'taken_at');
    if (remotePh.length > 0) {
      await logSync('info', `Baixados ${remotePh.length} fotos da nuvem`);
      
      for (const rp of remotePh) {
        if (deletedIds.has(rp.id)) continue;
        
        const local = await db.photos.get(rp.id);
        const serverUpdate = new Date(rp.updated_at || rp.taken_at || rp.created_at);
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt) : undefined;

        if (shouldUpdateLocal(serverUpdate, localUpdate)) {
          await db.photos.put({
            id: rp.id, responseId: rp.response_id, dataUrl: rp.data_url,
            caption: rp.caption, takenAt: new Date(rp.taken_at), 
            updatedAt: serverUpdate, tenantId: rp.tenant_id, synced: 1
          });
        } else if (local && localUpdate && serverUpdate <= localUpdate && local.synced === 0) {
          await db.photos.update(rp.id, { synced: 1 });
        }
      }
    }

    // ============================================================
    // 5. SCHEDULES
    // ============================================================
    
    // PUSH
    const schQuery = isManual ? db.schedules.filter(s => s.synced !== 1) : db.schedules.where('synced').equals(0);
    const allPendingSchedules = await schQuery.toArray();

    const pendingSchedules = [];
    for (const s of allPendingSchedules) {
      const client = await db.clients.get(s.clientId);
      if (client && client.synced === 1) {
        pendingSchedules.push(s);
      } else {
        await logSync('warn', `Schedule ${s.id} aguardando cliente ${s.clientId} sincronizar`);
      }
    }

    if (pendingSchedules.length > 0) {
      await logSync('info', `Enviando ${pendingSchedules.length} agendamentos...`);
      
      const recordsToPush = pendingSchedules.map(s => ({
        id: s.id, client_id: s.clientId, scheduled_at: s.scheduledAt,
        status: s.status, notes: s.notes, user_id: s.user_id || user.id,
        updated_at: s.updatedAt || new Date()
      }));
      
      const { successIds } = await safeBatchUpsert('schedules', recordsToPush);
      if (successIds.length > 0) await db.schedules.where('id').anyOf(successIds).modify({ synced: 1 });
    }

    // PULL SCHEDULES
    const remoteSch = await pullAllPages('schedules');
    if (remoteSch.length > 0) {
      await logSync('info', `Baixados ${remoteSch.length} schedules da nuvem`);
      
      for (const rs of remoteSch) {
        if (deletedIds.has(rs.id)) continue;
        
        const local = await db.schedules.get(rs.id);
        const serverUpdate = new Date(rs.updated_at || rs.created_at);
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt) : undefined;

        if (shouldUpdateLocal(serverUpdate, localUpdate)) {
          await db.schedules.put({
            id: rs.id, clientId: rs.client_id, scheduledAt: new Date(rs.scheduled_at),
            status: rs.status as any, notes: rs.notes, user_id: rs.user_id, 
            updatedAt: serverUpdate, tenantId: rs.tenant_id, synced: 1
          });
        } else if (local && localUpdate && serverUpdate <= localUpdate && local.synced === 0) {
          await db.schedules.update(rs.id, { synced: 1 });
        }
      }
    }

    // ============================================================
    // 6. CLEANUP (FINAL)
    // ============================================================
    await cleanupOrphans();

    await logSync('info', 'Sincronização Compartilhada concluída');
    if (isManual) alert('✅ Sincronização concluída!');
    
  } catch (err: any) {
    await logSync('error', 'Erro inesperado na sincronização', err?.message || err);
    if (isManual) alert('❌ Erro: ' + (err?.message || err));
  } finally {
    (window as any).isSyncingGlobally = false;
  }
}

// Sync rápido apenas clientes
export async function syncClientsOnly() {
  const { user } = useAuthStore.getState();
  if (!user || (window as any).isSyncingGlobally) return;
  
  (window as any).isSyncingGlobally = true;
  try {
    await logSync('info', 'Iniciando sync rápido de clientes...');
    
    await processPendingDeletions();
    const activeDeletions = await db.deletions_sync.toArray();
    const deletedIds = new Set(activeDeletions.map(d => d.recordId));

    const remoteClients = await pullAllPages('clients');
    
    if (remoteClients && remoteClients.length > 0) {
      for (const rc of remoteClients) {
        if (deletedIds.has(rc.id)) continue;
        const local = await db.clients.get(rc.id);
        const serverUpdate = new Date(rc.updated_at || rc.created_at);
        const localUpdate = local?.updatedAt ? new Date(local.updatedAt) : undefined;

        if (shouldUpdateLocal(serverUpdate, localUpdate)) {
          await db.clients.put({
            id: rc.id, name: rc.name, cnpj: rc.cnpj, address: rc.address,
            category: rc.category as any, foodTypes: rc.food_types,
            responsibleName: rc.responsible_name, phone: rc.phone, email: rc.email,
            createdAt: new Date(rc.created_at), updatedAt: serverUpdate,
            city: rc.city, state: rc.state, tenantId: rc.tenant_id, synced: 1
          });
        } else if (local && localUpdate && serverUpdate <= localUpdate && local.synced === 0) {
          await db.clients.update(rc.id, { synced: 1 });
        }
      }
    }
    await logSync('info', 'Sync rápido de clientes concluído.');
  } catch (err) {
    console.error('Failed fast sync', err);
  } finally {
    (window as any).isSyncingGlobally = false;
  }
}
