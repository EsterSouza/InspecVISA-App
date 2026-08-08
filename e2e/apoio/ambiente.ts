/**
 * Credenciais e endereço do ambiente de homologação.
 *
 * Nada disto é versionado: o `.env.homolog` está no `.gitignore` e no CI os
 * valores chegam por secrets. O seed que cria essas contas é
 * `supabase/homolog/seed.sql`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** O Playwright não lê `.env` sozinho, e o ambiente ganha do arquivo. */
export function carregaEnvHomolog(): void {
  const arquivo = path.join(raiz, '.env.homolog');
  if (!fs.existsSync(arquivo)) return;

  for (const linha of fs.readFileSync(arquivo, 'utf-8').split(/\r?\n/)) {
    if (linha.trimStart().startsWith('#') || !linha.includes('=')) continue;
    const chave = linha.slice(0, linha.indexOf('=')).trim();
    const valor = linha.slice(linha.indexOf('=') + 1).trim().replace(/^"|"$/g, '');
    if (chave && process.env[chave] === undefined) process.env[chave] = valor;
  }
}

export function baseURL(): string {
  return (process.env.E2E_BASE_URL || 'http://localhost:4173').replace(/\/$/, '');
}

/** Falha o teste com uma mensagem útil em vez de tentar logar com `undefined`. */
export function exige(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Falta ${nome}. Preencha o .env.homolog (ou os secrets do CI) — ver docs/rollout.md.`
    );
  }
  return valor;
}

export const contas = {
  staff: () => ({ email: exige('E2E_STAFF_EMAIL'), senha: exige('E2E_STAFF_PASSWORD') }),
  portal: () => ({ email: exige('E2E_PORTAL_EMAIL'), codigo: exige('E2E_PORTAL_CODE') }),
  portalEmAtraso: () => ({
    email: exige('E2E_PORTAL_EMAIL_SUSPENSA'),
    codigo: exige('E2E_PORTAL_CODE_SUSPENSA'),
  }),
  portalOutroTenant: () => ({
    email: exige('E2E_PORTAL_EMAIL_OUTRO_TENANT'),
    codigo: exige('E2E_PORTAL_CODE_OUTRO_TENANT'),
  }),
};

/** Tudo que o seed cria carrega este prefixo. Serve para afirmar isolamento. */
export const PREFIXO_HOMOLOG = '[HOMOLOG]';
