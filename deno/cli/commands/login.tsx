/**
 * `skmtc login` — sign in to skmtc-hub.
 *
 * Forms:
 *   - `skmtc login`                browser sign-in (OAuth device grant): prints
 *                                  a link and a code, the user approves the code
 *                                  at `/login/device`, and the CLI stores the
 *                                  token. When a token for the environment is
 *                                  already stored, reports `Logged in as
 *                                  <handle>` instead (the `whoami`).
 *   - `skmtc login --with-token`   reads a personal access token from stdin
 *                                  (the `gh` pattern), for CI.
 *   - `--env <env>`                production (default), staging or local.
 *   - `--json`                     one JSON object per line: the device code
 *                                  (`{ "type": "device-code", ... }`), then
 *                                  `{ "type": "logged-in", "handle": ... }`.
 *
 * No browser is opened: the recommended install grants `--allow-run=deno,sh`
 * only, so the link is printed. A token is stored only after the hub accepts
 * it, and output never echoes more than its last 4 characters.
 */

import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'
import {
  DEFAULT_HUB_ENV,
  HUB_HOSTS,
  type HubEnv,
  toLoginCommand,
  toTokenSettingsUrl
} from '@/lib/hub-env.ts'
import {
  HubTokenRejectedError,
  maskToken,
  readHubEnvVariable,
  readStoredAuth,
  type StoredAuth,
  toFreshStoredAuth,
  validateHubToken,
  withAuthLock,
  writeStoredAuth
} from '@/lib/hub-token.ts'
import {
  type DeviceCode,
  DeviceLoginError,
  formatUserCode,
  pollForTokens,
  requestDeviceCode,
  revokeRefreshToken
} from '@/lib/device-login.ts'

const USAGE = 'skmtc login [--env production|staging|local] [--with-token]'
const EXAMPLE = 'echo $SKMTC_HUB_TOKEN | skmtc login --with-token'

type RenderLoginArgs = {
  env: HubEnv | undefined
  withToken: boolean | undefined
  jsonFlag?: boolean
}

type Format = 'text' | 'json'

type LoginResult = {
  type: 'logged-in'
  env: HubEnv
  handle: string
}

const printLoginResult = (
  result: LoginResult,
  { format, tokenLast4 }: { format: Format; tokenLast4?: string }
): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result))
    return
  }

  const suffix = tokenLast4 ? ` (token ${tokenLast4})` : ''
  const where = result.env === 'production' ? '' : ` on ${result.env}`
  console.log(`Logged in as ${result.handle}${where}${suffix}`)
}

const printDeviceCode = (code: DeviceCode, format: Format): void => {
  const userCode = formatUserCode(code.userCode)

  if (format === 'json') {
    console.log(
      JSON.stringify({
        type: 'device-code',
        verificationUri: code.verificationUri,
        verificationUriComplete: code.verificationUriComplete,
        userCode,
        expiresIn: code.expiresIn
      })
    )
    return
  }

  console.log(`To sign in, open ${code.verificationUriComplete}`)
  console.log(`and check that it shows the code ${userCode}.`)
  console.log('Waiting for approval...')
}

const readStdinToEnd = async (): Promise<string> => {
  return await new Response(Deno.stdin.readable).text()
}

type DeviceLoginArgs = {
  env: HubEnv
  onCode: (code: DeviceCode) => void
  sleep?: (ms: number) => Promise<void>
}

/**
 * Store `auth`, replacing the stored login. The replaced login's refresh
 * token is revoked, so a copy of the old file cannot keep the sign-in alive.
 * A failed revoke does not stop the login; it is reported on stderr.
 */
export const replaceStoredAuth = async (auth: StoredAuth): Promise<void> => {
  // Under the lock, so a refresh in another command cannot overwrite the new login.
  const previous = await withAuthLock(() => {
    const current = readStoredAuth()
    writeStoredAuth(auth)
    return Promise.resolve(current)
  })

  if (!previous?.refreshToken || previous.refreshToken === auth.refreshToken) return

  await revokeRefreshToken({ env: previous.env, refreshToken: previous.refreshToken }).catch(() => {
    console.error(
      `Could not revoke the previous sign-in at ${HUB_HOSTS[previous.env].web}. ` +
        'Revoke the Skmtc CLI in Settings > Connected apps.'
    )
  })
}

/** Run the browser sign-in, store the token and return the handle. */
export const deviceLogin = async ({ env, onCode, sleep }: DeviceLoginArgs): Promise<string> => {
  const code = await requestDeviceCode(env)
  onCode(code)

  const tokens = await pollForTokens({ env, code, sleep })
  const handle = await validateHubToken({
    origin: HUB_HOSTS[env].api,
    token: tokens.accessToken
  })

  await replaceStoredAuth({
    env,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  })

  return handle
}

/**
 * Whether the hub refused the stored login itself. Only then is a logout the
 * fix: after a network error or a 5xx the stored sign-in is still good, and a
 * retry works.
 */
export const isRejectedLogin = (error: unknown): boolean =>
  error instanceof HubTokenRejectedError ||
  (error instanceof DeviceLoginError && error.code === 'invalid_grant')

const fail = (error: unknown): never => {
  console.error(error instanceof Error ? error.message : String(error))
  Deno.exit(1)
}

export const renderLogin = async ({
  env: envFlag,
  withToken,
  jsonFlag
}: RenderLoginArgs): Promise<void> => {
  const format = resolveOutputFormat({ jsonFlag })
  // Without --env, the whoami answers for the stored login's environment.
  const stored = readStoredAuth()
  const env = envFlag ?? readHubEnvVariable() ?? stored?.env ?? DEFAULT_HUB_ENV
  const origin = HUB_HOSTS[env].api

  if (withToken) {
    const token = (await readStdinToEnd()).trim()

    if (!token) {
      return failWithRecipe({
        command: 'login',
        arg: '--with-token (stdin was empty)',
        usage: USAGE,
        example: EXAMPLE,
        discover: `Mint a personal access token at ${toTokenSettingsUrl(env)}.`
      })
    }

    try {
      const handle = await validateHubToken({ origin, token })
      await replaceStoredAuth({ env, token })
      printLoginResult({ type: 'logged-in', env, handle }, { format })
      Deno.exit(0)
    } catch (error) {
      fail(error)
    }
  }

  // Already logged in to this environment → report status instead of signing
  // in again. Re-login is `skmtc logout` first.
  if (stored && stored.env === env) {
    try {
      const fresh = await toFreshStoredAuth(stored)
      const handle = await validateHubToken({ origin, token: fresh.token })
      printLoginResult(
        { type: 'logged-in', env, handle },
        { format, tokenLast4: maskToken(fresh.token) }
      )
      Deno.exit(0)
    } catch (error) {
      console.error(
        isRejectedLogin(error)
          ? 'A token is stored in ~/.skmtc/auth.json but the hub rejected it. ' +
              `Run \`skmtc logout\`, then \`${toLoginCommand(env)}\` again.`
          : `Could not check the stored login: ${error instanceof Error ? error.message : String(error)}`
      )
      Deno.exit(1)
    }
  }

  try {
    const handle = await deviceLogin({
      env,
      onCode: code => printDeviceCode(code, format)
    })
    printLoginResult({ type: 'logged-in', env, handle }, { format })
    Deno.exit(0)
  } catch (error) {
    fail(error)
  }
}
