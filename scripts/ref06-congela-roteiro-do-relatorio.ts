// REF-06 — congela, em cada relatório concluído, o roteiro que ele precisa para exibir
// as perguntas certas.
//
//   npx tsx scripts/ref06-congela-roteiro-do-relatorio.ts            # simulação (padrão)
//   npx tsx scripts/ref06-congela-roteiro-do-relatorio.ts --apply    # grava em produção
//
// POR QUE ASSIM, E NÃO REMAPEANDO AS RESPOSTAS
// O card do REF-06 previa remapear `responses.item_id` para os itens atuais. Medindo, o
// remapeamento é o caminho mais arriscado e nem sempre suficiente: a mesma linha de
// `checklist_items` já mudou de pergunta duas vezes (o `30546905…` foi "proporção Grau I",
// virou o agregado e hoje é a escala de trabalho), então "o item atual equivalente" às
// vezes não existe. O relatório concluído não precisa disso — precisa do texto da época.
//
// Este script monta, por inspeção, o roteiro do relatório e grava em
// `inspection_report_versions.snapshot_json.reportSnapshot.template`, que é exatamente o
// que `resolveReportTemplate` procura primeiro. Nenhuma resposta é reescrita, nenhuma nota
// muda: o que muda é o texto exibido, que volta a ser o que a consultora leu em campo.
//
// DE ONDE VEM O TEXTO DE CADA ITEM, EM ORDEM DE PREFERÊNCIA
//   1. snapshots já gravados (de qualquer inspeção do mesmo roteiro), preferindo o mais
//      próximo da data da inspeção — é o texto da época, e ignora placeholders;
//   2. o roteiro vivo no banco, para item que nunca mudou;
//   3. os roteiros históricos reconstruídos do git (scripts/historico/roteiros-antigos.ts);
//   4. `custom_description` da própria resposta, para item avulso (`extra|…`).
//
// APLICAR EM PRODUÇÃO EXIGE AUTORIZAÇÃO EXPLÍCITA DA ESTER.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { templates } from '../src/data/templates';
import { roteiroIlpiV1, roteiroIlpiFederal97 } from './historico/roteiros-antigos';
import type { ChecklistItem, ChecklistTemplate, Section } from '../src/types';
import { requireSupabaseEnv } from './env';

const APPLY = process.argv.includes('--apply');
const { url, key } = requireSupabaseEnv();
const sb = createClient(url, key, { auth: { persistSession: false } });

const PLACEHOLDER = /^Item preservado do relat[oó]rio conclu[ií]do/i;

// Inspeção do Lar Recanto do Sossego (Senador Canedo/GO, 07/04/2026). 26 respostas foram
// gravadas contra itens (`fed-055..058`, `fed-083..104`) que não existem em nenhum artefato:
// nem no banco, nem no código, nem em commit nenhum do repositório. E o PDF entregue à
// cliente em 14/04/2026 fecha em 97 itens — as 26 nunca apareceram no relatório, nem na
// nota, nem no plano de ação. Como não há texto para exibir e exibi-las mudaria o
// relatório entregue, elas saem do ar por `deleted_at` (reversível) e ficam fora do
// snapshot. Ver a conversa do REF-06.
const SEM_TEXTO_ACEITO: Record<string, RegExp> = {
  'f58d37c3-2c6f-4956-9a7a-e2ea7495b17e': /^fed-(05[5-8]|08[3-9]|09[0-9]|10[0-4])$/,
};

/**
 * Item avulso criado e nunca preenchido: sem descrição, sem situação, marcado "não se
 * aplica". Não entra na nota nem no plano de ação, e não há texto nenhum para exibir —
 * hoje sai no relatório como "Item preservado do relatorio concluido (extra|…)". Sai do
 * ar por `deleted_at`, que é reversível.
 */
function extraVazia(r: any): boolean {
  return String(r.item_id).startsWith('extra|')
    && !r.custom_description && !r.situation_description
    && (r.result === 'not_applicable' || r.result === 'not_evaluated' || !r.result);
}

/** Roteiros que só existem no git; a inspeção aponta para um id que não está em lugar nenhum. */
const ROTEIROS_HISTORICOS: Record<string, ChecklistTemplate> = {
  'tpl-ilpi-v1': roteiroIlpiV1,
};

/** Inspeções cujo roteiro base precisa ser forçado (o `template_id` gravado não confere). */
const ROTEIRO_FORCADO: Record<string, ChecklistTemplate> = {
  // Aponta para `tpl-ilpi-federal-v1`, mas as 89 respostas são `ilpi-*`: foi executada no
  // roteiro antigo e migrada com o template_id novo.
  '71d379fa-b958-44c4-a1ec-3c24fc62a233': roteiroIlpiV1,
  // Executada contra o federal de 97 itens (commit d76b234), que é o do PDF entregue.
  'f58d37c3-2c6f-4956-9a7a-e2ea7495b17e': roteiroIlpiFederal97,
  '55663dec-65e0-41bf-9beb-fdd938f06a31': roteiroIlpiFederal97,
  '7051ac58-b43d-40e5-9b92-cde693cfa8b9': roteiroIlpiFederal97,
};

async function readAll<T = any>(table: string, select: string, order = 'id', pagina = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pagina) {
    const { data, error } = await sb.from(table).select(select).order(order).range(from, from + pagina - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as T[]));
    if ((data as T[]).length < pagina) break;
  }
  return out;
}

const [inspecoes, clientes, respostas, tpls, secs, itens] = await Promise.all([
  readAll('inspections', 'id,client_id,template_id,status,inspection_date,created_at,deleted_at,tenant_id'),
  readAll('clients', 'id,name,category,city,state'),
  readAll('responses', 'id,inspection_id,item_id,result,custom_description,situation_description,created_at,deleted_at'),
  readAll('checklist_templates', 'id,name,category,version'),
  readAll('checklist_sections', 'id,template_id,title,"order"'),
  readAll('checklist_items', 'id,section_id,description,legislation_name,legislation_url,weight,is_critical,requirement_type,"order",created_at'),
]);
// Extrair o roteiro de dentro do `snapshot_json` é caro (as versões carregam as fotos em
// base64) e estoura o statement timeout com facilidade: vai em páginas de 3, com repetição,
// e fica em cache no disco. `--recarregar` ignora o cache.
const CACHE = path.join(os.tmpdir(), 'ref06-versoes.json');
async function lerVersoes(): Promise<any[]> {
  if (!process.argv.includes('--recarregar') && fs.existsSync(CACHE)) {
    return JSON.parse(fs.readFileSync(CACHE, 'utf-8'));
  }
  const { data: linhas, error: erroLista } = await sb
    .from('inspection_report_versions')
    .select('id,inspection_id,version,created_at')
    .order('created_at');
  if (erroLista) throw new Error(`inspection_report_versions: ${erroLista.message}`);

  const out: any[] = [];
  for (const linha of linhas as any[]) {
    let ok = false;
    for (let tentativa = 1; tentativa <= 3 && !ok; tentativa++) {
      const { data, error } = await sb
        .from('inspection_report_versions')
        .select('template:snapshot_json->reportSnapshot->template')
        .eq('id', linha.id)
        .maybeSingle();
      if (error) {
        if (tentativa === 3) { console.warn(`  (versão ${linha.version} de ${linha.inspection_id} não pôde ser lida: ${error.message})`); break; }
        await new Promise(r => setTimeout(r, 1500 * tentativa));
        continue;
      }
      out.push({ ...linha, template: (data as any)?.template ?? null });
      ok = true;
    }
  }
  fs.writeFileSync(CACHE, JSON.stringify(out));
  return out;
}
const versoes = await lerVersoes();

// ── Roteiro vivo do banco, no formato do app ────────────────────────────────
const roteiroDoBanco = new Map<string, ChecklistTemplate>();
for (const t of tpls) {
  const minhas = secs.filter((s: any) => s.template_id === t.id).sort((a: any, b: any) => a.order - b.order);
  roteiroDoBanco.set(t.id, {
    id: t.id, name: t.name, category: t.category, version: t.version,
    sections: minhas.map((s: any) => ({
      id: s.id, title: s.title, order: s.order,
      items: itens.filter((i: any) => i.section_id === s.id).sort((a: any, b: any) => a.order - b.order).map((i: any) => ({
        id: i.id, sectionId: s.id, order: i.order, description: i.description,
        legislation: i.legislation_name, legislationUrl: i.legislation_url,
        weight: i.weight, isCritical: i.is_critical, requirementType: i.requirement_type,
      })),
    })),
  } as ChecklistTemplate);
}

// ── Catálogo: item → candidatos, com a seção em que ele vivia e a data da fonte ──
type Candidato = { item: ChecklistItem; secao: Omit<Section, 'items'>; quando: number; fonte: string };
const catalogo = new Map<string, Candidato[]>();

function registrar(item: any, secao: any, quando: number, fonte: string) {
  if (!item?.id || !item.description || PLACEHOLDER.test(item.description)) return;
  const lista = catalogo.get(item.id) || [];
  lista.push({ item: { ...item, sectionId: secao.id }, secao: { id: secao.id, title: secao.title, order: secao.order ?? 0 }, quando, fonte });
  catalogo.set(item.id, lista);
}

for (const v of versoes as any[]) {
  if (!v.template || typeof v.template !== 'object') continue;
  const quando = new Date(v.created_at).getTime();
  for (const s of v.template.sections || []) for (const i of s.items || []) registrar(i, s, quando, `snapshot v${v.version}`);
}
// Roteiro vivo e roteiros do código entram como fonte tardia (quando = agora): só ganham
// quando nenhum snapshot da época tem o item.
const AGORA = Date.now();
for (const tpl of [...roteiroDoBanco.values()]) {
  for (const s of tpl.sections) for (const i of s.items) registrar(i, s, AGORA, `banco (${tpl.name})`);
}
for (const tpl of [...templates, roteiroIlpiV1, roteiroIlpiFederal97] as ChecklistTemplate[]) {
  for (const s of tpl.sections) for (const i of s.items) registrar(i, s, AGORA, `código (${tpl.name})`);
}

/** Melhor texto para um item, do ponto de vista de uma inspeção feita em `quandoInspecao`. */
function melhorCandidato(itemId: string, quandoInspecao: number): Candidato | undefined {
  const lista = catalogo.get(itemId);
  if (!lista) return undefined;
  return [...lista].sort((a, b) => Math.abs(a.quando - quandoInspecao) - Math.abs(b.quando - quandoInspecao))[0];
}

// ── Monta o roteiro de cada relatório ───────────────────────────────────────
type Plano = {
  id: string; cliente: string; base: string; acao: 'ok' | 'congelar' | 'sem fonte';
  faltavam: number; recuperados: number; semTexto: string[]; template?: ChecklistTemplate; proximaVersao: number;
};

const versoesPorInspecao = new Map<string, any[]>();
for (const v of versoes as any[]) {
  const l = versoesPorInspecao.get(v.inspection_id) || [];
  l.push(v);
  versoesPorInspecao.set(v.inspection_id, l);
}

function clonar<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

const planos: Plano[] = [];

for (const insp of inspecoes) {
  if (insp.deleted_at || insp.status !== 'completed') continue;

  const cliente = clientes.find((c: any) => c.id === insp.client_id);
  const minhas = respostas.filter((r: any) => r.inspection_id === insp.id && !r.deleted_at && !extraVazia(r));
  const avaliadas = minhas.filter((r: any) => r.result && r.result !== 'not_evaluated');
  const quandoInspecao = Math.max(...minhas.map((r: any) => new Date(r.created_at).getTime()), new Date(insp.created_at).getTime());
  const aceitaSemTexto = SEM_TEXTO_ACEITO[insp.id];

  // Esqueleto: melhor snapshot já gravado (sem placeholder e com maior cobertura), senão o roteiro base.
  const minhasVersoes = (versoesPorInspecao.get(insp.id) || []).filter((v: any) => v.template && typeof v.template === 'object');
  const cobertura = (t: ChecklistTemplate) => {
    const ids = new Set(t.sections.flatMap(s => s.items.map(i => i.id)));
    return avaliadas.filter((r: any) => ids.has(r.item_id)).length;
  };
  const limpas = minhasVersoes.filter((v: any) =>
    !v.template.sections.some((s: any) => s.items.some((i: any) => PLACEHOLDER.test(i.description || ''))));
  const melhorVersao = [...limpas].sort((a: any, b: any) => cobertura(b.template) - cobertura(a.template) || b.version - a.version)[0];

  const doBanco = !ROTEIRO_FORCADO[insp.id] && !melhorVersao && !ROTEIROS_HISTORICOS[insp.template_id];
  const base = ROTEIRO_FORCADO[insp.id]
    || (melhorVersao?.template as ChecklistTemplate | undefined)
    || ROTEIROS_HISTORICOS[insp.template_id]
    || roteiroDoBanco.get(insp.template_id);

  const proximaVersao = Math.max(0, ...(versoesPorInspecao.get(insp.id) || []).map((v: any) => v.version)) + 1;

  if (!base) {
    planos.push({ id: insp.id, cliente: cliente?.name || insp.client_id, base: `(nenhuma: ${insp.template_id})`, acao: 'sem fonte', faltavam: avaliadas.length, recuperados: 0, semTexto: [], proximaVersao });
    continue;
  }

  const template = clonar(base);

  // Esqueleto vindo do roteiro VIVO precisa voltar no tempo: o roteiro de hoje tem itens
  // que ainda não existiam quando o relatório foi entregue (entrariam em branco no PDF) e
  // tem itens cuja pergunta mudou depois (o `30546905…` já foi "proporção Grau I" e hoje é
  // a escala de trabalho). Snapshot e roteiro histórico já são da época — não passam aqui.
  if (doBanco) {
    const respondidos = new Set(minhas.map((r: any) => r.item_id));
    const nascimento = new Map(itens.map((i: any) => [i.id, new Date(i.created_at).getTime()]));
    for (const s of template.sections) {
      s.items = s.items
        .filter((i: any) => respondidos.has(i.id) || (nascimento.get(i.id) ?? 0) <= quandoInspecao)
        .map((i: any) => melhorCandidato(i.id, quandoInspecao)?.item ?? i);
    }
    template.sections = template.sections.filter((s: any) => s.items.length > 0);
  }

  const presentes = new Set(template.sections.flatMap((s: any) => s.items.map((i: any) => i.id)));
  const faltando = minhas.filter((r: any) => !presentes.has(r.item_id));
  const semTexto: string[] = [];
  let recuperados = 0;

  for (const r of faltando) {
    // Item avulso da inspeção: o texto é a própria resposta.
    if (String(r.item_id).startsWith('extra|') && r.custom_description) {
      const secaoId = String(r.item_id).split('|')[1];
      const secao = template.sections.find((s: any) => s.id === secaoId) || template.sections[template.sections.length - 1];
      secao.items.push({ id: r.item_id, sectionId: secao.id, order: secao.items.length + 1, description: r.custom_description, weight: 1, isCritical: false } as ChecklistItem);
      recuperados += 1;
      continue;
    }

    const c = melhorCandidato(r.item_id, quandoInspecao);
    if (!c) {
      if (!(aceitaSemTexto && aceitaSemTexto.test(r.item_id))) semTexto.push(r.item_id);
      continue;
    }
    let secao = template.sections.find((s: any) => s.id === c.secao.id || s.title === c.secao.title);
    if (!secao) {
      secao = { ...c.secao, items: [] } as Section;
      template.sections.push(secao);
    }
    secao.items.push({ ...c.item, order: c.item.order ?? secao.items.length + 1 });
    recuperados += 1;
  }

  template.sections.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  for (const s of template.sections) s.items.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  const cobre = new Set(template.sections.flatMap((s: any) => s.items.map((i: any) => i.id)));
  const descobertas = avaliadas.filter((r: any) => !cobre.has(r.item_id) && !(aceitaSemTexto && aceitaSemTexto.test(r.item_id)));

  const jaEstavaBom = melhorVersao
    && melhorVersao.version === proximaVersao - 1
    && faltando.length === 0
    && !ROTEIRO_FORCADO[insp.id];

  planos.push({
    id: insp.id,
    cliente: cliente?.name || insp.client_id,
    base: ROTEIRO_FORCADO[insp.id] ? `histórico: ${base.name}` : melhorVersao ? `snapshot v${melhorVersao.version}` : `roteiro ${base.name}`,
    acao: descobertas.length > 0 ? 'sem fonte' : jaEstavaBom ? 'ok' : 'congelar',
    faltavam: faltando.length,
    recuperados,
    semTexto: [...new Set(semTexto)],
    template,
    proximaVersao,
  });
}

planos.sort((a, b) => b.faltavam - a.faltavam || a.cliente.localeCompare(b.cliente));

console.log('=== REF-06 · congelar o roteiro de cada relatório concluído ===');
console.log('modo:', APPLY ? 'APLICANDO' : 'simulação (use --apply para gravar)', '\n');
console.log('cliente                              ação        faltavam  recuperados  base');
for (const p of planos) {
  console.log(`${p.cliente.slice(0, 34).padEnd(35)} ${p.acao.padEnd(11)} ${String(p.faltavam).padStart(8)} ${String(p.recuperados).padStart(12)}  ${p.base}`);
  if (p.semTexto.length) console.log(`${''.padEnd(36)}sem texto em fonte nenhuma: ${p.semTexto.join(', ')}`);
}

const paraGravar = planos.filter(p => p.acao === 'congelar');
const soltas = planos.filter(p => p.acao === 'sem fonte');
console.log(`\n${paraGravar.length} relatórios a congelar · ${planos.filter(p => p.acao === 'ok').length} já corretos · ${soltas.length} sem fonte`);

// Respostas que saem do ar (só o caso documentado em SEM_TEXTO_ACEITO).
const concluidas = new Set(inspecoes.filter((i: any) => i.status === 'completed' && !i.deleted_at).map((i: any) => i.id));
const aSoftDeletar = respostas.filter((r: any) => {
  if (r.deleted_at || !concluidas.has(r.inspection_id)) return false;
  const re = SEM_TEXTO_ACEITO[r.inspection_id];
  return (re && re.test(r.item_id)) || extraVazia(r);
});
if (aSoftDeletar.length) {
  console.log(`\n${aSoftDeletar.length} respostas a marcar com deleted_at (nunca apareceram no relatório entregue):`);
  console.log('  ' + [...new Set(aSoftDeletar.map((r: any) => r.item_id))].sort().join(', '));
}

// Conferência: `--secao "Recursos Humanos"` imprime a seção reconstruída de cada relatório,
// que é como se verifica se o texto congelado é o da época e não o do roteiro de hoje.
const filtroSecao = process.argv.includes('--secao') ? process.argv[process.argv.indexOf('--secao') + 1] : null;
if (filtroSecao) {
  for (const p of planos.filter(x => x.template)) {
    const secoes = p.template!.sections.filter(s => (s.title || '').toLowerCase().includes(filtroSecao.toLowerCase()));
    if (!secoes.length) continue;
    console.log(`\n--- ${p.cliente} (${p.id}) · ${p.acao} ---`);
    for (const s of secoes) for (const i of s.items) console.log(`  ${String(i.id).slice(0, 36).padEnd(38)} ${(i.description || '').slice(0, 78)}`);
  }
}

if (soltas.length) {
  console.log('\nATENÇÃO: relatórios sem fonte para pelo menos um item — nada será gravado neles.');
}

if (!APPLY) {
  console.log('\nNada foi gravado. Reexecute com --apply após autorização explícita.');
  process.exit(0);
}

// Grava uma versão NOVA, leve (só o roteiro), em vez de reescrever a versão existente:
// as versões antigas carregam as fotos em base64 e são a rede de recuperação delas
// (ver o reparo de fotos de jun/2026). Reescrevê-las para trocar um campo seria arriscado
// e caro. Quem procura foto em snapshot precisa varrer todas as versões, não só a última.
for (const p of paraGravar) {
  const insp = inspecoes.find((i: any) => i.id === p.id);
  const { error } = await sb.from('inspection_report_versions').insert({
    tenant_id: insp.tenant_id,
    inspection_id: p.id,
    version: p.proximaVersao,
    snapshot_json: {
      origem: 'REF-06: roteiro do relatório reconstruído (texto da época); respostas intactas',
      reportSnapshot: { generatedAt: new Date().toISOString(), template: p.template },
    },
  });
  if (error) throw new Error(`${p.cliente}: ${error.message}`);
  console.log(`  congelado: ${p.cliente} (v${p.proximaVersao}, ${p.recuperados} itens recuperados)`);
}

if (aSoftDeletar.length) {
  const agora = new Date().toISOString();
  const { error } = await sb.from('responses').update({ deleted_at: agora }).in('id', aSoftDeletar.map((r: any) => r.id));
  if (error) throw new Error(`soft-delete: ${error.message}`);
  console.log(`  ${aSoftDeletar.length} respostas marcadas com deleted_at`);
}

console.log('\nConcluído. Reexecutar é seguro: a segunda passada não encontra nada a fazer.');
