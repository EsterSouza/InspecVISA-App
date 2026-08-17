#!/usr/bin/env node
/**
 * Teto de lint — DEBT-02.
 *
 * O `npm run lint` ainda falha: sobram centenas de `@typescript-eslint/no-explicit-any`,
 * que estão sendo zerados por fatia (uma área por commit). Enquanto isso, este script é o
 * que roda no CI: ele não exige zero, exige **não piorar**. Se uma área passar do teto
 * registrado em `scripts/lint-teto.json`, o CI falha dizendo qual foi e quanto subiu.
 *
 * Ao terminar uma fatia, rodar `node scripts/lint-teto.mjs --gravar` para baixar o teto.
 * Quando tudo chegar a zero, este script sai de cena e o CI passa a rodar `npm run lint`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivoTeto = join(raiz, 'scripts', 'lint-teto.json');
const eslintBin = join(raiz, 'node_modules', 'eslint', 'bin', 'eslint.js');
const gravar = process.argv.includes('--gravar');

/** Mesma divisão que o handoff usa para as fatias: o diretório de primeiro nível,
 *  e o arquivo inteiro quando ele mora na raiz. */
function area(caminhoAbsoluto) {
  const rel = relative(raiz, caminhoAbsoluto).split(sep).join('/');
  const partes = rel.split('/');
  if (partes.length === 1) return rel;
  if (partes[0] === 'src' || partes[0] === 'supabase') return partes.slice(0, 2).join('/');
  return partes[0];
}

let saida;
try {
  // Chama o binário do eslint pelo próprio Node, sem `npx` e sem `shell: true`: com shell os
  // argumentos vão concatenados sem escape, e `npx.cmd` não roda em todo terminal do Windows.
  saida = execFileSync(process.execPath, [eslintBin, '.', '-f', 'json'], {
    cwd: raiz,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // O eslint sai com código 1 quando encontra erro — que é o caso esperado aqui.
  saida = err.stdout;
  if (!saida) {
    console.error('[lint-teto] o eslint não devolveu JSON:', err.message);
    process.exit(2);
  }
}

const atual = {};
for (const arquivo of JSON.parse(saida)) {
  if (!arquivo.messages.length) continue;
  const chave = area(arquivo.filePath);
  atual[chave] = (atual[chave] || 0) + arquivo.messages.length;
}
const total = Object.values(atual).reduce((soma, n) => soma + n, 0);

if (gravar) {
  const ordenado = Object.fromEntries(Object.entries(atual).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(arquivoTeto, `${JSON.stringify({ total, areas: ordenado }, null, 2)}\n`, 'utf8');
  console.log(`[lint-teto] teto regravado: ${total} problemas em ${Object.keys(ordenado).length} áreas.`);
  process.exit(0);
}

const teto = JSON.parse(readFileSync(arquivoTeto, 'utf8'));
const estouros = [];
for (const [chave, quantidade] of Object.entries(atual)) {
  const limite = teto.areas[chave] ?? 0;
  if (quantidade > limite) estouros.push(`${chave}: ${quantidade} (teto ${limite})`);
}

if (estouros.length) {
  console.error('[lint-teto] lint piorou nestas áreas:');
  for (const linha of estouros) console.error(`  - ${linha}`);
  console.error('\nCorrija, ou rode `node scripts/lint-teto.mjs --gravar` se o aumento for intencional.');
  process.exit(1);
}

const folga = teto.total - total;
console.log(
  folga > 0
    ? `[lint-teto] ok: ${total} problemas, ${folga} abaixo do teto (${teto.total}). Rode com --gravar para baixar o teto.`
    : `[lint-teto] ok: ${total} problemas, no teto.`
);
