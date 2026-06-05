/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'arcadia-bg': '#050508',
        'arcadia-surface': '#11111a',
        'neon-green': '#00ff88',
        'neon-cyan': '#00d4ff',
        'neon-pink': '#ff006e',
        'neon-purple': '#7000ff',
      },
      fontFamily: {
        arcade: ['"Press Start 2P"', 'system-ui', 'monospace'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Softened from the original two-stop 12px+24px stack. Single
        // 8px wash at 25% alpha — still recognisably neon but far
        // easier on the eye over long sessions.
        'neon-green':  '0 0 8px rgba(0, 255, 136, 0.25)',
        'neon-cyan':   '0 0 8px rgba(0, 212, 255, 0.25)',
        'neon-pink':   '0 0 8px rgba(255, 0, 110, 0.25)',
        'neon-purple': '0 0 8px rgba(112, 0, 255, 0.25)',
      },
      keyframes: {
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'grid-pan': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '60px 60px' },
        },
      },
      animation: {
        blink: 'blink 1s steps(1) infinite',
        'grid-pan': 'grid-pan 12s linear infinite',
      },
    },
  },
  plugins: [],
}
