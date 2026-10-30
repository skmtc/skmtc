/**
 * `skmtc feedback` — send a problem or a feature request to the Skmtc team.
 *
 * The hub files it as a GitHub issue; the command prints the feedback id and
 * the issue URL. The CLI's name and version go with it as context.
 */

import denoJson from '@/deno.json' with { type: 'json' }
import {
  failWithInvalidArg,
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { resolveHubAuth } from '@/lib/hub-token.ts'
import { printHubFailure } from '@/lib/print-hub-failure.ts'
import { type HubEnv, toMissingTokenHint } from '@/lib/hub-env.ts'
import {
  type FeedbackKind,
  type FeedbackResult,
  feedbackHeadless,
  toFeedbackInputProblem
} from '@/lib/feedback-headless.ts'

export const CLIENT_NAME = 'skmtc-cli'

const USAGE =
  'skmtc feedback --kind problem|feature_request --summary <text> --details <text> [--operation <name>] [--resource <ref>] [--request-id <id>] [--env <env>] [--token <pat>]'
const EXAMPLE =
  'skmtc feedback --kind problem --summary "generate drops enum descriptions" --details "Steps: ..."'

type RenderFeedbackArgs = {
  kind: FeedbackKind | undefined
  summary: string | undefined
  details: string | undefined
  operation: string | undefined
  resource: string | undefined
  requestId: string | undefined
  token: string | undefined
  env: HubEnv | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

const requireFlag = (arg: string, discover: string): never =>
  failWithRecipe({ command: 'feedback', arg, usage: USAGE, example: EXAMPLE, discover })

export const renderFeedback = async ({
  kind,
  summary,
  details,
  operation,
  resource,
  requestId,
  token,
  env,
  jsonFlag,
  noInputFlag
}: RenderFeedbackArgs): Promise<void> => {
  resolveInputMode({ noInputFlag, jsonFlag })

  if (kind === undefined) {
    return requireFlag('--kind', '`problem` for something broken, `feature_request` for an idea.')
  }
  if (summary === undefined) {
    return requireFlag('--summary', 'One line, at most 200 characters.')
  }
  if (details === undefined) {
    return requireFlag(
      '--details',
      'What happened and how to reproduce it, at most 8000 characters. No tokens or personal data.'
    )
  }

  const problem = toFeedbackInputProblem({ summary, details, operation, resource, requestId })
  if (problem) {
    return failWithInvalidArg({ message: problem, usage: USAGE, example: EXAMPLE })
  }

  const auth = await resolveHubAuth({ tokenFlag: token, envFlag: env })
  if (!auth.token) return requireFlag('--token', toMissingTokenHint(auth.env))

  const result = await feedbackHeadless({
    kind,
    summary,
    details,
    context: {
      ...(operation === undefined ? {} : { operation }),
      ...(resource === undefined ? {} : { resource }),
      ...(requestId === undefined ? {} : { requestId }),
      clientName: CLIENT_NAME,
      clientVersion: denoJson.version
    },
    token: auth.token,
    origin: auth.origin,
    env: auth.env
  })

  printFeedbackResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.type === 'failed' ? 1 : 0)
}

export const printFeedbackResult = (
  result: FeedbackResult,
  { format }: { format: 'text' | 'json' }
): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  switch (result.type) {
    case 'sent': {
      console.log(`Feedback sent: ${result.id}`)
      console.log(`  ${result.issueUrl}`)
      return
    }
    case 'failed': {
      printHubFailure('Feedback failed', result)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled feedback result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
