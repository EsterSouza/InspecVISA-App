/**
 * Regera o índice da nossa biblioteca de sistemas de design a partir dos
 * arquivos que já estão em `.claude/skills/biblioteca-design/sistemas/`.
 *
 * Existe porque a coleta NÃO pode ser feita por script: a borda do designmd.co
 * (WAF da Vercel) devolve 403 para qualquer cliente que não seja navegador —
 * inclusive com o token válido. Ver o aviso na skill `catalogo-designmd`.
 * Então o fluxo é: numa sessão, chamar `get_design` pelo MCP, salvar cada
 * resultado como um arquivo aqui, e rodar este script no fim para atualizar o
 * índice. Ele lê o que existe em disco — não fala com ninguém.
 *
 * Rodar:  node scripts/biblioteca/indexar-designs.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', '..', '.claude', 'skills', 'biblioteca-design', 'sistemas');

/* O cabeçalho de cada arquivo salvo. Mantido curto de propósito: o que interessa
   no índice é achar o sistema, não descrevê-lo. */
function lerMeta(texto, arquivo) {
  const slug = arquivo.replace(/\.md$/, '');
  const nome = (texto.match(/^#\s+(.+)$/m) || [])[1] || slug;
  const categoria = (texto.match(/^categoria:\s*(.+)$/mi) || [])[1] || 'Sem categoria';
  /* Cores em hex, para dar para procurar por paleta sem abrir o arquivo. */
  const cores = [...new Set((texto.match(/#[0-9a-fA-F]{6}\b/g) || []).map((c) => c.toUpperCase()))];
  /* Fontes citadas em linhas de tipografia. */
  const fontes = [...new Set((texto.match(/font-family[^\n]*|(?:^|\s)(Inter|Sora|Geist|Satoshi|Söhne|Suisse|Graphik|Roboto|Poppins|Manrope|Space Grotesk|IBM Plex[^\s,]*)\b/g) || [])
    .map((f) => f.trim()).filter((f) => f.length < 30))];
  return { slug, nome, categoria, cores: cores.slice(0, 6), fontes: fontes.slice(0, 3), kb: Math.round(texto.length / 1024) };
}

const arquivos = (await readdir(PASTA).catch(() => [])).filter((f) => f.endsWith('.md') && f !== 'INDICE.md');

const itens = [];
for (const f of arquivos) {
  const texto = await readFile(join(PASTA, f), 'utf8');
  itens.push(lerMeta(texto, f));
}

const porCategoria = {};
for (const i of itens) (porCategoria[i.categoria] ||= []).push(i);

const TOTAL_CATALOGO = 1675;
const pct = ((itens.length / TOTAL_CATALOGO) * 100).toFixed(1);

let md = `# Índice da biblioteca de sistemas de design\n\n`;
md += `Gerado por \`scripts/biblioteca/indexar-designs.mjs\`. **Não editar à mão.**\n\n`;
md += `**${itens.length} de ~${TOTAL_CATALOGO}** sistemas salvos (${pct}%).\n`;
md += `Cada arquivo é o DESIGN.md completo: paleta, tipografia, espaçamento e voz.\n`;
md += `Caminho: \`.claude/skills/biblioteca-design/sistemas/<slug>.md\`.\n\n`;

if (!itens.length) {
  md += `> Ainda vazia. Ver o passo a passo de coleta em \`../SKILL.md\`.\n`;
} else {
  for (const cat of Object.keys(porCategoria).sort()) {
    const lista = porCategoria[cat].sort((a, b) => a.nome.localeCompare(b.nome));
    md += `## ${cat} (${lista.length})\n\n`;
    md += `| Sistema | Slug | Cores | Tipografia | Tamanho |\n|---|---|---|---|---|\n`;
    for (const i of lista) {
      md += `| **${i.nome}** | \`${i.slug}\` | ${i.cores.join(' ') || '—'} | ${i.fontes.join(', ') || '—'} | ${i.kb} KB |\n`;
    }
    md += `\n`;
  }
}

await writeFile(join(PASTA, 'INDICE.md'), md, 'utf8');
console.log(`${itens.length} sistemas indexados → ${join(PASTA, 'INDICE.md')}`);
