/**
 * FE-27 — o gate de regressão visual e de acessibilidade.
 *
 * Fecha o buraco que o card descreve: `npm run build` não detecta coluna
 * espremida, botão quebrando em duas linhas nem tabela criando rolagem lateral.
 * Aqui isso vira asserção.
 *
 * **Só a camada estrutural, e isso é decisão, não corte de escopo.** O card
 * recusa `toHaveScreenshot()` porque o `baseURL` aponta para ambiente publicado
 * com banco compartilhado: snapshot de pixel contra dado real quebra a cada
 * visita nova, vira ruído, e em duas semanas alguém desliga o gate. O que se
 * mede aqui vale igual com a base cheia ou vazia — rolagem lateral, alvo de
 * toque, nome acessível, foco visível e contraste calculado dos tokens vigentes.
 *
 * A matriz é cruzada em eixos separados, de propósito:
 *   - **largura** (375 / 768 / 1280 / 1600) muda geometria → rolagem, alvo, nome;
 *   - **ponteiro** (dedo nas duas estreitas) muda o mínimo do alvo de toque;
 *   - **tema** (claro / escuro) muda cor → contraste.
 * Cruzar tema × largura seria o dobro do tempo para responder duas vezes a mesma
 * pergunta: contraste não depende de largura, geometria não depende de cor.
 *
 * O dedo é emulado de verdade (`hasTouch`), não presumido pela largura: a
 * decisão 7 do handoff cumpre os 44px com `[@media(pointer:coarse)]`, e uma
 * janela estreita com mouse não aciona essa regra. Medir sem toque aprovaria
 * telas que no celular têm alvo de 34px.
 *
 * O que continua sendo humano, com a matriz na mão: a comparação contra os
 * protótipos aprovados, e os estados de carregando e de erro. Protótipo e app
 * divergem de propósito em dado e conteúdo, então isso não vira `expect`.
 * **Build ou lint não substitui inspeção visual e funcional.**
 */
import { expect, test, type Page } from '@playwright/test';
import { contas } from './apoio/ambiente';
import { entraComoStaff } from './apoio/sessao';
import { abreExecucao } from './apoio/execucao';
import { entraNoPortal } from './apoio/portal';
import {
  abre,
  alvosPequenos,
  aplicaTema,
  congelaAnimacao,
  focoInvisivel,
  rolagemLateral,
  semNomeAcessivel,
  textosReprovados,
} from './apoio/gate';

interface Rota {
  nome: string;
  caminho: string;
}

const ROTAS_ADMIN: Rota[] = [
  { nome: 'Início', caminho: '/' },
  { nome: 'Clientes', caminho: '/clients' },
  { nome: 'Inspeções', caminho: '/inspections' },
  { nome: 'Agendamentos', caminho: '/schedules' },
  { nome: 'Plano de ação', caminho: '/plano-de-acao' },
  { nome: 'Solicitações', caminho: '/requests' },
  { nome: 'Roteiros', caminho: '/templates' },
  { nome: 'Biblioteca', caminho: '/legislations' },
  { nome: 'Sincronização', caminho: '/sync' },
  { nome: 'Configurações', caminho: '/settings' },
];

const ROTAS_PORTAL: Rota[] = [
  { nome: 'Visão geral', caminho: '/cliente' },
  { nome: 'Plano de ação', caminho: '/cliente/plano-de-acao' },
  { nome: 'Solicitações', caminho: '/cliente/solicitacoes' },
  { nome: 'Documentos', caminho: '/cliente/documentos' },
  { nome: 'Agenda', caminho: '/cliente/agenda' },
  { nome: 'Financeiro', caminho: '/cliente/financeiro' },
];

const DEDO = [
  { nome: '375', largura: 375, altura: 812 },
  { nome: '768', largura: 768, altura: 1024 },
];
const PONTEIRO = [
  { nome: '1280', largura: 1280, altura: 800 },
  { nome: '1600', largura: 1600, altura: 900 },
];

/** Uma varredura de geometria. `comToque` liga a régua de 44px — ela só faz
 *  sentido onde o ponteiro é o dedo. */
async function varreGeometria(
  page: Page,
  rotas: Rota[],
  tamanhos: { nome: string; largura: number; altura: number }[],
  comToque: boolean
): Promise<string[]> {
  const falhas: string[] = [];

  for (const t of tamanhos) {
    await page.setViewportSize({ width: t.largura, height: t.altura });

    for (const rota of rotas) {
      await abre(page, rota.caminho);
      const onde = `${rota.nome} @${t.nome}px`;

      const excesso = await rolagemLateral(page);
      if (excesso > 1) falhas.push(`${onde} · rolagem lateral de ${excesso}px`);

      for (const html of await semNomeAcessivel(page)) {
        falhas.push(`${onde} · controle sem nome acessível: ${html}`);
      }

      if (comToque) {
        const vistos = new Set<string>();
        for (const alvo of await alvosPequenos(page)) {
          const chave = `${alvo.nome}|${alvo.largura}x${alvo.altura}`;
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          falhas.push(`${onde} · alvo de ${alvo.largura}×${alvo.altura}px: "${alvo.nome}"`);
        }
      }
    }
  }

  return falhas;
}

async function varreContraste(page: Page, rotas: Rota[]): Promise<string[]> {
  const falhas: string[] = [];
  await page.setViewportSize({ width: 1280, height: 800 });

  for (const tema of ['claro', 'escuro'] as const) {
    for (const rota of rotas) {
      await abre(page, rota.caminho);
      await aplicaTema(page, tema);

      // Mede duas vezes e só acusa o que sobrevive às duas. Contraste ruim é
      // estável: se um texto reprova numa medição e some na outra, o que foi
      // medido era um quadro de transição — aviso que passa, esqueleto saindo —
      // e não um defeito. Gate que acusa fantasma é gate que alguém desliga.
      const primeira = await textosReprovados(page);
      if (!primeira.length) continue;
      await page.waitForTimeout(500);
      const segunda = await textosReprovados(page);
      const persistem = new Set(segunda.map((t) => `${t.texto}|${t.cor}|${t.fundo}`));

      for (const t of primeira) {
        if (!persistem.has(`${t.texto}|${t.cor}|${t.fundo}`)) continue;
        falhas.push(`${rota.nome} [${tema}] · "${t.texto}" ${t.razao}:1 (mínimo ${t.minimo}) — ${t.cor} sobre ${t.fundo}`);
      }
    }
  }

  return falhas;
}

// A matriz é longa por natureza — 10 rotas × 2 larguras é uma dezena e meia de
// navegações por teste —, então o tempo-limite de 45s do config não serve aqui.
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

test.describe('Gate visual — app interno', () => {
  test.beforeEach(async ({ page }) => {
    await entraComoStaff(page);
  });

  test('geometria no ponteiro (1280 e 1600)', async ({ page }) => {
    const falhas = await varreGeometria(page, ROTAS_ADMIN, PONTEIRO, false);
    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });

  test('contraste nos dois temas', async ({ page }) => {
    const falhas = await varreContraste(page, ROTAS_ADMIN);
    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });

  test('foco visível ao navegar por teclado', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const falhas: string[] = [];

    for (const rota of ROTAS_ADMIN) {
      await abre(page, rota.caminho);
      for (const controle of await focoInvisivel(page)) {
        falhas.push(`${rota.nome} · "${controle}" recebe foco sem mostrar`);
      }
    }

    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });
});

test.describe('Gate visual — app interno no dedo', () => {
  test.use({ hasTouch: true });

  test('geometria e alvo de toque (375 e 768)', async ({ page }) => {
    await entraComoStaff(page);
    const falhas = await varreGeometria(page, ROTAS_ADMIN, DEDO, true);
    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });
});

test.describe('Gate visual — portal do cliente', () => {
  test.beforeEach(async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);
  });

  test('geometria no ponteiro (1280 e 1600)', async ({ page }) => {
    const falhas = await varreGeometria(page, ROTAS_PORTAL, PONTEIRO, false);
    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });

  test('contraste nos dois temas', async ({ page }) => {
    const falhas = await varreContraste(page, ROTAS_PORTAL);
    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });

  test('o botão de tema do cabeçalho troca e persiste', async ({ page }) => {
    const botao = page.getByRole('button', { name: /Tema (claro|escuro)/i });
    await expect(botao).toBeVisible();

    const comecouEscuro = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await botao.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!comecouEscuro);

    // Recarrega: o tema tem que estar decidido antes da primeira pintura, senão
    // quem usa o escuro vê um lampejo branco a cada abertura.
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!comecouEscuro);

    await page.getByRole('button', { name: /Tema (claro|escuro)/i }).click();
  });
});

test.describe('Gate visual — execução do roteiro no dedo', () => {
  test.use({ hasTouch: true });

  /**
   * A execução ficava de fora da matriz por não ter URL própria — e era
   * justamente a tela em que o celular doía: cabeçalho de ~600px antes do
   * primeiro item. Ela entra por `abreExecucao`, que reaproveita a inspeção em
   * andamento de homologação.
   */
  test('geometria e alvo de toque (375 e 768)', async ({ page }) => {
    await entraComoStaff(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await abreExecucao(page);
    await congelaAnimacao(page);

    const falhas: string[] = [];
    for (const t of DEDO) {
      await page.setViewportSize({ width: t.largura, height: t.altura });
      await page.waitForTimeout(400);
      const onde = `Execução @${t.nome}px`;

      const excesso = await rolagemLateral(page);
      if (excesso > 1) falhas.push(`${onde} · rolagem lateral de ${excesso}px`);

      for (const html of await semNomeAcessivel(page)) {
        falhas.push(`${onde} · controle sem nome acessível: ${html}`);
      }

      const vistos = new Set<string>();
      for (const alvo of await alvosPequenos(page)) {
        const chave = `${alvo.nome}|${alvo.largura}x${alvo.altura}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        falhas.push(`${onde} · alvo de ${alvo.largura}×${alvo.altura}px: "${alvo.nome}"`);
      }
    }

    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });

  /**
   * O salto de seção tem de parar ABAIXO do cabeçalho fixo de 97px. Sem
   * `scroll-margin-top` o cabeçalho come o título da seção que ela pediu — e
   * isso nenhuma varredura de geometria pega.
   */
  test('o salto de seção não para debaixo do cabeçalho', async ({ page }) => {
    await entraComoStaff(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await abreExecucao(page);
    await congelaAnimacao(page);

    await page.getByRole('button', { name: 'Ações da inspeção' }).click();
    const secoes = page.getByRole('navigation', { name: /Seções do roteiro/i }).getByRole('button');
    const ultima = secoes.last();
    const rotulo = ((await ultima.textContent()) || '').replace(/\d+\/\d+$/, '').trim();
    await ultima.click();
    await page.waitForTimeout(1200);

    const topo = await page.evaluate((texto: string) => {
      const alvo = [...document.querySelectorAll('h3')]
        .find((h) => (h.textContent || '').includes(texto.replace(/^\d+ · /, '')));
      return alvo ? Math.round(alvo.getBoundingClientRect().top) : -1;
    }, rotulo);

    expect(topo, `"${rotulo}" parou a ${topo}px do topo`).toBeGreaterThanOrEqual(97);
  });
});

test.describe('Gate visual — portal do cliente no dedo', () => {
  test.use({ hasTouch: true });

  test('geometria e alvo de toque (375 e 768)', async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);
    const falhas = await varreGeometria(page, ROTAS_PORTAL, DEDO, true);
    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });
});

test.describe('Gate visual — superfícies sem login', () => {
  test('a tela de entrada não vira com o tema', async ({ page }) => {
    await page.goto('/login');
    await congelaAnimacao(page);

    const medida = async () =>
      page.evaluate(() => {
        const heroi = document.querySelector('div.min-h-screen')!;
        const titulo = document.querySelector('h1')!;
        return {
          fundo: getComputedStyle(heroi).backgroundImage,
          tinta: getComputedStyle(titulo).color,
        };
      });

    await aplicaTema(page, 'claro');
    const claro = await medida();
    await aplicaTema(page, 'escuro');
    const escuro = await medida();

    // O `Login` é herói de marca, não superfície de trabalho: é escuro nos dois
    // temas. Se ele começar a virar, o texto branco fica sobre fundo claro.
    expect(escuro).toEqual(claro);
  });

  test('geometria das públicas em 375 e 1280', async ({ page }) => {
    const rotas: Rota[] = [
      { nome: 'Entrada da equipe', caminho: '/login' },
      { nome: 'Entrada do cliente', caminho: '/cliente' },
      { nome: 'Agendamento público', caminho: '/agendar' },
    ];
    const falhas = [
      ...(await varreGeometria(page, rotas, [{ nome: '375', largura: 375, altura: 812 }], false)),
      ...(await varreGeometria(page, rotas, [{ nome: '1280', largura: 1280, altura: 800 }], false)),
    ];
    expect(falhas, `\n${falhas.join('\n')}\n`).toEqual([]);
  });
});
