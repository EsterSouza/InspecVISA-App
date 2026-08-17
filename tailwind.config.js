import tailwindcssAnimate from 'tailwindcss-animate';

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
        // Azul de ação — de docs/prototipos/_src/tokens.css (--accent*)
        primary: {
          DEFAULT: '#244A9B',
          50: '#EAF3FC', // --accent-soft
          100: '#DCE8FF',
          200: '#B9D1FF',
          300: '#91B4FF',
          400: '#6F95F6', // --accent no tema escuro
          500: '#4F7BE8',
          600: '#315EBC',
          700: '#244A9B', // --accent
          800: '#1B3A7D', // --accent-hover
          900: '#0B1F3A', // navy institucional — âncora mais escura da escala
        },
        // Navy institucional — --ink/--ink-2/--ink-3, hierarquia de texto/estrutura
        navy: {
          DEFAULT: '#0B1F3A',
          2: '#41556F',
          3: '#54657B',
        },
        // Teal operacional (identidade interna do InspecVISA) — --teal*
        secondary: {
          DEFAULT: '#0F6B78',
          50: '#F2F9FA',
          100: '#ADE3EB', // --teal-soft (corrigido 17/08 — ver nota abaixo)
          200: '#BCDDE1', // --teal-soft-border
          300: '#8FC3C9',
          400: '#4F9AA3',
          500: '#0F6B78', // --teal
          600: '#0C5560',
          700: '#0A4A53', // --teal-soft-ink
          800: '#083A42',
          900: '#062931',
        },
        // Âmbar semântico — atenção e prazo, nunca ação principal (--amber*)
        // "soft" corrigido em 17/08/2026: a versão original (#FBF0DC) tinha luminosidade
        // 92% — igual à de success-soft/danger-soft/teal-soft (todas 92-95%), então o
        // matiz era a única diferença e os badges ficavam indistinguíveis a olho. Baixada
        // a luminosidade e subida a saturação em todos os 4 "soft" semânticos, mantendo o
        // mesmo matiz; contraste com a tinta ("soft-ink") conferido de novo, todos >=4,5:1.
        amber: {
          DEFAULT: '#D99721',
          soft: '#FADA9E',
          'soft-ink': '#7A5210',
          'soft-border': '#EFD9AC',
          strong: '#AE7714',
        },
        // Verde de sucesso/conformidade — --success*
        success: {
          DEFAULT: '#0E7A4A',
          soft: '#AEEACA',
          'soft-ink': '#0A5734',
          'soft-border': '#B9DFCA',
        },
        // Vermelho de erro/não conformidade — --danger*
        danger: {
          DEFAULT: '#B3261E',
          hover: '#8C1D17',
          soft: '#FAA79E',
          'soft-ink': '#8C1D17',
          'soft-border': '#F0C7C2',
        },
        // Superfície — --surface* (FE-21: de-para de cor, Artefato D)
        surface: {
          DEFAULT: '#FFFFFF',
          sunken: '#E4ECF6',
          hover: '#F4F8FC',
          active: '#E9F1FB',
        },
        // Fundo de página. Testado com --bg (#EEF3F9, o tom do Manual 2.0) em
        // 17/08/2026 e revertido no mesmo dia a pedido da Ester: de volta ao
        // cinza neutro que já estava no app antes do FE-21 (Tailwind gray-50).
        canvas: '#F9FAFB',
        // Traço decorativo — --border (não delimita controle)
        default: '#CBD9EA',
        // Traço de campo — --border-control (3:1 obrigatório em input/select/checkbox)
        control: '#7688A2',
        // Link/texto azul sobre superfície clara — --accent-ink (distinto de primary-800)
        'accent-ink': '#1D3D80',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        title: ['Sora', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
