import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Trading'
const isCi = process.env.CI === 'true'

export default defineConfig({
  base: isCi ? `/${repo}/` : '/',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1600,
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
