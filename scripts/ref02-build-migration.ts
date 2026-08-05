// REF-02 — gera a migration que carrega a biblioteca curada em `legislations`.
//
//   npx tsx scripts/ref02-build-migration.ts
//
// Por que gerar em vez de escrever SQL à mão: a reconciliação entre as linhas que
// já existem no banco e as entradas da biblioteca é feita pela chave canônica
// (canonicalLegislationKey), que é código TypeScript. Reimplementar a
// normalização em PL/pgSQL criaria uma segunda cópia da regra — foi exatamente
// esse o defeito que o REF-02 removeu de pdfGenerator.ts. Aqui a regra é usada
// uma vez, offline, e o resultado sai como UPDATE/INSERT explícitos e revisáveis.
//
// O snapshot de `legislations` abaixo é de 05/08/2026, projeto pfjacmawaigndqclgvpn:
//   select json_agg(json_build_array(id::text, name) order by name) from legislations;
// Se o banco mudar, reexecute a consulta, atualize DB_SNAPSHOT e regenere.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGISLATION_LIBRARY } from '../src/data/legislationLibrary';
import { canonicalLegislationKey } from '../src/utils/legislationRefs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DB_SNAPSHOT: [id: string, name: string][] = [
  ['6d3f480f-35b8-49e5-b06b-98278daecba3', 'ABNT NBR 9050'],
  ['b1692068-5748-4ae5-af0b-597ff880e863', 'CBO 5162-10 - Cuidador de Idosos'],
  ['19d10488-fca2-4791-bef2-011fc9c29a46', 'Constituição da República Federativa do Brasil'],
  ['0184e2c4-b66e-4614-b75d-65f0b14e3ba8', 'Decreto Municipal 1.601/1992 (RJ Capital)'],
  ['f44ec428-2308-4457-91a3-c74b1c3a5721', 'Decreto Municipal nº 17.944/2022 - Belo Horizonte'],
  ['6ae8b52a-a87b-402c-a6eb-1d1de15e61d9', 'Decreto Nº 57501 DE 30/01/2026'],
  ['1789b058-ee5d-45fc-ade8-11c35f860119', 'Lei Federal nº 10.741/2003'],
  ['73ebc7a1-e317-434c-904f-c95a9ff864ee', 'Lei Federal nº 14.423/2022'],
  ['c85daa03-c1cf-485b-9659-92f20e41e052', 'Lei Federal nº 14.602/2023'],
  ['7fffb46e-0ebe-4f9b-b5db-a0d38f1abcd8', 'Lei Federal nº 6.437/1977'],
  ['00fd31f3-dc5c-4729-a3cd-20609b7df60b', 'Lei Federal nº 8.078/1990'],
  ['3c30f258-260a-4fde-b649-b22b883a19a7', 'Lei Federal nº 8.080/1990'],
  ['e22cce96-a538-4883-a039-ce781525d305', 'Lei Federal nº 8.842/1994'],
  ['3ceeefc4-e5da-4a4f-bec2-f037bcaa0a87', 'Lei Municipal nº 7.031/1996 - Belo Horizonte'],
  ['5fa8df23-8b58-4800-ab47-516ebfbf4002', 'Lei Municipal nº 7.930/1999 - Belo Horizonte'],
  ['92d27e75-244c-4e71-be35-4a965bdddc30', 'Lei Municipal RJ nº 8.618/2024'],
  ['fa9ebc85-4b9a-46ea-a58d-b2b039098083', 'Lei Ordinária RJ nº 8.049/2018'],
  ['d8e41207-0873-4213-a0b0-f3f2ff8962f2', 'NR-32'],
  ['920d4eaa-d278-40ba-8bde-1bc4b018d91a', 'Parecer COFEN nº 022/2022'],
  ['f3f7a46b-7feb-435d-8231-39213eefc754', 'Portaria 2619/2011 (SP Capital)'],
  ['40d6dc14-1707-444d-8a62-c34f40a20d91', 'Portaria CVS 5/2013'],
  ['f8a1e953-a9e1-4d48-9641-6f76aec941ee', 'Portaria SMS nº 12/2015 - Belo Horizonte'],
  ['34ae3cbb-7d60-4b5d-b561-5ad71987d77d', 'Portaria SMSA/SUS-BH nº 0221/2022'],
  ['4a4cd390-a864-48e5-bc71-8870566371c3', 'Portaria SVS/MS nº 344/1998'],
  ['c8b239ac-f650-43c9-9989-cfcdefb7ac2e', 'RDC ANVISA nº 15/2012'],
  ['ecec061a-bc56-434c-8b05-9706bbd5258c', 'RDC ANVISA nº 216/2004'],
  ['06ecbc90-58a5-4d29-8209-f41a1fa266ea', 'RDC ANVISA nº 222/2018'],
  ['0c6871f2-2e0f-4273-8d59-4f999fa38013', 'RDC ANVISA nº 36/2013'],
  ['88f74734-dac2-4f9a-bfa9-20c05ceee1f4', 'RDC ANVISA nº 50/2002'],
  ['9b5af7b2-4f53-45d9-9b57-092cef99069a', 'RDC ANVISA nº 502/2021'],
  ['9ce086e8-fce0-4383-a179-bc677b3cdfcf', 'RDC ANVISA nº 63/2011'],
  ['826e9660-e6ec-484b-a2c7-f94ae9360560', 'RDC ANVISA nº 751/2022'],
  ['39fe1c06-6d02-44fd-b282-d434b9ff3c57', 'RDC Nº 7/2010'],
  ['84e2a4ed-1b45-4121-8dfa-e12dc728c206', 'Resolução CNDI nº 33/2017'],
  ['a2d2e21f-e1cc-41a3-bb59-42a26ee4836d', 'Resolução COFEN nº 450/2013'],
  ['a814841c-be14-44f1-b8eb-f970fd19d72c', 'Resolução COFEN nº 557/2017'],
  ['cba03998-630b-476c-87ac-f317e310ba9f', 'Resolução COFEN nº 619/2019'],
  ['e58a2001-b794-4c20-bcea-84e8fce9d87b', 'Resolução COFEN nº 725/2023'],
  ['002394ff-0fd3-4483-85e4-c22cbc5ecf12', 'Resolução COFEN nº 746/2024'],
  ['7bbe8549-dc6e-4a72-92fc-83f4249c397e', 'Resolução COFEN nº 787/2025'],
  ['36d32187-10a3-4531-90f5-5d11a1773c0e', 'Resolução SES Nº 1568/2017 (RJ)'],
  ['2b1ab37f-6dd1-4ce9-84b7-2ed8817538e7', 'Resolução SES/MG nº 7.426/2021'],
];

function lit(value: string | null | undefined): string {
  if (value == null) return 'null';
  return `'${value.replace(/'/g, "''")}'`;
}

function arrayLit(values?: readonly string[]): string {
  if (!values || values.length === 0) return 'null';
  return `array[${values.map(lit).join(', ')}]::text[]`;
}

const dbByKey = new Map<string, { id: string; name: string }>();
const dbColisoes: string[] = [];
for (const [id, name] of DB_SNAPSHOT) {
  const key = canonicalLegislationKey(name);
  if (dbByKey.has(key)) dbColisoes.push(`${key}: ${dbByKey.get(key)!.name} / ${name}`);
  else dbByKey.set(key, { id, name });
}
if (dbColisoes.length) {
  throw new Error(`Duas linhas de legislations com a mesma chave canônica:\n${dbColisoes.join('\n')}`);
}

const atualizar: string[] = [];
const inserir: string[] = [];
const renomeados: string[] = [];

for (const entry of LEGISLATION_LIBRARY) {
  const key = canonicalLegislationKey(entry.name);
  const existente = dbByKey.get(key);
  const campos = [
    `name = ${lit(entry.name)}`,
    `summary = ${lit(entry.summary)}`,
    `url = ${lit(entry.url)}`,
    `uf = ${lit(entry.uf ?? null)}`,
    `segments = ${arrayLit(entry.segments)}`,
  ];

  if (existente) {
    if (existente.name !== entry.name) renomeados.push(`${existente.name}  →  ${entry.name}`);
    atualizar.push(
      `-- ${key}${existente.name !== entry.name ? `  (renomeia: ${existente.name})` : ''}\n` +
      `update public.legislations set\n  ${campos.join(',\n  ')}\nwhere id = ${lit(existente.id)};`
    );
  } else {
    inserir.push(
      `-- ${key}\n` +
      `insert into public.legislations (name, summary, url, uf, segments)\n` +
      `select ${lit(entry.name)}, ${lit(entry.summary)}, ${lit(entry.url)}, ${lit(entry.uf ?? null)}, ${arrayLit(entry.segments)}\n` +
      `where not exists (select 1 from public.legislations where name = ${lit(entry.name)});`
    );
  }
}

const naoTocadas = [...dbByKey.entries()]
  .filter(([key]) => !LEGISLATION_LIBRARY.some(e => canonicalLegislationKey(e.name) === key))
  .map(([key, row]) => `${key} — ${row.name}`);

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const header = `-- REF-02 — carga da biblioteca de legislações saneada.
--
-- GERADO por scripts/ref02-build-migration.ts a partir de
-- src/data/legislationLibrary.ts. Não editar à mão: altere a biblioteca e
-- regenere, senão o código e o banco divergem de novo.
--
-- O que faz:
--   * atualiza as ${atualizar.length} linhas que já existem (ementa, URL oficial, uf, segmentos),
--     casadas por chave canônica — não por nome, porque grafias como
--     "Decreto Nº 57501 DE 30/01/2026" e "Decreto Rio nº 57.501/2026" são o
--     mesmo ato e um upsert por nome criaria duplicata;
--   * insere as ${inserir.length} entradas novas, de forma idempotente (insert ... where not exists).
--
-- O que NÃO faz, de propósito:
--   * não apaga nenhuma linha. A biblioteca é editável pela LegislationsManager;
--     linha criada pela Ester não pode sumir numa migration. As linhas do banco
--     sem correspondência na biblioteca ficam como estão:
${(naoTocadas.length ? naoTocadas : ['(nenhuma)']).map(n => `--       ${n}`).join('\n')}
--   * não mexe em checklist_items. O backfill de legislation_url é o
--     scripts/ref02-backfill-item-urls.mjs, que reusa a mesma resolução do app.
--
-- Reexecutável: os updates são por id e os inserts são condicionais.

begin;
`;

const sql = [
  header,
  '-- ── Linhas existentes: ementa, URL oficial, UF e segmentos ──────────────────',
  atualizar.join('\n\n'),
  '',
  '-- ── Atos citados pelos roteiros que ainda não estavam na biblioteca ─────────',
  inserir.join('\n\n'),
  '',
  'commit;',
  '',
].join('\n');

const outPath = path.join(root, 'supabase', 'migrations', `${stamp}_ref02_legislation_library.sql`);
fs.writeFileSync(outPath, sql, 'utf-8');

console.log('=== REF-02: migration gerada ===');
console.log('arquivo           :', path.relative(root, outPath));
console.log('linhas atualizadas:', atualizar.length);
console.log('linhas inseridas  :', inserir.length);
console.log('renomeadas        :', renomeados.length);
renomeados.forEach(r => console.log('   ', r));
console.log('sem correspondência na biblioteca (mantidas):', naoTocadas.length);
naoTocadas.forEach(n => console.log('   ', n));
