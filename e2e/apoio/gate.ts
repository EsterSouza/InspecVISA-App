/**
 * FE-27 — as medições do gate visual, feitas dentro da página.
 *
 * Tudo aqui roda em `page.evaluate`, então não pode fechar sobre nada do Node.
 * São medições **estruturais**, independentes de dado: valem igual com a base de
 * homologação cheia ou vazia. É a diferença que o card do FE-27 marca — snapshot
 * de pixel contra dado real quebra a cada visita nova e em duas semanas alguém
 * desliga o gate.
 */
import type { Page } from '@playwright/test';

export const LARGURAS = [
  { nome: '375', largura: 375, altura: 812 },
  { nome: '768', largura: 768, altura: 1024 },
  { nome: '1280', largura: 1280, altura: 800 },
  { nome: '1600', largura: 1600, altura: 900 },
] as const;

export interface TextoReprovado {
  texto: string;
  razao: number;
  minimo: number;
  cor: string;
  fundo: string;
}

export interface AlvoPequeno {
  nome: string;
  largura: number;
  altura: number;
}

/** Congela transição e animação: sem isso `getComputedStyle` devolve a cor do
 *  início da transição, e a medição vira caça a fantasma. */
export async function congelaAnimacao(page: Page): Promise<void> {
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
}

/**
 * Abre a rota e espera a tela estar **pintada com dado**, não só respondida.
 *
 * Não use `networkidle` aqui: o app é PWA com service worker e sincronização em
 * segundo plano, então a rede nunca fica ociosa por 500ms e a espera estoura o
 * teste inteiro sem nada de errado na tela. O sinal certo é o do próprio app —
 * o esqueleto de carregamento (`animate-pulse`, padronizado no FE-20) sumir.
 */
export async function abre(page: Page, caminho: string): Promise<void> {
  await page.goto(caminho, { waitUntil: 'domcontentloaded' });
  await page
    .locator('main, [role="main"]')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => undefined);
  // Rota que carrega rápido nunca chega a mostrar esqueleto; por isso o
  // `catch`: ausência de esqueleto é sucesso, não falha.
  await page
    .waitForFunction(() => !document.querySelector('.animate-pulse'), undefined, { timeout: 10_000 })
    .catch(() => undefined);
  await congelaAnimacao(page);
}

export async function aplicaTema(page: Page, tema: 'claro' | 'escuro'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'escuro');
  }, tema);
}

/** Rolagem lateral da página inteira. 1px de folga porque zoom fracionário do
 *  navegador produz 0,5px de diferença que ninguém vê. */
export async function rolagemLateral(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Todo texto visível contra o fundo em que ele **de fato** cai — subindo a árvore
 * até achar um fundo opaco, que é o que o olho enxerga. Mede o nó de texto, não o
 * contêiner: um `<div>` com cor herdada e filhos não é texto.
 */
export async function textosReprovados(page: Page): Promise<TextoReprovado[]> {
  return page.evaluate(() => {
    const canais = (s: string): number[] => {
      const m = s.match(/[\d.]+/g);
      return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
    };
    const opacidade = (s: string): number => {
      const m = s.match(/[\d.]+/g);
      return m && m.length > 3 ? Number(m[3]) : 1;
    };
    const luz = (c: number[]): number => {
      const f = c.map((x) => {
        const y = x / 255;
        return y <= 0.03928 ? y / 12.92 : ((y + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    };
    const razao = (a: number[], b: number[]): number => {
      const [l1, l2] = [luz(a), luz(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const mistura = (frente: number[], alfa: number, fundo: number[]): number[] =>
      frente.map((c, i) => Math.round(c * alfa + fundo[i] * (1 - alfa)));
    const fundoDe = (el: Element): number[] => {
      let n: Element | null = el;
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (opacidade(c) >= 1) return canais(c);
        n = n.parentElement;
      }
      return canais(getComputedStyle(document.body).backgroundColor);
    };

    const fora: TextoReprovado[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const proprios = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent?.trim());
      if (!proprios.length) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return;
      if (!(el as HTMLElement).offsetHeight) return;

      const tamanho = parseFloat(cs.fontSize);
      const negrito = parseInt(cs.fontWeight, 10) >= 700;
      // "Texto grande" da WCAG: 24px, ou 18,66px se for negrito.
      const minimo = tamanho >= 24 || (tamanho >= 18.66 && negrito) ? 3 : 4.5;

      const fundo = fundoDe(el);
      const alfa = opacidade(cs.color);
      const frente = alfa < 1 ? mistura(canais(cs.color), alfa, fundo) : canais(cs.color);
      const r = razao(frente, fundo);
      if (r < minimo) {
        fora.push({
          texto: proprios.map((n) => n.textContent!.trim()).join(' ').slice(0, 60),
          razao: Math.round(r * 100) / 100,
          minimo,
          cor: cs.color,
          fundo: `rgb(${fundo.join(', ')})`,
        });
      }
    });
    return fora;
  }) as Promise<TextoReprovado[]>;
}

/** Alvo de toque abaixo de 44px (decisão 7). Só faz sentido perguntar em
 *  viewport de dedo — no ponteiro fino o mínimo é outro. */
export async function alvosPequenos(page: Page): Promise<AlvoPequeno[]> {
  return page.evaluate(() => {
    const fora: AlvoPequeno[] = [];
    document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // Link dentro de parágrafo é texto corrido, não alvo isolado: a régua de
      // 44px não se aplica (WCAG 2.5.5, exceção "inline").
      if (el.tagName === 'A' && el.parentElement && /^(P|LI|SPAN|LABEL)$/.test(el.parentElement.tagName)) return;
      if (r.height < 44 || r.width < 44) {
        fora.push({
          nome: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40),
          largura: Math.round(r.width),
          altura: Math.round(r.height),
        });
      }
    });
    return fora;
  }) as Promise<AlvoPequeno[]>;
}

/** Controle que o leitor de tela anunciaria como "botão", sem mais nada. */
export async function semNomeAcessivel(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fora: string[] = [];
    document.querySelectorAll('button, a[href]').forEach((el) => {
      // `getComputedStyle(el).display` do FILHO de um ancestral `display:none`
      // devolve o valor dele mesmo ("flex"), não "none" — a barra inferior é
      // `lg:hidden` e vinha sendo cobrada no desktop, onde ninguém a vê. Quem
      // responde se o elemento existe na tela é a caixa renderizada.
      if (!el.getClientRects().length) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') return;
      const nome =
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.textContent?.trim() ||
        (el.querySelector('img')?.getAttribute('alt') ?? '');
      if (!nome.trim()) fora.push(el.outerHTML.slice(0, 120));
    });
    return fora;
  }) as Promise<string[]>;
}

/** Percorre os primeiros controles com Tab e devolve os que não mostram foco. */
export async function focoInvisivel(page: Page, quantos = 12): Promise<string[]> {
  const fora: string[] = [];
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < quantos; i += 1) {
    await page.keyboard.press('Tab');
    const resultado = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      // Anel do Tailwind é `box-shadow`; contorno nativo é `outline`. Vale
      // qualquer um dos dois — e mudança de borda também comunica foco.
      const temAnel =
        (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
        (cs.boxShadow !== 'none' && cs.boxShadow !== '');
      return temAnel ? null : (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40);
    });
    if (resultado) fora.push(resultado);
  }
  return fora;
}
