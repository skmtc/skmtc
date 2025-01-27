import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/'
    }
  },
  test: {
    exclude: ['app/reapit-download/**', 'app/reapit-files/**']
  }
})
