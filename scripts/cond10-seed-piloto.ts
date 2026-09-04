// COND-10 — cria a revisão de RASCUNHO com as árvores do piloto de Estética.
//
//   npx tsx scripts/cond10-seed-piloto.ts            # simulação (padrão)
//   npx tsx scripts/cond10-seed-piloto.ts --apply    # grava o RASCUNHO em produção
//
// Lê VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente ou do .env (scripts/env.ts).
//
// O QUE ELE FAZ, E O QUE ELE NÃO FAZ
//
// Ele grava um **rascunho**. Rascunho não entra em inspeção nenhuma: só revisão
// PUBLICADA entra, e publicar é decisão da consultora, na tela do editor, depois de
// passar pelo simulador (COND-07). O caminho é este, e nesta ordem:
//
//   1. este script cria o rascunho com as 4 árvores e a justificativa de cada uma;
//   2. Admin → Roteiros → Clínica de Estética e Saúde → Condições;
//   3. simular os perfis (processa/não processa, com/sem roupa, consultório
//      individualizado, com/sem cirurgia) e conferir o que sai em cada um;
//   4. publicar, se — e só se — o gate estiver limpo e o resultado bater com o
//      que está escrito em src/data/estetica/condicionais-piloto.ts;
//   5. rodar uma inspeção de teste de ponta a ponta antes de usar num cliente.
//
// Ele NÃO publica, NÃO apaga revisão publicada e NÃO toca em inspeção, resposta ou
// relatório.
//
// A TRADUÇÃO DE IDS, QUE É A PARTE QUE MORDE
//
// As regras nomeiam os alvos pelos ids do catálogo empacotado (`est-036`,
// `sec-est-10`); o banco usa UUID. A regra referencia por id **sem FK** (COND-04),
// então id errado não dá erro — vira regra que nunca casa, em silêncio. Este
// script traduz pela descrição normalizada, do mesmo jeito que `applySupplement`,
// e **para** se algum alvo não mapear.
//
// ROLLBACK: esvaziar `APPLICABILITY_PILOT` (src/domain/applicability/pilot.ts) e
// publicar o app. A revisão continua no banco, intacta; o motor é que para de ser
// consultado. Nenhuma resposta é apagada.
//
// APLICAR EM PRODUÇÃO EXIGE AUTORIZAÇÃO EXPLÍCITA DA ESTER (regra 1 do handoff).
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from './env';
import {
  PILOT_BRANCHES,
  PILOT_ROUTING_QUESTIONS,
  PILOT_RULES,
  PILOT_TEMPLATE_ID_PROD,
  pilotRevisionNotes,
} from '../src/data/estetica/condicionais-piloto';
import { templateEsteticaClinica } from '../src/data/estetica/roteiro-clinica';
import { publishGate } from '../src/domain/applicability';
import type { ApplicabilityRule } from '../src/domain/applicability';
import { normalizeRequirementText } from '../src/utils/itemIdentity';

const APPLY = process.argv.includes('--apply');
const tenantArg = process.argv.indexOf('--tenant');
const TENANT = tenantArg >= 0 ? process.argv[tenantArg + 1] : undefined;

const { url, key } = requireSupabaseEnv();
const sb = createClient(url, key, { auth: { persistSession: false } });

/** Índice texto normalizado → id. Texto repetido fica de fora: casar no escuro é pior do que parar. */
function indexarPorTexto(linhas: { id: string; texto: string }[]): Map<string, string> {
  const contagem = new Map<string, number>();
  for (const linha of linhas) {
    const chave = normalizeRequirementText(linha.texto);
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  const indice = new Map<string, string>();
  for (const linha of linhas) {
    const chave = normalizeRequirementText(linha.texto);
    if (!chave || contagem.get(chave) !== 1) continue;
    indice.set(chave, linha.id);
  }
  return indice;
}

async function main() {
  console.log(`COND-10 · piloto de condicionais — ${APPLY ? 'APLICANDO' : 'simulação'}\n`);

  // ─── 1. O gate, antes de tocar no banco ────────────────────────────────────
  const gate = publishGate({
    sections: templateEsteticaClinica.sections,
    rules: PILOT_RULES,
    routingQuestions: PILOT_ROUTING_QUESTIONS,
  });
  if (!gate.ready) {
    console.error('Gate de publicação reprovou — nada foi gravado:');
    for (const problema of gate.blockers) console.error(`  · ${problema.message}`);
    process.exit(1);
  }
  console.log(`Gate limpo. ${PILOT_BRANCHES.length} árvores, ${PILOT_RULES.length} regras, ${PILOT_ROUTING_QUESTIONS.length} perguntas.`);
  for (const branch of PILOT_BRANCHES) {
    console.log(`  · ${branch.nome} — ${branch.rules.length} alvo(s)`);
  }
  if (gate.warnings.length > 0) {
    console.log('\nAvisos (não bloqueiam):');
    for (const aviso of gate.warnings) console.log(`  · ${aviso.message}`);
  }

  // ─── 2. O roteiro precisa existir no banco ─────────────────────────────────
  const { data: roteiro, error: erroRoteiro } = await sb
    .from('checklist_templates')
    .select('id, name')
    .eq('id', PILOT_TEMPLATE_ID_PROD)
    .maybeSingle();
  if (erroRoteiro) throw erroRoteiro;
  if (!roteiro) {
    console.error(`\nO roteiro "${PILOT_TEMPLATE_ID_PROD}" não existe em checklist_templates.`);
    console.error('Confira o id em pilot.ts e em condicionais-piloto.ts antes de seguir.');
    process.exit(1);
  }
  console.log(`\nRoteiro no banco: ${roteiro.name}`);

  // ─── 3. Traduzir os alvos: id do catálogo → id do banco ────────────────────
  // `checklist_items` pendura em `section_id`, nao em `template_id`.
  const { data: secoes, error: erroSecoes } = await sb
    .from('checklist_sections')
    .select('id, title')
    .eq('template_id', PILOT_TEMPLATE_ID_PROD);
  if (erroSecoes) throw erroSecoes;

  const { data: itens, error: erroItens } = await sb
    .from('checklist_items')
    .select('id, description')
    .in('section_id', (secoes || []).map((l) => String(l.id)));
  if (erroItens) throw erroItens;

  const itensBanco = indexarPorTexto((itens || []).map((l) => ({ id: String(l.id), texto: String(l.description ?? '') })));
  const secoesBanco = indexarPorTexto((secoes || []).map((l) => ({ id: String(l.id), texto: String(l.title ?? '') })));
  console.log(`Banco: ${(secoes || []).length} seções e ${(itens || []).length} itens.`);

  const textoDoCatalogo = new Map<string, string>();
  for (const secao of templateEsteticaClinica.sections) {
    textoDoCatalogo.set(secao.id, secao.title);
    for (const item of secao.items) textoDoCatalogo.set(item.id, item.description);
  }

  const naoMapeadas: string[] = [];
  const regrasNoBanco: ApplicabilityRule[] = PILOT_RULES.map((regra) => {
    const texto = textoDoCatalogo.get(regra.target.id);
    const indice = regra.target.type === 'section' ? secoesBanco : itensBanco;
    const idBanco = texto ? indice.get(normalizeRequirementText(texto)) : undefined;
    if (!idBanco) {
      naoMapeadas.push(`${regra.id} → ${regra.target.type} ${regra.target.id}`);
      return regra;
    }
    return { ...regra, target: { ...regra.target, id: idBanco } };
  });

  if (naoMapeadas.length > 0) {
    console.error(`\n${naoMapeadas.length} alvo(s) sem correspondente no banco — nada foi gravado:`);
    for (const linha of naoMapeadas) console.error(`  · ${linha}`);
    console.error('\nO texto do requisito no banco divergiu do catálogo. Reconcilie antes de semear.');
    process.exit(1);
  }
  console.log(`Os ${PILOT_RULES.length} alvos foram traduzidos para os ids do banco pela descrição.`);

  // ─── 4. Revisão existente ──────────────────────────────────────────────────
  const { data: existentes, error: erroRevisao } = await sb
    .from('checklist_template_revisions')
    .select('id, revision, status, tenant_id, updated_at')
    .eq('template_id', PILOT_TEMPLATE_ID_PROD)
    .order('revision', { ascending: false });
  if (erroRevisao) throw erroRevisao;

  const rascunho = (existentes || []).find((linha) => linha.status === 'draft');
  const publicada = (existentes || []).find((linha) => linha.status === 'published');
  if (publicada) {
    console.log(`Já existe revisão PUBLICADA (nº ${publicada.revision}) — ela continua valendo e não é tocada.`);
  }

  const tenant = TENANT || rascunho?.tenant_id || publicada?.tenant_id;
  if (!tenant) {
    console.error('\nSem tenant: passe --tenant <uuid>. Não vou adivinhar o tenant de uma escrita em produção.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log(`\nSimulação — nada gravado. Com --apply, ${rascunho ? `SOBRESCREVE o rascunho ${rascunho.id}` : 'CRIA um rascunho novo'} no tenant ${tenant}.`);
    console.log('\nNotas que acompanham a revisão:\n');
    console.log(pilotRevisionNotes());
    return;
  }

  if (rascunho) {
    const { error } = await sb
      .from('checklist_template_revisions')
      .update({ rules: regrasNoBanco, routing_questions: PILOT_ROUTING_QUESTIONS, notes: pilotRevisionNotes() })
      .eq('id', rascunho.id);
    if (error) throw error;
    console.log(`\nRascunho ${rascunho.id} atualizado.`);
  } else {
    const { data, error } = await sb
      .from('checklist_template_revisions')
      .insert({
        template_id: PILOT_TEMPLATE_ID_PROD,
        tenant_id: tenant,
        rules: regrasNoBanco,
        routing_questions: PILOT_ROUTING_QUESTIONS,
        notes: pilotRevisionNotes(),
      })
      .select('id, revision')
      .single();
    if (error) throw error;
    console.log(`\nRascunho criado: ${data.id} (revisão ${data.revision}).`);
  }
  console.log('Nada foi publicado. Abra Admin → Roteiros → Condições para simular e publicar.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
