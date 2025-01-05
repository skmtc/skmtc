import { ReapitConnectBrowserSession } from '@reapit/connect-session'

// Needs to be a singleton as the class is stateful
export const reapitConnectBrowserSession = new ReapitConnectBrowserSession({
  connectClientId: import.meta.env.VITE_CONNECT_CLIENT_ID,
  connectOAuthUrl: import.meta.env.VITE_CONNECT_OAUTH_URL,
  connectUserPoolId: import.meta.env.VITE_CONNECT_USER_POOL_ID,
})
