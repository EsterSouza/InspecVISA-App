/**
 * Baixa TODOS os componentes do React Bits para dentro da skill `reactbits`,
 * para não precisar consultar o site nem o MCP deles de novo.
 *
 * Fonte: github.com/DavidHDev/react-bits — MIT + Commons Clause, livre para uso
 * pessoal e comercial. O Commons Clause proíbe vender o próprio software; usar os
 * componentes dentro dos nossos produtos está liberado. A licença vai copiada
 * junto, no LICENCA.md, para a origem nunca ficar implícita.
 *
 * Rodar:  node scripts/biblioteca/coletar-reactbits.mjs
 * É idempotente e retomável: pula arquivo já baixado, a menos que passe --forcar.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const DESTINO = join(RAIZ, '.claude', 'skills', 'reactbits', 'componentes');

const REPO = 'DavidHDev/react-bits';
const PREFIXO = 'src/content/';
const forcar = process.argv.includes('--forcar');

/* O GitHub corta requisição sem User-Agent. */
const CABECALHOS = { 'User-Agent': 'inspecvisa-biblioteca', Accept: 'application/vnd.github+json' };

const existe = (p) => access(p).then(() => true, () => false);

async function baixarArvore() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, { headers: CABECALHOS });
  if (!r.ok) throw new Error(`árvore do repositório: HTTP ${r.status}`);
  const json = await r.json();
  if (json.truncated) throw new Error('a árvore veio truncada — precisa paginar por diretório');
  return json.tree.filter((n) => n.type === 'blob' && n.path.startsWith(PREFIXO));
}

async function baixarArquivo(caminho) {
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${caminho}`, { headers: { 'User-Agent': CABECALHOS['User-Agent'] } });
  if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
  return r.text();
}

/* Categoria do React Bits → como a gente chama. As quatro pastas do repositório
   viram o mesmo nome que aparece no menu do site deles. */
const CATEGORIAS = {
  Animations: 'Animacoes',
  Backgrounds: 'Fundos',
  Components: 'Componentes',
  TextAnimations: 'Texto-animado'
};

async function main() {
  console.log('Lendo a árvore do repositório…');
  const blobs = await baixarArvore();
  console.log(`${blobs.length} arquivos em ${PREFIXO}`);

  const componentes = new Map(); // "Categoria/Nome" → { categoria, nome, arquivos[] }

  for (const b of blobs) {
    const partes = b.path.slice(PREFIXO.length).split('/');
    if (partes.length < 2) continue;
    const [catOriginal, nome] = partes;
    const categoria = CATEGORIAS[catOriginal] || catOriginal;
    const chave = `${categoria}/${nome}`;
    if (!componentes.has(chave)) componentes.set(chave, { categoria, nome, catOriginal, arquivos: [] });
    componentes.get(chave).arquivos.push({ caminho: b.path, arquivo: partes.slice(1).join('/'), tamanho: b.size });
  }

  console.log(`${componentes.size} componentes\n`);

  let baixados = 0, pulados = 0, falhas = [];

  for (const [chave, c] of componentes) {
    const pasta = join(DESTINO, c.categoria, c.nome);
    await mkdir(pasta, { recursive: true });

    for (const a of c.arquivos) {
      const destino = join(pasta, a.arquivo.split('/').slice(1).join('/') || a.arquivo);
      await mkdir(dirname(destino), { recursive: true });

      if (!forcar && (await existe(destino))) { pulados++; continue; }

      try {
        const conteudo = await baixarArquivo(a.caminho);
        await writeFile(destino, conteudo, 'utf8');
        baixados++;
      } catch (e) {
        falhas.push(`${chave} · ${a.arquivo}: ${e.message}`);
      }
    }
    process.stdout.write(`\r  ${baixados} baixados · ${pulados} já existiam · ${falhas.length} falhas   `);
  }
  console.log('\n');

  /* ---- Dependência de cada componente ----
     É a informação que decide se dá para usar: o app não tem nenhuma biblioteca
     de animação, então "só CSS" e "precisa de three.js" são conversas diferentes.
     Sai dos próprios imports, não de suposição. */
  const EXTERNAS = /^(?!\.|\/)([@\w][^'"]*)$/;
  const IGNORAR = new Set(['react', 'react-dom', 'prop-types']);

  for (const c of componentes.values()) {
    const deps = new Set();
    for (const a of c.arquivos) {
      if (!/\.(jsx?|tsx?)$/.test(a.arquivo)) continue;
      const destino = join(DESTINO, c.categoria, c.nome, a.arquivo.split('/').slice(1).join('/') || a.arquivo);
      const src = await readFile(destino, 'utf8').catch(() => '');
      for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
        const alvo = m[1];
        if (!EXTERNAS.test(alvo)) continue;
        /* `gsap/ScrollTrigger` conta como `gsap`; `@react-three/fiber` fica inteiro. */
        const pacote = alvo.startsWith('@') ? alvo.split('/').slice(0, 2).join('/') : alvo.split('/')[0];
        if (!IGNORAR.has(pacote)) deps.add(pacote);
      }
    }
    c.deps = [...deps].sort();
  }

  /* ---- Índice: é o que a skill lê para saber o que existe sem abrir 315 arquivos ---- */
  const porCategoria = {};
  for (const c of componentes.values()) (porCategoria[c.categoria] ||= []).push(c);

  let indice = `# Índice do React Bits\n\n`;
  indice += `Gerado por \`scripts/biblioteca/coletar-reactbits.mjs\` a partir de \`github.com/${REPO}\`.\n`;
  indice += `**Não editar à mão** — rodar o script de novo.\n\n`;
  indice += `**${componentes.size} componentes** em ${Object.keys(porCategoria).length} categorias.\n`;
  indice += `Cada pasta tem o \`.jsx\` e, quando existe, o \`.css\`. O caminho é\n`;
  indice += `\`.claude/skills/reactbits/componentes/<Categoria>/<Nome>/\`.\n\n`;

  /* Sem dependência externa = dá para usar em qualquer lugar. É o corte mais útil
     do inventário, então vai antes das categorias. */
  const semDep = [...componentes.values()].filter((c) => !c.deps.length).sort((a, b) => a.nome.localeCompare(b.nome));
  const contagemDep = {};
  for (const c of componentes.values()) for (const d of c.deps) contagemDep[d] = (contagemDep[d] || 0) + 1;

  indice += `## Só React e CSS — sem dependência externa (${semDep.length})\n\n`;
  indice += `Os únicos que entram sem somar biblioteca ao bundle.\n\n`;
  indice += semDep.map((c) => `\`${c.nome}\``).join(' · ') + `\n\n`;

  indice += `## Dependências, e quantos componentes puxam cada uma\n\n`;
  indice += `| Pacote | Componentes |\n|---|---|\n`;
  for (const [d, n] of Object.entries(contagemDep).sort((a, b) => b[1] - a[1])) indice += `| \`${d}\` | ${n} |\n`;
  indice += `\nO app **não tem nenhuma delas** hoje. Somar uma biblioteca de animação a um app\n`;
  indice += `que a consultora abre em campo, no 4G, é decisão — não detalhe de implementação.\n\n`;

  for (const cat of Object.keys(porCategoria).sort()) {
    const lista = porCategoria[cat].sort((a, b) => a.nome.localeCompare(b.nome));
    indice += `## ${cat} (${lista.length})\n\n`;
    indice += `| Componente | Arquivos | Tamanho | Precisa de |\n|---|---|---|---|\n`;
    for (const c of lista) {
      const exts = c.arquivos.map((a) => a.arquivo.split('.').pop()).join(', ');
      const kb = Math.round(c.arquivos.reduce((s, a) => s + (a.tamanho || 0), 0) / 1024);
      const deps = c.deps.length ? c.deps.map((d) => `\`${d}\``).join(', ') : '—';
      indice += `| **${c.nome}** | ${exts} | ${kb} KB | ${deps} |\n`;
    }
    indice += `\n`;
  }

  await writeFile(join(DESTINO, 'INDICE.md'), indice, 'utf8');

  /* ---- Licença copiada junto, para a origem nunca ficar implícita ---- */
  const licenca = await baixarArquivo('LICENSE').catch(() => null);
  if (licenca) {
    await writeFile(
      join(DESTINO, 'LICENCA.md'),
      `# Licença do React Bits\n\nCopiado de \`github.com/${REPO}\` em ${new Date().toISOString().slice(0, 10)}.\n\n` +
      `**MIT + Commons Clause — livre para uso pessoal e comercial.** O Commons Clause proíbe\n` +
      `vender o próprio software (revender a coleção como produto); usar os componentes dentro\n` +
      `dos nossos produtos e páginas está liberado. Manter o aviso de copyright ao redistribuir.\n\n` +
      `---\n\n\`\`\`\n${licenca}\n\`\`\`\n`,
      'utf8'
    );
  }

  console.log(`Índice: ${join(DESTINO, 'INDICE.md')}`);
  if (falhas.length) {
    console.log(`\n${falhas.length} falhas:`);
    falhas.slice(0, 20).forEach((f) => console.log('  ' + f));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
