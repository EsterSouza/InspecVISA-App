// Semeia o Roteiro de Inspeção — Serviços de Saúde (Base Federal) em produção.
//
//   npx tsx scripts/seed-roteiro-saude.ts            # simulação (padrão)
//   npx tsx scripts/seed-roteiro-saude.ts --apply    # grava em produção
//
// POR QUE ISTO PRECISA EXISTIR
//
// O roteiro nasceu só no catálogo empacotado (src/data/saude/). O seletor de
// NewInspection mostra o catálogo e o banco juntos — o empacotado entra quando
// nenhum roteiro do banco tem o mesmo NOME —, então ele aparece na tela e dá a
// impressão de estar pronto. Só que uma inspeção criada sobre o roteiro
// empacotado grava cada resposta com o id do catálogo (`sau-001`), que não
// existe em `checklist_items`. Não há FK ali (ver
// docs/…/respostas-sem-fk-para-checklist-items), então nada reclama: a inspeção
// nasce órfã e em silêncio. É exatamente o que já deixou seis inspeções
// concluídas dependendo de um roteiro que depois sumiu do app — o comentário em
// NewInspection.tsx:137 conta essa história.
//
// O QUE ELE GRAVA
//
// Três tabelas, na ordem: `checklist_templates` (uma linha), `checklist_sections`
// (uma por seção, mantendo o `order` do catálogo) e `checklist_items` (uma por
// item, mantendo `order`, peso, criticidade, tipo e as duas colunas de
// legislação). Os ids são gerados pelo banco; a ponte entre catálogo e banco
// continua sendo a descrição normalizada, como em `applySupplement`.
//
// O que ele NÃO faz: não mexe em roteiro existente, não apaga nada e não toca
// em inspeção, resposta ou relatório. Se já houver roteiro com o mesmo nome, ele
// para — reconciliar dois roteiros de mesmo nome é trabalho de gente, não de
// script.
//
// APLICAR EM PRODUÇÃO EXIGE AUTORIZAÇÃO EXPLÍCITA.
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from './env';
import { templateServicosSaude } from '../src/data/saude/roteiro-servicos-saude';

const APPLY = process.argv.includes('--apply');

const { url, key } = requireSupabaseEnv();
const sb = createClient(url, key, { auth: { persistSession: false } });

const ROTEIRO = templateServicosSaude;

async function main() {
  console.log(`Semeando "${ROTEIRO.name}" — ${APPLY ? 'APLICANDO' : 'simulação'}\n`);

  const totalItens = ROTEIRO.sections.reduce((soma, secao) => soma + secao.items.length, 0);
  console.log(`Catálogo: ${ROTEIRO.sections.length} seções, ${totalItens} itens, versão ${ROTEIRO.version}.`);

  const { data: existente, error: erroBusca } = await sb
    .from('checklist_templates')
    .select('id, name')
    .eq('name', ROTEIRO.name)
    .maybeSingle();
  if (erroBusca) throw erroBusca;

  if (existente) {
    console.error(`\nJá existe roteiro com este nome: ${existente.id}`);
    console.error('Nada foi gravado. Dois roteiros de mesmo nome quebram o merge do seletor.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nSimulação — nada gravado. Com --apply, cria:');
    for (const secao of ROTEIRO.sections) {
      console.log(`  ${String(secao.order).padStart(2)}. ${secao.title} — ${secao.items.length} itens`);
    }
    return;
  }

  // ─── 1. O roteiro ──────────────────────────────────────────────────────────
  const { data: roteiro, error: erroRoteiro } = await sb
    .from('checklist_templates')
    .insert({ name: ROTEIRO.name, category: ROTEIRO.category, version: ROTEIRO.version })
    .select('id')
    .single();
  if (erroRoteiro) throw erroRoteiro;
  console.log(`\nRoteiro criado: ${roteiro.id}`);

  // ─── 2. As seções, com o `order` do catálogo ───────────────────────────────
  const { data: secoes, error: erroSecoes } = await sb
    .from('checklist_sections')
    .insert(ROTEIRO.sections.map((secao) => ({
      template_id: roteiro.id,
      title: secao.title,
      order: secao.order,
    })))
    .select('id, title');
  if (erroSecoes) throw erroSecoes;

  const idDaSecao = new Map((secoes || []).map((linha) => [String(linha.title), String(linha.id)]));
  console.log(`${(secoes || []).length} seções criadas.`);

  // ─── 3. Os itens, em blocos de 50 ──────────────────────────────────────────
  const itens = ROTEIRO.sections.flatMap((secao) => {
    const sectionId = idDaSecao.get(secao.title);
    if (!sectionId) throw new Error(`Seção "${secao.title}" não voltou do insert.`);
    return secao.items.map((item) => ({
      section_id: sectionId,
      description: item.description,
      legislation_name: item.legislation || null,
      legislation_url: item.legislationUrl || null,
      weight: item.weight ?? 1,
      is_critical: item.isCritical ?? false,
      requirement_type: item.requirementType || 'legal',
      order: item.order,
    }));
  });

  for (let i = 0; i < itens.length; i += 50) {
    const { error } = await sb.from('checklist_items').insert(itens.slice(i, i + 50));
    if (error) throw error;
  }
  console.log(`${itens.length} itens criados.`);
  console.log(`\nO id do roteiro em produção é ${roteiro.id} — é este que entra no piloto de condicionais.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
