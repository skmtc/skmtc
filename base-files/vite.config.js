import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),{
    name: 'post-build',
    buildStart() {
      console.log('SKMTC BUILD START')
    },
    buildEnd(error) {
      console.log(`SKMTC BUILD END ${error}`)
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
    watch: {
      exclude: ['node_modules', 'build', "src/index.css"],
      onInvalidate(file) {
        console.log(`SKMTC INVALIDATE ${file}`)
      }
    },
    outDir: 'build',
    emptyOutDir: false,
    rollupOptions: {
      onLog(level, log, handler) {
        handler(level, log);
      }
    }
  }
})
