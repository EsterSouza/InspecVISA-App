/**
 * PWA e service worker (P360-015).
 *
 * O critério de aceite é "smoke autenticado passa após limpeza do service
 * worker": o risco real deste app não é o servidor cair, é o navegador do
 * cliente continuar servindo um bundle antigo do cache depois de um deploy.
 */
import { expect, test } from '@playwright/test';
import { contas } from './apoio/ambiente';
import { entraNoPortal } from './apoio/portal';

/** Espera o service worker sair de `installing` e assumir a página. */
async function esperaServiceWorkerAtivo(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registro = await navigator.serviceWorker.getRegistration();
    if (!registro) return false;
    if (registro.active) return true;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return !!(await navigator.serviceWorker.getRegistration())?.active;
  });
}

test.describe('marca do build', () => {
  test('o build publicado se identifica e o HTML confere', async ({ page, request }) => {
    const resposta = await request.get('/build-info.json');
    expect(resposta.status()).toBe(200);

    const info = await resposta.json();
    expect(info.sha).toMatch(/^[0-9a-f]{7,40}$/);

    await page.goto('/cliente');
    const metaSha = await page.locator('meta[name="build-sha"]').getAttribute('content');
    // Divergir aqui significa que o navegador está com HTML de outro build —
    // normalmente service worker preso na versão anterior.
    expect(metaSha).toBe(info.sha);
  });
});

test.describe('service worker', () => {
  test('registra, ativa e não precacheia o build-info', async ({ page, request }) => {
    await page.goto('/cliente');
    expect(await esperaServiceWorkerAtivo(page)).toBe(true);

    const sw = await (await request.get('/sw.js')).text();
    expect(sw).toContain('assets/');
    // Se o build-info entrasse no precache, o smoke passaria a ler o SHA antigo
    // e deixaria de detectar exatamente o problema que existe para detectar.
    expect(sw).not.toContain('build-info.json');
  });

  test('o portal volta a funcionar depois de limpar service worker e caches', async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);
    expect(await esperaServiceWorkerAtivo(page)).toBe(true);

    // O hard refresh do usuário, feito por código.
    await page.evaluate(async () => {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map((r) => r.unregister()));
      const chaves = await caches.keys();
      await Promise.all(chaves.map((c) => caches.delete(c)));
    });
    await page.reload();

    await expect(page.getByRole('heading', { name: /\[HOMOLOG\] Conta Em Dia/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Plano de ação/i })).toBeVisible();
  });

  test('o service worker assume o controle sem esperar a próxima aba', async ({ page, request }) => {
    // `skipWaiting` + `clientsClaim` são o que faz o bundle novo valer na
    // primeira recarga; sem eles o cliente fica no antigo até fechar tudo.
    const sw = await (await request.get('/sw.js')).text();
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/clientsClaim/);

    // No primeiro carregamento a página que registrou o worker ainda não é
    // controlada por ele — `clientsClaim` assume logo depois. O que interessa
    // provar é o passo seguinte: na recarga, quem serve é o service worker.
    await page.goto('/cliente');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();

    const controlado = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return !!navigator.serviceWorker.controller;
    });
    expect(controlado).toBe(true);
  });
});
