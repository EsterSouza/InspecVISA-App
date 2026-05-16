import { db } from '../db/database';

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

export async function importDatabase(jsonFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (!content.data || !content.version) {
          throw new Error('Arquivo de backup invalido.');
        }

        const { clients, inspections, responses, photos, schedules, templates, settings } = content.data;

        await db.transaction('rw', [db.clients, db.inspections, db.responses, db.photos, db.schedules, db.templates], async () => {
          if (Array.isArray(clients)) await db.clients.bulkPut(reviveRecords(clients));
          if (Array.isArray(inspections)) await db.inspections.bulkPut(reviveRecords(inspections));
          if (Array.isArray(responses)) await db.responses.bulkPut(reviveRecords(responses));
          if (Array.isArray(photos)) await db.photos.bulkPut(reviveRecords(photos));
          if (Array.isArray(schedules)) await db.schedules.bulkPut(reviveRecords(schedules));
          if (Array.isArray(templates)) await db.templates.bulkPut(reviveRecords(templates));
        });

        if (settings) {
          localStorage.setItem('inspec-visa-settings', JSON.stringify(settings));
        }

        resolve('Importacao concluida com sucesso! Recarregando aplicacao...');
      } catch (err) {
        reject(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
      }
    };
    reader.onerror = () => reject('Erro ao ler arquivo.');
    reader.readAsText(jsonFile);
  });
}
