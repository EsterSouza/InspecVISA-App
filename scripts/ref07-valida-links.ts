// REF-07 — confere se a URL de cada verbete da biblioteca ainda resolve.
//
// Por que: a URL é o que o cliente clica na página de referências do relatório.
// Link morto ou redirecionado para a home do órgão vira uma citação que não
// comprova nada, e nada no app avisa — a biblioteca não é exercitada em teste.
//
// Uso:  npx tsx scripts/ref07-valida-links.ts
// Saída: uma linha por verbete com problema; código de saída 1 se houver algum.
//
// Lê src/data/legislationLibrary.ts, que é a fonte de verdade (REF-02). Não toca
// no Supabase — a carga do banco vem da migration gerada a partir deste arquivo.

import { LEGISLATION_LIBRARY } from '../src/data/legislationLibrary';

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;

/**
 * 'quebrado' = o servidor respondeu e o documento não está lá.
 * 'inacessivel' = a conexão nem se estabeleceu. Costuma ser a rede de quem roda
 * (proxy, sandbox, bloqueio de saída) e não o link — bvsms.saude.gov.br e
 * planalto.gov.br derrubam a conexão em ambientes com egresso filtrado. Reportar
 * os dois juntos como "link morto" produziria uma lista de falso positivo maior
 * que a de achado real.
 */
type Verdict = 'quebrado' | 'inacessivel';
type Problem = { name: string; url: string; detail: string; verdict: Verdict };

/** Redirect para a raiz do host é o modo silencioso de um link morrer. */
function landedOnHomepage(finalUrl: string): boolean {
  try {
    const { pathname, search } = new URL(finalUrl);
    return (pathname === '/' || pathname === '') && !search;
  } catch {
    return false;
  }
}

async function check(name: string, url: string): Promise<Problem | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Alguns portais oficiais respondem 405 a HEAD; GET é o que o usuário faz.
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!res.ok) return { name, url, detail: `HTTP ${res.status}`, verdict: 'quebrado' };
    if (landedOnHomepage(res.url) && !landedOnHomepage(url)) {
      return { name, url, detail: `redirecionou para a home: ${res.url}`, verdict: 'quebrado' };
    }
    return null;
  } catch (err) {
    const cause = (err as { cause?: { code?: string } })?.cause?.code;
    const message = err instanceof Error ? err.message : String(err);
    return {
      name,
      url,
      detail: controller.signal.aborted ? `timeout (${TIMEOUT_MS}ms)` : (cause || message),
      verdict: 'inacessivel',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const entries = LEGISLATION_LIBRARY.map(e => ({ name: e.name, url: e.url }));
  const semUrl = entries.filter(e => !e.url?.trim());
  const comUrl = entries.filter(e => e.url?.trim());

  const problems: Problem[] = [];
  const queue = [...comUrl];
  // ponytail: pool manual de 6 requisições; se a biblioteca passar de algumas
  // centenas de verbetes, trocar por uma lib de concorrência.
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const problem = await check(item.name, item.url);
        if (problem) problems.push(problem);
        process.stdout.write(problem ? 'x' : '.');
      }
    })
  );
  process.stdout.write('\n\n');

  const byName = (a: Problem, b: Problem) => a.name.localeCompare(b.name);
  const quebrados = problems.filter(p => p.verdict === 'quebrado').sort(byName);
  const inacessiveis = problems.filter(p => p.verdict === 'inacessivel').sort(byName);

  for (const e of semUrl) console.log(`SEM URL      ${e.name}`);
  for (const p of quebrados) {
    console.log(`QUEBRADO     ${p.name}\n             ${p.url}\n             ${p.detail}`);
  }
  if (inacessiveis.length) {
    console.log(`\nNão verificados — a conexão não se estabeleceu. Rode de novo numa rede`);
    console.log(`sem filtro de saída antes de tratar qualquer um destes como link morto:`);
    for (const p of inacessiveis) console.log(`  ${p.detail.padEnd(12)} ${p.name}`);
  }

  console.log(
    `\n${comUrl.length} verificados · ${quebrados.length} quebrados · ` +
    `${inacessiveis.length} inacessíveis · ${semUrl.length} sem URL`
  );
  if (quebrados.length || semUrl.length) process.exit(1);
}

main();
