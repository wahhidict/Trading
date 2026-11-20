/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0f1420',
        panel: '#161b26',
        panel2: '#1e222d',
        border: '#2a2e39',
        accent: '#2962ff',
        up: '#22ab94',
        down: '#f23645',
        txt: '#d1d4dc',
        muted: '#787b86',
      },
      fontFamily: {
        ui: ['-apple-system', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
