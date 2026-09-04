// COND-10 — cria a revisão de RASCUNHO com as árvores do piloto.
//
//   npx tsx scripts/cond10-seed-piloto.ts --roteiro saude              # simulação (padrão)
//   npx tsx scripts/cond10-seed-piloto.ts --roteiro saude --apply      # grava o RASCUNHO
//   npx tsx scripts/cond10-seed-piloto.ts --roteiro estetica --apply
//
// Lê VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente ou do .env (scripts/env.ts).
//
// O QUE ELE FAZ, E O QUE ELE NÃO FAZ
//
// Ele grava um **rascunho**. Rascunho não entra em inspeção nenhuma: só revisão
// PUBLICADA entra, e publicar é decisão da consultora, na tela do editor, depois de
// passar pelo simulador (COND-07). O caminho é este, e nesta ordem:
//
//   1. este script cria o rascunho com as árvores e a justificativa de cada uma;
//   2. Admin → Roteiros → <o roteiro> → Condições;
//   3. simular os perfis e conferir o que sai em cada um;
//   4. publicar, se — e só se — o gate estiver limpo e o resultado bater com o
//      que está escrito no arquivo de árvores;
//   5. rodar uma inspeção de teste de ponta a ponta antes de usar num cliente.
//
// Ele NÃO publica, NÃO apaga revisão publicada e NÃO toca em inspeção, resposta ou
// relatório.
//
// COMO O ROTEIRO É ENCONTRADO
//
// Pelo **nome**, não pelo id. Id de catálogo (`tpl-saude-servicos-v1`) e id de
// banco (UUID) são coisas diferentes, e um roteiro pode entrar no banco depois de
// a árvore ser escrita — foi o caso do roteiro de Serviços de Saúde. O nome é a
// mesma chave que o seletor de NewInspection e o gate do piloto usam.
//
// A TRADUÇÃO DE IDS, QUE É A PARTE QUE MORDE
//
// As regras nomeiam os alvos pelos ids do catálogo (`sau-045`, `sec-sau-10`); o
// banco usa UUID. A regra referencia por id **sem FK** (COND-04), então id errado
// não dá erro — vira regra que nunca casa, em silêncio. Este script traduz pela
// descrição normalizada, do mesmo jeito que `applySupplement`, e **para** se
// algum alvo não mapear.
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
  pilotRevisionNotes,
} from '../src/data/estetica/condicionais-piloto';
import {
  PILOT_BRANCHES_SAUDE,
  PILOT_SAUDE_ROUTING_QUESTIONS,
  PILOT_SAUDE_RULES,
  PILOT_SAUDE_TEMPLATE_NAME,
  pilotSaudeRevisionNotes,
} from '../src/data/saude/condicionais-piloto-saude';
import { templateEsteticaClinica } from '../src/data/estetica/roteiro-clinica';
import { templateServicosSaude } from '../src/data/saude/roteiro-servicos-saude';
import { publishGate } from '../src/domain/applicability';
import type { ApplicabilityRule, RoutingQuestion } from '../src/domain/applicability';
import type { ChecklistTemplate } from '../src/types';
import { normalizeRequirementText } from '../src/utils/itemIdentity';

interface Alvo {
  chave: string;
  nomeNoBanco: string;
  catalogo: ChecklistTemplate;
  rules: ApplicabilityRule[];
  questions: RoutingQuestion[];
  branches: readonly { nome: string; rules: ApplicabilityRule[] }[];
  notas: () => string;
}

const ALVOS: Alvo[] = [
  {
    chave: 'estetica',
    nomeNoBanco: 'Roteiro de Inspeção — Clínica de Estética e Saúde',
    catalogo: templateEsteticaClinica,
    rules: PILOT_RULES,
    questions: PILOT_ROUTING_QUESTIONS,
    branches: PILOT_BRANCHES,
    notas: pilotRevisionNotes,
  },
  {
    chave: 'saude',
    nomeNoBanco: PILOT_SAUDE_TEMPLATE_NAME,
    catalogo: templateServicosSaude,
    rules: PILOT_SAUDE_RULES,
    questions: PILOT_SAUDE_ROUTING_QUESTIONS,
    branches: PILOT_BRANCHES_SAUDE,
    notas: pilotSaudeRevisionNotes,
  },
];

const APPLY = process.argv.includes('--apply');
const roteiroArg = process.argv.indexOf('--roteiro');
const ROTEIRO = roteiroArg >= 0 ? process.argv[roteiroArg + 1] : undefined;
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
  const alvo = ALVOS.find((entrada) => entrada.chave === ROTEIRO);
  if (!alvo) {
    console.error(`Passe --roteiro com um destes: ${ALVOS.map((a) => a.chave).join(', ')}`);
    process.exit(1);
  }

  console.log(`COND-10 · piloto de condicionais (${alvo.chave}) — ${APPLY ? 'APLICANDO' : 'simulação'}\n`);

  // ─── 1. O gate, antes de tocar no banco ────────────────────────────────────
  const gate = publishGate({
    sections: alvo.catalogo.sections,
    rules: alvo.rules,
    routingQuestions: alvo.questions,
  });
  if (!gate.ready) {
    console.error('Gate de publicação reprovou — nada foi gravado:');
    for (const problema of gate.blockers) console.error(`  · ${problema.message}`);
    process.exit(1);
  }
  console.log(`Gate limpo. ${alvo.branches.length} árvores, ${alvo.rules.length} regras, ${alvo.questions.length} perguntas.`);
  for (const branch of alvo.branches) {
    console.log(`  · ${branch.nome} — ${branch.rules.length} alvo(s)`);
  }
  if (gate.warnings.length > 0) {
    console.log('\nAvisos (não bloqueiam):');
    for (const aviso of gate.warnings) console.log(`  · ${aviso.message}`);
  }

  // ─── 2. O roteiro precisa existir no banco, e é achado pelo NOME ───────────
  const { data: roteiro, error: erroRoteiro } = await sb
    .from('checklist_templates')
    .select('id, name')
    .eq('name', alvo.nomeNoBanco)
    .maybeSingle();
  if (erroRoteiro) throw erroRoteiro;
  if (!roteiro) {
    console.error(`\nNão existe roteiro chamado "${alvo.nomeNoBanco}" em checklist_templates.`);
    console.error('Semeie o roteiro antes (scripts/seed-roteiro-saude.ts para o de saúde).');
    process.exit(1);
  }
  const templateId = String(roteiro.id);
  console.log(`\nRoteiro no banco: ${roteiro.name} (${templateId})`);

  // ─── 3. Traduzir os alvos: id do catálogo → id do banco ────────────────────
  // `checklist_items` pendura em `section_id`, nao em `template_id`.
  const { data: secoes, error: erroSecoes } = await sb
    .from('checklist_sections')
    .select('id, title')
    .eq('template_id', templateId);
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
  for (const secao of alvo.catalogo.sections) {
    textoDoCatalogo.set(secao.id, secao.title);
    for (const item of secao.items) textoDoCatalogo.set(item.id, item.description);
  }

  const naoMapeadas: string[] = [];
  const regrasNoBanco: ApplicabilityRule[] = alvo.rules.map((regra) => {
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
  console.log(`Os ${alvo.rules.length} alvos foram traduzidos para os ids do banco pela descrição.`);

  // ─── 4. Revisão existente ──────────────────────────────────────────────────
  const { data: existentes, error: erroRevisao } = await sb
    .from('checklist_template_revisions')
    .select('id, revision, status, tenant_id, updated_at')
    .eq('template_id', templateId)
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
    console.log(alvo.notas());
    return;
  }

  if (rascunho) {
    const { error } = await sb
      .from('checklist_template_revisions')
      .update({ rules: regrasNoBanco, routing_questions: alvo.questions, notes: alvo.notas() })
      .eq('id', rascunho.id);
    if (error) throw error;
    console.log(`\nRascunho ${rascunho.id} atualizado.`);
  } else {
    const { data, error } = await sb
      .from('checklist_template_revisions')
      .insert({
        template_id: templateId,
        tenant_id: tenant,
        rules: regrasNoBanco,
        routing_questions: alvo.questions,
        notes: alvo.notas(),
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
