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
          bg: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-bg), ${opacityValue})` : `rgb(var(--omp-bg))`,
          surface: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-surface), ${opacityValue})` : `rgb(var(--omp-surface))`,
          surfaceLight: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-surface-light), ${opacityValue})` : `rgb(var(--omp-surface-light))`,
          surfaceElevated: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-surface-elevated), ${opacityValue})` : `rgb(var(--omp-surface-elevated))`,
          border: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-border), ${opacityValue})` : `rgb(var(--omp-border))`,
          borderLight: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-border-light), ${opacityValue})` : `rgb(var(--omp-border-light))`,
          accent: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-accent), ${opacityValue})` : `rgb(var(--omp-accent))`,
          accentHover: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-accent-hover), ${opacityValue})` : `rgb(var(--omp-accent-hover))`,
          accentMuted: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-accent), 0.15)` : `rgba(var(--omp-accent), 0.15)`,
          accentBorder: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-accent), 0.35)` : `rgba(var(--omp-accent), 0.35)`,
          text: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-text), ${opacityValue})` : `rgb(var(--omp-text))`,
          muted: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-muted), ${opacityValue})` : `rgb(var(--omp-muted))`,
          subtle: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-subtle), ${opacityValue})` : `rgb(var(--omp-subtle))`,
          success: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-success), ${opacityValue})` : `rgb(var(--omp-success))`,
          warning: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-warning), ${opacityValue})` : `rgb(var(--omp-warning))`,
          error: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-error), ${opacityValue})` : `rgb(var(--omp-error))`,
          info: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-info), ${opacityValue})` : `rgb(var(--omp-info))`,
          cyan: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-cyan), ${opacityValue})` : `rgb(var(--omp-cyan))`,
          purple: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--omp-purple), ${opacityValue})` : `rgb(var(--omp-purple))`,
        }
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'Inter', 'Helvetica Neue', 'Helvetica', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        xs: '2px',
        sm: '3px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.02em',
        normal: '0em',
        wide: '0.04em',
        wider: '0.08em',
        widest: '0.14em',
      }
    },
  },
  plugins: [],
}
