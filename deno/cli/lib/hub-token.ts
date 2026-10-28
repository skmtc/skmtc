/**
 * skmtc-hub credential resolution and storage.
 *
 * A hub credential is an OAuth token from `skmtc login`'s browser sign-in,
 * or a personal access token (PAT). One resolution order applies
 * everywhere a token is needed:
 *
 *   1. `--token` flag         (explicit beats ambient)
 *   2. `$SKMTC_HUB_TOKEN`     (env beats file so CI can override a
 *                              developer login)
 *   3. `~/.skmtc/auth.json`   (written by `skmtc login`)
 *
 * The stored file is `{ "env": "<hub env>", "token": "..." }`, plus
 * `refreshToken` and `expiresAt` for an OAuth token, mode 0600. A stored
 * OAuth token that has expired is refreshed before it is used.
 */

import * as v from 'valibot'
import { join } from '@std/path/join'
import { dirname } from '@std/path/dirname'
import { readEnv, readHomeDirectory } from '@/lib/env.ts'
import {
  DEFAULT_HUB_ENV,
  HUB_ENVS,
  HUB_HOSTS,
  type HubEnv,
  toHubEnvFromApi
} from '@/lib/hub-env.ts'
import { refreshTokens } from '@/lib/device-login.ts'

export type StoredAuth = {
  /** The hub environment the token belongs to. */
  env: HubEnv
  token: string
  /** Set for an OAuth token from the browser sign-in. */
  refreshToken?: string
  /** Epoch milliseconds; set for an OAuth token. */
  expiresAt?: number
}

/** Refresh a stored OAuth token this long before it expires. */
const REFRESH_MARGIN_MS = 60_000

/** Resolve the hub environment: `--env` flag → `$SKMTC_ENV` → production. */
export const resolveHubEnv = (envFlag?: HubEnv): HubEnv =>
  envFlag ?? readEnv('SKMTC_ENV') ?? DEFAULT_HUB_ENV

export const toAuthFilePath = (): string => {
  const home = readHomeDirectory()

  if (!home) {
    throw new Error('Neither HOME nor USERPROFILE env var is set')
  }

  return join(home, '.skmtc', 'auth.json')
}

const storedAuthSchema = v.object({
  env: v.picklist(HUB_ENVS),
  token: v.pipe(v.string(), v.minLength(1)),
  refreshToken: v.optional(v.string()),
  expiresAt: v.optional(v.number())
})

/** The shape written before `--env`: the API base URL as `host`, a PAT as `token`. */
const legacyStoredAuthSchema = v.object({
  host: v.string(),
  token: v.pipe(v.string(), v.minLength(1))
})

const toStoredAuth = (value: unknown): StoredAuth | null => {
  const current = v.safeParse(storedAuthSchema, value)
  if (current.success) return current.output

  const legacy = v.safeParse(legacyStoredAuthSchema, value)
  if (!legacy.success) return null

  const env = toHubEnvFromApi(legacy.output.host)
  return env ? { env, token: legacy.output.token } : null
}

/**
 * Read `~/.skmtc/auth.json`. Returns `null` when the file is missing,
 * unparseable, or not the expected shape — a broken file behaves like
 * "not logged in" rather than crashing every command.
 */
export const readStoredAuth = (): StoredAuth | null => {
  try {
    const contents = Deno.readTextFileSync(toAuthFilePath())
    return toStoredAuth(JSON.parse(contents))
  } catch {
    return null
  }
}

/**
 * Write `~/.skmtc/auth.json` with mode 0600, creating `~/.skmtc` if
 * missing. Returns the file path. The explicit `chmod` covers the
 * case where the file already existed with a looser mode (the `mode`
 * option only applies on create).
 */
export const writeStoredAuth = (auth: StoredAuth): string => {
  const filePath = toAuthFilePath()

  Deno.mkdirSync(dirname(filePath), { recursive: true })
  Deno.writeTextFileSync(filePath, `${JSON.stringify(auth, null, 2)}\n`, {
    mode: 0o600
  })
  Deno.chmodSync(filePath, 0o600)

  return filePath
}

/** Delete the stored credential. Returns whether a file was removed. */
export const deleteStoredAuth = (): boolean => {
  try {
    Deno.removeSync(toAuthFilePath())
    return true
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false
    }
    throw error
  }
}

/**
 * The stored token, refreshed first when it is an OAuth token that has
 * expired or is about to. A refused refresh throws `DeviceLoginError`, whose
 * message tells the user to run `skmtc login`.
 */
export const toFreshStoredAuth = async (
  stored: StoredAuth,
  now: () => number = Date.now
): Promise<StoredAuth> => {
  const { refreshToken, expiresAt } = stored

  if (!refreshToken || expiresAt === undefined || expiresAt - REFRESH_MARGIN_MS > now()) {
    return stored
  }

  const tokens = await refreshTokens({ env: stored.env, refreshToken, now })
  const refreshed: StoredAuth = {
    env: stored.env,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  }
  writeStoredAuth(refreshed)

  return refreshed
}

type ResolveHubAuthArgs = {
  tokenFlag?: string
  /** `--env` flag — the hub environment. */
  envFlag?: HubEnv
}

export type ResolvedHubAuth = {
  token: string | undefined
  env: HubEnv
  /** The environment's API base URL. */
  origin: string
}

/**
 * Resolve token AND hub environment together so they stay coherent. The
 * token follows the standard precedence (flag → env → stored file). The
 * environment is `--env` → `$SKMTC_ENV` → the stored file's `env` (when no
 * flag or env var supplies the token) → production. So after
 * `skmtc login --env local`, later commands talk to local without `--env`.
 */
export const resolveHubAuth = async ({
  tokenFlag,
  envFlag
}: ResolveHubAuthArgs = {}): Promise<ResolvedHubAuth> => {
  const flagToken = tokenFlag?.trim()
  const envToken = readEnv('SKMTC_HUB_TOKEN')
  const explicitEnv = envFlag ?? readEnv('SKMTC_ENV')

  if (flagToken || envToken) {
    const env = explicitEnv ?? DEFAULT_HUB_ENV
    return { token: flagToken || envToken, env, origin: HUB_HOSTS[env].api }
  }

  const stored = readStoredAuth()
  const env = explicitEnv ?? stored?.env ?? DEFAULT_HUB_ENV

  // A stored token belongs to one environment and is never sent to another.
  if (!stored || stored.env !== env) {
    return { token: undefined, env, origin: HUB_HOSTS[env].api }
  }

  const fresh = await toFreshStoredAuth(stored)

  return { token: fresh.token, env, origin: HUB_HOSTS[env].api }
}

/** Last-4 display form — never echo more of a token than this. */
export const maskToken = (token: string): string => `…${token.slice(-4)}`

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Validate a token against the hub and return the account handle. Uses
 * `GET /v1/user`, which the hub allows for ANY authenticated token
 * regardless of scopes (the self-introspection carve-out) — so this
 * works for least-privilege tokens too.
 */
export const validateHubToken = async ({
  origin,
  token
}: {
  origin: string
  token: string
}): Promise<string> => {
  const response = await fetch(`${origin}/v1/user`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`token validation failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const payload: unknown = await response.json()

  if (!isObject(payload)) {
    throw new Error('hub returned non-object identity payload')
  }

  const handle = payload['handle']

  if (typeof handle !== 'string' || handle.length === 0) {
    throw new Error('hub identity payload missing `handle`')
  }

  return handle
}
