// Leva `guidance` e `requiredAction` do fonte para o banco, casando por descrição.
//
// Existe porque o seed **pula roteiro que já existe pelo nome** — é o que protege
// roteiro editado no admin de ser sobrescrito. O efeito colateral é que campo novo
// escrito em `src/data/` nunca chega: a coluna é criada, os itens continuam com ela
// vazia e a tela abre em branco, sem erro nenhum. Aconteceu com `guidance` em
// 04/09/2026 e voltaria a acontecer com `requiredAction`.
//
// O casamento é por `description` porque o `est-0xx` do fonte **não existe no banco**:
// lá o id é uuid e não há coluna `code`. Descrição duplicada ou sem par é relatada e
// nada é gravado — a checagem vem antes da escrita, de propósito.
//
//   npx tsx scripts/sincroniza-textos-do-roteiro.ts            # só confere
//   npx tsx scripts/sincroniza-textos-do-roteiro.ts --aplicar  # grava
//
// Roteiro alvo pelo nome, com `--roteiro="..."`; sem isso, faz todos os mapeados.
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from './env';
import { templateEsteticaClinica } from '../src/data/estetica/roteiro-clinica';
import { templateServicosSaude } from '../src/data/saude/roteiro-servicos-saude';
import type { ChecklistTemplate } from '../src/types';

const ROTEIROS: ChecklistTemplate[] = [templateEsteticaClinica, templateServicosSaude];

const aplicar = process.argv.includes('--aplicar');
const filtro = process.argv.find(a => a.startsWith('--roteiro='))?.slice('--roteiro='.length);

const { url, key } = requireSupabaseEnv();
const db = createClient(url, key, { auth: { persistSession: false } });

type Linha = { id: string; description: string; guidance: string | null; required_action: string | null };

async function sincroniza(roteiro: ChecklistTemplate) {
  const { data: tpl, error: eTpl } = await db
    .from('checklist_templates')
    .select('id, name')
    .eq('name', roteiro.name)
    .maybeSingle();
  if (eTpl) throw eTpl;
  if (!tpl) {
    console.log(`\n· ${roteiro.name}\n  não existe no banco — nada a sincronizar.`);
    return;
  }

  const { data: secoes, error: eSec } = await db
    .from('checklist_sections')
    .select('id')
    .eq('template_id', tpl.id);
  if (eSec) throw eSec;

  const { data: linhas, error: eIt } = await db
    .from('checklist_items')
    .select('id, description, guidance, required_action')
    .in('section_id', (secoes || []).map(s => s.id))
    .is('retired_at', null);
  if (eIt) throw eIt;

  // Uma descrição pode aparecer em mais de um item; guardar todos e decidir depois.
  const porDescricao = new Map<string, Linha[]>();
  for (const linha of (linhas || []) as Linha[]) {
    const lista = porDescricao.get(linha.description) || [];
    lista.push(linha);
    porDescricao.set(linha.description, lista);
  }

  const itens = roteiro.sections.flatMap(s => s.items).filter(i => !i.retiredAt);
  const semPar: string[] = [];
  const duplicados: string[] = [];
  const aGravar: { id: string; guidance: string | null; required_action: string | null }[] = [];
  let iguais = 0;

  for (const item of itens) {
    const alvos = porDescricao.get(item.description);
    if (!alvos || alvos.length === 0) {
      semPar.push(item.id);
      continue;
    }
    if (alvos.length > 1) duplicados.push(item.id);

    for (const alvo of alvos) {
      const guidance = item.guidance ?? null;
      const requiredAction = item.requiredAction ?? null;
      if (alvo.guidance === guidance && alvo.required_action === requiredAction) {
        iguais += 1;
        continue;
      }
      aGravar.push({ id: alvo.id, guidance, required_action: requiredAction });
    }
  }

  console.log(`\n· ${roteiro.name}`);
  console.log(`  no fonte: ${itens.length} · no banco: ${linhas?.length ?? 0}`);
  console.log(`  já iguais: ${iguais} · a gravar: ${aGravar.length}`);
  if (semPar.length) console.log(`  SEM PAR no banco (${semPar.length}): ${semPar.join(', ')}`);
  if (duplicados.length) console.log(`  descrição duplicada (${duplicados.length}): ${duplicados.join(', ')}`);

  if (!aplicar) {
    if (aGravar.length) console.log('  (conferência — rode com --aplicar para gravar)');
    return;
  }

  // Um update por item: o upsert levaria a linha inteira e apagaria coluna que o
  // fonte não conhece. São ~100 chamadas, e isto roda uma vez por mudança de texto.
  let gravados = 0;
  for (const linha of aGravar) {
    const { error } = await db
      .from('checklist_items')
      .update({ guidance: linha.guidance, required_action: linha.required_action })
      .eq('id', linha.id);
    if (error) throw error;
    gravados += 1;
  }
  console.log(`  gravados: ${gravados}`);
}

for (const roteiro of ROTEIROS) {
  if (filtro && roteiro.name !== filtro) continue;
  await sincroniza(roteiro);
}
console.log(aplicar ? '\nfeito.' : '\nnada foi gravado.');
