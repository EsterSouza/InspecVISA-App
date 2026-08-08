/**
 * Smoke do que está publicado — não do que o CI achou que publicou.
 *
 * Um health endpoint respondendo 200 não prova nada: a Vercel serve o `index.html`
 * de qualquer build. Este script pergunta três coisas diferentes:
 *
 *  1. de qual commit é o deploy (`/build-info.json`, que o service worker não cacheia);
 *  2. de qual commit é o HTML que o navegador recebe (meta `build-sha`) — divergir dos
 *     dois denuncia service worker preso em bundle antigo;
 *  3. se o código da feature está mesmo lá dentro, procurando uma string literal dela
 *     nos chunks que o `sw.js` lista.
 *
 * Uso:
 *   npx tsx scripts/prod-smoke.ts
 *   npx tsx scripts/prod-smoke.ts --url https://staging.exemplo.com --sha abc1234
 *   npx tsx scripts/prod-smoke.ts --onda portal-plano-acao
 */
import { execSync } from 'node:child_process';

const URL_PADRAO = 'https://inspecvisa.consultorasanitaria.com.br';

/**
 * Uma linha por onda liberada. O texto tem de ser string literal da UI: nome de
 * identificador some na minificação, string literal não. Ao liberar uma onda nova,
 * acrescente aqui — é isto que separa "o CI publicou" de "a feature está no ar".
 */
const MARCADORES = [
  { onda: 'portal-pastas', card: 'P360-004/PORT-02', texto: 'Pasta Principal Completa' },
  { onda: 'portal-plano-acao', card: 'P360-010/PORT-03', texto: 'Estou providenciando' },
  { onda: 'portal-evidencia', card: 'P360-011', texto: 'Enviar evidência' },
  { onda: 'portal-acesso', card: 'PORT-01', texto: 'Acesso do portal' },
  { onda: 'portal-solicitacoes', card: 'P360-012', texto: 'Solicitações de consultoria' },
  {
    onda: 'painel-operacional',
    card: 'P360-013',
    texto: 'O que exige ação agora, sem abrir cliente por cliente.',
  },
];

/** Arquivos que não podem ser cacheados, senão o cliente fica preso em bundle velho. */
const SEM_CACHE = ['/', '/index.html', '/sw.js', '/build-info.json'];

type Resultado = { ok: boolean; titulo: string; detalhe: string };

const resultados: Resultado[] = [];

function registra(ok: boolean, titulo: string, detalhe: string) {
  resultados.push({ ok, titulo, detalhe });
  console.log(`${ok ? '  OK  ' : ' FALHA'} │ ${titulo}\n       │ ${detalhe}`);
}

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function shaLocal(): string {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

async function baixa(url: string): Promise<{ status: number; texto: string; headers: Headers }> {
  const resposta = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  return { status: resposta.status, texto: await resposta.text(), headers: resposta.headers };
}

/** Baixa em lotes para não abrir 65 conexões de uma vez. */
async function baixaTodos(urls: string[], simultaneos = 8): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (let i = 0; i < urls.length; i += simultaneos) {
    const lote = urls.slice(i, i + simultaneos);
    const respostas = await Promise.all(lote.map((u) => baixa(u).catch(() => null)));
    lote.forEach((u, j) => {
      const r = respostas[j];
      if (r && r.status === 200) mapa.set(u, r.texto);
    });
  }
  return mapa;
}

async function main() {
  const base = (arg('url') || URL_PADRAO).replace(/\/$/, '');
  const shaEsperado = arg('sha') || shaLocal();
  const ondaFiltro = arg('onda');

  console.log(`\nSmoke de ${base}`);
  console.log(`SHA esperado: ${shaEsperado || '(nenhum — só relata o que está no ar)'}\n`);

  // 1. de qual commit é o deploy
  const info = await baixa(`${base}/build-info.json`);
  if (info.status !== 200) {
    registra(
      false,
      'build-info.json publicado',
      `HTTP ${info.status}. Deploy anterior ao P360-015 não tem o arquivo — republique antes de confiar no resto.`
    );
    return encerra();
  }
  let publicado: { sha?: string; shaCurto?: string; branch?: string; geradoEm?: string; ambiente?: string };
  try {
    publicado = JSON.parse(info.texto);
  } catch {
    // O catch-all do vercel.json manda qualquer caminho desconhecido para o
    // index.html com status 200 — por isso "responde 200" não prova nada aqui, e
    // um arquivo ausente chega como HTML em vez de 404.
    const pareceIndex = info.texto.trimStart().startsWith('<!doctype html');
    registra(
      false,
      'build-info.json legível',
      pareceIndex
        ? 'veio o index.html (o catch-all da Vercel responde 200 para caminho inexistente) — este deploy é anterior ao P360-015'
        : `resposta não é JSON: ${info.texto.slice(0, 120)}`
    );
    return encerra();
  }
  registra(
    true,
    'build-info.json publicado',
    `sha ${publicado.shaCurto} · branch ${publicado.branch} · ambiente ${publicado.ambiente} · gerado ${publicado.geradoEm}`
  );

  if (shaEsperado) {
    const bate = publicado.sha === shaEsperado;
    registra(
      bate,
      'deploy está no SHA esperado',
      bate
        ? `${publicado.shaCurto} confere`
        : `publicado ${publicado.sha} ≠ esperado ${shaEsperado} — a Vercel ainda não terminou, ou publicou outro commit`
    );
  }

  // 2. de qual commit é o HTML entregue
  const html = await baixa(`${base}/`);
  const metaSha = html.texto.match(/<meta[^>]+name="build-sha"[^>]+content="([^"]+)"/)?.[1];
  if (!metaSha) {
    registra(false, 'HTML carimbado com o SHA', 'meta build-sha ausente no index.html servido');
  } else {
    const bate = metaSha === publicado.sha;
    registra(
      bate,
      'HTML servido é do mesmo build',
      bate ? `meta build-sha = ${metaSha.slice(0, 7)}` : `HTML em ${metaSha.slice(0, 7)}, deploy em ${publicado.shaCurto}`
    );
  }

  // 3. cabeçalhos que impedem o cliente de ficar preso em bundle velho.
  // Só valem no ambiente publicado: quem serve esses headers é o vercel.json, e o
  // `vite preview` responde `no-cache` por conta própria.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(base)) {
    console.log('  pula  │ Cache-Control: quem serve esses headers é a Vercel, não o preview local');
  } else {
    for (const caminho of SEM_CACHE) {
      const r = await fetch(`${base}${caminho}`, { cache: 'no-store' });
      const cc = r.headers.get('cache-control') || '(ausente)';
      registra(/no-store/.test(cc), `sem cache em ${caminho}`, `Cache-Control: ${cc}`);
    }
  }

  // 4. os chunks que o service worker vai precachear
  const sw = await baixa(`${base}/sw.js`);
  if (sw.status !== 200) {
    registra(false, 'service worker publicado', `HTTP ${sw.status} em /sw.js`);
    return encerra();
  }
  const chunks = [...new Set(sw.texto.match(/assets\/[A-Za-z0-9_.-]+\.js/g) || [])];
  registra(chunks.length > 0, 'service worker lista os chunks', `${chunks.length} arquivos js no precache`);

  // 5. o código da feature está mesmo no ar
  const corpos = await baixaTodos(chunks.map((c) => `${base}/${c}`));
  registra(
    corpos.size === chunks.length,
    'todos os chunks do precache respondem',
    `${corpos.size}/${chunks.length} baixados`
  );

  const alvo = ondaFiltro ? MARCADORES.filter((m) => m.onda === ondaFiltro) : MARCADORES;
  if (ondaFiltro && alvo.length === 0) {
    registra(false, `onda ${ondaFiltro}`, `não existe em MARCADORES — ondas: ${MARCADORES.map((m) => m.onda).join(', ')}`);
  }
  for (const marcador of alvo) {
    const onde = [...corpos.entries()]
      .filter(([, corpo]) => corpo.includes(marcador.texto))
      .map(([url]) => url.slice(base.length + 1));
    registra(
      onde.length > 0,
      `onda ${marcador.onda} (${marcador.card}) no bundle`,
      onde.length > 0 ? `“${marcador.texto}” em ${onde.join(', ')}` : `“${marcador.texto}” não encontrado em nenhum chunk`
    );
  }

  encerra();
}

function encerra() {
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);
  if (falhas.length > 0) {
    console.log('\nFalhou:');
    for (const f of falhas) console.log(`  · ${f.titulo} — ${f.detalhe}`);
  }
  // `process.exitCode` em vez de `process.exit`: no Windows, encerrar com fetch
  // ainda pendente derruba o processo com assertion do libuv.
  process.exitCode = falhas.length > 0 ? 1 : 0;
}

main().catch((erro) => {
  console.error('\nSmoke não completou:', erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
