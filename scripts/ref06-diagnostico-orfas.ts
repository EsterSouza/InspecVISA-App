// REF-06 — mede o estrago real das respostas órfãs nos relatórios concluídos.
//
//   npx tsx scripts/ref06-diagnostico-orfas.ts            # censo + simulação por inspeção
//   npx tsx scripts/ref06-diagnostico-orfas.ts --itens    # lista item a item o que degrada
//
// SÓ LÊ. Nenhuma escrita, nem com flag.
//
// POR QUE ESTE SCRIPT EXISTE
// "303 item_id órfãos" não diz quanto relatório está degradado: um item_id órfão em
// `checklist_items` pode estar perfeitamente resolvido no relatório (suplemento regional,
// item do roteiro empacotado, snapshot congelado) ou pode cair na seção "Itens preservados
// do roteiro concluído" com a descrição trocada pelo texto da resposta. Quem decide é
// `resolveReportTemplate` — então o jeito honesto de medir é rodar a mesma função sobre os
// dados de produção, que é o que este script faz.
//
// Ele simula os dois caminhos que o app usa em InspectionSummary:
//   remoto  — inspeção enriquecida com city/state do cliente (fase 2, online)
//   dexie   — inspeção como volta do servidor, sem city/state (fase 1, e offline em
//             outro aparelho): `mapFromPostgres` não preenche esses campos e a coluna
//             nem existe em `inspections`, então o suplemento regional não é aplicado.
import { createClient } from '@supabase/supabase-js';
import { getTemplateById } from '../src/data/templates';
import { resolveReportTemplate } from '../src/utils/reportTemplate';
import type { ChecklistTemplate, Inspection, InspectionResponse } from '../src/types';
import { requireSupabaseEnv } from './env';
import {
  lerTudo,
  type LinhaCliente,
  type LinhaInspecao,
  type LinhaItem,
  type LinhaResposta,
  type LinhaRoteiro,
  type LinhaSecao,
} from './linhas';

const DETALHE = process.argv.includes('--itens');
const SECAO_DEGRADADA = 'sec-report-recovered';

const { url, key } = requireSupabaseEnv();
const sb = createClient(url, key, { auth: { persistSession: false } });

/** O roteiro congelado dentro do snapshot, sem o resto (que traz as fotos em base64). */
type LinhaVersao = { inspection_id: string; created_at: string; template: ChecklistTemplate | null };

const [inspecoes, clientes, respostas, tpls, secs, itens, versoes] = await Promise.all([
  lerTudo<LinhaInspecao>(sb, 'inspections', 'id,client_id,template_id,status,consultant_name,inspection_date,created_at,deleted_at'),
  lerTudo<LinhaCliente>(sb, 'clients', 'id,name,category,city,state,food_types'),
  lerTudo<Omit<LinhaResposta, 'created_at'>>(sb, 'responses', 'id,inspection_id,item_id,result,situation_description,custom_description,deleted_at'),
  lerTudo<LinhaRoteiro>(sb, 'checklist_templates', 'id,name,category,version'),
  lerTudo<LinhaSecao>(sb, 'checklist_sections', 'id,template_id,title,"order"'),
  lerTudo<Omit<LinhaItem, 'created_at'>>(sb, 'checklist_items', 'id,section_id,description,legislation_name,legislation_url,weight,is_critical,requirement_type,"order"'),
  // Só o roteiro congelado: `snapshot_json` inteiro traz as fotos em base64 e estoura a resposta.
  lerTudo<LinhaVersao>(sb, 'inspection_report_versions', 'inspection_id,created_at,template:snapshot_json->reportSnapshot->template', 'created_at'),
]);

/** Roteiros do banco no formato do app (mesmo mapeamento do TemplateService). */
const roteiroDoBanco = new Map<string, ChecklistTemplate>();
for (const t of tpls) {
  const minhasSecs = secs.filter(s => s.template_id === t.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  roteiroDoBanco.set(t.id, {
    id: t.id,
    name: t.name,
    category: t.category,
    version: t.version,
    sections: minhasSecs.map(s => ({
      id: s.id,
      title: s.title,
      order: s.order,
      items: itens
        .filter(i => i.section_id === s.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(i => ({
          id: i.id,
          sectionId: s.id,
          order: i.order,
          description: i.description,
          legislation: i.legislation_name,
          legislationUrl: i.legislation_url,
          weight: i.weight,
          isCritical: i.is_critical,
          requirementType: i.requirement_type,
        })),
    })),
  } as ChecklistTemplate);
}

/** Último snapshot com roteiro congelado, por inspeção. `versoes` já vem em ordem crescente. */
const snapshotPorInspecao = new Map<string, ChecklistTemplate>();
for (const v of versoes) {
  if (v.template && typeof v.template === 'object') snapshotPorInspecao.set(v.inspection_id, v.template);
}

const idsDeItens = new Set(itens.map(i => i.id));
const respostasPorInspecao = new Map<string, Omit<LinhaResposta, 'created_at'>[]>();
for (const r of respostas) {
  if (r.deleted_at) continue;
  const lista = respostasPorInspecao.get(r.inspection_id) || [];
  lista.push(r);
  respostasPorInspecao.set(r.inspection_id, lista);
}

// ── 1. Censo dos órfãos por origem ──────────────────────────────────────────
const origem = (itemId: string) => {
  if (idsDeItens.has(itemId)) return null;
  if (itemId.startsWith('extra|')) return 'item avulso da inspeção (por desenho)';
  if (/^(go|bh|rj)-/.test(itemId)) return 'suplemento regional (por desenho)';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(itemId)) return 'item APAGADO do roteiro (defeito)';
  return 'id do roteiro empacotado em src/data (defeito)';
};

const censo = new Map<string, { ids: Set<string>; respostas: number; inspecoes: Set<string> }>();
for (const r of respostas) {
  if (r.deleted_at) continue;
  const o = origem(r.item_id);
  if (!o) continue;
  const acc = censo.get(o) || { ids: new Set<string>(), respostas: 0, inspecoes: new Set<string>() };
  acc.ids.add(r.item_id);
  acc.respostas += 1;
  acc.inspecoes.add(r.inspection_id);
  censo.set(o, acc);
}

console.log('=== REF-06 · respostas cujo item_id não existe em checklist_items ===\n');
console.log('origem                                      ids   respostas   inspeções');
for (const [o, a] of [...censo].sort((x, y) => y[1].respostas - x[1].respostas)) {
  console.log(`${o.padEnd(42)} ${String(a.ids.size).padStart(4)}  ${String(a.respostas).padStart(9)}   ${String(a.inspecoes.size).padStart(9)}`);
}

// ── 2. Simulação do relatório, inspeção a inspeção ───────────────────────────
type Linha = {
  id: string;
  cliente: string;
  roteiro: string;
  avaliadas: number;
  snapshot: 'usado' | 'rejeitado' | 'ausente' | 'sem roteiro';
  degradadasRemoto: number;
  degradadasDexie: number;
  itens: string[];
};

function comoResposta(r: Omit<LinhaResposta, 'created_at'>): InspectionResponse {
  return {
    id: r.id,
    inspectionId: r.inspection_id,
    itemId: r.item_id,
    result: r.result,
    situationDescription: r.situation_description || undefined,
    customDescription: r.custom_description || undefined,
  } as InspectionResponse;
}

/** Quantas respostas caem na seção "Itens preservados do roteiro concluído". */
function degradadas(resolvido: ChecklistTemplate, resps: InspectionResponse[]): string[] {
  const secao = resolvido.sections.find(s => s.id === SECAO_DEGRADADA);
  if (!secao) return [];
  const ids = new Set(secao.items.map(i => i.id));
  return resps.filter(r => ids.has(r.itemId)).map(r => r.itemId);
}

const linhas: Linha[] = [];
for (const insp of inspecoes) {
  if (insp.deleted_at || insp.status !== 'completed') continue;

  const cliente = clientes.find(c => c.id === insp.client_id);
  const resps = (respostasPorInspecao.get(insp.id) || []).map(comoResposta);
  // `template_id` é nullable no banco; sem roteiro a busca não acha nada e a inspeção cai
  // no ramo "sem roteiro" logo abaixo — que é o que já acontecia com o `any`.
  const templateId = insp.template_id ?? '';
  const base = getTemplateById(templateId) || roteiroDoBanco.get(templateId);
  const snapshot = snapshotPorInspecao.get(insp.id);

  const avaliadas = resps.filter(r => r.result && r.result !== 'not_evaluated').length;
  const nome = cliente?.name || insp.client_id;
  const roteiro = base?.name || `(sem roteiro: ${insp.template_id})`;

  if (!base) {
    // Roteiro que sumiu do app (ex.: `tpl-ilpi-v1`). O InspectionSummary não tem o que
    // passar para `resolveReportTemplate` e usa o snapshot cru — se houver. Sem ele,
    // sobra o roteiro de recuperação e TODOS os itens degradam.
    const cobre = new Set((snapshot?.sections || []).flatMap(s => s.items.map(i => i.id)));
    const foraDoSnapshot = resps.filter(r => !cobre.has(r.itemId));
    linhas.push({
      id: insp.id, cliente: nome, roteiro, avaliadas,
      snapshot: snapshot ? 'usado' : 'sem roteiro',
      degradadasRemoto: snapshot ? foraDoSnapshot.length : resps.length,
      degradadasDexie: snapshot ? foraDoSnapshot.length : resps.length,
      itens: snapshot ? foraDoSnapshot.map(r => r.itemId) : [],
    });
    continue;
  }

  const comum = {
    ...insp,
    status: 'completed',
    templateId: insp.template_id,
    clientId: insp.client_id,
    clientCategory: cliente?.category,
    foodTypes: cliente?.food_types || undefined,
    reportTemplateSnapshot: snapshot,
  } as unknown as Inspection;

  const remoto = resolveReportTemplate(base, { ...comum, city: cliente?.city ?? undefined, state: cliente?.state ?? undefined }, resps);
  const dexie = resolveReportTemplate(base, comum, resps);
  const itensRemoto = degradadas(remoto, resps);

  linhas.push({
    id: insp.id,
    cliente: nome,
    roteiro,
    avaliadas,
    snapshot: !snapshot ? 'ausente' : remoto === snapshot ? 'usado' : 'rejeitado',
    degradadasRemoto: itensRemoto.length,
    degradadasDexie: degradadas(dexie, resps).length,
    itens: itensRemoto,
  });
}

linhas.sort((a, b) => b.degradadasRemoto - a.degradadasRemoto || a.cliente.localeCompare(b.cliente));

console.log('\n\n=== relatórios concluídos · itens que saem degradados ===');
console.log('(degradado = cai na seção "Itens preservados do roteiro concluído",');
console.log(' com a descrição trocada pelo texto da resposta ou por um placeholder)\n');
console.log('cliente                              aval.  snapshot     online  offline  roteiro');
for (const l of linhas) {
  console.log(
    `${l.cliente.slice(0, 34).padEnd(35)} ${String(l.avaliadas).padStart(5)}  ${l.snapshot.padEnd(11)} ${String(l.degradadasRemoto).padStart(6)} ${String(l.degradadasDexie).padStart(8)}  ${l.roteiro.slice(0, 40)}`
  );
}

const totalRemoto = linhas.reduce((s, l) => s + l.degradadasRemoto, 0);
const totalDexie = linhas.reduce((s, l) => s + l.degradadasDexie, 0);
console.log(`\n${linhas.length} relatórios concluídos · ${linhas.filter(l => l.degradadasRemoto > 0).length} com item degradado online, ${linhas.filter(l => l.degradadasDexie > 0).length} offline`);
console.log(`respostas degradadas: ${totalRemoto} online, ${totalDexie} offline`);

if (DETALHE) {
  console.log('\n\n=== detalhe (caminho online) ===');
  for (const l of linhas.filter(x => x.itens.length > 0)) {
    console.log(`\n${l.cliente} (${l.id})`);
    for (const id of l.itens) console.log(`  ${id}  ${origem(id) || 'existe em checklist_items'}`);
  }
}
