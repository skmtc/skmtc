import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import svgrPlugin from 'vite-plugin-svgr'
import wyw from '@wyw-in-js/vite'
import checker from 'vite-plugin-checker'
import { VitePWA } from 'vite-plugin-pwa'
import EnvironmentPlugin from 'vite-plugin-environment'

const customLogger = createLogger()
const loggerWarn = customLogger.warn

customLogger.warn = (msg, options) => {
  if (msg.includes('vite:css') && msg.includes('@import must precede all other statements')) return
  loggerWarn(msg, options)
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    svgrPlugin(),
    wyw({
      include: ['**/*.{ts,tsx}'],
      babelOptions: {
        presets: ['@babel/preset-typescript', '@babel/preset-react']
      }
    }),
    mode === 'development' &&
      checker({
        typescript: true,
        overlay: false,
        eslint: {
          lintCommand: 'eslint "./src/**/*.{ts,tsx}"'
        }
      }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/favicon.ico'],
      manifest: {
        start_url: '/',
        name: 'Reapit Contact App',
        short_name: 'Contact',
        description: 'Contact app for Reapit Foundatioms',
        theme_color: '#fff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-152x152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    EnvironmentPlugin({
      APP_ENV: 'local',
      CONNECT_CLIENT_ID: '',
      CONNECT_USER_POOL_ID: 'eu-west-2_eQ7dreNzJ',
      CONNECT_OAUTH_URL: 'https://connect.reapit.cloud',
      PLATFORM_API_URL: 'https://platform.reapit.cloud'
    })
  ],
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks: {
          elements: ['@reapit/elements']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    host: true,
    port: 8080
  },
  customLogger
}))
