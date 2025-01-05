export type APP_ENV = 'local' | 'development' | 'production'

export type Config = {
  APP_ENV: APP_ENV | string
  CONNECT_CLIENT_ID: string
  CONNECT_OAUTH_URL: string
  CONNECT_USER_POOL_ID: string
  PLATFORM_API_URL: string
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      env: Config
    }
  }
}
