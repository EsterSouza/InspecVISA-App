/**
 * Testes mínimos de liberação do portal do cliente (P360-015).
 *
 * Rodam contra o tenant de homologação, dentro do banco de produção. Tudo que
 * eles leem tem o prefixo `[HOMOLOG]`; se algum nome de cliente real aparecer,
 * é vazamento entre tenants e o teste falha.
 */
import { expect, test } from '@playwright/test';
import { contas, PREFIXO_HOMOLOG } from './apoio/ambiente';
import { entraNoPortal, tentaEntrar } from './apoio/portal';

test.describe('acesso à conta', () => {
  test('conta válida abre o painel da própria conta', async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);

    await expect(page.getByRole('heading', { name: /\[HOMOLOG\] Conta Em Dia/ })).toBeVisible();
  });

  test('senha errada não abre o painel', async ({ page }) => {
    const { email } = contas.portal();
    await tentaEntrar(page, email, 'senha-que-nao-existe');

    await expect(page.getByRole('button', { name: /Acessar meu painel/i })).toBeVisible();
    await expect(page.getByText(/unidades? · \d+ compromissos?/i)).toHaveCount(0);
  });

  test('conta em atraso entra e continua vendo a entrega', async ({ page }) => {
    // PORT-01: atraso suspende agendar, nunca esconde o que já foi entregue.
    const { email, codigo } = contas.portalEmAtraso();
    await entraNoPortal(page, email, codigo);

    await expect(page.getByRole('heading', { name: /\[HOMOLOG\] Conta Em Atraso/ })).toBeVisible();
    // `exact` porque "Item vencido no plano de ação" também é um heading.
    await expect(page.getByRole('heading', { name: 'Plano de ação', exact: true })).toBeVisible();
  });

  test('conta de outro tenant não enxerga as unidades do primeiro', async ({ page }) => {
    const { email, codigo } = contas.portalOutroTenant();
    await entraNoPortal(page, email, codigo);

    await expect(page.getByRole('heading', { name: /\[HOMOLOG\] Conta Do Outro Tenant/ })).toBeVisible();
    await expect(page.getByText('1 unidade · 0 compromissos')).toBeVisible();
    // O que importa é a ausência: nenhuma unidade do tenant A pode vazar para cá.
    // (O nome da própria unidade não aparece na tela quando a conta tem só uma e
    // nenhum compromisso — não há seletor de unidade nem lista de visitas.)
    await expect(page.getByText('[HOMOLOG] Unidade Com Pasta')).toHaveCount(0);
    await expect(page.getByText('[HOMOLOG] Unidade Sem Pasta')).toHaveCount(0);
  });

  test('o painel não mostra nada fora do tenant de homologação', async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);

    // Toda unidade citada na tela tem de ser de homologação. Um nome de cliente
    // real aqui seria vazamento entre tenants.
    const unidades = await page.locator('option[value^="aaaa0015"]').allTextContents();
    expect(unidades.length).toBeGreaterThan(0);
    for (const nome of unidades) expect(nome).toContain(PREFIXO_HOMOLOG);

    const seletor = page.getByLabel('Unidade');
    const todas = await seletor.locator('option').allTextContents();
    for (const nome of todas) {
      if (nome.trim() === 'Todas') continue;
      expect(nome).toContain(PREFIXO_HOMOLOG);
    }
  });
});

test.describe('acessos rápidos', () => {
  test.beforeEach(async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);
  });

  test('pasta principal e pasta personalizada são dois botões distintos', async ({ page }) => {
    // Decisão de produto: um não substitui o outro.
    const principal = page.getByRole('link', { name: /Abrir pasta principal completa/i });
    const personalizada = page.getByRole('link', {
      name: /Abrir Pasta Sanitária Personalizada — \[HOMOLOG\] Unidade Com Pasta/i,
    });

    await expect(principal).toBeVisible();
    await expect(personalizada).toBeVisible();
    expect(await principal.getAttribute('href')).not.toBe(await personalizada.getAttribute('href'));
  });

  test('unidade sem pasta personalizada não gera botão quebrado', async ({ page }) => {
    // "URL ausente ou inválida não pode gerar botão quebrado."
    const personalizadas = page.getByRole('link', { name: /Pasta Sanitária Personalizada/i });
    await expect(personalizadas).toHaveCount(1);
    await expect(personalizadas.first()).not.toHaveAttribute('href', /^\s*$/);
  });

  test('tutorial aparece e o clique entra na auditoria', async ({ page }) => {
    const tutorial = page.getByRole('link', { name: /Abrir tutorial do portal \(PDF\)/i });
    await expect(tutorial).toBeVisible();

    // A auditoria é uma RPC própria: observar a chamada prova o registro sem
    // precisar de acesso ao banco a partir do teste.
    const auditoria = page.waitForRequest(
      (req) => req.url().includes('client_portal_audit_event') && req.method() === 'POST',
      { timeout: 10_000 }
    );
    await tutorial.click({ modifiers: ['Alt'] }); // não navega para fora do app
    await expect(auditoria).resolves.toBeTruthy();
  });
});

test.describe('plano de ação', () => {
  test.beforeEach(async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);
  });

  test('pendência vencida vem marcada e as três respostas estão disponíveis', async ({ page }) => {
    const plano = page.getByRole('region').filter({ hasText: 'Plano de ação' }).first();

    await expect(plano.getByText('Prazo vencido')).toBeVisible();
    await expect(plano.getByText('[HOMOLOG] Pendencia vencida para teste de prazo')).toBeVisible();

    // PORT-03: quem ainda não corrigiu precisa ter como dizer isso.
    const item = plano.getByRole('listitem').first();
    await expect(item.getByRole('button', { name: 'Já corrigi' })).toBeVisible();
    await expect(item.getByRole('button', { name: 'Estou providenciando' })).toBeVisible();
    await expect(item.getByRole('button', { name: 'Ainda não fiz' })).toBeVisible();
  });

  test('o envio de evidência é oferecido no item pendente', async ({ page }) => {
    const plano = page.getByRole('region').filter({ hasText: 'Plano de ação' }).first();
    const item = plano.getByRole('listitem').first();

    await expect(item.getByRole('button', { name: /Enviar evidência/i })).toBeVisible();
    await expect(item.getByText(/PDF, JPG, PNG ou WEBP, até 10 MB/i)).toBeVisible();
  });

  test('"Ainda não fiz" exige justificativa', async ({ page }) => {
    // Regra do PORT-03: "não fiz" sozinho não serve para a próxima visita.
    const plano = page.getByRole('region').filter({ hasText: 'Plano de ação' }).first();
    const item = plano.getByRole('listitem').first();

    await item.getByRole('button', { name: 'Ainda não fiz' }).click();
    await expect(item.getByRole('textbox').first()).toBeVisible();
  });
});

test.describe('regressão do que já estava no ar', () => {
  test.beforeEach(async ({ page }) => {
    const { email, codigo } = contas.portal();
    await entraNoPortal(page, email, codigo);
  });

  test('pagamento, conformidade, agenda e solicitações continuam na página', async ({ page }) => {
    await expect(page.getByText(/Pagamento confirmado|Pagamento em aberto/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Conformidade da rede/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Calendário de compromissos/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Agendamentos e arquivos/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Solicitações$/i })).toBeVisible();
  });

  test('a visita concluída abre o detalhe', async ({ page }) => {
    // Filtrar pelo href: o nome da unidade também aparece no botão da pasta
    // personalizada, que é link externo para o Drive.
    await page.locator('a[href^="/cliente/visita/"]').first().click();
    await expect(page).toHaveURL(/\/cliente\/visita\//);
    await expect(page.getByText(/\[HOMOLOG\] Unidade/).first()).toBeVisible();
  });
});
