import { db } from '../db/database';

export async function exportDatabase() {
  const clients = await db.clients.toArray();
  const inspections = await db.inspections.toArray();
  const responses = await db.responses.toArray();
  const photos = await db.photos.toArray();
  
  // Get settings from local storage if available, though it's managed by Zustand
  const settings = localStorage.getItem('inspec-visa-settings');
  
  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: {
      clients,
      inspections,
      responses,
      photos,
      settings: settings ? JSON.parse(settings) : null
    }
  };

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
          throw new Error('Arquivo de backup inválido.');
        }

        const { clients, inspections, responses, photos, settings } = content.data;

        // Transactional import
        await db.transaction('rw', [db.clients, db.inspections, db.responses, db.photos], async () => {
          // We use put (upsert) to avoid duplicates if importing same data twice
          if (clients) await db.clients.bulkPut(clients);
          if (inspections) await db.inspections.bulkPut(inspections);
          if (responses) await db.responses.bulkPut(responses);
          if (photos) await db.photos.bulkPut(photos);
        });

        if (settings) {
          localStorage.setItem('inspec-visa-settings', JSON.stringify(settings));
          // Note: Zustand state won't update automatically without a reload or manual trigger
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
