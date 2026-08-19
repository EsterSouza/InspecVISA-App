/**
 * Entrada autenticada, compartilhada pelos specs.
 *
 * Morava dentro do `staff.spec.ts` até o FE-27 (19/08/2026) precisar da mesma
 * sessão no gate visual. Duas cópias de um login que passa por seleção de perfil
 * é exatamente o tipo de coisa que diverge em silêncio.
 */
import { expect, type Page } from '@playwright/test';
import { contas } from './ambiente';

export async function entraComoStaff(page: Page): Promise<void> {
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
