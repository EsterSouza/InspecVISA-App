import { db } from '../db/database';
import type { Client, Inspection, InspectionResponse, Schedule } from '../types';
import { generateId } from '../utils/imageUtils';
import { toDateKey } from '../utils/date';

/**
 * O backup antigo traz **as duas grafias** do mesmo campo (`created_at` e `createdAt`),
 * porque foi exportado por versões diferentes do app — é o que os `||` do código tratam.
 * Tudo é opcional de propósito: o arquivo é dado de fora, não contrato nosso. Era `any`,
 * que escondia justamente essa duplicidade (DEBT-02).
 */
export interface LegacyClient {
  id?: string;
  name?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  category?: Client['category'];
  food_types?: Client['foodTypes'];
  foodTypes?: Client['foodTypes'];
  responsible_name?: string;
  responsibleName?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  createdAt?: string;
}

export interface LegacyInspection {
  id?: string;
  client_id?: string;
  clientId?: string;
  template_id?: string;
  templateId?: string;
  consultant_name?: string;
  consultantName?: string;
  inspection_date?: string;
  inspectionDate?: string;
  status?: Inspection['status'];
  observations?: string;
  completed_at?: string;
  completedAt?: string;
  created_at?: string;
  createdAt?: string;
  ilpi_capacity?: number;
  ilpiCapacity?: number;
  residents_total?: number;
  residentsTotal?: number;
  residents_male?: number;
  residentsMale?: number;
  residents_female?: number;
  residentsFemale?: number;
  dependency_level1?: number;
  dependencyLevel1?: number;
  dependency_level2?: number;
  dependencyLevel2?: number;
  dependency_level3?: number;
  dependencyLevel3?: number;
  accompanist_name?: string;
  accompanistName?: string;
  accompanist_role?: string;
  accompanistRole?: string;
  signature_data_url?: string;
  signatureDataUrl?: string;
}

export interface LegacyResponse {
  id?: string;
  inspection_id?: string;
  inspectionId?: string;
  item_id?: string;
  itemId?: string;
  result?: InspectionResponse['result'];
  situation_description?: string;
  situationDescription?: string;
  corrective_action?: string;
  correctiveAction?: string;
  custom_description?: string;
  customDescription?: string;
  created_at?: string;
  createdAt?: string;
}

export interface LegacyPhoto {
  id?: string;
  response_id?: string;
  responseId?: string;
  data_url?: string;
  dataUrl?: string;
  storage_path?: string;
  storagePath?: string;
  caption?: string;
  taken_at?: string;
  takenAt?: string;
}

export interface LegacySchedule {
  id?: string;
  client_id?: string;
  clientId?: string;
  scheduled_at?: string;
  scheduledAt?: string;
  status?: Schedule['status'];
  notes?: string;
  user_id?: string;
  userId?: string;
}

export interface LegacyBackup {
  source: string;
  exportedAt: string;
  user_id: string;
  data: {
    clients: LegacyClient[];
    inspections: LegacyInspection[];
    responses: LegacyResponse[];
    photos: LegacyPhoto[];
    schedules: LegacySchedule[];
  };
}
/**
 * Normaliza nomes de clientes para comparação
 */
function normalizeClientName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
}

/**
 * Encontra cliente correspondente por CNPJ (prioridade) ou por nome (fuzzy match)
 */
function findMatchingClient(legacyClient: LegacyClient, localClients: Client[]): Client | null {
  // 1. Prioridade: CNPJ
  if (legacyClient.cnpj) {
    const cleanCnpj = legacyClient.cnpj.replace(/\D/g, '');
    const matchByCnpj = localClients.find(c => (c.cnpj || '').replace(/\D/g, '') === cleanCnpj);
    if (matchByCnpj) return matchByCnpj;
  }

  // 2. Fuzzy Match por nome
  const normalizedLegacy = normalizeClientName(legacyClient.name || '');
  
  for (const local of localClients) {
    const normalizedLocal = normalizeClientName(local.name);
    
    // Match exato
    if (normalizedLocal === normalizedLegacy) {
      return local;
    }
    
    // Match parcial (80% de similaridade)
    const similarity = calculateSimilarity(normalizedLocal, normalizedLegacy);
    if (similarity > 0.8) {
      return local;
    }
  }
  
  return null;
}

/**
 * Calcula similaridade entre duas strings (Levenshtein simplificado)
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[s2.length][s1.length];
}

/**
 * Encontra inspeção correspondente (mesmo cliente + mesma data)
 */
function findMatchingInspection(
  legacyInspection: LegacyInspection,
  clientIdMap: Map<string, string>,
  localInspections: Inspection[]
): Inspection | null {
  const mappedClientId = clientIdMap.get(legacyInspection.client_id || legacyInspection.clientId || '');
  if (!mappedClientId) return null;
  
  // Aqui o UTC é o certo, não o local: `new Date('2026-08-16')` (data pura, sem
  // hora) já nasce à meia-noite UTC, e ler em local devolveria 15/08 no Brasil.
  const legacyDate = new Date(legacyInspection.inspection_date || legacyInspection.inspectionDate || '').toISOString().split('T')[0];
  
  for (const local of localInspections) {
    const localDate = new Date(local.inspectionDate).toISOString().split('T')[0];
    
    if (local.clientId === mappedClientId && localDate === legacyDate) {
      return local;
    }
  }
  
  return null;
}

export interface ConsolidationReport {
  clientsMerged: number;
  inspectionsMerged: number;
  inspectionsCreated: number;
  responsesMerged: number;
  photosImported: number;
  schedulesImported: number;
  conflicts: Array<{
    type: 'client' | 'inspection' | 'error';
    label: string;
    resolution: string;
  }>;
}

/**
 * CONSOLIDAÇÃO INTELIGENTE: Mescla dados da Ana com dados atuais
 */
export async function consolidateLegacyData(
  legacyBackup: LegacyBackup,
  onProgress?: (message: string) => void
): Promise<ConsolidationReport> {
  const report: ConsolidationReport = {
    clientsMerged: 0,
    inspectionsCreated: 0,
    inspectionsMerged: 0,
    responsesMerged: 0,
    photosImported: 0,
    schedulesImported: 0,
    conflicts: []
  };
  
  const log = (msg: string) => {
    console.log(`[Consolidação] ${msg}`);
    onProgress?.(msg);
  };
  
  log('🔄 Iniciando consolidação de dados legados...');
  
  // Carregar dados locais para comparação
  const localClients = await db.clients.filter(c => !c.deletedAt).toArray();
  const localInspections = await db.inspections.filter(i => !i.deletedAt).toArray();
  
  // Mapa: legacyClientId → localClientId
  const clientIdMap = new Map<string, string>();
  
  // ============================================================
  // 1. PROCESSAR CLIENTES
  // ============================================================
  log(`📋 Processando ${legacyBackup.data.clients.length} clientes...`);
  
  for (const legacyClient of legacyBackup.data.clients) {
    const match = findMatchingClient(legacyClient, localClients);
    
    if (match) {
      // Cliente JÁ EXISTE → Mapeia
      clientIdMap.set(legacyClient.id || '', match.id);
      
      // Mescla dados (preenche apenas campos vazios no local)
      let updated = false;
      // `Partial<...>` em vez de um saco de chaves: o `update` do Dexie so aceita campos
      // que existem no registro.
      const updates: Partial<Client> = {};
      
      if (!match.cnpj && legacyClient.cnpj) { updates.cnpj = legacyClient.cnpj; updated = true; }
      if (!match.address && legacyClient.address) { updates.address = legacyClient.address; updated = true; }
      if (!match.city && legacyClient.city) { updates.city = legacyClient.city; updated = true; }
      if (!match.state && legacyClient.state) { updates.state = legacyClient.state; updated = true; }
      if (!match.phone && legacyClient.phone) { updates.phone = legacyClient.phone; updated = true; }
      if (!match.email && legacyClient.email) { updates.email = legacyClient.email; updated = true; }
      
      const legacyResponsible = legacyClient.responsible_name || legacyClient.responsibleName;
      if (!match.responsibleName && legacyResponsible) { 
        updates.responsibleName = legacyResponsible; 
        updated = true; 
      }
      
      if (updated) {
        updates.syncStatus = 'pending';
        updates.updatedAt = new Date();
        await db.clients.update(match.id, updates);
        report.clientsMerged++;
        log(`✅ Cliente mesclado (dados unificados): ${match.name}`);
      } else {
        log(`ℹ️ Cliente já existente e completo: ${match.name}`);
      }
      
      report.conflicts.push({
        type: 'client',
        label: match.name,
        resolution: updated ? 'Dados incompletos preenchidos com info da Ana' : 'Já estava sincronizado'
      });
    } else {
      // Cliente NÃO EXISTE → Cria novo
      const newId = generateId();
      clientIdMap.set(legacyClient.id || '', newId);
      
      await db.clients.add({
        id: newId,
        // Nome e categoria sao obrigatorios no registro local; o backup pode nao ter.
        // O fallback e o mesmo que o `any` produzia calado — so que agora esta escrito.
        name: legacyClient.name || 'Cliente sem nome',
        cnpj: legacyClient.cnpj,
        address: legacyClient.address,
        category: legacyClient.category || 'estetica',
        foodTypes: legacyClient.food_types || legacyClient.foodTypes,
        responsibleName: legacyClient.responsible_name || legacyClient.responsibleName,
        phone: legacyClient.phone,
        email: legacyClient.email,
        city: legacyClient.city,
        state: legacyClient.state,
        createdAt: new Date(legacyClient.created_at || legacyClient.createdAt || Date.now()),
        updatedAt: new Date(),
        deletedAt: null,
        syncStatus: 'pending'
      });
      
      report.clientsMerged++;
      log(`➕ Novo cliente importado: ${legacyClient.name}`);
    }
  }
  
  // ============================================================
  // 2. PROCESSAR INSPEÇÕES
  // ============================================================
  log(`📝 Processando ${legacyBackup.data.inspections.length} inspeções...`);
  
  const inspectionIdMap = new Map<string, string>(); // legacyInspectionId → localInspectionId
  
  for (const legacyInspection of legacyBackup.data.inspections) {
    const match = findMatchingInspection(legacyInspection, clientIdMap, localInspections);
    
    if (match) {
      // INSPEÇÃO JÁ EXISTE (mesma data + mesmo cliente) → MERGE
      inspectionIdMap.set(legacyInspection.id || '', match.id);
      
      // Atualiza campos se vazios
      let updated = false;
      // `Partial<...>` em vez de um saco de chaves: o `update` do Dexie so aceita campos
      // que existem no registro.
      const updates: Partial<Inspection> = {};
      
      const legacyObs = legacyInspection.observations;
      if (!match.observations && legacyObs) {
        updates.observations = legacyObs;
        updated = true;
      }
      
      if (updated) {
        updates.syncStatus = 'pending';
        updates.updatedAt = new Date();
        await db.inspections.update(match.id, updates);
      }
      
      report.inspectionsMerged++;
      log(`🔀 Inspeção CONSOLIDADA: ${match.id} (${new Date(match.inspectionDate).toLocaleDateString()})`);
      
      report.conflicts.push({
        type: 'inspection',
        label: `Inspeção ${new Date(match.inspectionDate).toLocaleDateString()}`,
        resolution: 'Respostas de Nutrição e outros setores agora estão juntas'
      });
    } else {
      // INSPEÇÃO NÃO EXISTE → Cria nova
      const mappedClientId = clientIdMap.get(legacyInspection.client_id || legacyInspection.clientId || '');
      if (!mappedClientId) {
        log(`⚠️ Cliente não encontrado para inspeção ${legacyInspection.id}, pulando...`);
        continue;
      }
      
      const newId = generateId();
      inspectionIdMap.set(legacyInspection.id || '', newId);
      
      await db.inspections.add({
        id: newId,
        clientId: mappedClientId,
        // Obrigatorios no registro local; o backup pode nao ter. Mesmo resultado que o
        // `any` produzia calado, agora escrito.
        templateId: legacyInspection.template_id || legacyInspection.templateId || '',
        consultantName: legacyInspection.consultant_name || legacyInspection.consultantName || '',
        inspectionDate: new Date(legacyInspection.inspection_date || legacyInspection.inspectionDate || Date.now()),
        status: legacyInspection.status || 'in_progress',
        observations: legacyInspection.observations,
        completedAt: legacyInspection.completed_at || legacyInspection.completedAt ? new Date((legacyInspection.completed_at || legacyInspection.completedAt) as string) : undefined,
        ilpiCapacity: legacyInspection.ilpi_capacity || legacyInspection.ilpiCapacity,
        residentsTotal: legacyInspection.residents_total || legacyInspection.residentsTotal,
        residentsMale: legacyInspection.residents_male || legacyInspection.residentsMale,
        residentsFemale: legacyInspection.residents_female || legacyInspection.residentsFemale,
        dependencyLevel1: legacyInspection.dependency_level1 || legacyInspection.dependencyLevel1,
        dependencyLevel2: legacyInspection.dependency_level2 || legacyInspection.dependencyLevel2,
        dependencyLevel3: legacyInspection.dependency_level3 || legacyInspection.dependencyLevel3,
        accompanistName: legacyInspection.accompanist_name || legacyInspection.accompanistName,
        accompanistRole: legacyInspection.accompanist_role || legacyInspection.accompanistRole,
        signatureDataUrl: legacyInspection.signature_data_url || legacyInspection.signatureDataUrl,
        createdAt: new Date(legacyInspection.created_at || legacyInspection.createdAt || Date.now()),
        updatedAt: new Date(),
        deletedAt: null,
        syncStatus: 'pending'
      });
      
      report.inspectionsCreated++;
      log(`➕ Inspeção criada: ${newId} (${new Date(legacyInspection.inspection_date || legacyInspection.inspectionDate || Date.now()).toLocaleDateString()})`);
    }
  }
  
  // ============================================================
  // 3. PROCESSAR RESPOSTAS
  // ============================================================
  log(`💬 Processando ${legacyBackup.data.responses.length} respostas...`);
  
  for (const legacyResponse of legacyBackup.data.responses) {
    const mappedInspectionId = inspectionIdMap.get(legacyResponse.inspection_id || legacyResponse.inspectionId || '');
    if (!mappedInspectionId) continue;
    
    // Verifica se JÁ EXISTE resposta para o MESMO ITEM nessa inspeção
    const existing = await db.responses
      .where('[inspectionId+itemId]')
      .equals([mappedInspectionId, legacyResponse.item_id || legacyResponse.itemId || ''])
      .first();
    
    if (existing) {
      log(`ℹ️ Resposta ignorada (item ${legacyResponse.item_id || legacyResponse.itemId} já tem resposta local)`);
      continue;
    }
    
    // Importa resposta
    const newRespId = generateId();
    await db.responses.add({
      id: newRespId,
      inspectionId: mappedInspectionId,
      itemId: legacyResponse.item_id || legacyResponse.itemId || '',
      // Sem resultado no backup, o registro entra como nao avaliado — nao inventa conformidade.
      result: legacyResponse.result || 'not_evaluated',
      situationDescription: legacyResponse.situation_description || legacyResponse.situationDescription,
      correctiveAction: legacyResponse.corrective_action || legacyResponse.correctiveAction,
      customDescription: legacyResponse.custom_description || legacyResponse.customDescription,
      photos: [], // ✅ Fix: missing property
      createdAt: new Date(legacyResponse.created_at || legacyResponse.createdAt || Date.now()),
      updatedAt: new Date(),
      deletedAt: null,
      syncStatus: 'pending'
    });
    
    report.responsesMerged++;
  }
  
  // ============================================================
  // 4. PROCESSAR FOTOS
  // ============================================================
  log(`📸 Processando ${legacyBackup.data.photos.length} fotos...`);
  
  for (const legacyPhoto of legacyBackup.data.photos) {
    const legacyResponseId = legacyPhoto.response_id || legacyPhoto.responseId;
    
    // Encontrar qual resposta legada era essa
    const legacyOriginalResp = legacyBackup.data.responses.find(r => r.id === legacyResponseId);
    if (!legacyOriginalResp) continue;
    
    const mappedInspectionId = inspectionIdMap.get(legacyOriginalResp.inspection_id || legacyOriginalResp.inspectionId || '');
    if (!mappedInspectionId) continue;
    
    // Buscar a resposta local correspondente ao mesmo item
    const localResponse = await db.responses
      .where('[inspectionId+itemId]')
      .equals([mappedInspectionId, legacyOriginalResp.item_id || legacyOriginalResp.itemId || ''])
      .first();
    
    if (!localResponse) continue;
    
    // Importa foto
    await db.photos.add({
      id: generateId(),
      responseId: localResponse.id,
      dataUrl: legacyPhoto.data_url || legacyPhoto.dataUrl || '',
      storagePath: legacyPhoto.storage_path || legacyPhoto.storagePath,
      caption: legacyPhoto.caption,
      takenAt: new Date(legacyPhoto.taken_at || legacyPhoto.takenAt || Date.now()),
      updatedAt: new Date(),
      deletedAt: null,
      syncStatus: 'pending'
    });
    
    report.photosImported++;
  }
  
  // ============================================================
  // 5. PROCESSAR SCHEDULES
  // ============================================================
  log(`📅 Processando ${legacyBackup.data.schedules.length} agendamentos...`);
  
  for (const legacySchedule of legacyBackup.data.schedules) {
    const mappedClientId = clientIdMap.get(legacySchedule.client_id || legacySchedule.clientId || '');
    if (!mappedClientId) continue;
    
    const legacyDate = new Date(legacySchedule.scheduled_at || legacySchedule.scheduledAt || '').toISOString().split('T')[0];
    
    // Evitar duplicata
    const existing = await db.schedules
      .where('clientId').equals(mappedClientId)
      .filter(s => new Date(s.scheduledAt).toISOString().split('T')[0] === legacyDate && !s.deletedAt)
      .first();
      
    if (existing) continue;
    
    await db.schedules.add({
      id: generateId(),
      clientId: mappedClientId,
      scheduledAt: new Date(legacySchedule.scheduled_at || legacySchedule.scheduledAt || Date.now()),
      // O agendamento nasce pendente quando o backup nao diz o estado.
      status: legacySchedule.status || 'pending',
      notes: legacySchedule.notes,
      user_id: legacySchedule.user_id || legacySchedule.userId, // ✅ Fix: user_id
      updatedAt: new Date(),
      deletedAt: null,
      syncStatus: 'pending'
    });
    
    report.schedulesImported++;
  }
  
  log('✅ Consolidação concluída com sucesso!');
  return report;
}

/**
 * EXPORTAÇÃO DE BACKUP: Gera um JSON de toda a base local atual
 */
export async function exportCurrentDatabase() {
  const data = {
    source: 'Backup Local (Pré-Consolidação)',
    exportedAt: new Date().toISOString(),
    data: {
      clients: await db.clients.toArray(),
      inspections: await db.inspections.toArray(),
      responses: await db.responses.toArray(),
      photos: await db.photos.toArray(),
      schedules: await db.schedules.toArray()
    }
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-inspecvisa-${toDateKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
