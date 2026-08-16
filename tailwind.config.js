import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
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
          100: '#E3F1F3', // --teal-soft
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
        amber: {
          DEFAULT: '#D99721',
          soft: '#FBF0DC',
          'soft-ink': '#7A5210',
          'soft-border': '#EFD9AC',
          strong: '#AE7714',
        },
        // Verde de sucesso/conformidade — --success*
        success: {
          DEFAULT: '#0E7A4A',
          soft: '#E4F3EB',
          'soft-ink': '#0A5734',
          'soft-border': '#B9DFCA',
        },
        // Vermelho de erro/não conformidade — --danger*
        danger: {
          DEFAULT: '#B3261E',
          hover: '#8C1D17',
          soft: '#FBE9E7',
          'soft-ink': '#8C1D17',
          'soft-border': '#F0C7C2',
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
