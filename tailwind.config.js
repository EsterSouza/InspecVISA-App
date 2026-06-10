/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#244A9B',
          50: '#EEF4FF',
          100: '#DCE8FF',
          200: '#B9D1FF',
          300: '#91B4FF',
          400: '#6F95F6',
          500: '#4F7BE8',
          600: '#315EBC',
          700: '#244A9B',
          800: '#142F68',
          900: '#06122F',
        },
        secondary: {
          DEFAULT: '#0F6B78',
          50: '#EAF7F8',
          500: '#0F6B78',
          600: '#0B5660',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
