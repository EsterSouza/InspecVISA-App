/**
 * Servidor estático só para conferir os protótipos no navegador.
 * Sem dependência: `node docs/prototipos/serve.mjs` e abrir http://localhost:5177
 */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const porta = Number(process.env.PORT) || 5177;
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (caminho === '/') {
    const arquivos = (await readdir(raiz)).filter((f) => f.endsWith('.html')).sort();
    const itens = arquivos.map((f) => `<li><a href="/${f}">${f}</a></li>`).join('');
    res.writeHead(200, { 'content-type': tipos['.html'] });
    return res.end(`<meta charset="utf-8"><title>Protótipos</title><h1>Protótipos</h1><ul>${itens}</ul>`);
  }

  // normalize + prefixo: nada fora da pasta dos protótipos
  const alvo = join(raiz, normalize(caminho).replace(/^([/\\])+/, ''));
  if (!alvo.startsWith(raiz)) { res.writeHead(403); return res.end('fora do diretório'); }

  try {
    const corpo = await readFile(alvo);
    res.writeHead(200, { 'content-type': tipos[extname(alvo)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'content-type': tipos['.html'] });
    res.end('<meta charset="utf-8">não encontrado');
  }
}).listen(porta, () => console.log(`protótipos em http://localhost:${porta}`));
