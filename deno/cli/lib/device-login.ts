/**
 * Sign in with the OAuth device authorization grant (RFC 8628).
 *
 * The CLI asks identity for a device code and a user code, the user
 * approves the user code at `/login/device` in a browser, and the CLI polls
 * the token endpoint until the approval lands. The client, resource and
 * scopes are registered in skmtc-hub (`apps/identity`, migration
 * `0009_skmtc_cli_client.sql`); they are the same in every environment.
 */

import * as v from 'valibot'
import { HUB_HOSTS, type HubEnv } from '@/lib/hub-env.ts'

export const CLI_CLIENT_ID = 'skmtc-cli'
export const CLI_RESOURCE = 'urn:skmtc:cli'
export const CLI_SCOPE = 'write:catalog write:releases offline_access'

const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

const toAuthUrl = (env: HubEnv, path: string): string => `${HUB_HOSTS[env].web}/api/auth${path}`

const deviceCodeSchema = v.object({
  device_code: v.string(),
  user_code: v.string(),
  verification_uri: v.string(),
  verification_uri_complete: v.optional(v.string()),
  expires_in: v.number(),
  interval: v.optional(v.number(), 5)
})

export type DeviceCode = {
  deviceCode: string
  userCode: string
  verificationUri: string
  /** The verification URI with the user code filled in. */
  verificationUriComplete: string
  expiresIn: number
  interval: number
}

const tokenSchema = v.object({
  access_token: v.string(),
  refresh_token: v.string(),
  expires_in: v.number()
})

const tokenErrorSchema = v.object({ error: v.string() })

export type OauthTokens = {
  accessToken: string
  refreshToken: string
  /** Epoch milliseconds. */
  expiresAt: number
}

/** The token endpoint refused the grant: the approval was denied or expired, or the refresh token was revoked. */
export class DeviceLoginError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DeviceLoginError'
    this.code = code
  }
}

const postForm = (url: string, fields: Record<string, string>): Promise<Response> =>
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: new URLSearchParams(fields)
  })

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`identity answered ${response.status} without JSON: ${text.slice(0, 200)}`)
  }
}

/** Format a user code as `XXXX-XXXX`; identity accepts it with or without the dash. */
export const formatUserCode = (userCode: string): string => {
  const plain = userCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return plain.length === 8 ? `${plain.slice(0, 4)}-${plain.slice(4)}` : plain
}

export const requestDeviceCode = async (env: HubEnv): Promise<DeviceCode> => {
  const response = await postForm(toAuthUrl(env, '/device/code'), {
    client_id: CLI_CLIENT_ID,
    scope: CLI_SCOPE,
    resource: CLI_RESOURCE
  })
  const body = await readJson(response)

  if (!response.ok) {
    const parsed = v.safeParse(tokenErrorSchema, body)
    const code = parsed.success ? parsed.output.error : String(response.status)
    throw new Error(`identity refused the sign-in request (${code})`)
  }

  const code = v.parse(deviceCodeSchema, body)
  const complete = new URL(code.verification_uri)
  complete.searchParams.set('user_code', code.user_code)

  return {
    deviceCode: code.device_code,
    userCode: code.user_code,
    verificationUri: code.verification_uri,
    verificationUriComplete: code.verification_uri_complete ?? complete.toString(),
    expiresIn: code.expires_in,
    interval: code.interval
  }
}

type TokenResult =
  | { type: 'tokens'; tokens: OauthTokens }
  | {
      type: 'error'
      code: string
    }

const requestToken = async (
  env: HubEnv,
  fields: Record<string, string>,
  now: () => number
): Promise<TokenResult> => {
  const response = await postForm(toAuthUrl(env, '/oauth2/token'), {
    ...fields,
    client_id: CLI_CLIENT_ID
  })
  const body = await readJson(response)

  if (response.ok) {
    const token = v.parse(tokenSchema, body)
    return {
      type: 'tokens',
      tokens: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: now() + token.expires_in * 1000
      }
    }
  }

  const parsed = v.safeParse(tokenErrorSchema, body)
  if (!parsed.success) {
    throw new Error(`identity answered ${response.status} from the token endpoint`)
  }

  return { type: 'error', code: parsed.output.error }
}

type PollArgs = {
  env: HubEnv
  code: DeviceCode
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Poll the token endpoint until the user approves or denies the code, or it
 * expires. `slow_down` adds 5 seconds to the interval (RFC 8628, 3.5).
 */
export const pollForTokens = async ({
  env,
  code,
  sleep = defaultSleep,
  now = Date.now
}: PollArgs): Promise<OauthTokens> => {
  const deadline = now() + code.expiresIn * 1000
  let interval = code.interval

  while (now() < deadline) {
    await sleep(interval * 1000)

    const result = await requestToken(
      env,
      { grant_type: DEVICE_CODE_GRANT, device_code: code.deviceCode },
      now
    )

    if (result.type === 'tokens') return result.tokens

    if (result.code === 'authorization_pending') continue

    if (result.code === 'slow_down') {
      interval += 5
      continue
    }

    if (result.code === 'access_denied') {
      throw new DeviceLoginError(result.code, 'The sign-in was denied in the browser.')
    }

    if (result.code === 'expired_token') break

    throw new DeviceLoginError(result.code, `Sign-in failed (${result.code}).`)
  }

  throw new DeviceLoginError('expired_token', 'The code expired. Run `skmtc login` again.')
}

/** Exchange a refresh token for new tokens. */
export const refreshTokens = async ({
  env,
  refreshToken,
  now = Date.now
}: {
  env: HubEnv
  refreshToken: string
  now?: () => number
}): Promise<OauthTokens> => {
  const result = await requestToken(
    env,
    { grant_type: 'refresh_token', refresh_token: refreshToken },
    now
  )

  if (result.type === 'tokens') return result.tokens

  throw new DeviceLoginError(
    result.code,
    'Your sign-in expired or was revoked. Run `skmtc login` to sign in again.'
  )
}
