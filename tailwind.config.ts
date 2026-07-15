import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Dark mode is driven by data-theme on <html>, not the OS preference alone,
  // so the in-app "system | light | dark" setting stays the single authority.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // All colors resolve through CSS variables (src/styles/tokens.css)
        // so theme switching needs no Tailwind dark: duplication.
        paper: 'var(--paper)',
        card: 'var(--card)',
        grid: 'var(--grid)',
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
        },
        ballpoint: 'var(--ballpoint)',
        redpen: 'var(--redpen)',
        green: 'var(--green)',
        highlight: 'var(--highlight)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      // Type scale per §11.2: 13 / 15 (base) / 17 / 22 / 28 / 40
      fontSize: {
        xs: ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.5' }],
        md: ['17px', { lineHeight: '1.5' }],
        xl: ['22px', { lineHeight: '1.15' }],
        '2xl': ['28px', { lineHeight: '1.15' }],
        hero: ['40px', { lineHeight: '1.15' }],
      },
      borderRadius: {
        card: '12px',
        sheet: '16px',
      },
      boxShadow: {
        // Only overlays get shadows (§11.3); cards stay flat paper.
        overlay: '0 8px 32px rgb(0 0 0 / 0.16)',
      },
    },
  },
  plugins: [],
} satisfies Config;
