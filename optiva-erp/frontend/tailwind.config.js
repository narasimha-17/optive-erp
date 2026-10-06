/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#14141f', soft: '#3d3f50', muted: '#6b6d80', faint: '#9a9cae' },
        canvas: '#f7f7fa',
        line: { DEFAULT: '#e7e7ee', strong: '#d6d6e2' },
        brand: {
          50: '#f6f4ff',
          100: '#ece8fd',
          200: '#d9d1fa',
          300: '#bdb0f5',
          400: '#9d89ee',
          500: '#7c64e3',
          600: '#5b43c9',
          700: '#4a35a8',
          800: '#3b2c86',
          900: '#2b2063',
        },
        coral: { 50: '#fff1ef', 100: '#ffe0db', 500: '#f0685b', 600: '#dc4f42' },
        ok: { 50: '#ecf8f2', 500: '#1f9d6b', 600: '#17855a' },
        warn: { 50: '#fff7e8', 500: '#d98a0b', 600: '#b97206' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,20,31,.04), 0 1px 1px rgba(20,20,31,.02)',
        pop: '0 12px 32px -8px rgba(20,20,31,.18), 0 2px 6px rgba(20,20,31,.06)',
      },
      borderRadius: { card: '12px' },
    },
  },
  corePlugins: { container: false },
  plugins: [],
}
