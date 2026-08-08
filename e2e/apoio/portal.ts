import { expect, type Page } from '@playwright/test';

/** Faz login no portal do cliente e espera o painel montar. */
export async function entraNoPortal(page: Page, email: string, codigo: string): Promise<void> {
  await page.goto('/cliente');
  await page.getByLabel(/E-mail ou usuario/i).fill(email);
  // Sem âncora `^`: o texto do label é " Senha" (o espaço vem do ícone no JSX) e
  // o Playwright não faz trim quando o seletor é regex.
  await page.getByLabel(/Senha/i).fill(codigo);
  await page.getByRole('button', { name: /Acessar meu painel/i }).click();
  // O painel mostra a contagem de unidades no cabeçalho — é o sinal de que a
  // sessão abriu, e não só de que o POST voltou.
  await expect(page.getByText(/unidades? · \d+ compromissos?/i)).toBeVisible();
}

/** Tenta o login e devolve a mensagem de erro exibida, sem falhar o teste. */
export async function tentaEntrar(page: Page, email: string, codigo: string): Promise<string> {
  await page.goto('/cliente');
  await page.getByLabel(/E-mail ou usuario/i).fill(email);
  // Sem âncora `^`: o texto do label é " Senha" (o espaço vem do ícone no JSX) e
  // o Playwright não faz trim quando o seletor é regex.
  await page.getByLabel(/Senha/i).fill(codigo);
  await page.getByRole('button', { name: /Acessar meu painel/i }).click();
  const erro = page.getByText(/invalid|incorret|nao encontrad|não encontrad/i).first();
  await expect(erro).toBeVisible();
  return (await erro.textContent()) ?? '';
}
