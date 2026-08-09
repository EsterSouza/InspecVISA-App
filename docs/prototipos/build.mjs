/**
 * Monta os três protótipos a partir de uma única fonte de tokens.
 *
 * Gera dois formatos por artefato:
 *   fe-0X-*.html            documento completo, abre no navegador e no dev server
 *   _publish/fe-0X-*.html   fragmento para o publicador de artefato, que injeta
 *                           o próprio <head>/<body> e bloqueia host externo (CSP)
 *
 * Rodar:  node docs/prototipos/build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '_src');
const read = (p) => readFileSync(join(src, p), 'utf8');

/* Sora e Source Sans 3 vão embutidas: não estão instaladas na máquina e o
   artefato publicado não carrega fonte de host externo. São variáveis, então
   um arquivo por família cobre a escala inteira de peso. */
const fontFaces = `
@font-face {
  font-family: 'Sora';
  src: url(data:font/woff2;base64,${read('fonts/Sora-var.b64')}) format('woff2-variations');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Source Sans 3';
  src: url(data:font/woff2;base64,${read('fonts/SourceSans3-var.b64')}) format('woff2-variations');
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}`;

const darkVars = read('tokens-dark.css');

/* Claro e escuro são um sistema só: as variáveis do escuro existem uma vez e
   valem tanto para a preferência do sistema quanto para o botão de tema. */
const themes = `
:root[data-theme='dark'] {
${darkVars}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${darkVars}
  }
}`;

const css = [fontFaces, read('tokens.css'), themes, read('base.css'), read('components.css')].join('\n');
const js = read('shell.js');
const icons = read('icons.svg');

const pages = readdirSync(join(src, 'pages')).filter((f) => f.endsWith('.html'));

mkdirSync(join(here, '_publish'), { recursive: true });

for (const file of pages) {
  const raw = read(join('pages', file));

  const title = (raw.match(/<!--\s*title:\s*(.+?)\s*-->/) || [])[1] || 'InspecVISA';
  const pageCss = (raw.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const pageJs = (raw.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  const body = raw
    .replace(/<!--\s*title:.*?-->/, '')
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace(/<script>[\s\S]*?<\/script>/, '')
    .trim();

  const style = `<style>\n${css}\n${pageCss}\n</style>`;
  const script = `<script>\n${js}\n${pageJs}\n</script>`;

  const standalone = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${style}
</head>
<body>
${icons}
${body}
${script}
</body>
</html>
`;

  const fragment = `<title>${title}</title>
${style}
${icons}
${body}
${script}
`;

  const out = file.replace(/\.html$/, '') + '.html';
  writeFileSync(join(here, out), standalone, 'utf8');
  writeFileSync(join(here, '_publish', out), fragment, 'utf8');
  const kb = (Buffer.byteLength(standalone) / 1024).toFixed(0);
  console.log(`${out.padEnd(28)} ${kb} KB`);
}
