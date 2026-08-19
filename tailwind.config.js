import tailwindcssAnimate from 'tailwindcss-animate';

/**
 * FE-12 — a cor mora em `src/index.css`, aqui só o nome.
 *
 * Cada token é `rgb(var(--x) / <alpha-value>)`: o valor vem da variável (que o
 * `:root`/`.dark` troca) e o `<alpha-value>` mantém funcionando os modificadores
 * de opacidade que o app já usa (`bg-surface/60`, `bg-navy/50`, `text-white/90`).
 * Por isso as variáveis guardam canais ("11 31 58"), não hexadecimal.
 *
 * O de-para claro→escuro e o porquê de cada faixa estão no cabeçalho do
 * `index.css`; os valores do escuro vêm de `docs/prototipos/_src/tokens-dark.css`.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        // Três colunas na execução da inspeção (índice · roteiro · nota):
        // só cabem com folga a partir de 1400px. Ver FE-23, decisão 23.
        '3col': '1400px',
      },
      colors: {
        // Azul de ação — de docs/prototipos/_src/tokens.css (--accent*).
        // No escuro a escala inverte: 50 é o tom mais escuro, 900 o mais claro.
        primary: {
          DEFAULT: token('primary'),
          50: token('primary-50'),
          100: token('primary-100'),
          200: token('primary-200'),
          300: token('primary-300'),
          400: token('primary-400'),
          500: token('primary-500'),
          600: token('primary-600'),
          700: token('primary-700'),
          800: token('primary-800'),
          900: token('primary-900'),
        },
        // Navy institucional — --ink/--ink-2/--ink-3, hierarquia de texto/estrutura.
        // No escuro vira a tinta clara: `text-navy` continua sendo "o texto".
        navy: {
          DEFAULT: token('navy'),
          2: token('navy-2'),
          3: token('navy-3'),
        },
        // Teal operacional (identidade interna do InspecVISA) — --teal*
        secondary: {
          DEFAULT: token('secondary'),
          50: token('secondary-50'),
          100: token('secondary-100'),
          200: token('secondary-200'),
          300: token('secondary-300'),
          400: token('secondary-400'),
          500: token('secondary-500'),
          600: token('secondary-600'),
          700: token('secondary-700'),
          800: token('secondary-800'),
          900: token('secondary-900'),
        },
        // Âmbar semântico — atenção e prazo, nunca ação principal (--amber*).
        // Os quatro "soft" tiveram luminosidade e saturação corrigidas em 17/08
        // para deixarem de ser indistinguíveis entre si; ver histórico no git.
        amber: {
          DEFAULT: token('amber'),
          soft: token('amber-soft'),
          'soft-ink': token('amber-soft-ink'),
          'soft-border': token('amber-soft-border'),
          strong: token('amber-strong'),
        },
        // Verde de sucesso/conformidade — --success*
        success: {
          DEFAULT: token('success'),
          soft: token('success-soft'),
          'soft-ink': token('success-soft-ink'),
          'soft-border': token('success-soft-border'),
        },
        // Vermelho de erro/não conformidade — --danger*
        danger: {
          DEFAULT: token('danger'),
          hover: token('danger-hover'),
          soft: token('danger-soft'),
          'soft-ink': token('danger-soft-ink'),
          'soft-border': token('danger-soft-border'),
        },
        // Superfície — --surface* (FE-21: de-para de cor, Artefato D)
        surface: {
          DEFAULT: token('surface'),
          sunken: token('surface-sunken'),
          hover: token('surface-hover'),
          active: token('surface-active'),
        },
        // Fundo de página. No claro é o cinza neutro que a Ester pediu de volta
        // em 17/08 (Tailwind gray-50); no escuro, o navy profundo do Manual.
        canvas: token('canvas'),
        // Traço decorativo — --border (não delimita controle)
        default: token('border'),
        // Traço de campo — --border-control (3:1 obrigatório em input/select/checkbox)
        control: token('border-control'),
        // Link/texto azul sobre superfície clara — --accent-ink (distinto de primary-800)
        'accent-ink': token('accent-ink'),
        // Tinta sobre preenchimento colorido (botão, chip ativo, badge cheio).
        // No claro é branco; no escuro o preenchimento clareia e a tinta escurece.
        // É o token que substitui `text-white` sobre `bg-primary-*`/`bg-danger`/etc.
        'on-accent': token('on-accent'),
        // Superfície invertida em relação à página — dica de ferramenta, contador cheio
        inverse: {
          DEFAULT: token('inverse'),
          ink: token('inverse-ink'),
        },
        // Escuro fixo: NÃO acompanha o tema. Só para superfície que é escura nos
        // dois modos — véu de modal, herói do login, visor de foto em tela cheia.
        // Sobre `deep` o branco literal continua sendo a tinta certa.
        deep: {
          DEFAULT: '#0B1F3A',  // navy institucional
          blue: '#1B3A7D',     // meio do gradiente do login
          ink: '#DCE8FF',      // texto claro sobre o escuro fixo
          accent: '#6F95F6',   // foco e link — precisa de 3:1 contra o navy
          glow: '#4F7BE8',     // só decoração desfocada, nunca informação
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        title: ['Sora', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
