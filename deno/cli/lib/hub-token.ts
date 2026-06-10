/**
 * skmtc-hub credential resolution and storage.
 *
 * The hub's only programmatic credential is a personal access token
 * (PAT). One resolution order applies everywhere a token is needed:
 *
 *   1. `--token` flag         (explicit beats ambient)
 *   2. `$SKMTC_HUB_TOKEN`     (env beats file so CI can override a
 *                              developer login)
 *   3. `~/.skmtc/auth.json`   (written by `skmtc login`)
 *
 * The stored file is `{ "host": "<hub api base>", "token": "..." }`,
 * mode 0600, single-host for now — the shape leaves room for a
 * per-host map later.
 */

import { join } from '@std/path/join'
import { dirname } from '@std/path/dirname'

export const DEFAULT_HUB_URL = 'https://api.skmtc.dev'

/** Where users mint PATs in the hub UI. */
export const HUB_TOKEN_SETTINGS_URL = 'https://skmtc.dev/settings/tokens'

export type StoredAuth = {
  /** Hub API base URL the token was validated against. */
  host: string
  token: string
}

export const resolveHubUrl = (hubUrlFlag?: string): string => {
  const fromFlag = hubUrlFlag?.trim()
  if (fromFlag) return fromFlag

  const fromEnv = Deno.env.get('SKMTC_HUB_URL')?.trim()
  if (fromEnv) return fromEnv

  return DEFAULT_HUB_URL
}

export const toAuthFilePath = (): string => {
  const home = Deno.env.get('HOME')

  if (!home) {
    throw new Error('HOME env var is not set')
  }

  return join(home, '.skmtc', 'auth.json')
}

const isStoredAuth = (value: unknown): value is StoredAuth =>
  typeof value === 'object' &&
  value !== null &&
  'host' in value &&
  typeof value.host === 'string' &&
  'token' in value &&
  typeof value.token === 'string' &&
  value.token.length > 0

/**
 * Read `~/.skmtc/auth.json`. Returns `null` when the file is missing,
 * unparseable, or not the expected shape — a broken file behaves like
 * "not logged in" rather than crashing every command.
 */
export const readStoredAuth = (): StoredAuth | null => {
  try {
    const contents = Deno.readTextFileSync(toAuthFilePath())
    const parsed: unknown = JSON.parse(contents)

    return isStoredAuth(parsed) ? parsed : null
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
export const writeStoredAuth = ({ host, token }: StoredAuth): string => {
  const filePath = toAuthFilePath()

  Deno.mkdirSync(dirname(filePath), { recursive: true })
  Deno.writeTextFileSync(filePath, `${JSON.stringify({ host, token }, null, 2)}\n`, {
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

type ResolveHubTokenArgs = {
  tokenFlag?: string
}

/** Resolve a hub token: `--token` flag → `$SKMTC_HUB_TOKEN` → `~/.skmtc/auth.json`. */
export const resolveHubToken = ({ tokenFlag }: ResolveHubTokenArgs = {}): string | undefined => {
  const fromFlag = tokenFlag?.trim()
  if (fromFlag) return fromFlag

  const fromEnv = Deno.env.get('SKMTC_HUB_TOKEN')?.trim()
  if (fromEnv) return fromEnv

  return readStoredAuth()?.token
}

type ResolveHubAuthArgs = {
  tokenFlag?: string
  hubUrlFlag?: string
}

export type ResolvedHubAuth = {
  token: string | undefined
  hubUrl: string
}

/**
 * Resolve token AND hub URL together so they stay coherent. The token
 * follows the standard precedence (flag → env → stored file). The hub
 * URL is flag → `$SKMTC_HUB_URL` → — only when the token came from the
 * stored file — the file's `host` → the production default. Without
 * the stored-host step, a `skmtc login --hub-url <local hub>` token
 * would silently be sent to the production host on the next publish.
 */
export const resolveHubAuth = ({ tokenFlag, hubUrlFlag }: ResolveHubAuthArgs = {}): ResolvedHubAuth => {
  const flagToken = tokenFlag?.trim()
  const envToken = Deno.env.get('SKMTC_HUB_TOKEN')?.trim()
  const stored = readStoredAuth()

  const token = flagToken || envToken || stored?.token

  const explicitHubUrl = hubUrlFlag?.trim() || Deno.env.get('SKMTC_HUB_URL')?.trim()
  const tokenFromStore = !flagToken && !envToken && stored !== null
  const hubUrl = explicitHubUrl ?? (tokenFromStore ? stored.host : DEFAULT_HUB_URL)

  return { token, hubUrl }
}

/** Last-4 display form — never echo more of a token than this. */
export const maskToken = (token: string): string => `…${token.slice(-4)}`

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Validate a PAT against the hub and return the account handle. Uses
 * `GET /v1/user`, which the hub allows for ANY authenticated token
 * regardless of scopes (the self-introspection carve-out) — so this
 * works for least-privilege tokens too.
 */
export const validateHubToken = async ({
  hubUrl,
  token
}: {
  hubUrl: string
  token: string
}): Promise<string> => {
  const response = await fetch(`${hubUrl}/v1/user`, {
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
