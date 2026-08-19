/**
 * Testes mínimos de liberação do portal do cliente (P360-015).
 *
 * Rodam contra o tenant de homologação, dentro do banco de produção. Tudo que
 * eles leem tem o prefixo `[HOMOLOG]`; se algum nome de cliente real aparecer,
 * é vazamento entre tenants e o teste falha.
 *
 * **Atualizados no FE-27 (19/08/2026).** Foram escritos em 08/08 contra o portal
 * de página única; o FE-09 quebrou o portal em seções com rota própria e oito
 * destes testes passaram a procurar bloco que não existe mais na visão geral.
 * Estavam vermelhos desde então sem ninguém ver: o job `e2e` do CI só roda por
 * `workflow_dispatch`. O que cada um prova continua o mesmo — mudou onde olhar.
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

    // Desde o FE-09 o plano de ação é uma seção com rota própria. A prova de que
    // o atraso não esconde a entrega é a seção abrir e trazer a pendência.
    await page.getByRole('link', { name: /^Plano de ação/ }).click();
    await expect(page).toHaveURL(/\/cliente\/plano-de-acao/);
    await expect(page.getByText('[HOMOLOG] Pendencia vencida para teste de prazo')).toBeVisible();
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
    //
    // A lista de visitas é o melhor lugar para perguntar isso: cada compromisso
    // nomeia a unidade dele. O seletor `<option>` que este teste usava só existe
    // acima de 6 unidades (`PortalUnitFilter`) — abaixo disso a filtragem é por
    // chip, e o teste media o vazio.
    await page.goto('/cliente/agenda');
    // Esperar a lista montar: contar link antes disso conta zero e o teste passa
    // por engano — o que ele tem que provar é o conteúdo, não a ausência.
    await expect(page.getByRole('heading', { name: /Agendamentos e arquivos/i })).toBeVisible();
    const visitas = page.locator('a[href^="/cliente/visita/"]');
    const total = await visitas.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i += 1) {
      expect(await visitas.nth(i).innerText()).toContain(PREFIXO_HOMOLOG);
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
    // FE-09: o plano deixou de ser um bloco da visão geral e virou seção.
    await page.goto('/cliente/plano-de-acao');
    await expect(page.getByRole('heading', { name: 'Plano de ação', level: 1 })).toBeVisible();
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
    // Os quatro assuntos continuam no ar — cada um na seção que o FE-09 criou.
    // O teste anterior os procurava todos na visão geral, onde só dois ficaram.
    await expect(page.getByRole('heading', { name: /Conformidade da rede/i })).toBeVisible();

    await page.goto('/cliente/agenda');
    await expect(page.getByRole('heading', { name: /Calendário de compromissos/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Agendamentos e arquivos/i })).toBeVisible();

    await page.goto('/cliente/solicitacoes');
    await expect(page.getByRole('heading', { name: /^Solicitações$/i })).toBeVisible();

    await page.goto('/cliente/financeiro');
    await expect(page.getByText(/Pagamento confirmado|Pagamento em aberto|Sem cobrança/i).first()).toBeVisible();
  });

  test('a visita concluída abre o detalhe', async ({ page }) => {
    // A lista de visitas mora na Agenda desde o FE-09. Filtrar pelo href: o nome
    // da unidade também aparece no botão da pasta personalizada, que é link
    // externo para o Drive.
    await page.goto('/cliente/agenda');
    const visita = page.locator('a[href^="/cliente/visita/"]').first();
    await expect(visita).toBeVisible();
    await visita.click();
    await expect(page).toHaveURL(/\/cliente\/visita\//);
    await expect(page.getByText(/\[HOMOLOG\] Unidade/).first()).toBeVisible();
  });
});
