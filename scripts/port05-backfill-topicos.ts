// PORT-05 — cria os tópicos clicáveis dos planos de ação que já foram entregues.
//
//   npx tsx scripts/port05-backfill-topicos.ts                     # simulação (padrão)
//   npx tsx scripts/port05-backfill-topicos.ts --apply             # grava em produção
//   npx tsx scripts/port05-backfill-topicos.ts --desde 2026-08-01  # recorte (padrão: 2026-08-01)
//
// Precisa de VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ver scripts/env.ts).
//
// POR QUE ESTE SCRIPT EXISTE
// A migration do PORT-05 entrou depois dos relatórios de agosto: os itens já publicados
// continuam com a ação corretiva num parágrafo só, e o cliente segue sem poder marcar
// tópico por tópico. Republicar o relatório resolveria — e reconciliaria título e prazo
// de todo o plano de ação junto, que não é o que se quer num relatório já entregue.
// Aqui só se acrescenta o que faltava.
//
// POR QUE SCRIPT E NÃO SQL
// Quem decide o que é tópico é `buildCheckpoints` (src/utils/actionCheckpoints.ts), a mesma
// função que a publicação usa. Reescrever a regra em PL/pgSQL criaria uma segunda cópia dela,
// que dias depois divergiria da primeira.
//
// O QUE ELE NUNCA FAZ
// Não apaga, não atualiza e não desmarca nada: só INSERE tópico que ainda não existe naquele
// item. Um `done_at` que o cliente já tenha marcado é intocável. Rodar duas vezes não duplica.
//
// APLICAR EM PRODUÇÃO EXIGE AUTORIZAÇÃO EXPLÍCITA DA ESTER.
import { createClient } from '@supabase/supabase-js';
import { buildCheckpoints } from '../src/utils/actionCheckpoints';
import { requireSupabaseEnv } from './env';

const APPLY = process.argv.includes('--apply');
const argDesde = process.argv.indexOf('--desde');
const DESDE = argDesde >= 0 ? process.argv[argDesde + 1] : '2026-08-01';

const { url, key } = requireSupabaseEnv();
const sb = createClient(url, key, { auth: { persistSession: false } });

type LinhaItem = {
  id: string;
  tenant_id: string;
  client_id: string;
  status: string;
  title: string | null;
  recommended_action: string | null;
  published_at: string | null;
};

type LinhaTopico = { action_item_id: string; checkpoint_key: string };

/** Página a página: o PostgREST corta em mil linhas em silêncio. */
async function lerItens(): Promise<LinhaItem[]> {
  const out: LinhaItem[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('client_action_items')
      .select('id,tenant_id,client_id,status,title,recommended_action,published_at')
      // Só `published`: `resolved` já foi encerrado (mostrar caixa vazia num item fechado
      // seria dizer ao cliente que voltou a ter o que fazer), e a RPC de marcar tópico
      // recusa item que não esteja publicado — a caixa nasceria travada.
      .eq('status', 'published')
      .gte('published_at', `${DESDE}T00:00:00Z`)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`client_action_items: ${error.message}`);
    const linhas = (data ?? []) as LinhaItem[];
    out.push(...linhas);
    if (linhas.length < 1000) break;
  }
  return out;
}

async function lerTopicosExistentes(ids: string[]): Promise<Map<string, Set<string>>> {
  const mapa = new Map<string, Set<string>>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb
      .from('client_action_checkpoints')
      .select('action_item_id,checkpoint_key')
      .in('action_item_id', ids.slice(i, i + 200));
    if (error) throw new Error(`client_action_checkpoints: ${error.message}`);
    for (const linha of (data ?? []) as LinhaTopico[]) {
      const chaves = mapa.get(linha.action_item_id) ?? new Set<string>();
      chaves.add(linha.checkpoint_key);
      mapa.set(linha.action_item_id, chaves);
    }
  }
  return mapa;
}

const itens = await lerItens();
const existentes = await lerTopicosExistentes(itens.map((i) => i.id));

type NovaLinha = {
  tenant_id: string;
  action_item_id: string;
  checkpoint_key: string;
  ordinal: number;
  text: string;
};

const inserir: NovaLinha[] = [];
const itensComTopico: LinhaItem[] = [];
const itensSemTopico: LinhaItem[] = [];
const itensJaSincronizados: LinhaItem[] = [];

for (const item of itens) {
  const topicos = buildCheckpoints(item.recommended_action);
  if (topicos.length === 0) {
    itensSemTopico.push(item);
    continue;
  }
  itensComTopico.push(item);

  const jaTem = existentes.get(item.id) ?? new Set<string>();
  const faltando = topicos.filter((t) => !jaTem.has(t.key));
  if (faltando.length === 0) {
    itensJaSincronizados.push(item);
    continue;
  }

  // O `ordinal` é a posição no texto, não a posição entre os que faltam: se um dia
  // metade já existir, o que entrar depois continua caindo no lugar certo da lista.
  for (const topico of faltando) {
    inserir.push({
      tenant_id: item.tenant_id,
      action_item_id: item.id,
      checkpoint_key: topico.key,
      ordinal: topicos.findIndex((t) => t.key === topico.key) + 1,
      text: topico.text,
    });
  }
}

const clientesAtingidos = new Set(itensComTopico.map((i) => i.client_id));

console.log('=== PORT-05 · tópicos dos relatórios já entregues ===');
console.log('modo                          :', APPLY ? 'APLICANDO' : 'simulação (use --apply para gravar)');
console.log('recorte                       : publicados a partir de', DESDE);
console.log('itens publicados lidos        :', itens.length);
console.log('  com ação em tópicos         :', itensComTopico.length, `(${clientesAtingidos.size} clientes)`);
console.log('  em parágrafo corrido        :', itensSemTopico.length, '(ficam como estão, por definição)');
console.log('  já com os tópicos no banco  :', itensJaSincronizados.length);
console.log('tópicos a criar               :', inserir.length);

const porItem = new Map<string, number>();
for (const linha of inserir) porItem.set(linha.action_item_id, (porItem.get(linha.action_item_id) ?? 0) + 1);
const distribuicao = new Map<number, number>();
for (const quantos of porItem.values()) distribuicao.set(quantos, (distribuicao.get(quantos) ?? 0) + 1);
console.log('\n--- quantos tópicos por item ---');
for (const [quantos, itensAssim] of [...distribuicao].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${String(quantos).padStart(2)} tópico(s): ${itensAssim} item(ns)`);
}

console.log('\n--- amostra (10 primeiros itens) ---');
for (const item of itensComTopico.filter((i) => porItem.has(i.id)).slice(0, 10)) {
  console.log(`\n• ${item.title ?? '(sem título)'}`);
  for (const linha of inserir.filter((l) => l.action_item_id === item.id)) {
    console.log(`    ${linha.ordinal}. ${linha.text}`);
  }
}

if (!APPLY) {
  console.log('\nNada foi gravado. Rode com --apply para criar os tópicos.');
  process.exit(0);
}

let gravados = 0;
for (let i = 0; i < inserir.length; i += 200) {
  const lote = inserir.slice(i, i + 200);
  // `ignoreDuplicates`: se outra publicação criar o mesmo tópico enquanto isto roda,
  // a linha dela fica — inclusive o `done_at` que o cliente já tenha marcado nela.
  const { error } = await sb
    .from('client_action_checkpoints')
    .upsert(lote, { onConflict: 'action_item_id,checkpoint_key', ignoreDuplicates: true });
  if (error) throw new Error(`insert: ${error.message}`);
  gravados += lote.length;
  console.log(`gravados ${gravados}/${inserir.length}`);
}

console.log('\nPronto. Os tópicos já aparecem no portal do cliente.');
