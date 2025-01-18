import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wyw from '@wyw-in-js/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wyw(), {
    name: 'post-build',
    buildStart() {
      console.log('SKMTC BUILD START')
    },
    closeBundle() {
      console.log('SKMTC CLOSE BUNDLE')
    }
  }],
  resolve: {
    extensions: ['.ts', '.tsx', '.generated.ts', '.generated.tsx', '.example.ts', '.example.tsx'],
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      onLog(level, log, handler) {
        handler(level, log);
      }
    }
  }
})
