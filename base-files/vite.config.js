import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),{
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
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: false,
    rollupOptions: {
      onLog(level, log, handler) {
        handler(level, log);
      }
    }
  }
})
