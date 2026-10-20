/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        omp: {
          bg: '#0d1117',
          surface: '#161b22',
          surfaceLight: '#21262d',
          border: '#30363d',
          accent: '#58a6ff',
          accentHover: '#1f6feb',
          text: '#c9d1d9',
          muted: '#8b949e',
          success: '#3fb950',
          warning: '#d29922',
          error: '#f85149',
          purple: '#bc8cff',
          cyan: '#39c5bb',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
