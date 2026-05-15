import { db } from '../db/database';
import { supabase } from '../lib/supabase';

const PRE_BUNDLE_BACKUP_FLAG = 'inspecvisa-pre-bundle-backup-created';
const DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'deletedAt',
  'dataVerifiedAt',
  'inspectionDate',
  'completedAt',
  'takenAt',
  'scheduledAt',
  'timestamp',
];

function reviveDate(value: unknown) {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}

function reviveDateFields<T extends Record<string, any>>(record: T): T {
  const revived: Record<string, any> = { ...record };
  for (const field of DATE_FIELDS) {
    if (field in revived) {
      revived[field] = reviveDate(revived[field]);
    }
  }
  return revived as T;
}

function reviveRecords<T extends Record<string, any>>(records: T[]) {
  return records.map(reviveDateFields);
}

async function markRecordsSynced(content: any) {
  const data = content?.data || {};
  const verifiedAt = new Date();
  const mark = { syncStatus: 'synced' as const, syncError: undefined, syncAttempts: 0, dataVerifiedAt: verifiedAt };

  if (Array.isArray(data.clients) && data.clients.length > 0) {
    await db.clients.where('id').anyOf(data.clients.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.inspections) && data.inspections.length > 0) {
    await db.inspections.where('id').anyOf(data.inspections.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.responses) && data.responses.length > 0) {
    await db.responses.where('id').anyOf(data.responses.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.photos) && data.photos.length > 0) {
    await db.photos.where('id').anyOf(data.photos.map((item: any) => item.id)).modify(mark);
  }
  if (Array.isArray(data.schedules) && data.schedules.length > 0) {
    await db.schedules.where('id').anyOf(data.schedules.map((item: any) => item.id)).modify(mark);
  }
}

async function syncBackupToCloud(content: any) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessao expirada. Entre novamente antes de importar o backup.');

  const response = await fetch('/api/sync-backup-import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(content),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || `Resgate do backup falhou (${response.status}).`);
  }

  await markRecordsSynced(content);
  return result.counts as Record<string, number>;
}

async function buildDatabaseBackupPayload(reason = 'manual-export') {
  const clients = await db.clients.toArray();
  const inspections = await db.inspections.toArray();
  const responses = await db.responses.toArray();
  const photos = await db.photos.toArray();
  const schedules = await db.schedules.toArray();
  const templates = await db.templates.toArray();
  const settings = localStorage.getItem('inspec-visa-settings');

  return {
    version: '2.0',
    reason,
    timestamp: new Date().toISOString(),
    data: {
      clients,
      inspections,
      responses,
      photos,
      schedules,
      templates,
      settings: settings ? JSON.parse(settings) : null
    }
  };
}

export async function ensurePreBundleBackup(): Promise<string> {
  const existingId = localStorage.getItem(PRE_BUNDLE_BACKUP_FLAG);
  if (existingId) return existingId;

  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pre-bundle-${Date.now()}`;

  const payload = await buildDatabaseBackupPayload('pre-bundle-sync');
  await db.local_backups.put({
    id,
    createdAt: new Date(),
    reason: 'pre-bundle-sync',
    payload
  });

  localStorage.setItem(PRE_BUNDLE_BACKUP_FLAG, id);
  console.log(`[Backup] Pre-bundle local backup created: ${id}`);
  return id;
}

export async function exportDatabase() {
  const backup = await buildDatabaseBackupPayload();

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspec-visa-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportInternalBackups() {
  const backups = await db.local_backups.toArray();
  const payload = {
    version: 'internal-backups-1.0',
    timestamp: new Date().toISOString(),
    count: backups.length,
    backups,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspec-visa-backups-internos-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDatabase(jsonFile: File, options: { syncToCloud?: boolean } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (!content.data || !content.version) {
          throw new Error('Arquivo de backup inválido.');
        }

        const { clients, inspections, responses, photos, schedules, templates, settings } = content.data;

        // Transactional import
        await db.transaction('rw', [db.clients, db.inspections, db.responses, db.photos, db.schedules, db.templates], async () => {
          // We use put (upsert) to avoid duplicates if importing same data twice
          if (Array.isArray(clients)) await db.clients.bulkPut(reviveRecords(clients));
          if (Array.isArray(inspections)) await db.inspections.bulkPut(reviveRecords(inspections));
          if (Array.isArray(responses)) await db.responses.bulkPut(reviveRecords(responses));
          if (Array.isArray(photos)) await db.photos.bulkPut(reviveRecords(photos));
          if (Array.isArray(schedules)) await db.schedules.bulkPut(reviveRecords(schedules));
          if (Array.isArray(templates)) await db.templates.bulkPut(reviveRecords(templates));
        });

        if (settings) {
          localStorage.setItem('inspec-visa-settings', JSON.stringify(settings));
          // Note: Zustand state won't update automatically without a reload or manual trigger
        }

        if (options.syncToCloud) {
          const counts = await syncBackupToCloud(content);
          resolve(
            `Backup importado e enviado para a nuvem. ` +
            `Clientes: ${counts.clients || 0}, inspeções: ${counts.inspections || 0}, respostas: ${counts.responses || 0}, fotos: ${counts.photos || 0}, agendamentos: ${counts.schedules || 0}.`
          );
          return;
        }

        resolve('Importação concluída com sucesso! Recarregando aplicação...');
      } catch (err) {
        reject(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
      }
    };
    reader.onerror = () => reject('Erro ao ler arquivo.');
    reader.readAsText(jsonFile);
  });
}
