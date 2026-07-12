import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // lib tests run in node; component tests opt into jsdom via // @vitest-environment jsdom
    globals: true,       // enables RTL auto-cleanup; tests still import explicitly from 'vitest'
    setupFiles: ['./src/test/setup.js'],
    // Non-UTC, DST-observing TZ: toISOString()/bare new Date(iso) calendar bugs fail loudly
    env: { TZ: 'Pacific/Auckland' },
    restoreMocks: true
  }
})
