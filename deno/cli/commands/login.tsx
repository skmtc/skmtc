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
import { readEnv } from '@/lib/env.ts'
import { HUB_HOSTS, type HubEnv, toTokenSettingsUrl } from '@/lib/hub-env.ts'
import {
  maskToken,
  readStoredAuth,
  resolveHubEnv,
  toFreshStoredAuth,
  validateHubToken,
  writeStoredAuth
} from '@/lib/hub-token.ts'
import {
  type DeviceCode,
  formatUserCode,
  pollForTokens,
  requestDeviceCode
} from '@/lib/device-login.ts'

const USAGE = 'skmtc login [--env production|staging|local] [--with-token]'
const EXAMPLE = 'echo $SKMTC_HUB_TOKEN | skmtc login --with-token'

type RenderLoginArgs = {
  env: HubEnv | undefined
  withToken: boolean | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
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

/** Run the browser sign-in, store the token and return the handle. */
export const deviceLogin = async ({ env, onCode, sleep }: DeviceLoginArgs): Promise<string> => {
  const code = await requestDeviceCode(env)
  onCode(code)

  const tokens = await pollForTokens({ env, code, sleep })
  const handle = await validateHubToken({
    origin: HUB_HOSTS[env].api,
    token: tokens.accessToken
  })

  writeStoredAuth({
    env,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  })

  return handle
}

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
  const env = envFlag ?? readEnv('SKMTC_ENV') ?? stored?.env ?? resolveHubEnv()
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
      writeStoredAuth({ env, token })
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
    } catch {
      console.error(
        'A token is stored in ~/.skmtc/auth.json but the hub rejected it. ' +
          'Run `skmtc logout`, then `skmtc login` again.'
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
