#!/usr/bin/env node
/**
 * FE-27 — camada estática do gate visual. Roda em segundos, sem navegador.
 *
 *   npm run check:ui
 *
 * O que ela pega é o que `npm run build` e `npm run lint` não pegam: regressão de
 * acessibilidade e de marca que compila perfeitamente. O catálogo de verificações
 * é o da skill `auditar-ui` do Design Arsenal — que **não estava acessível nesta
 * máquina** em 19/08/2026 (`design-library` não existe mais no OneDrive), então a
 * implementação é nossa e a lista de verificações veio do card do FE-27.
 *
 * Severidade (`auditar-ui/references/acceptance.md`):
 *   P0  bloqueia — quebra fluxo principal
 *   P1  falha em fluxo principal ou em acessibilidade      ← reprova o gate
 *   P2  degrada — some no ruído, mas é dívida              ← registra e segue
 *   P3  refinamento
 *
 * Pronto = nenhum P0/P1 aberto e o P2 restante registrado e aceito. E a frase que
 * fecha o gate continua valendo: **build ou lint não substitui inspeção visual e
 * funcional** — esta régua é o piso, não o teto.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const achados = [];

function arquivos(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__' || nome === 'node_modules') continue;
      arquivos(caminho, saida);
    } else if (/\.tsx?$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

const linhaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;

function achar(severidade, arquivo, linha, regra, detalhe) {
  achados.push({ severidade, arquivo: relative(raiz, arquivo).split(sep).join('/'), linha, regra, detalhe });
}

/**
 * Percorre as tags de abertura do JSX. Não é um parser: é o suficiente para
 * perguntar "esta tag tem tal atributo?", que é tudo que as regras precisam.
 *
 * O que exige cuidado é achar o FIM da tag. Um `/<tag[^<]*?>/` ingênuo para no
 * primeiro `>` que aparecer — e `>` aparece dentro de `onClick={() => ...}` e de
 * `${a > b}`. A tag sairia cortada, e atributo depois do corte (justo o `rel=`
 * que a regra procura) viraria acusação falsa. Por isso a varredura conta chaves
 * e respeita aspas, inclusive crase.
 */
function* tags(texto) {
  const abertura = /<([a-zA-Z][a-zA-Z0-9.]*)(?=[\s/>])/g;
  let m;
  while ((m = abertura.exec(texto)) !== null) {
    let i = m.index + m[0].length;
    let chaves = 0;
    let aspas = null;
    while (i < texto.length) {
      const c = texto[i];
      if (aspas) {
        if (c === aspas) aspas = null;
      } else if (c === '"' || c === "'" || c === '`') {
        aspas = c;
      } else if (c === '{') {
        chaves += 1;
      } else if (c === '}') {
        chaves -= 1;
      } else if (c === '>' && chaves === 0) {
        break;
      }
      i += 1;
    }
    yield { nome: m[1], corpo: texto.slice(m.index, i + 1), indice: m.index };
  }
}

// Superfícies escuras nos DOIS temas (família `deep`): ali o branco literal é a
// tinta certa, e cobrá-las pelo token inverteria a cor. Ver FE-12.
const ESCURO_FIXO = [
  'src/pages/Login.tsx',
  'src/pages/PublicAppointmentStatus.tsx',
  'src/components/inspection/PhotoCapture.tsx',
];

// Cor que NÃO é interface e por isso não segue o tema:
//   - a assinatura do cliente e a página do PDF são tinta sobre papel branco;
//   - o `pdfGenerator` desenha um documento impresso, que é claro sempre. Ligar
//     o PDF ao tema faria a consultora gerar relatório de fundo navy.
const COR_LITERAL_ACEITA = [
  'src/components/ui/SignaturePad.tsx',
  'src/components/inspection/PdfPreviewModal.tsx',
  'src/utils/pdfGenerator.ts',
  'src/utils/franchiseReport.ts',
];

for (const arquivo of arquivos(join(raiz, 'src'))) {
  const rel = relative(raiz, arquivo).split(sep).join('/');
  const texto = readFileSync(arquivo, 'utf8');

  for (const { nome, corpo, indice } of tags(texto)) {
    const linha = linhaDe(texto, indice);

    // P1 · foco removido sem substituto. `tabIndex={-1}` é exceção legítima: o
    // elemento só recebe foco por script (mover o leitor de tela para o título
    // do passo), e um anel ali seria ruído visual sem ninguém navegando.
    if (/outline-none/.test(corpo) && !/focus-visible:(ring|outline|border)/.test(corpo) && !/tabIndex=\{-1\}/.test(corpo)) {
      achar('P1', arquivo, linha, 'foco-sem-substituto', `<${nome}> apaga o contorno e não devolve anel de foco`);
    }

    // P1 · imagem sem alternativa textual. `alt=""` é resposta válida (decorativa).
    if (nome === 'img' && !/\salt=/.test(corpo)) {
      achar('P1', arquivo, linha, 'img-sem-alt', '<img> sem `alt` (use alt="" se for decorativa)');
    }

    // P1 · aba nova que entrega `window.opener` para a página aberta.
    // `noreferrer` também serve: ele implica `noopener` em todo navegador atual.
    // Cobrar `noopener` literal só produziria acusação falsa nos dois `<a>` que
    // já usam `noreferrer` — e a regra que grita errado é a primeira a ser
    // desligada por quem mantém o gate.
    if (/target="_blank"/.test(corpo) && !/rel="[^"]*(noopener|noreferrer)/.test(corpo)) {
      achar('P1', arquivo, linha, 'blank-sem-noopener', `<${nome}> abre em aba nova sem rel="noopener" nem "noreferrer"`);
    }

    // P1 · clique em elemento que o teclado não alcança.
    if ((nome === 'div' || nome === 'span') && /\sonClick=/.test(corpo) && !/\srole=/.test(corpo) && !/tabIndex=/.test(corpo)) {
      achar('P1', arquivo, linha, 'clique-sem-teclado', `<${nome}> com onClick sem role nem tabIndex`);
    }

    // P1 · branco/preto literal onde o tema manda. Sobre preenchimento colorido a
    // tinta é `on-accent`; sobre superfície escura FIXA o branco continua certo.
    if (/(text|border|ring)-white(?![\w-])/.test(corpo) && !ESCURO_FIXO.includes(rel)) {
      achar('P1', arquivo, linha, 'branco-literal', `<${nome}> usa branco literal fora de superfície escura fixa — o tema escuro clareia o fundo embaixo`);
    }

    // P2 · `transition-all` anima layout junto e custa quadro em lista longa.
    if (/transition-all/.test(corpo)) {
      achar('P2', arquivo, linha, 'transition-all', `<${nome}> usa transition-all; nomeie a propriedade`);
    }
  }

  // Fora das tags: cor literal em qualquer lugar do arquivo (inclusive `style`,
  // constante e canvas), que é por onde a cor escapa do tema.
  if (!COR_LITERAL_ACEITA.includes(rel)) {
    for (const m of texto.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const linha = linhaDe(texto, m.index);
      const conteudo = texto.split('\n')[linha - 1];
      // Comentário citando um valor antigo não é cor aplicada.
      if (/^\s*(\*|\/\/|\/\*)/.test(conteudo)) continue;
      achar('P2', arquivo, linha, 'cor-literal', `${m[0]} cravado — use \`rgb(var(--token))\` ou a classe do token`);
    }
  }
}

// P0 · a regra global de `prefers-reduced-motion`. Se ela sumir, as 139 animações
// do app voltam a rodar para quem pediu para o sistema parar de animar.
const css = readFileSync(join(raiz, 'src/index.css'), 'utf8');
if (!/@media \(prefers-reduced-motion: reduce\)/.test(css)) {
  achar('P0', join(raiz, 'src/index.css'), 1, 'sem-reduced-motion', 'a regra global de prefers-reduced-motion sumiu do index.css');
}

const ordem = { P0: 0, P1: 1, P2: 2, P3: 3 };
achados.sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || a.arquivo.localeCompare(b.arquivo) || a.linha - b.linha);

const conta = (s) => achados.filter((a) => a.severidade === s).length;
for (const a of achados) {
  console.log(`${a.severidade}  ${a.arquivo}:${a.linha}  [${a.regra}] ${a.detalhe}`);
}
console.log(`\nP0 ${conta('P0')} · P1 ${conta('P1')} · P2 ${conta('P2')} · P3 ${conta('P3')}`);

if (conta('P0') || conta('P1')) {
  console.error('\nO gate reprova: P0/P1 em aberto.');
  process.exit(1);
}
console.log('Gate estático aprovado: nenhum P0/P1 em aberto.');
