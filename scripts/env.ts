// Credenciais do Supabase para os scripts de manutenção.
//
// O Node não carrega `.env` sozinho — o Vite carrega, e é por isso que o app
// funciona sem isto mas `npx tsx scripts/...` falhava com "Faltam VITE_SUPABASE_URL".
// A variável de ambiente, quando existe, ganha do arquivo: dá para apontar o
// script para outro projeto sem editar o `.env`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fromEnvFile(name: string): string | undefined {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#') || !line.includes('=')) continue;
    const chave = line.slice(0, line.indexOf('=')).trim();
    if (chave === name) return line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '');
  }
  return undefined;
}

/** URL + service role do Supabase, do ambiente ou do `.env`. Encerra o processo se faltar. */
export function requireSupabaseEnv(): { url: string; key: string } {
  const url = process.env.VITE_SUPABASE_URL || fromEnvFile('VITE_SUPABASE_URL');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || fromEnvFile('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY — nem no ambiente, nem no .env.');
    process.exit(1);
  }
  return { url, key };
}
