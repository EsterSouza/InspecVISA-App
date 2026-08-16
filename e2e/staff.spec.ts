/**
 * App interno autenticado (P360-015).
 *
 * O ponto mais sensível: a consultora de homologação não pode enxergar nenhum
 * cliente real. É a mesma barreira de RLS que o portal usa, mas por outro
 * caminho — sessão de `authenticated` em vez de token de portal.
 */
import { expect, test, type Page } from '@playwright/test';
import { contas, exige, PREFIXO_HOMOLOG } from './apoio/ambiente';

async function entraComoStaff(page: Page): Promise<void> {
  const { email, senha } = contas.staff();
  await page.goto('/login');
  await page.getByLabel(/E-mail corporativo/i).fill(email);
  await page.getByLabel(/Senha/i).fill(senha);
  await page.getByRole('button', { name: /Entrar Agora/i }).click();
  await expect(page.getByRole('button', { name: /Entrar Agora/i })).toHaveCount(0, {
    timeout: 20_000,
  });

  // Depois do login vem "Quem está usando?". A lista de perfis é fixa no código
  // (Ester e Ana), não vem do tenant — então aparece igual em homologação.
  // Precisa de `waitFor`: o botão de entrar some antes de a tela de perfil
  // montar, então perguntar `isVisible()` na hora responde `false` e o teste
  // segue sem escolher perfil — e aí a próxima navegação volta para o login.
  const selecaoDePerfil = page.getByRole('heading', { name: /Quem está usando\?/i });
  const apareceu = await selecaoDePerfil
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (apareceu) {
    await page.getByRole('button').filter({ hasText: 'Ester' }).first().click();
    await expect(selecaoDePerfil).toHaveCount(0, { timeout: 15_000 });
  }
}

/** Access token da sessão logada, como o supabase-js o guarda no localStorage. */
async function tokenDaSessao(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const chave = localStorage.key(i);
      if (!chave || !chave.startsWith('sb-') || !chave.endsWith('-auth-token')) continue;
      try {
        const valor = JSON.parse(localStorage.getItem(chave) ?? '{}');
        if (valor?.access_token) return String(valor.access_token);
      } catch {
        /* chave de outro formato */
      }
    }
    return '';
  });
  expect(token, 'não achei a sessão do Supabase no localStorage').not.toBe('');
  return token;
}

/**
 * O app interno é offline-first: a lista de clientes vem do IndexedDB, não do
 * servidor. Em contexto novo do Playwright o banco local está vazio e a tela diz
 * "Nenhum cliente encontrado" — o que não é falha de permissão, é falta de sync.
 */
async function sincroniza(page: Page): Promise<void> {
  await page.goto('/sync');
  await page.getByRole('button', { name: /Sincronizar Agora/i }).click();
  await page.waitForLoadState('networkidle');
}

test.describe('acesso da equipe', () => {
  test('credencial inválida não entra', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/E-mail corporativo/i).fill('nao.existe@inspecvisa.test');
    await page.getByLabel(/Senha/i).fill('senha-que-nao-existe');
    await page.getByRole('button', { name: /Entrar Agora/i }).click();

    await expect(page.getByRole('button', { name: /Entrar Agora/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a conta de homologação entra', async ({ page }) => {
    await entraComoStaff(page);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('isolamento entre tenants no app interno', () => {
  test.beforeEach(async ({ page }) => {
    await entraComoStaff(page);
  });

  test('o servidor só devolve clientes do tenant de homologação', async ({ page }) => {
    // Olhar a resposta do servidor, e não a lista na tela, é de propósito: a tela
    // lê do IndexedDB e em contexto novo começa vazia — o que provaria nada. Quem
    // decide o que sai daqui é o RLS, e é isso que precisa ser observado.
    const tenantsVistos = new Set<string>();
    const nomesVistos: string[] = [];

    page.on('response', async (resposta) => {
      if (!/\/rest\/v1\/clients/.test(resposta.url())) return;
      const corpo = await resposta.json().catch(() => null);
      if (!Array.isArray(corpo)) return;
      for (const linha of corpo) {
        if (linha?.tenant_id) tenantsVistos.add(String(linha.tenant_id));
        if (linha?.name) nomesVistos.push(String(linha.name));
      }
    });

    await sincroniza(page);
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    expect(nomesVistos.length, 'o servidor não devolveu nenhum cliente').toBeGreaterThan(0);
    // Um único tenant, e é o de homologação: nem o tenant B, nem o real.
    expect([...tenantsVistos]).toEqual([exige('E2E_TENANT_HOMOLOG')]);
    for (const nome of nomesVistos) expect(nome).toContain(PREFIXO_HOMOLOG);
  });

  test('/painel redireciona pro Início, que traz a fila operacional sem misturar tenants', async ({ page }) => {
    // FE-14: /painel foi absorvido pelo Início — a rota antiga só redireciona.
    await page.goto('/painel');
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /O que exige ação agora/i })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByText('[HOMOLOG] Unidade Do Outro Tenant')).toHaveCount(0);
  });

  test('a agenda traz inspeção e reunião, cada uma com o seu tipo', async ({ page }) => {
    // Agenda multiuso: o seed criou uma inspeção e uma reunião. O que não pode
    // acontecer é a reunião entrar como inspeção — foi essa a decisão de produto.
    //
    // A consulta é feita com o token da sessão que acabou de logar, não pela tela:
    // a agenda também lê do IndexedDB, e o que precisa ser provado aqui é o que o
    // servidor entrega para esta sessão.
    await page.goto('/schedules');
    const token = await tokenDaSessao(page);

    const url = exige('E2E_SUPABASE_URL').replace(/\/$/, '');
    const chave = exige('E2E_SUPABASE_ANON_KEY');
    const resposta = await page.request.get(
      `${url}/rest/v1/appointment_requests?select=appointment_type,tenant_id,inspection_id,unit_name`,
      { headers: { apikey: chave, Authorization: `Bearer ${token}` } }
    );
    expect(resposta.ok()).toBe(true);

    const compromissos = (await resposta.json()) as Array<{
      appointment_type: string;
      tenant_id: string;
      inspection_id: string | null;
    }>;

    expect(compromissos.length, 'nenhum compromisso veio do servidor').toBeGreaterThan(0);
    // RLS: nada de outro tenant chega aqui, nem o real, nem o tenant B.
    for (const c of compromissos) expect(c.tenant_id).toBe(exige('E2E_TENANT_HOMOLOG'));

    const tipos = new Set(compromissos.map((c) => c.appointment_type));
    expect(tipos.has('inspection'), 'a inspeção do seed não veio').toBe(true);
    expect(tipos.has('follow_up_meeting'), 'a reunião do seed não veio').toBe(true);

    // A reunião não pode ter inspeção vinculada — é a contaminação que o card proíbe.
    for (const c of compromissos.filter((x) => x.appointment_type !== 'inspection')) {
      expect(c.inspection_id, `${c.appointment_type} veio com inspeção vinculada`).toBeNull();
    }
  });
});
