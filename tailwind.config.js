/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // strict type scale — these five sizes only, no one-offs
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['14px', '20px'],
      base: ['16px', '24px'],
      xl: ['20px', '26px'],
      '2xl': ['28px', '34px']
    },
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      // theme surfaces come from CSS variables (slate / amoled), see index.css
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        card2: 'var(--card2)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        veil: 'var(--veil)',
        ink: 'var(--ink)',
        mut: 'var(--mut)',
        focus: 'var(--focus)',
        tint: 'var(--tint)'
      },
      maxWidth: { grid: '1600px' }
    }
  },
  plugins: []
}
