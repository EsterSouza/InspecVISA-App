// REF-02 — dump de LEITURA do Supabase de produção para trabalho local.
// Gera scripts/ref01-raw.json e scripts/ref01-legislations.json (não versionados),
// os mesmos arquivos que scripts/ref01-build-inventory.ts consome.
//
//   node scripts/ref02-dump.mjs
//
// Usa SUPABASE_SERVICE_ROLE_KEY de .env.vercel.production.local porque a chave anon
// não enxerga checklist_items/legislations sob RLS. SOMENTE SELECT.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnv(file) {
  if (!fs.existsSync(path.join(root, file))) return {};
  return Object.fromEntries(
    fs.readFileSync(path.join(root, file), 'utf-8')
      .split(/\r?\n/)
      .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
  );
}

const env = { ...readEnv('.env'), ...readEnv('.env.vercel.production.local') };
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function all(table, select, order) {
  const out = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select(select).order(order).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

const templates = await all('checklist_templates', 'id,name,category', 'name');
const sections = await all('checklist_sections', 'id,template_id,title,order', 'id');
const items = await all('checklist_items', 'id,section_id,description,legislation_name,legislation_url,requirement_type,weight,is_critical,order', 'id');
const legislations = await all('legislations', 'id,name,summary,url,uf,segments', 'name');

const tplById = new Map(templates.map(t => [t.id, t]));
const secById = new Map(sections.map(s => [s.id, s]));

const raw = items.map(i => {
  const sec = secById.get(i.section_id);
  const tpl = sec ? tplById.get(sec.template_id) : null;
  return {
    item_id: i.id,
    description: i.description,
    legislation_name: i.legislation_name,
    legislation_url: i.legislation_url,
    requirement_type: i.requirement_type,
    weight: i.weight,
    is_critical: i.is_critical,
    section_id: i.section_id,
    section_title: sec ? sec.title : null,
    template_id: tpl ? tpl.id : null,
    template_name: tpl ? tpl.name : null,
    template_category: tpl ? tpl.category : null,
  };
});

fs.writeFileSync(path.join(root, 'scripts/ref01-raw.json'), JSON.stringify(raw, null, 1), 'utf-8');
fs.writeFileSync(path.join(root, 'scripts/ref01-legislations.json'), JSON.stringify(legislations, null, 1), 'utf-8');
console.log('templates', templates.length, '| sections', sections.length, '| items', raw.length, '| legislations', legislations.length);
console.log('itens sem template resolvido:', raw.filter(r => !r.template_id).length);
