export type VITE_APP_ENV = 'local' | 'development' | 'production'

export type Config = {
  VITE_APP_ENV: VITE_APP_ENV | string
  VITE_CONNECT_CLIENT_ID: string
  VITE_CONNECT_OAUTH_URL: string
  VITE_CONNECT_USER_POOL_ID: string
  VITE_PLATFORM_API_URL: string
}

declare global {
  interface Window {
    reapit: {
      config: Config
    }
  }
}
