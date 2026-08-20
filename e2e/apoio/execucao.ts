/**
 * Entrada na execução do roteiro — a única tela do admin sem URL própria: ela
 * é alcançada por `navigate(state)`, então o gate não consegue `page.goto`.
 *
 * Reaproveita a inspeção em andamento que já existir em homologação; só cria
 * uma quando não há nenhuma, para não deixar lixo a cada rodada.
 */
import { expect, type Page } from '@playwright/test';

export async function abreExecucao(page: Page): Promise<void> {
  await page.goto('/inspections');
  await page.waitForLoadState('networkidle');

  const continuar = page.getByRole('button', { name: 'Continuar' }).first();
  if (await continuar.count()) {
    await continuar.click();
  } else {
    await page.goto('/new');
    await page.waitForLoadState('networkidle');
    await page.getByText('[HOMOLOG] Unidade Com Pasta').click();
    await page.getByText(/Roteiro de Inspeção — ILPI/).click();
    await page.getByRole('button', { name: /Iniciar inspeção/i }).click();
  }

  await expect(page.getByRole('group', { name: /Filtrar itens do roteiro/i }).first())
    .toBeVisible({ timeout: 30_000 });
}
