// Somente leitura. Lista os itens legais sem legislation_url resolvível,
// com roteiro, seção e descrição — o script do REF-02 só imprime id + citação.
import { createClient } from '@supabase/supabase-js';
import { resolveLegislationUrl } from '../src/utils/legislationRefs';

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

async function readAll(table: string, select: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as any[]));
    if ((data as any[]).length < 1000) break;
  }
  return out;
}

const [items, secs, tpls] = await Promise.all([
  readAll('checklist_items', '*'),
  readAll('checklist_sections', 'id,title,template_id'),
  readAll('checklist_templates', '*'),
]);

const secById = new Map(secs.map((s: any) => [s.id, s]));
const tplById = new Map(tpls.map((t: any) => [t.id, t]));

const alvo = items.filter(
  (i: any) => i.requirement_type !== 'good_practice' && !resolveLegislationUrl(i.legislation_name)
);

console.log('total itens:', items.length);
console.log('legal:', items.filter((i: any) => i.requirement_type === 'legal').length);
console.log('good_practice:', items.filter((i: any) => i.requirement_type === 'good_practice').length);
console.log('alvo (legal sem URL resolvível):', alvo.length);
console.log('colunas do item:', Object.keys(items[0]).join(', '));

const linhas = alvo.map((i: any) => {
  const s: any = secById.get(i.section_id) || {};
  const t: any = tplById.get(s.template_id) || {};
  return {
    id: i.id,
    roteiro: t.name || '(?)',
    ativo: t.is_active,
    secao: s.title || '(?)',
    descricao: i.description || i.title || i.question || '',
    legislation: i.legislation_name,
    peso: i.weight,
    critico: i.is_critical,
  };
});

linhas.sort(
  (a, b) => a.roteiro.localeCompare(b.roteiro) || a.secao.localeCompare(b.secao) || a.descricao.localeCompare(b.descricao)
);

for (const l of linhas) {
  console.log(
    `\n[${l.roteiro}${l.ativo === false ? ' · ARQUIVADO' : ''}] § ${l.secao}\n  id: ${l.id}  peso=${l.peso} critico=${l.critico}\n  desc: ${l.descricao}\n  leg : ${JSON.stringify(l.legislation)}`
  );
}

console.log('\n=== por roteiro ===');
const porRoteiro = new Map<string, number>();
for (const l of linhas) {
  const k = `${l.roteiro}${l.ativo === false ? ' (ARQUIVADO)' : ''}`;
  porRoteiro.set(k, (porRoteiro.get(k) || 0) + 1);
}
for (const [k, v] of [...porRoteiro].sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`);

console.log('\n=== citações distintas ===');
const porCit = new Map<string, number>();
for (const l of linhas) porCit.set(l.legislation || '(vazio)', (porCit.get(l.legislation || '(vazio)') || 0) + 1);
for (const [k, v] of [...porCit].sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${JSON.stringify(k)}`);
