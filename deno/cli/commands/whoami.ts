/**
 * `skmtc whoami` — show the account and the hub a hub command would use.
 *
 * Resolves the token as `api publish` does (`--token`, `$SKMTC_HUB_TOKEN`,
 * then the `skmtc login` store), asks the hub whose it is, and prints the
 * handle, the environment, its API origin and where the token came from.
 * Output never echoes more of the token than its last 4 characters.
 */

import { failWithRecipe, resolveInputMode, resolveOutputFormat } from '@/lib/strict-mode.ts'
import {
  HubTokenRejectedError,
  type HubTokenSource,
  maskToken,
  resolveHubAuth,
  resolveHubTarget,
  validateHubToken
} from '@/lib/hub-token.ts'
import {
  type HubEnv,
  toMissingTokenHint,
  toRejectedStoredLoginMessage,
  toTokenSettingsUrl
} from '@/lib/hub-env.ts'
import { isRejectedLogin } from '@/commands/login.tsx'

const USAGE = 'skmtc whoami [--env production|staging|local] [--token <pat>]'
const EXAMPLE = 'skmtc whoami --json'

export type WhoamiResult = {
  type: 'whoami'
  handle: string
  env: HubEnv
  origin: string
  tokenSource: HubTokenSource
}

type WhoamiOutcome =
  | { type: 'signed-in'; result: WhoamiResult; token: string }
  | { type: 'missing'; env: HubEnv }
  | { type: 'failed'; message: string }

const TOKEN_SOURCE_LABELS: Record<HubTokenSource, string> = {
  flag: '--token',
  env: '$SKMTC_HUB_TOKEN',
  stored: 'skmtc login (~/.skmtc/auth.json)'
}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** The message for a token the hub refused, by where the token came from. */
const toRejectedMessage = (env: HubEnv, tokenSource: HubTokenSource): string =>
  tokenSource === 'stored'
    ? toRejectedStoredLoginMessage(env)
    : `The hub rejected the token from ${TOKEN_SOURCE_LABELS[tokenSource]}. ` +
      `Pass a valid token; mint a PAT at ${toTokenSettingsUrl(env)}.`

/** Resolve the token, then ask the hub whose it is. */
export const runWhoami = async ({
  tokenFlag,
  envFlag
}: {
  tokenFlag: string | undefined
  envFlag: HubEnv | undefined
}): Promise<WhoamiOutcome> => {
  const auth = await resolveHubAuth({ tokenFlag, envFlag }).catch((error: unknown) => {
    // A stored sign-in whose refresh identity refused.
    if (isRejectedLogin(error)) return undefined
    throw error
  })
  if (auth === undefined) {
    // Only a stored login refreshes, so the refusal is the stored login's.
    const { env } = resolveHubTarget({ tokenFlag, envFlag })
    return { type: 'failed', message: toRejectedStoredLoginMessage(env) }
  }
  if (!auth.token || !auth.tokenSource) return { type: 'missing', env: auth.env }

  try {
    const handle = await validateHubToken({ origin: auth.origin, token: auth.token })
    return {
      type: 'signed-in',
      result: {
        type: 'whoami',
        handle,
        env: auth.env,
        origin: auth.origin,
        tokenSource: auth.tokenSource
      },
      token: auth.token
    }
  } catch (error) {
    return {
      type: 'failed',
      message:
        error instanceof HubTokenRejectedError
          ? toRejectedMessage(auth.env, auth.tokenSource)
          : `Could not check the token at ${auth.origin}: ${toErrorMessage(error)}`
    }
  }
}

type RenderWhoamiArgs = {
  token: string | undefined
  env: HubEnv | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

export const renderWhoami = async ({
  token,
  env,
  jsonFlag,
  noInputFlag
}: RenderWhoamiArgs): Promise<void> => {
  resolveInputMode({ noInputFlag, jsonFlag })

  const outcome = await runWhoami({ tokenFlag: token, envFlag: env })

  switch (outcome.type) {
    case 'missing':
      return failWithRecipe({
        command: 'whoami',
        arg: '--token',
        usage: USAGE,
        example: EXAMPLE,
        discover: toMissingTokenHint(outcome.env)
      })
    case 'failed':
      console.error(outcome.message)
      return Deno.exit(1)
    case 'signed-in': {
      const { result } = outcome
      if (resolveOutputFormat({ jsonFlag }) === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`Logged in as ${result.handle} (token ${maskToken(outcome.token)})`)
        console.log(`  environment: ${result.env}`)
        console.log(`  origin:      ${result.origin}`)
        console.log(`  token from:  ${TOKEN_SOURCE_LABELS[result.tokenSource]}`)
      }
      return Deno.exit(0)
    }
    default: {
      const _exhaustive: never = outcome
      throw new Error(`Unhandled whoami outcome: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
