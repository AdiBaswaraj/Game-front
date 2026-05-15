/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'arcadia-bg': '#0a0a0f',
        'neon-green': '#00ff88',
        'neon-cyan': '#00d4ff',
        'neon-pink': '#ff006e',
      },
      fontFamily: {
        arcade: ['"Press Start 2P"', 'system-ui', 'monospace'],
      },
    },
  },
  plugins: [],
}
