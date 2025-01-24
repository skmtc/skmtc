import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wyw from '@wyw-in-js/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wyw({
    include: ['**/*.{ts,tsx}'],
    babelOptions: {
      presets: ['@babel/preset-typescript', '@babel/preset-react'],
    },
  }), {
    name: 'post-build',
    buildStart() {
      console.log('SKMTC BUILD START')
    },
    buildEnd(error) {
      console.log('SKMTC BUILD END', error)
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
    minify: false,
    rollupOptions: {
      onLog(level, log, handler) {
        handler(level, log);
      }
    }
  }
})
