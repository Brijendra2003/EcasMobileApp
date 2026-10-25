// Colours resolve to CSS variables that ThemeProvider (src/components/theme.tsx)
// fills from the synced design tokens in src/shared/tokens.ts, so light/dark
// and the web palette stay in one place.
const token = name => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: token('navy'),
        primary: token('primary'),
        canvas: token('canvas'),
        surface: token('surface'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        // Status colours (fallbacks; live values come from attendance_status_codes.color)
        present: '#16a34a',
        absent: '#dc2626',
        leave: '#d97706',
        duty: '#2563eb',
        warn: '#d97706',
        danger: '#dc2626',
        safe: '#16a34a',
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '18px' },
    },
  },
  plugins: [],
};
