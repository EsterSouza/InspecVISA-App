import { authenticate, assertTenantAccess, chunkArray, json } from './syncJobCore';

const WRITE_CHUNK_SIZE = 100;
const PHOTO_BUCKET = 'inspection-photos';

async function readBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function iso(value: any) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function collectTenantIds(groups: any[][]) {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const tenantId = item?.tenantId || item?.tenant_id;
      if (tenantId) ids.add(tenantId);
    }
  }
  return [...ids];
}

function mapClient(client: any, tenantId: string) {
  return {
    id: client.id,
    name: client.name,
    cnpj: client.cnpj || null,
    address: client.address || null,
    city: client.city || null,
    state: client.state || null,
    category: client.category,
    food_types: client.foodTypes || client.food_types || null,
    responsible_name: client.responsibleName || client.responsible_name || null,
    phone: client.phone || null,
    email: client.email || null,
    deleted_at: iso(client.deletedAt || client.deleted_at),
    updated_at: iso(client.updatedAt || client.updated_at || client.createdAt || client.created_at),
    created_at: iso(client.createdAt || client.created_at || client.updatedAt || client.updated_at),
    tenant_id: client.tenantId || client.tenant_id || tenantId,
  };
}

function mapInspection(inspection: any, tenantId: string) {
  return {
    id: inspection.id,
    client_id: inspection.clientId || inspection.client_id,
    template_id: inspection.templateId || inspection.template_id,
    consultant_name: inspection.consultantName || inspection.consultant_name || '',
    inspection_date: iso(inspection.inspectionDate || inspection.inspection_date || inspection.createdAt || inspection.created_at),
    status: inspection.status || 'in_progress',
    observations: inspection.observations || null,
    ilpi_capacity: inspection.ilpiCapacity || inspection.ilpi_capacity || null,
    residents_total: inspection.residentsTotal || inspection.residents_total || null,
    residents_male: inspection.residentsMale || inspection.residents_male || null,
    residents_female: inspection.residentsFemale || inspection.residents_female || null,
    dependency_level1: inspection.dependencyLevel1 || inspection.dependency_level1 || inspection.dependency_level_1 || null,
    dependency_level2: inspection.dependencyLevel2 || inspection.dependency_level2 || inspection.dependency_level_2 || null,
    dependency_level3: inspection.dependencyLevel3 || inspection.dependency_level3 || inspection.dependency_level_3 || null,
    dependency_level_1: inspection.dependencyLevel1 || inspection.dependency_level1 || inspection.dependency_level_1 || null,
    dependency_level_2: inspection.dependencyLevel2 || inspection.dependency_level2 || inspection.dependency_level_2 || null,
    dependency_level_3: inspection.dependencyLevel3 || inspection.dependency_level3 || inspection.dependency_level_3 || null,
    observed_staff: inspection.observedStaff || inspection.observed_staff || null,
    observed_nursing_techs: inspection.observedNursingTechs || inspection.observed_nursing_techs || null,
    accompanist_name: inspection.accompanistName || inspection.accompanist_name || null,
    accompanist_role: inspection.accompanistRole || inspection.accompanist_role || null,
    signature_data_url: inspection.signatureDataUrl || inspection.signature_data_url || null,
    deleted_at: iso(inspection.deletedAt || inspection.deleted_at),
    updated_at: iso(inspection.updatedAt || inspection.updated_at || inspection.createdAt || inspection.created_at),
    created_at: iso(inspection.createdAt || inspection.created_at || inspection.updatedAt || inspection.updated_at),
    tenant_id: inspection.tenantId || inspection.tenant_id || tenantId,
  };
}

function mapResponse(response: any, tenantId: string) {
  return {
    id: response.id,
    inspection_id: response.inspectionId || response.inspection_id,
    item_id: response.itemId || response.item_id,
    result: response.result,
    situation_description: response.situationDescription || response.situation_description || null,
    corrective_action: response.correctiveAction || response.corrective_action || null,
    responsible: response.responsible || null,
    deadline: response.deadline || null,
    custom_description: response.customDescription || response.custom_description || null,
    deleted_at: iso(response.deletedAt || response.deleted_at),
    updated_at: iso(response.updatedAt || response.updated_at || response.createdAt || response.created_at),
    created_at: iso(response.createdAt || response.created_at || response.updatedAt || response.updated_at),
    tenant_id: response.tenantId || response.tenant_id || tenantId,
  };
}

function mapSchedule(schedule: any, tenantId: string) {
  return {
    id: schedule.id,
    client_id: schedule.clientId || schedule.client_id,
    scheduled_at: iso(schedule.scheduledAt || schedule.scheduled_at),
    status: schedule.status || 'pending',
    notes: schedule.notes || null,
    user_id: schedule.user_id || null,
    inspection_id: schedule.inspectionId || schedule.inspection_id || null,
    updated_at: iso(schedule.updatedAt || schedule.updated_at || schedule.scheduledAt || schedule.scheduled_at),
    tenant_id: schedule.tenantId || schedule.tenant_id || tenantId,
    deleted_at: iso(schedule.deletedAt || schedule.deleted_at),
  };
}

function dataUrlToUpload(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Formato de foto local invalido para upload.');
  return {
    contentType: match[1] || 'image/jpeg',
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function mapPhoto(admin: any, photo: any, tenantId: string) {
  let dataUrl = photo.data_url || photo.dataUrl || null;
  const responseId = photo.responseId || photo.response_id;

  if (photo.storagePath || photo.storage_path) {
    dataUrl = `storage://${photo.storagePath || photo.storage_path}`;
  } else if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
    const storagePath = `${tenantId}/${responseId}/${photo.id}.jpg`;
    const upload = dataUrlToUpload(dataUrl);
    const { error } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, upload.buffer, {
        cacheControl: '31536000',
        contentType: upload.contentType,
        upsert: true,
      });
    if (error) throw new Error(`Falha no upload da foto ${photo.id}: ${error.message}`);
    dataUrl = `storage://${storagePath}`;
  }

  return {
    id: photo.id,
    response_id: responseId,
    data_url: dataUrl,
    caption: photo.caption || null,
    taken_at: iso(photo.takenAt || photo.taken_at || photo.updatedAt || photo.updated_at),
    updated_at: iso(photo.updatedAt || photo.updated_at || photo.takenAt || photo.taken_at),
    deleted_at: iso(photo.deletedAt || photo.deleted_at),
    tenant_id: photo.tenantId || photo.tenant_id || tenantId,
  };
}

async function upsertChunks(admin: any, table: string, rows: any[]) {
  for (const chunk of chunkArray(rows, WRITE_CHUNK_SIZE)) {
    const { error } = await admin.from(table).upsert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const auth = await authenticate(req);
    if (auth.error) return json(res, auth.error.status, { ok: false, error: auth.error.message });

    const body = await readBody(req);
    const data = body?.data || body;
    const clients = Array.isArray(data.clients) ? data.clients : [];
    const inspections = Array.isArray(data.inspections) ? data.inspections : [];
    const responses = Array.isArray(data.responses) ? data.responses : [];
    const photos = Array.isArray(data.photos) ? data.photos : [];
    const schedules = Array.isArray(data.schedules) ? data.schedules : [];

    const tenantIds = collectTenantIds([clients, inspections, responses, photos, schedules]);
    if (tenantIds.length !== 1) {
      return json(res, 400, { ok: false, error: 'Backup precisa conter exatamente um tenantId para resgate seguro.' });
    }

    const tenantId = tenantIds[0];
    const access = await assertTenantAccess(auth.admin, tenantId, auth.user.id);
    if (access.error) return json(res, access.error.status, { ok: false, error: access.error.message });

    const mappedClients = clients.map((client: any) => mapClient(client, tenantId));
    const mappedInspections = inspections.map((inspection: any) => mapInspection(inspection, tenantId));
    const mappedResponses = responses.map((response: any) => mapResponse(response, tenantId));
    const mappedSchedules = schedules.map((schedule: any) => mapSchedule(schedule, tenantId));
    const mappedPhotos = [];
    for (const photo of photos) mappedPhotos.push(await mapPhoto(auth.admin, photo, tenantId));

    await upsertChunks(auth.admin, 'clients', mappedClients);
    await upsertChunks(auth.admin, 'inspections', mappedInspections);
    await upsertChunks(auth.admin, 'responses', mappedResponses);
    await upsertChunks(auth.admin, 'schedules', mappedSchedules);
    await upsertChunks(auth.admin, 'photos', mappedPhotos);

    return json(res, 200, {
      ok: true,
      counts: {
        clients: mappedClients.length,
        inspections: mappedInspections.length,
        responses: mappedResponses.length,
        photos: mappedPhotos.length,
        schedules: mappedSchedules.length,
      },
    });
  } catch (err: any) {
    return json(res, 500, { ok: false, error: err?.message || 'Erro inesperado no resgate do backup.' });
  }
}
