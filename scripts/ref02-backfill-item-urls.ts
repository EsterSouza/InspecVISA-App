// REF-02 — preenche checklist_items.legislation_url a partir da biblioteca curada.
//
//   npx tsx scripts/ref02-backfill-item-urls.ts            # simulação (padrão)
//   npx tsx scripts/ref02-backfill-item-urls.ts --apply    # grava em produção
//
// Precisa de VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (a chave
// anon não enxerga checklist_items sob RLS). Passe a service role por variável de
// ambiente, não por arquivo commitado.
//
// POR QUE SCRIPT E NÃO MIGRATION SQL
// A resolução item → norma → URL é `resolveLegislationUrl` (src/utils/legislationRefs.ts),
// que já é usada pelo app na tela e no PDF. Reescrevê-la em PL/pgSQL criaria uma
// segunda cópia da regra, que é exatamente o defeito que o REF-02 removeu do
// pdfGenerator.ts. Aqui a mesma função decide o valor gravado.
//
// APLICAR EM PRODUÇÃO EXIGE AUTORIZAÇÃO EXPLÍCITA DA ESTER (regra 1 do handoff).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { resolveLegislationUrl, resolveCitedLegislations } from '../src/utils/legislationRefs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Node não carrega .env sozinho. A variável de ambiente, quando existe, ganha do
// arquivo — para dar como rodar apontando para outro projeto sem editar o .env.
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

const APPLY = process.argv.includes('--apply');
const url = process.env.VITE_SUPABASE_URL || fromEnvFile('VITE_SUPABASE_URL');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || fromEnvFile('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY — nem no ambiente, nem no .env.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function readAll(table: string, select: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const items = await readAll('checklist_items', 'id,legislation_name,legislation_url,requirement_type');

const paraAtualizar: any[] = [];
const jaCorretos: any[] = [];
const semResolucao: any[] = [];

for (const item of items) {
  const alvo = resolveLegislationUrl(item.legislation_name) || null;
  if (!alvo) {
    // Sem ato catalogável na citação. Boa prática pode ficar assim por definição;
    // item legal nessa situação é lacuna real e sai no relatório abaixo.
    semResolucao.push(item);
    continue;
  }
  if (item.legislation_url === alvo) jaCorretos.push(item);
  else paraAtualizar.push({ ...item, alvo });
}

const legalSemResolucao = semResolucao.filter(i => i.requirement_type !== 'good_practice');

console.log('=== REF-02 · backfill de legislation_url ===');
console.log('modo                       :', APPLY ? 'APLICANDO' : 'simulação (use --apply para gravar)');
console.log('itens lidos                :', items.length);
console.log('já com a URL da biblioteca :', jaCorretos.length);
console.log('a atualizar                :', paraAtualizar.length);
console.log('  dos quais estavam vazios :', paraAtualizar.filter(i => !i.legislation_url).length);
console.log('  dos quais tinham outra   :', paraAtualizar.filter(i => i.legislation_url).length);
console.log('sem ato catalogável        :', semResolucao.length, `(legais: ${legalSemResolucao.length})`);

if (legalSemResolucao.length) {
  console.log('\n--- itens legais que continuarão sem URL (citação sem ato reconhecível) ---');
  for (const item of legalSemResolucao) {
    const citados = resolveCitedLegislations(item.legislation_name).map(c => c.key).join(', ');
    console.log(` ${item.id}  ${JSON.stringify(item.legislation_name)}  [${citados}]`);
  }
}

if (!APPLY) {
  console.log('\nNada foi gravado. Reexecute com --apply após autorização explícita.');
  process.exit(0);
}

let gravados = 0;
for (let i = 0; i < paraAtualizar.length; i += 100) {
  const lote = paraAtualizar.slice(i, i + 100);
  for (const item of lote) {
    const { error } = await sb
      .from('checklist_items')
      .update({ legislation_url: item.alvo })
      .eq('id', item.id);
    if (error) throw new Error(`item ${item.id}: ${error.message}`);
    gravados++;
  }
  console.log(`  ${gravados}/${paraAtualizar.length}`);
}
console.log('\nConcluído. Itens atualizados:', gravados);
console.log('Reexecutar é seguro: a segunda passada encontra tudo já correto e não grava nada.');
