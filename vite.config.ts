import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function gitOutput(command: string): string {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

/**
 * Carimba o SHA no que é publicado. Sem isso não há como responder "o bundle em
 * produção é deste commit?" — comparar hash de chunk não serve, porque o hash
 * muda com qualquer variável de ambiente inlinada.
 *
 * O `build-info.json` é a fonte para o smoke (`scripts/prod-smoke.ts`): fica fora
 * do precache do service worker de propósito, porque o glob do workbox só pega
 * js/css/html/woff2. A meta tag responde outra pergunta — de qual build é o HTML
 * que este navegador recebeu —, que é o que denuncia service worker preso em
 * versão antiga.
 */
function buildInfoPlugin() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || gitOutput('git rev-parse HEAD') || 'desconhecido';
  const branch =
    process.env.VERCEL_GIT_COMMIT_REF || gitOutput('git rev-parse --abbrev-ref HEAD') || 'desconhecido';
  const info = {
    sha,
    shaCurto: sha.slice(0, 7),
    branch,
    ambiente: process.env.VERCEL_ENV || 'local',
    geradoEm: new Date().toISOString(),
  };

  return {
    name: 'inspecvisa-build-info',
    apply: 'build' as const,
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { name: 'build-sha', content: info.sha }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { name: 'build-at', content: info.geradoEm }, injectTo: 'head' as const },
      ];
    },
    generateBundle(this: { emitFile: (file: Record<string, unknown>) => void }) {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: `${JSON.stringify(info, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    buildInfoPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512.png', 'logo-claro-192.png'],
      manifest: {
        id: '/',
        name: 'InspecVISA — Inspeção Sanitária',
        short_name: 'InspecVISA',
        description: 'Agendamento, acompanhamento e relatórios de inspeção sanitária.',
        lang: 'pt-BR',
        theme_color: '#06122F',
        background_color: '#0B1B3F',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity', 'health'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Ícones e logo vêm do `includeAssets` acima, por nome explícito — não por
        // glob. Um PNG/SVG novo em `public/` (screenshot, imagem de trabalho) não
        // deve inflar o precache do service worker em silêncio.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        maximumFileSizeToCacheInBytes: 4000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'dexie', '@supabase/supabase-js', 'zustand'],
          charts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable'],
          'document-parser': ['pdfjs-dist', 'mammoth'],
          ui: ['clsx', 'tailwind-merge'],
        },
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // `e2e/` é do Playwright: o Vitest coleta os arquivos e falha na hora de
    // importar `@playwright/test`.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/store/**', 'src/components/**'],
      exclude: ['src/data/**', 'src/db/**'],
      thresholds: { lines: 80, functions: 80 },
    },
  },
} as any);

