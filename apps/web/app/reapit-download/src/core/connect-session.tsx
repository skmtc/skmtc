import { ReapitConnectBrowserSession } from '@reapit/connect-session'

// Needs to be a singleton as the class is stateful
export const reapitConnectBrowserSession = new ReapitConnectBrowserSession({
  connectClientId: process.env.CONNECT_CLIENT_ID ?? '',
  connectOAuthUrl: process.env.CONNECT_OAUTH_URL ?? '',
  connectUserPoolId: process.env.CONNECT_USER_POOL_ID ?? '',
})
