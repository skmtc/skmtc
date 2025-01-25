import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wyw from '@wyw-in-js/vite'
import EnvironmentPlugin from 'vite-plugin-environment'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wyw({
    include: ['**/*.{ts,tsx}'],
    babelOptions: {
      presets: ['@babel/preset-typescript', '@babel/preset-react'],
    },
  }), EnvironmentPlugin({
    APP_ENV: 'local',
    CONNECT_CLIENT_ID: '4j7u49bnip8gsf4ujteu7ojkoq',
    CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
    CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
    PLATFORM_API_URL: 'https://platform.reapit.cloud',
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
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    rollupOptions: {
      onLog(level, log, handler) {
        handler(level, log);
      }
    }
  }
})
