/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E6B5E',
          50: '#E8F5F2',
          100: '#C6E8E1',
          200: '#8FD1C3',
          300: '#58BAA5',
          400: '#2D8F7E',
          500: '#1E6B5E',
          600: '#18574C',
          700: '#12433A',
          800: '#0C2F28',
          900: '#061B16',
        },
        secondary: {
          DEFAULT: '#2D5A8E',
          50: '#E8EFF8',
          500: '#2D5A8E',
          600: '#244875',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
