/**
 * The skmtc-hub environments the CLI can sign in to and talk to. `--env`
 * (then `$SKMTC_ENV`) picks one; production is the default.
 *
 * `web` is the site origin, which also serves sign-in under `/api/auth`.
 * `local` is the `skmtc.co.uk` tunnel: identity refuses sign-in from any
 * other local origin.
 */

export const HUB_ENVS = ['production', 'staging', 'local'] as const

export type HubEnv = (typeof HUB_ENVS)[number]

export const DEFAULT_HUB_ENV: HubEnv = 'production'

export type HubHosts = {
  /** The API base URL. */
  api: string
  /** The site origin. */
  web: string
}

export const HUB_HOSTS: Record<HubEnv, HubHosts> = {
  production: { api: 'https://api.skmtc.dev', web: 'https://skmtc.dev' },
  staging: { api: 'https://api.skmtc.net', web: 'https://skmtc.net' },
  local: { api: 'https://api.skmtc.co.uk', web: 'https://skmtc.co.uk' }
}

export const isHubEnv = (value: unknown): value is HubEnv => HUB_ENVS.some(env => env === value)

/** The environment whose API is `api`, for an `auth.json` written before `--env`. */
export const toHubEnvFromApi = (api: string): HubEnv | undefined =>
  HUB_ENVS.find(env => HUB_HOSTS[env].api === api.replace(/\/+$/, ''))

/** Where a user mints a personal access token. */
export const toTokenSettingsUrl = (env: HubEnv): string => `${HUB_HOSTS[env].web}/settings/tokens`
