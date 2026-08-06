// REF-04 — cura `requirement_type` e `legislation_name` dos itens legais que
// citavam texto genérico ("Boas Práticas", "Normas do Corpo de Bombeiros") em vez
// de ato normativo.
//
//   npx tsx scripts/ref04-curadoria-requirement-type.ts            # simulação (padrão)
//   npx tsx scripts/ref04-curadoria-requirement-type.ts --apply    # grava em produção
//
// Precisa de VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
//
// POR QUE SÓ BANCO, E NÃO src/data/
// Os 47 itens de estética vivem em três roteiros `[ARQUIVADO]` que já foram
// substituídos pelos roteiros curados de 08/2026 e **não existem mais em
// `src/data/`**. Não há seed que possa reverter esta gravação. O único item de
// roteiro ativo é o `go-003` do ILPI Goiás, cuja correção já está no código desde
// o REF-02 (src/data/templates_ilpi_go.ts) — aqui o banco só está sendo alinhado
// ao que o código já diz.
//
// DE ONDE VEM CADA DECISÃO
// Nenhuma é nova. Cada item arquivado tem contraparte nos roteiros curados pela
// Ester (src/data/estetica/roteiro-clinica.ts), e a decisão aplicada é a mesma
// que ela tomou lá — o `precedente` de cada linha aponta o id correspondente.
//
// APLICAR EM PRODUÇÃO EXIGE AUTORIZAÇÃO EXPLÍCITA DA ESTER (regra 1 do handoff).
import { createClient } from '@supabase/supabase-js';
import { resolveLegislationUrl } from '../src/utils/legislationRefs';

const APPLY = process.argv.includes('--apply');
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

/** Uma decisão de curadoria, casada pelo início da descrição do item. */
type Decisao =
  | { desc: string; para: 'good_practice'; precedente: string }
  | { desc: string; para: 'legal'; legislacao: string; precedente: string };

// ── Vira boa prática (sem base legal vigente citável) ─────────────────────────
const VIRA_BOA_PRATICA: Decisao[] = [
  { desc: 'É utilizada barreira de proteção descartável', para: 'good_practice', precedente: 'est-053' },
  { desc: 'O estabelecimento possui extintores de incêndio', para: 'good_practice', precedente: 'est-095' },
  { desc: 'As saídas de emergência estão desobstruídas', para: 'good_practice', precedente: 'est-096' },
  { desc: 'O estabelecimento possui toda a sinalização visível', para: 'good_practice', precedente: 'est-107' },
  { desc: 'O estabelecimento possui um local seguro para a guarda de pertences', para: 'good_practice', precedente: 'est-106' },
  { desc: 'O descarte de embalagens de produtos é realizado', para: 'good_practice', precedente: 'est-104' },
  { desc: 'Apresenta Memorial Descritivo', para: 'good_practice', precedente: 'est-012' },
  { desc: 'Possui processo de qualificação de fornecedores', para: 'good_practice', precedente: 'est-015' },
  { desc: 'É proibido o fracionamento de produtos', para: 'good_practice', precedente: 'est-069' },
  { desc: 'Há controle de temperatura e integridade para amostras grátis', para: 'good_practice', precedente: 'est-076' },
  { desc: 'Os produtos expostos à venda', para: 'good_practice', precedente: 'est-068' },
  { desc: 'Possui plano de contingência para o armazenamento de produtos termolábeis', para: 'good_practice', precedente: 'est-072' },
  { desc: 'As toalhas de tecido, se utilizadas', para: 'good_practice', precedente: 'est-091' },
  { desc: 'Se o processamento de roupas é terceirizado', para: 'good_practice', precedente: 'est-090' },
  { desc: 'A empresa possui Livro de Reclamações', para: 'good_practice', precedente: 'est-102' },
];

// ── Continua exigência legal, reancorada em ato normativo real ────────────────
const REANCORA: Decisao[] = [
  { desc: 'Possui Alvará ou Licença Sanitária vigente', para: 'legal', legislacao: 'RDC Anvisa nº 63/2011', precedente: 'est-001' },
  { desc: 'Possui CNPJ e o CNAE é compatível', para: 'legal', legislacao: 'RDC Anvisa nº 63/2011', precedente: 'est-002' },
  { desc: 'Os profissionais executam apenas os procedimentos', para: 'legal', legislacao: 'Nota Técnica Anvisa nº 2/2024', precedente: 'est-094' },
  { desc: 'O estabelecimento está organizado, limpo', para: 'legal', legislacao: 'RDC Anvisa nº 63/2011', precedente: 'est-031' },
  { desc: 'As instruções pós-procedimento são fornecidas por escrito', para: 'legal', legislacao: 'Lei nº 8.078/1990, art. 6º, III', precedente: 'est-061' },
  { desc: 'A publicidade e propaganda do estabelecimento', para: 'legal', legislacao: 'Lei nº 8.078/1990', precedente: 'est-092' },
  { desc: 'Apresenta Termo de Consentimento Livre e Esclarecido', para: 'legal', legislacao: 'Lei nº 8.078/1990, art. 6º, III', precedente: 'est-009' },
  { desc: 'Há bebedouro com água potável', para: 'legal', legislacao: 'NR-24', precedente: 'est-098' },
  // Roteiro RJ arquivado. A Lei 5.991/1973 é ato real e vigente; faltava na
  // biblioteca, e foi catalogada junto com esta curadoria (REF-04).
  { desc: 'Medicamento identificado', para: 'legal', legislacao: 'Lei nº 5.991/1973', precedente: 'biblioteca REF-04' },
  { desc: 'Prescrição disponível', para: 'legal', legislacao: 'Lei nº 5.991/1973', precedente: 'biblioteca REF-04' },
  // ILPI Goiás, roteiro ativo. Correção já feita no código pelo REF-02
  // (src/data/templates_ilpi_go.ts, go-003); o banco ficou para trás.
  { desc: 'Apresenta CNPJ ativo e o CNAE declarado', para: 'legal', legislacao: 'Art. 8º, RDC 502/2021; Art. 276, Lei Municipal 1.812/2014', precedente: 'go-003 (REF-02)' },
];

const DECISOES = [...VIRA_BOA_PRATICA, ...REANCORA];

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

const items = await readAll('checklist_items', 'id,section_id,description,legislation_name,legislation_url,requirement_type');
const secs = await readAll('checklist_sections', 'id,template_id');
const tpls = await readAll('checklist_templates', 'id,name');

const tplBySection = new Map(secs.map((s: any) => [s.id, s.template_id]));
const nomeTpl = new Map(tpls.map((t: any) => [t.id, t.name]));

// Os roteiros tocados por esta curadoria, nomeados explicitamente. Escopar por
// roteiro — e não por "citação que não resolve" — mantém o script idempotente:
// depois da primeira passada as citações passam a resolver, e um filtro baseado
// nisso deixaria de reencontrar os próprios itens que acabou de corrigir.
const ROTEIROS_ALVO = [
  '[ARQUIVADO] Roteiro de Inspeção — Estética e Beleza',
  '[ARQUIVADO] Roteiro de Inspeção — Estética e Beleza (v2027)',
  '[ARQUIVADO] Roteiro de Inspeção — Clínica de Estética e Saúde | RJ / Rio de Janeiro',
  'Roteiro de Inspeção — ILPI | Goiás / Senador Canedo',
];

const idsAlvo = new Set(
  tpls.filter((t: any) => ROTEIROS_ALVO.includes(t.name)).map((t: any) => t.id)
);

const faltando = ROTEIROS_ALVO.filter(n => !tpls.some((t: any) => t.name === n));
if (faltando.length) {
  throw new Error(`Roteiros não encontrados no banco: ${faltando.join(' | ')}`);
}

const alvo = items.filter((i: any) => idsAlvo.has(tplBySection.get(i.section_id)));

const paraGravar: any[] = [];
const semDecisao: any[] = [];
let comDecisao = 0;

for (const item of alvo) {
  const desc = (item.description || '').trim();
  const d = DECISOES.find(x => desc.startsWith(x.desc));
  if (!d) {
    // Sem decisão só é problema se o item continua sendo exigência legal sem ato
    // resolvível — que é justamente a lacuna que este card fecha. O resto dos
    // itens desses roteiros já está íntegro e não é tocado.
    if (item.requirement_type !== 'good_practice' && !resolveLegislationUrl(item.legislation_name)) {
      semDecisao.push(item);
    }
    continue;
  }

  comDecisao++;
  const patch: Record<string, any> = {};
  if (d.para === 'good_practice') {
    if (item.requirement_type !== 'good_practice') patch.requirement_type = 'good_practice';
    // Boa prática não tem base legal: a URL, se houver, é ruído no relatório.
    if (item.legislation_url) patch.legislation_url = null;
  } else {
    const alvoUrl = resolveLegislationUrl(d.legislacao);
    if (!alvoUrl) {
      throw new Error(
        `Decisão "${d.desc}" reancora em ${JSON.stringify(d.legislacao)}, que não resolve na biblioteca. ` +
          'Catalogue o ato em src/data/legislationLibrary.ts antes de rodar.'
      );
    }
    if (item.legislation_name !== d.legislacao) patch.legislation_name = d.legislacao;
    if (item.legislation_url !== alvoUrl) patch.legislation_url = alvoUrl;
  }

  if (Object.keys(patch).length) paraGravar.push({ item, d, patch });
}

console.log('=== REF-04 · curadoria de requirement_type ===');
console.log('modo                        :', APPLY ? 'APLICANDO' : 'simulação (use --apply para gravar)');
console.log('itens lidos                 :', items.length);
console.log('itens nos roteiros alvo     :', alvo.length);
console.log('cobertos por decisão        :', comDecisao);
console.log('a gravar                    :', paraGravar.length);
console.log('  → good_practice           :', paraGravar.filter(x => x.d.para === 'good_practice').length);
console.log('  → legal reancorado        :', paraGravar.filter(x => x.d.para === 'legal').length);
console.log('já no estado final          :', comDecisao - paraGravar.length);
console.log('legais sem ato e sem decisão:', semDecisao.length);

if (semDecisao.length) {
  console.log('\n--- itens legais sem decisão (precisam de curadoria antes de gravar) ---');
  for (const i of semDecisao) {
    console.log(` ${i.id}  ${JSON.stringify(i.legislation_name)}\n     ${i.description?.slice(0, 90)}`);
  }
}

console.log('\n--- alterações ---');
for (const { item, d, patch } of paraGravar) {
  console.log(` ${item.id}  [${d.precedente}]  ${item.description.slice(0, 70)}`);
  for (const [k, v] of Object.entries(patch)) {
    console.log(`     ${k}: ${JSON.stringify((item as any)[k])} → ${JSON.stringify(v)}`);
  }
}

if (!APPLY) {
  console.log('\nNada foi gravado. Reexecute com --apply após autorização explícita.');
  process.exit(semDecisao.length ? 1 : 0);
}

if (semDecisao.length) {
  console.error('\nAbortado: há itens legais sem decisão. Complete a tabela antes de aplicar.');
  process.exit(1);
}

let gravados = 0;
for (const { item, patch } of paraGravar) {
  const { error } = await sb.from('checklist_items').update(patch).eq('id', item.id);
  if (error) throw new Error(`item ${item.id}: ${error.message}`);
  gravados++;
  if (gravados % 10 === 0) console.log(`  ${gravados}/${paraGravar.length}`);
}

console.log('\nConcluído. Itens atualizados:', gravados);
console.log('Reexecutar é seguro: a segunda passada encontra tudo no estado final e não grava nada.');
