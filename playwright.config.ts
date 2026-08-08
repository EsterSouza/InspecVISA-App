import { defineConfig, devices } from '@playwright/test';
import { carregaEnvHomolog, baseURL } from './e2e/apoio/ambiente';

carregaEnvHomolog();

export default defineConfig({
  testDir: './e2e',
  // Contra ambiente publicado e banco compartilhado: paralelismo agressivo
  // atrapalha o teste de reserva concorrente, que precisa controlar a corrida.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: baseURL(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // "Mobile real ou emulação confiável": o Pixel 5 traz viewport, touch e
    // user agent móveis de verdade, não só uma janela estreita.
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
