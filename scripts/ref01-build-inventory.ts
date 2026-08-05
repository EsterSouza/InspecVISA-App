// REF-01 — gera docs/referencias/inventario.csv a partir de um dump de
// checklist_items e legislations, consultados ao vivo no Supabase de produção
// (leitura, sem escrita). Reusa extractBaseLegislation e canonicalLegislationKey
// de src/utils/legislationRefs.ts — não reimplementa a normalização.
//
// Como reexecutar (ex.: depois do REF-02 mudar a biblioteca):
// 1. No MCP do Supabase (projeto pfjacmawaigndqclgvpn), rodar:
//
//    select ci.id as item_id, ci.legislation_name, ci.legislation_url,
//           ci.requirement_type, ct.id as template_id, ct.name as template_name
//    from checklist_items ci
//    join checklist_sections cs on cs.id = ci.section_id
//    join checklist_templates ct on ct.id = cs.template_id
//    order by ct.name, ci.id;
//
//    select id, name, url, uf, segments from legislations order by name;
//
// 2. Salvar os dois resultados como scripts/ref01-raw.json e
//    scripts/ref01-legislations.json (arrays JSON crus, UTF-8, não versionados —
//    são snapshot de produção, não fonte de verdade do repositório).
// 3. `npx tsx scripts/ref01-build-inventory.ts`
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBaseLegislation, canonicalLegislationKey } from '../src/utils/legislationRefs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RawItem {
  item_id: string;
  legislation_name: string;
  legislation_url: string | null;
  requirement_type: string | null;
  template_id: string;
  template_name: string;
}

interface RawLegislation {
  id: string;
  name: string;
  url: string;
  uf: string | null;
  segments: string[] | null;
}

const items: RawItem[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref01-raw.json'), 'utf-8'));
const legislations: RawLegislation[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref01-legislations.json'), 'utf-8'));

// Biblioteca indexada por chave canônica. Se duas entradas da biblioteca colidirem
// na mesma chave, é um problema da biblioteca em si (assunto do REF-02) — registramos
// e seguimos com a primeira encontrada.
const libraryByKey = new Map<string, RawLegislation>();
const libraryKeyCollisions: { key: string; names: string[] }[] = [];
for (const leg of legislations) {
  const key = canonicalLegislationKey(leg.name);
  if (libraryByKey.has(key)) {
    const existing = libraryByKey.get(key)!;
    let collision = libraryKeyCollisions.find(c => c.key === key);
    if (!collision) {
      collision = { key, names: [existing.name] };
      libraryKeyCollisions.push(collision);
    }
    collision.names.push(leg.name);
  } else {
    libraryByKey.set(key, leg);
  }
}

interface Entry {
  key: string;
  grafias: Set<string>;
  itemIds: Set<string>;
  templates: Set<string>;
}

const byKey = new Map<string, Entry>();
const itemsWithoutExtraction: { item_id: string; legislation_name: string; template_name: string }[] = [];
let totalCitations = 0;

for (const item of items) {
  const bases = extractBaseLegislation(item.legislation_name);
  if (bases.length === 0) {
    itemsWithoutExtraction.push({ item_id: item.item_id, legislation_name: item.legislation_name, template_name: item.template_name });
    continue;
  }
  for (const base of bases) {
    totalCitations++;
    const key = canonicalLegislationKey(base);
    let entry = byKey.get(key);
    if (!entry) {
      entry = { key, grafias: new Set(), itemIds: new Set(), templates: new Set() };
      byKey.set(key, entry);
    }
    entry.grafias.add(base);
    entry.itemIds.add(item.item_id);
    entry.templates.add(item.template_name);
  }
}

function csvField(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const rows = Array.from(byKey.values()).sort((a, b) => b.itemIds.size - a.itemIds.size || a.key.localeCompare(b.key));

const header = ['chave_canonica', 'grafias_encontradas', 'grafias_divergentes', 'itens_que_citam', 'roteiros', 'existe_em_legislations', 'legislation_url'];
const lines = [header.join(',')];

for (const row of rows) {
  const lib = libraryByKey.get(row.key);
  const grafiasArr = Array.from(row.grafias).sort();
  const line = [
    csvField(row.key),
    csvField(grafiasArr.join('; ')),
    csvField(grafiasArr.length > 1 ? 'sim' : 'não'),
    csvField(String(row.itemIds.size)),
    csvField(Array.from(row.templates).sort().join('; ')),
    csvField(lib ? 'sim' : 'não'),
    csvField(lib?.url || ''),
  ];
  lines.push(line.join(','));
}

const outPath = path.join(__dirname, '..', 'docs', 'referencias', 'inventario.csv');
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');

// Resumo para conferência manual — não faz parte do CSV.
console.log('=== REF-01: resumo ===');
console.log('Itens de checklist processados:', items.length);
console.log('Itens sem nenhuma referência reconhecida por extractBaseLegislation:', itemsWithoutExtraction.length);
console.log('Total de citações (item x ato citado, após dedup por item):', totalCitations);
console.log('Atos normativos distintos (chaves canônicas):', byKey.size);
console.log('Chaves canônicas com mais de uma grafia:', rows.filter(r => r.grafias.size > 1).length);
console.log('Chaves canônicas presentes em `legislations`:', rows.filter(r => libraryByKey.has(r.key)).length);
console.log('Colisões de chave canônica dentro da própria biblioteca:', libraryKeyCollisions.length);
if (libraryKeyCollisions.length > 0) {
  console.log(JSON.stringify(libraryKeyCollisions, null, 2));
}
if (itemsWithoutExtraction.length > 0) {
  console.log('--- itens sem extração reconhecida ---');
  console.log(JSON.stringify(itemsWithoutExtraction, null, 2));
}
console.log('CSV escrito em', outPath);
