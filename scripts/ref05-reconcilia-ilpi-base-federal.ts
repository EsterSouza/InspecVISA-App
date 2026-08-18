// REF-05 — reconcilia o roteiro ILPI (Base Federal) entre `src/data/templates.ts` e o banco.
//
//   npx tsx scripts/ref05-reconcilia-ilpi-base-federal.ts            # simulação (padrão)
//   npx tsx scripts/ref05-reconcilia-ilpi-base-federal.ts --apply    # grava em produção
//
// Lê VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente ou do .env (scripts/env.ts).
//
// O QUE JÁ FOI FEITO NO CÓDIGO, E NÃO AQUI
// A maior parte da reconciliação foi trazer o **banco para o código**: 10 itens que só
// existiam em produção, 15 flags `isCritical` e 2 citações de artigo em que o banco estava
// certo (Art. 29 VI é a sala administrativa, não a XII; o banheiro do dormitório é o
// Art. 29 I item 5). Nada disso toca produção — o código é que estava para trás.
//
// O QUE ESTE SCRIPT FAZ, E POR QUE ASSIM
// Sobra o inverso: a quebra dos cuidadores por grau de dependência, que o código tem fiel ao
// Art. 16 II a/b/c e o banco tem comprimida num item só.
//
// O item agregado do banco **não é apagado** — ele é reescrito no lugar, virando o item de
// escala de trabalho (`fed-076a`), que é o que ele já perguntava. Isso importa: 18 inspeções
// concluídas têm resposta nesse item, e `responses.item_id` não tem chave estrangeira para
// `checklist_items`. Apagar a linha deixaria 18 respostas órfãs, e o relatório as
// renderizaria na seção "Itens preservados do roteiro concluído" com a descrição degradada
// para o texto da resposta (`buildLegacyCompletedReportTemplate`, src/utils/reportTemplate.ts).
// Reescrevendo no lugar, nenhuma resposta é órfã e nenhum relatório muda de forma.
//
// APLICAR EM PRODUÇÃO EXIGE AUTORIZAÇÃO EXPLÍCITA DA ESTER (regra 1 do handoff).
import { createClient } from '@supabase/supabase-js';
import { templates } from '../src/data/templates';
import { requireSupabaseEnv } from './env';
import { lerTudo, type LinhaItem, type LinhaRoteiro, type LinhaSecao } from './linhas';
import type { ChecklistItem } from '../src/types';

const APPLY = process.argv.includes('--apply');
const { url, key } = requireSupabaseEnv();
const sb = createClient(url, key, { auth: { persistSession: false } });

const ROTEIRO = 'Roteiro de Inspeção — ILPI (Base Federal)';
const SECAO_RH = 'Recursos Humanos';

/** Item agregado a ser reescrito, casado pelo início da descrição. */
const AGREGADO = 'Cuidadores em quantidade adequada ao grau de dependência';
/** Item do código que assume o lugar do agregado (mesma pergunta, redação da norma). */
const VIRA = 'fed-076a';
/** Itens do código a inserir ao lado dele. */
const INSERIR = ['fed-068', 'fed-069', 'fed-070'];

const [items, secs, tpls] = await Promise.all([
  lerTudo<LinhaItem>(sb, 'checklist_items', '*'),
  lerTudo<Pick<LinhaSecao, 'id' | 'title' | 'template_id'>>(sb, 'checklist_sections', 'id,title,template_id'),
  lerTudo<Pick<LinhaRoteiro, 'id' | 'name'>>(sb, 'checklist_templates', 'id,name'),
]);

const tpl = tpls.find(t => t.name === ROTEIRO);
if (!tpl) throw new Error(`Roteiro não encontrado no banco: ${ROTEIRO}`);

const minhasSecoes = secs.filter(s => s.template_id === tpl.id);
const secaoRH = minhasSecoes.find(s => s.title === SECAO_RH);
if (!secaoRH) throw new Error(`Seção não encontrada: ${SECAO_RH}`);

const idsSecao = new Set(minhasSecoes.map(s => s.id));
const itensDoRoteiro = items.filter(i => idsSecao.has(i.section_id));

const codigo = templates.find(t => t.name === ROTEIRO);
if (!codigo) throw new Error(`Roteiro não encontrado no código: ${ROTEIRO}`);
const itensCodigo: ChecklistItem[] = codigo.sections.flatMap(s => s.items);
const doCodigo = (id: string) => {
  const i = itensCodigo.find(x => x.id === id);
  if (!i) throw new Error(`Item ${id} não existe mais em src/data/templates.ts`);
  return i;
};

const paraLinha = (c: ChecklistItem) => ({
  section_id: secaoRH.id,
  description: c.description,
  legislation_name: c.legislation,
  weight: c.weight,
  is_critical: !!c.isCritical,
  order: c.order,
  requirement_type: c.requirementType || 'legal',
});

// ── 1. Reescrita do agregado ────────────────────────────────────────────────
const agregado = itensDoRoteiro.find(i => (i.description || '').startsWith(AGREGADO));
const alvoVira = doCodigo(VIRA);
// O que estava lá vai junto no objeto: o relatório abaixo imprime o "de" e o "para",
// e assim não depende de o `agregado` ainda existir na hora de imprimir.
const reescrita = agregado && agregado.description !== alvoVira.description
  ? { id: agregado.id, de: agregado.description, deLegislacao: agregado.legislation_name, patch: paraLinha(alvoVira) }
  : null;

// ── 2. Inserções ────────────────────────────────────────────────────────────
const jaExiste = new Set(itensDoRoteiro.map(i => (i.description || '').trim()));
const inserir = INSERIR.map(doCodigo).filter(c => !jaExiste.has(c.description.trim()));

// ── 3. Citação do descanso da enfermagem (decisão da Ester: só a lei federal) ──
const descanso = itensDoRoteiro.find(i => (i.description || '').startsWith('Dispõe de local/sala de descanso'));
const citacaoDescanso = descanso && itensCodigo.find(c => c.description === descanso.description)?.legislation;
const ajusteDescanso =
  descanso && citacaoDescanso && descanso.legislation_name !== citacaoDescanso
    ? { id: descanso.id, de: descanso.legislation_name, para: citacaoDescanso }
    : null;

console.log('=== REF-05 · reconciliação do ILPI (Base Federal) ===');
console.log('modo                  :', APPLY ? 'APLICANDO' : 'simulação (use --apply para gravar)');
console.log('itens no banco        :', itensDoRoteiro.length);
console.log('itens no código       :', itensCodigo.length);
console.log('reescrever agregado   :', reescrita ? 'sim' : 'não (já no estado final)');
console.log('inserir               :', inserir.length);
console.log('ajustar citação       :', ajusteDescanso ? 'sim' : 'não (já no estado final)');

if (reescrita) {
  console.log(`\n--- reescrita no lugar (id ${reescrita.id}) ---`);
  console.log(`  de   : ${reescrita.de}`);
  console.log(`  para : ${reescrita.patch.description}`);
  console.log(`  leg  : ${JSON.stringify(reescrita.deLegislacao)} → ${JSON.stringify(reescrita.patch.legislation_name)}`);
}
if (inserir.length) {
  console.log('\n--- inserções ---');
  for (const c of inserir) console.log(`  [${c.id}] ${c.description.slice(0, 90)}\n        ${JSON.stringify(c.legislation)}`);
}
if (ajusteDescanso) {
  console.log(`\n--- citação (id ${ajusteDescanso.id}) ---`);
  console.log(`  de   : ${JSON.stringify(ajusteDescanso.de)}`);
  console.log(`  para : ${JSON.stringify(ajusteDescanso.para)}`);
}

if (!APPLY) {
  console.log('\nNada foi gravado. Reexecute com --apply após autorização explícita.');
  process.exit(0);
}

if (reescrita) {
  const { error } = await sb.from('checklist_items').update(reescrita.patch).eq('id', reescrita.id);
  if (error) throw new Error(`reescrita: ${error.message}`);
  console.log('  agregado reescrito');
}
if (inserir.length) {
  const { error } = await sb.from('checklist_items').insert(inserir.map(paraLinha));
  if (error) throw new Error(`inserção: ${error.message}`);
  console.log(`  ${inserir.length} itens inseridos`);
}
if (ajusteDescanso) {
  const { error } = await sb
    .from('checklist_items')
    .update({ legislation_name: ajusteDescanso.para })
    .eq('id', ajusteDescanso.id);
  if (error) throw new Error(`citação: ${error.message}`);
  console.log('  citação ajustada');
}

console.log('\nConcluído. Reexecutar é seguro: a segunda passada não encontra nada a fazer.');
