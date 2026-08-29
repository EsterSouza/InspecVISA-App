#!/usr/bin/env node
/**
 * FE-12 — a régua de cor dos dois temas.
 *
 * Lê os tokens direto de `src/index.css` (não uma cópia: se a cor mudar lá, a régua
 * mede a cor nova) e reprova quando um par sai do mínimo. Roda em segundos, sem
 * navegador: é o que evita "clareei um token e escureci um selo sem perceber".
 *
 *   npm run check:contraste
 *
 * Três réguas, porque são três problemas diferentes:
 *   TEXTO      4,5:1  — texto comum sobre o fundo em que ele realmente aparece
 *   GRAFICO    3:1    — traço de controle, ícone, indicador (WCAG 1.4.11)
 *   SUPERFICIE 1,12:1 — o selo tem que DESCOLAR do cartão. Não é WCAG, e o piso é
 *                       o que o tema claro já entrega hoje. Existe por causa da
 *                       primeira rodada do escuro, em que os "soft" ficavam a
 *                       1,03:1 do cartão e viravam mancha sem forma; hoje o escuro
 *                       trabalha em 1,37–1,45.
 *
 * Dois pares que NÃO entram, de propósito:
 *   - tinta sobre `amber`: âmbar é cor de preenchimento grande (barra, faixa), não
 *     fundo de texto pequeno — para texto existe o par `amber-soft`/`amber-soft-ink`.
 *   - `soft-border` contra o próprio `soft`: no claro eles quase se tocam por
 *     desenho. Quem tem que se ler é o `soft` contra o cartão, e isso é medido.
 *
 * A escala numérica também é conferida: no escuro ela inverte (50 = mais escuro,
 * 900 = mais claro) e precisa continuar monotônica, senão `bg-primary-50` deixa de
 * ser "fundo suave" em algum degrau.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'src/index.css'), 'utf8');

function tokens(seletor) {
  const bloco = css.match(new RegExp(`${seletor}\\s*\\{([\\s\\S]*?)\\n  \\}`));
  if (!bloco) throw new Error(`bloco ${seletor} não encontrado em src/index.css`);
  const mapa = {};
  for (const [, nome, canais] of bloco[1].matchAll(/--([a-z0-9-]+):\s*([\d\s]+);/g)) {
    mapa[nome] = canais.trim().split(/\s+/).map(Number);
  }
  return mapa;
}

const lum = (c) => {
  const f = c.map((x) => {
    const y = x / 255;
    return y <= 0.03928 ? y / 12.92 : ((y + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
};

const TEXTO = [
  ['navy', 'canvas'], ['navy', 'surface'], ['navy-2', 'surface'], ['navy-3', 'surface'],
  ['navy-2', 'surface-sunken'], ['navy-3', 'surface-sunken'], ['navy', 'surface-hover'], ['navy', 'surface-active'],
  ['on-accent', 'primary-600'], ['on-accent', 'primary-700'], ['on-accent', 'primary-800'],
  ['on-accent', 'danger'], ['on-accent', 'success'], ['on-accent', 'success-soft-ink'],
  ['on-accent', 'secondary'],
  ['accent-ink', 'surface'], ['primary-700', 'surface'], ['primary-600', 'surface'],
  ['primary-800', 'surface'], ['primary-900', 'surface'], ['primary-700', 'canvas'],
  ['primary-700', 'primary-50'], ['primary-700', 'primary-100'], ['accent-ink', 'primary-100'],
  ['amber-soft-ink', 'amber-soft'], ['success-soft-ink', 'success-soft'], ['danger-soft-ink', 'danger-soft'],
  ['pink-soft-ink', 'pink-soft'],
  ['secondary-700', 'secondary-100'], ['secondary-700', 'secondary-50'],
  ['danger', 'surface'], ['success', 'surface'], ['secondary', 'surface'], ['pink', 'surface'],
  ['inverse-ink', 'inverse'],
  ['amber-soft-ink', 'surface'], ['success-soft-ink', 'surface'], ['danger-soft-ink', 'surface'],
  ['pink-soft-ink', 'surface'],
];

const GRAFICO = [
  ['amber-strong', 'surface'], ['border-control', 'surface'], ['border-control', 'canvas'],
  ['primary-500', 'surface'],
  // `primary-500` é anel de foco e indicador: o que fica em cima dele é ícone, não
  // texto corrido — por isso 3:1 e não 4,5:1. O avatar de `ClientDetails` usava esse
  // fundo com iniciais (3,94:1) e passou para `primary-700` no FE-27.
  ['on-accent', 'primary-500'],
];

const SUPERFICIE = [
  ['amber-soft', 'surface'], ['success-soft', 'surface'], ['danger-soft', 'surface'], ['pink-soft', 'surface'],
  ['primary-50', 'surface'], ['secondary-100', 'surface'],
  // O cartão contra a página fica em 1,05 (claro) e 1,14 (escuro): quem delimita o
  // cartão é o traço, não a diferença de fundo. Por isso mede-se o traço.
  ['border', 'surface'],
];

const REGUAS = [
  ['TEXTO', TEXTO, 4.5],
  ['GRAFICO', GRAFICO, 3],
  ['SUPERFICIE', SUPERFICIE, 1.12],
];

const DEGRAUS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
let falhas = 0;

for (const [tema, seletor] of [['claro', ':root'], ['escuro', '\\.dark']]) {
  const t = tokens(seletor);
  const razao = (a, b) => {
    for (const n of [a, b]) if (!t[n]) throw new Error(`token --${n} não existe no tema ${tema}`);
    const [l1, l2] = [lum(t[a]), lum(t[b])].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const erros = [];

  for (const [nome, pares, min] of REGUAS) {
    for (const [a, b] of pares) {
      const r = razao(a, b);
      if (r < min) erros.push(`${nome}  ${a} / ${b} = ${r.toFixed(2)} (mínimo ${min})`);
    }
  }

  for (const familia of ['primary', 'secondary']) {
    for (let i = 1; i < DEGRAUS.length; i++) {
      const anterior = lum(t[`${familia}-${DEGRAUS[i - 1]}`]);
      const atual = lum(t[`${familia}-${DEGRAUS[i]}`]);
      const invertido = tema === 'escuro' ? atual < anterior : atual > anterior;
      if (invertido) erros.push(`ESCALA ${familia}: o degrau ${DEGRAUS[i]} saiu da ordem em relação ao ${DEGRAUS[i - 1]}`);
    }
  }

  const total = TEXTO.length + GRAFICO.length + SUPERFICIE.length;
  if (erros.length) {
    falhas += erros.length;
    console.error(`\ntema ${tema}: ${erros.length} de ${total} pares reprovados`);
    for (const e of erros) console.error('  ' + e);
  } else {
    console.log(`tema ${tema}: ${total} pares conferidos, nenhum reprovado`);
  }
}

if (falhas) {
  console.error('\nA cor não passou. Ajuste o token em src/index.css e rode de novo.');
  process.exit(1);
}
