import { supabase } from '../lib/supabase';
import type { LinhaPostgres, SyncStatus } from '../types';
import { withTimeout } from '../utils/network';
import { useAuthStore } from '../store/useAuthStore';
import { getLocalActor } from '../utils/localActor';
import { dataUrlToBlob } from '../utils/imageUtils';
import { errorMessage } from '../utils/errors';
import type { Table } from 'dexie';
import { reconcileRoutingAnswers } from '../utils/routingAnswersSync';
import type { RoutingAnswerCarrier } from '../utils/routingAnswersSync';

/**
 * RepositoryService
 * Centralizes Hybrid-Cache and Sync Queue logic.
 */

/**
 * O que as filas de sincronização exigem de qualquer registro local, seja ele cliente,
 * inspeção, resposta, foto ou agendamento — os campos que elas de fato leem, e nada além.
 * Cada entidade traz muito mais; o excesso não atrapalha, é o mínimo que precisa bater.
 */
export interface SyncableRecord {
  id: string;
  // Data, nao texto: o registro **local** guarda Date. A forma remota (texto ISO) so
  // aparece no generico de `mergeRemoteRecord`, que aceita as duas.
  updatedAt?: Date;
  createdAt?: Date;
  tenantId?: string;
  syncStatus?: SyncStatus;
  syncAttempts?: number;
  syncError?: string | null;
  dataVerifiedAt?: Date;
  localActorId?: string;
  /** Só fotos. */
  storagePath?: string;
  /** Cópia dos dois lados quando o merge detecta divergência. */
  conflictRemote?: unknown;
  conflictLocal?: unknown;
}

/** Tabela do Dexie vista por estas funções: qualquer uma das cinco sincronizáveis. */
export type SyncableTable = Table<SyncableRecord, string>;

/** Registro pronto para a fila: já tem data e situação de sincronização preenchidas. */
export type RegistroEnfileirado = SyncableRecord & { updatedAt: Date; syncStatus: SyncStatus };

export type { LinhaPostgres };

/** O recorte de uma foto que o upload para o Storage precisa. */
type FotoParaUpload = {
  id: string;
  responseId?: string;
  dataUrl?: string;
  storagePath?: string;
  tenantId?: string;
};

const activePushes = new Set<string>();
const TENANT_SCOPED_TABLES = new Set(['clients', 'inspections', 'responses', 'photos', 'schedules']);
const BUNDLE_SYNC_TABLES = new Set(['inspections', 'responses', 'photos']);
const UNSAFE_LOCAL_STATUSES: SyncStatus[] = ['pending', 'syncing', 'failed', 'conflict'];
const PHOTO_BUCKET = 'inspection-photos';

function syncKey(tableName: string, id: string) {
  return `${tableName}:${id}`;
}

function sameTimestamp(a?: Date | string, b?: Date | string) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function timestampOf(value?: Date | string) {
  return value ? new Date(value).getTime() : 0;
}

function currentActorId() {
  return getLocalActor().id;
}

const STORAGE_UPLOAD_TIMEOUT_MS = 120000; // 2 min — large photos on slow mobile connections
const REMOTE_VERIFY_TIMEOUT_MS = 15000;

function pushTimeoutMs(tableName: string) {
  if (tableName === 'photos') return 120000;   // DB upsert after storage (metadata only, but may be slow)
  if (tableName === 'clients' || tableName === 'inspections' || tableName === 'schedules') return 120000;
  if (tableName === 'responses') return 45000;  // Brazil→Ohio RTT on mobile needs headroom
  return 45000;
}

function bulkChunkSize(tableName: string) {
  if (tableName === 'responses') return 5;  // was 1 — 36 × 1-req = 36 round-trips; 5 = 8 round-trips
  if (tableName === 'inspections' || tableName === 'schedules') return 3;
  return 5;
}

async function confirmRemoteTimestamp(
  tableName: string,
  id: string,
  updatedAt: Date | string,
  timeoutLabel: string
) {
  const { data: serverRow, error } = await withTimeout(
    supabase
      .from(tableName)
      .select('id, updated_at')
      .eq('id', id)
      .maybeSingle(),
    REMOTE_VERIFY_TIMEOUT_MS,
    timeoutLabel
  ) as { data: { id: string; updated_at: string | null } | null; error: unknown };

  if (error || !serverRow?.updated_at) return false;

  const serverTs = new Date(serverRow.updated_at).getTime();
  const localTs = new Date(updatedAt).getTime();
  // 2 s tolerance covers Postgres microsecond vs JS millisecond rounding.
  return Math.abs(serverTs - localTs) <= 2000;
}

function isInlineDataUrl(value?: string) {
  return Boolean(value?.startsWith('data:image/'));
}

async function uploadPhotoToStorage<T extends FotoParaUpload>(
  record: T,
  dexieTable: SyncableTable,
  tenantId?: string
): Promise<T> {
  // Already uploaded on a previous attempt — nothing to do
  if (record.storagePath) return record;

  if (!isInlineDataUrl(record.dataUrl)) {
    console.warn(`[PhotoUpload] ${record.id}: dataUrl is not inline (prefix: "${record.dataUrl?.slice(0, 30) ?? 'empty'}")`);
    return record;
  }
  if (!tenantId || !record.responseId) {
    console.warn(`[PhotoUpload] ${record.id}: missing tenantId=${tenantId} or responseId=${record.responseId}`);
    return record;
  }

  const storagePath = `${tenantId}/${record.responseId}/${record.id}.jpg`;
  const blob = dataUrlToBlob(record.dataUrl!);

  // Use AbortController via fileOptions.signal — Storage client supports it natively
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STORAGE_UPLOAD_TIMEOUT_MS);

  try {
    const { error } = await (supabase.storage.from(PHOTO_BUCKET).upload(storagePath, blob, {
      cacheControl: '31536000',
      contentType: blob.type || 'image/jpeg',
      upsert: true,
      // `signal` existe no cliente de Storage, mas nao esta no tipo publico de FileOptions.
    } as Parameters<typeof supabase.storage.from>[0] extends never ? never : Record<string, unknown>));

    if (error) {
      console.error(`[PhotoUpload] ${record.id}: Storage error — ${error.message}`);
      throw error;
    }
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`TIMEOUT: StorageUpload_photos took longer than ${STORAGE_UPLOAD_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  await dexieTable.update(record.id, { storagePath });
  console.log(`[PhotoUpload] ${record.id}: uploaded to ${storagePath}`);
  return { ...record, storagePath };
}

export const RepositoryService = {
  /**
   * withTimeout: Wraps a promise with a timeout
   */
  async withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number, label: string): Promise<T> {
    return withTimeout(promise, ms, label);
  },

  async preparePhotoForRemote<T extends FotoParaUpload>(
    record: T,
    dexieTable: SyncableTable,
    tenantId?: string
  ): Promise<T> {
    return uploadPhotoToStorage(record, dexieTable, tenantId);
  },

  /**
   * Generic Upsert (Last Write Wins)
   */
  async upsert<T extends { id: string; updatedAt: Date; syncStatus: SyncStatus; tenantId?: string }>(
    tableName: string,
    record: T,
    dexieTable: Table<T, string>,
    mapToPostgres: (item: T) => LinhaPostgres
  ): Promise<T> {
    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
    const now = new Date();
    
    const enriched: T = {
      ...record,
      tenantId: record.tenantId || tenantId,
      localActorId: (record as { localActorId?: string }).localActorId || currentActorId(),
      updatedAt: now,
      syncStatus: 'pending' as SyncStatus,
      syncAttempts: 0
    };

    // 1. Save locally immediately (Fire and Forget for Remote)
    await dexieTable.put(enriched);
 
    if (navigator.onLine && !BUNDLE_SYNC_TABLES.has(tableName)) {
      // Background push - NO AWAIT
      RepositoryService.pushToRemote(tableName, enriched, dexieTable, mapToPostgres).catch(err => {
        console.warn(`[SyncBackground] Push failed for ${tableName}/${enriched.id}:`, err.message);
      });
    }
 
    return enriched;
  },

  async mergeRemoteRecord<T extends { id: string; updatedAt?: Date | string; createdAt?: Date | string; syncStatus?: SyncStatus }>(
    dexieTable: SyncableTable,
    remote: T,
    options: { label?: string; preserveLocal?: boolean } = {}
  ): Promise<{ accepted: boolean; conflict: boolean; record: T }> {
    const local = await dexieTable.get(remote.id);
    const verifiedAt = new Date();

    if (!local) {
      const record = { ...remote, syncStatus: 'synced' as SyncStatus, dataVerifiedAt: verifiedAt } as T;
      // O generico aceita a forma remota (data em texto); a tabela guarda a local. Quem chama
      // ja converteu — o cast e a fronteira entre as duas formas, e existia como `any` antes.
      await dexieTable.put(record as unknown as SyncableRecord);
      return { accepted: true, conflict: false, record };
    }

    const remoteUpdatedAt = timestampOf(remote.updatedAt || remote.createdAt);
    const localUpdatedAt = timestampOf(local.updatedAt || local.createdAt);

    // COND-08 · resposta de roteamento converge POR PERGUNTA, antes de qualquer
    // decisão de quem vence o registro. Sem isto, a inspeção que a colega editou
    // offline levaria o objeto inteiro e apagaria a resposta dada aqui — perda
    // silenciosa, que é o que a regra inegociável 1 proíbe. Só toca inspeção:
    // nas outras tabelas o recorte não existe e a função devolve `null`.
    const rota = reconcileRoutingAnswers(local as RoutingAnswerCarrier, remote as RoutingAnswerCarrier);
    if (rota) {
      await dexieTable.update(local.id, {
        ...rota.patch,
        // O local tem resposta que o servidor ainda não conhece: entra na fila.
        ...(rota.localAhead && local.syncStatus === 'synced' ? { syncStatus: 'pending' as SyncStatus } : {}),
      } as Partial<SyncableRecord>);
      Object.assign(local, rota.patch);
      remote = { ...remote, ...rota.patch };
    }

    if (local.syncStatus && UNSAFE_LOCAL_STATUSES.includes(local.syncStatus)) {
      const diverged = remoteUpdatedAt > 0 && !sameTimestamp(remote.updatedAt || remote.createdAt, local.updatedAt || local.createdAt);
      if (diverged && options.preserveLocal === false && local.syncStatus !== 'conflict') {
        await dexieTable.update(local.id, {
          syncStatus: 'conflict',
          syncError: `Conflito preservado${options.label ? ` em ${options.label}` : ''}: remoto divergiu de alteracao local.`,
          conflictRemote: remote,
          conflictLocal: local
        });
      }
      return { accepted: false, conflict: diverged && options.preserveLocal === false, record: local as unknown as T };
    }

    if (remoteUpdatedAt > localUpdatedAt + 1000 || options.preserveLocal === false) {
      const record = { ...local, ...remote, syncStatus: 'synced' as SyncStatus, dataVerifiedAt: verifiedAt, syncError: null, conflictRemote: undefined, conflictLocal: undefined } as T;
      await dexieTable.put(record as unknown as SyncableRecord);
      return { accepted: true, conflict: false, record };
    }

    if (!local.dataVerifiedAt) {
      await dexieTable.update(local.id, { dataVerifiedAt: verifiedAt });
    }

    return { accepted: false, conflict: false, record: local as unknown as T };
  },

  async pushToRemote<T extends { id: string; updatedAt: Date; syncStatus: SyncStatus; tenantId?: string; dataVerifiedAt?: Date; syncAttempts?: number }>(
    tableName: string,
    record: T,
    dexieTable: Table<T, string>,
    mapToPostgres: (item: T) => LinhaPostgres
  ): Promise<boolean> {
    // Dexie tipa `update` sobre o generico ainda aberto e, assim, recusa ate as chaves que
    // `SyncableRecord` garante. Esta visao restringe a tabela ao que estas funcoes escrevem.
    const tabela = dexieTable as unknown as SyncableTable;
    const key = syncKey(tableName, record.id);
    if (activePushes.has(key)) return false;
    activePushes.add(key);

    try {
      const tenantId = record.tenantId || useAuthStore.getState().tenantInfo?.tenantId;
      if (TENANT_SCOPED_TABLES.has(tableName) && !tenantId) {
        await tabela.update(record.id, {
          syncStatus: 'pending',
          syncError: 'Aguardando tenantId para sincronizar'
        });
        return false;
      }

      let recordToPush = { ...record, tenantId } as T;
      if (tenantId && tenantId !== record.tenantId) {
        await tabela.update(record.id, { tenantId });
      }

      await tabela.update(record.id, { syncStatus: 'syncing' });

      if (tableName === 'photos') {
        recordToPush = await uploadPhotoToStorage(recordToPush as unknown as FotoParaUpload, tabela, tenantId) as unknown as T;

        // Guard: never send base64 to the DB column — it causes request timeouts.
        // If the storage upload was skipped or failed, keep the photo pending and abort.
        if (!(recordToPush as FotoParaUpload).storagePath && isInlineDataUrl((record as unknown as FotoParaUpload).dataUrl)) {
          console.warn(`[PhotoSync] ${record.id}: storage upload incomplete — blocking DB upsert`);
          await tabela.update(record.id, {
            syncStatus: 'pending',
            syncError: 'Aguardando upload para Supabase Storage antes de sincronizar metadados'
          });
          return false;
        }
      }

      // Perform Push (Direct Upsert - Last Write Wins)
      const pgRecord = mapToPostgres(recordToPush);
      const { error: pushError } = await withTimeout(
        supabase.from(tableName).upsert(pgRecord),
        pushTimeoutMs(tableName),
        `Push_${tableName}`
      );

      if (pushError) throw pushError;

      const current = await tabela.get(record.id);
      if (current && sameTimestamp(current.updatedAt, recordToPush.updatedAt)) {
        await tabela.update(record.id, { 
          syncStatus: 'synced', 
          dataVerifiedAt: new Date(),
          syncError: null,
          syncAttempts: 0 
        });
      } else if (current) {
        await tabela.update(record.id, { syncStatus: 'pending' });
      }
      return true;

    } catch (err) {
      const attempts = (record.syncAttempts || 0) + 1;

      // TIMEOUT RECOVERY: The push may have succeeded server-side but the HTTP
      // response was too slow to arrive back (e.g. Brazil→US-East RTT on mobile).
      // Before marking as pending/failed, do a lightweight GET to verify.
      if (errorMessage(err).startsWith('TIMEOUT') && navigator.onLine) {
        try {
          const confirmed = await confirmRemoteTimestamp(
            tableName,
            record.id,
            record.updatedAt,
            `PushVerify_${tableName}`
          );

          if (confirmed) {
            console.log(`[SyncVerify] ✅ ${tableName}/${record.id}: confirmed synced (response was slow).`);
            const current = await tabela.get(record.id);
            if (current && sameTimestamp(current.updatedAt, record.updatedAt)) {
              await tabela.update(record.id, {
                syncStatus: 'synced',
                dataVerifiedAt: new Date(),
                syncError: null,
                syncAttempts: 0
              });
            }
            return true;
          }
        } catch {
          // Verification GET itself failed — fall through to normal error handling
        }
      }

      const shouldMarkFailed = attempts >= 3;

      console.error(`[SyncFailure] ❌ Error in ${tableName}/${record.id}:`, errorMessage(err));

      const current = await tabela.get(record.id);
      if (current?.syncStatus === 'synced' && sameTimestamp(current.updatedAt, record.updatedAt)) {
        return true;
      }
      if (current && sameTimestamp(current.updatedAt, record.updatedAt)) {
        await tabela.update(record.id, {
          syncStatus: shouldMarkFailed ? 'failed' : 'pending',
          syncError: errorMessage(err),
          syncAttempts: attempts
        });
      }
      return false;
    } finally {
      activePushes.delete(key);
    }
  },

  /**
   * getAll: Returns local data immediately + triggers background refresh
   */
  async getAll<T extends { dataVerifiedAt?: Date }>(
    dexieTable: SyncableTable,
    fetchRemote: () => Promise<T[]>,
    ttlMs: number
  ): Promise<T[]> {
    const local = (await dexieTable.toArray()) as unknown as T[];
    
    // Check if we should refresh based on TTL
    const verifiedTimes = local
      .map((item) => item.dataVerifiedAt?.getTime())
      .filter((t): t is number => !!t);

    const oldestVerified = verifiedTimes.length > 0 ? Math.min(...verifiedTimes) : 0;
    const isStale = local.length === 0 || Date.now() - oldestVerified > ttlMs;

    if (isStale && navigator.onLine) {
      fetchRemote().then(async (remoteData: T[]) => {
        for (const item of remoteData) {
          await RepositoryService.mergeRemoteRecord(dexieTable, item as unknown as SyncableRecord, { label: 'refresh remoto' });
        }
      }).catch(err => console.warn(`[Repository] Background fetch failed:`, err));
    }

    return local;
  },

  /**
   * processQueue: Processes items individually (sequential)
   * Best for large payloads like photos
   */
  async processQueue<T extends RegistroEnfileirado>(tableName: string, dexieTable: Table<T, string>, mapToPostgres: (item: T) => LinhaPostgres) {
    if (!navigator.onLine) return;
 
    const pending = await dexieTable.where('syncStatus').equals('pending').toArray();
    for (const item of pending) {
      await RepositoryService.pushToRemote(tableName, item, dexieTable, mapToPostgres);
    }
  },
 
  /**
   * processBulkQueue: Processes all items in a single network call (batch)
   * Best for light metadata (clients, inspections, responses, schedules)
   */
  async processBulkQueue<T extends RegistroEnfileirado>(tableName: string, dexieTable: Table<T, string>, mapToPostgres: (item: T) => LinhaPostgres) {
    if (!navigator.onLine) return;
    // Mesma visao restrita do `pushToRemote`: Dexie recusa `update` com o generico aberto.
    const tabela = dexieTable as unknown as SyncableTable;
 
    const tenantId = useAuthStore.getState().tenantInfo?.tenantId;
    const queuedItems = (await dexieTable
      .where('syncStatus')
      .equals('pending')
      .toArray())
      .filter((item) => !activePushes.has(syncKey(tableName, item.id)));

    const blockedItems = TENANT_SCOPED_TABLES.has(tableName)
      ? queuedItems.filter((item) => !item.tenantId && !tenantId)
      : [];

    for (const item of blockedItems) {
    // Dexie tipa `update` sobre o generico ainda aberto e, assim, recusa ate as chaves que
    // `SyncableRecord` garante. Esta visao restringe a tabela ao que estas funcoes escrevem.
    const tabela = dexieTable as unknown as SyncableTable;
      await tabela.update(item.id, {
        syncStatus: 'pending',
        syncError: 'Aguardando tenantId para sincronizar'
      });
    }

    const items = queuedItems
      .filter((item) => !blockedItems.some((blocked) => blocked.id === item.id))
      .map((item) => (!item.tenantId && tenantId ? { ...item, tenantId } : item));

    for (const item of items) {
      const current = await tabela.get(item.id);
      if (item.tenantId && current?.tenantId !== item.tenantId) {
        await tabela.update(item.id, { tenantId: item.tenantId });
      }
    }
 
    if (items.length === 0) return;
 
    const ids = items.map((i) => i.id);
    console.log(`[Repository] 📦 Iniciando Chunked Bulk Upsert para ${tableName} (${items.length} itens total)...`);
 
    try {
      // 1. Mark as 'syncing' locally
      await tabela.where('id').anyOf(ids).modify({ syncStatus: 'syncing' });
 
      // 2. Prepare payload and Chunk it (max 5 items per request)
      const mappedArray = items.map(mapToPostgres);
      const CHUNK_SIZE = bulkChunkSize(tableName);
      const chunks = [];
      for (let i = 0; i < mappedArray.length; i += CHUNK_SIZE) {
        chunks.push(mappedArray.slice(i, i + CHUNK_SIZE));
      }
 
      // 3. Sequential Chunk Processing
      let processedCount = 0;
      for (const chunk of chunks) {
        processedCount += chunk.length;
        console.log(`[Repository] 🚀 Sending chunk of ${chunk.length} to ${tableName} (${processedCount}/${items.length})...`);
        
        const { error } = await withTimeout(
          supabase.from(tableName).upsert(chunk),
          pushTimeoutMs(tableName),
          `BulkPush_${tableName}`
        );
 
        if (error) throw error;
      }
 
      // 4. Success: Mark as synced only if no newer local edit happened
      // during the network request.
      const verifiedAt = new Date();
      for (const item of items) {
        const current = await tabela.get(item.id);
        if (current && sameTimestamp(current.updatedAt, item.updatedAt)) {
          await tabela.update(item.id, {
            syncStatus: 'synced',
            dataVerifiedAt: verifiedAt,
            syncError: null,
            syncAttempts: 0
          });
        } else if (current) {
          await tabela.update(item.id, { syncStatus: 'pending' });
        }
      }
 
      console.log(`[Repository] ✅ Bulk Upsert completo para ${tableName}.`);
    } catch (err) {
      console.error(`[Repository] ❌ Erro no Bulk Upsert para ${tableName}:`, errorMessage(err));

      // 5. Error handling per item — if the chunk timed out, verify each record
      // individually before marking as failed (the server may have persisted them).
      const isTimeout = errorMessage(err).startsWith('TIMEOUT');
      for (const item of items) {
        const attempts = (item.syncAttempts || 0) + 1;
        const shouldMarkFailed = attempts >= 3;
        const current = await tabela.get(item.id);
        if (!current) continue;
        if (current.syncStatus === 'synced' && sameTimestamp(current.updatedAt, item.updatedAt)) continue;

        if (isTimeout && navigator.onLine) {
          try {
            const confirmed = await confirmRemoteTimestamp(
              tableName,
              item.id,
              item.updatedAt,
              `BulkVerify_${tableName}`
            );
            if (confirmed) {
              if (sameTimestamp(current.updatedAt, item.updatedAt)) {
                await tabela.update(item.id, {
                  syncStatus: 'synced',
                  dataVerifiedAt: new Date(),
                  syncError: null,
                  syncAttempts: 0
                });
              }
              continue; // verified synced — skip the error update below
            }
          } catch { /* fall through */ }
        }

        if (sameTimestamp(current.updatedAt, item.updatedAt)) {
          await tabela.update(item.id, {
            syncStatus: shouldMarkFailed ? 'failed' : 'pending',
            syncError: errorMessage(err),
            syncAttempts: attempts
          });
        }
      }
    }
  }
};
