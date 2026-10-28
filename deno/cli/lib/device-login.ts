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
import { HUB_HOSTS, type HubEnv, toLoginCommand } from '@/lib/hub-env.ts'

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

/**
 * Every identity request ends within this time. It must stay below the auth
 * lock's stale age in `hub-token.ts`: a refresh that outlived the lock would
 * let a second command send the same refresh token.
 */
const IDENTITY_TIMEOUT_MS = 20_000

const postForm = (url: string, fields: Record<string, string>): Promise<Response> =>
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS)
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
  | { type: 'error'; code: string }
  /** Identity could not be reached, or answered 429 or 5xx without an OAuth error. */
  | { type: 'unavailable'; detail: string }

const requestToken = async (
  env: HubEnv,
  fields: Record<string, string>,
  now: () => number
): Promise<TokenResult> => {
  const response = await postForm(toAuthUrl(env, '/oauth2/token'), {
    ...fields,
    client_id: CLI_CLIENT_ID
  }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))))

  if (response instanceof Error) {
    return { type: 'unavailable', detail: response.message }
  }

  const body = await readJson(response).catch((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  )

  if (response.ok && !(body instanceof Error)) {
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
  if (parsed.success) return { type: 'error', code: parsed.output.error }

  const detail = body instanceof Error ? body.message : `identity answered ${response.status}`
  // 429 is rate limiting, often an HTML page from the edge: wait and retry.
  if (response.status === 429 || response.status >= 500) return { type: 'unavailable', detail }

  throw new Error(detail)
}

/** OAuth error codes that say identity is busy or failing, not that the grant is bad. */
const TRANSIENT_ERRORS = new Set(['server_error', 'temporarily_unavailable'])

/** Never poll faster than this, whatever interval identity sends. */
const MIN_INTERVAL_SECONDS = 5
/** The longest wait between polls after transient failures. */
const MAX_INTERVAL_SECONDS = 60

type PollArgs = {
  env: HubEnv
  code: DeviceCode
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Poll the token endpoint until the user approves or denies the code, or it
 * expires. `slow_down` adds 5 seconds to the interval, and a transient
 * failure (no answer, a 5xx, `server_error`, `temporarily_unavailable`)
 * doubles it, up to a minute (RFC 8628, 3.5).
 */
export const pollForTokens = ({
  env,
  code,
  sleep = defaultSleep,
  now = Date.now
}: PollArgs): Promise<OauthTokens> => {
  const deadline = now() + code.expiresIn * 1000

  const poll = async (interval: number): Promise<OauthTokens> => {
    if (now() >= deadline) {
      throw new DeviceLoginError(
        'expired_token',
        `The code expired. Run \`${toLoginCommand(env)}\` again.`
      )
    }

    await sleep(interval * 1000)

    const result = await requestToken(
      env,
      { grant_type: DEVICE_CODE_GRANT, device_code: code.deviceCode },
      now
    )

    if (result.type === 'tokens') return result.tokens

    if (result.type === 'unavailable' || TRANSIENT_ERRORS.has(result.code)) {
      return poll(Math.min(interval * 2, MAX_INTERVAL_SECONDS))
    }

    switch (result.code) {
      case 'authorization_pending':
        return poll(interval)
      case 'slow_down':
        return poll(interval + 5)
      case 'access_denied':
        throw new DeviceLoginError(result.code, 'The sign-in was denied in the browser.')
      case 'expired_token':
        throw new DeviceLoginError(
          result.code,
          `The code expired. Run \`${toLoginCommand(env)}\` again.`
        )
      default:
        throw new DeviceLoginError(result.code, `Sign-in failed (${result.code}).`)
    }
  }

  return poll(Math.max(code.interval, MIN_INTERVAL_SECONDS))
}

/**
 * Revoke a refresh token at identity (RFC 7009). Revoking the refresh token
 * ends the grant, so the CLI loses access until the next `skmtc login`.
 * Identity answers 200 also for a token it does not know.
 */
export const revokeRefreshToken = async ({
  env,
  refreshToken
}: {
  env: HubEnv
  refreshToken: string
}): Promise<void> => {
  const response = await postForm(toAuthUrl(env, '/oauth2/revoke'), {
    token: refreshToken,
    token_type_hint: 'refresh_token',
    client_id: CLI_CLIENT_ID
  })

  if (!response.ok) {
    throw new Error(`identity refused to revoke the token (${response.status})`)
  }
}

/**
 * Exchange a refresh token for new tokens. Every failure is a
 * `DeviceLoginError`: `invalid_grant` means the sign-in expired or was
 * revoked; any other code, or no answer, is reported as it is, because
 * trying again later can work.
 */
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
  ).catch(
    (error: unknown): TokenResult => ({
      type: 'unavailable',
      detail: error instanceof Error ? error.message : String(error)
    })
  )

  switch (result.type) {
    case 'tokens':
      return result.tokens
    case 'unavailable':
      throw new DeviceLoginError(
        'unavailable',
        `Could not refresh your sign-in at ${HUB_HOSTS[env].web}: ${result.detail}. Try again.`
      )
    case 'error':
      if (result.code === 'invalid_grant') {
        throw new DeviceLoginError(
          result.code,
          `Your sign-in expired or was revoked. Run \`${toLoginCommand(env)}\` to sign in again.`
        )
      }
      throw new DeviceLoginError(
        result.code,
        `Identity refused to refresh your sign-in (${result.code}). Try again.`
      )
  }
}
