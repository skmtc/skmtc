/**
 * Headless `feedback` — send a problem or a feature request to the Skmtc team.
 *
 * Calls `POST /v1/feedback`. The hub files the text as a GitHub issue and
 * answers with its id and URL. Any token the hub accepts may send.
 */

import * as v from 'valibot'
import type { HubEnv } from '@/lib/hub-env.ts'
import { type HubTokenSource, toRejectedTokenMessage } from '@/lib/hub-token.ts'
import {
  type ApiErrorDetail,
  errorMessage,
  readApiError,
  rethrowTimeout,
  toSentence
} from '@/lib/api-publish-headless.ts'

export const FEEDBACK_KINDS = ['problem', 'feature_request'] as const

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

/** The hub's limits, from `sendFeedbackRequest` and `feedbackContext`. */
export const SUMMARY_MAX_LENGTH = 200
export const DETAILS_MAX_LENGTH = 8000
export const CONTEXT_MAX_LENGTH = 200

/** The hub's `FeedbackContext`, as far as the CLI sends it. */
export type FeedbackContext = {
  operation?: string
  resource?: string
  requestId?: string
  clientName: string
  clientVersion: string
}

export type FeedbackFailureCode =
  | 'bad-request'
  | 'unauthorized'
  | 'rate-limited'
  | 'bad-gateway'
  | 'unavailable'
  | 'network'
  | 'hub-error'

export type FeedbackFailure = {
  type: 'failed'
  code: FeedbackFailureCode
  status?: number
  message: string
  /** From `Retry-After` on a 429, when the hub sent one. */
  retryAfterSeconds?: number
  requestId?: string
  details?: ApiErrorDetail[]
}

/** The hub's `SentFeedback`. */
export type FeedbackSent = {
  type: 'sent'
  id: string
  issueUrl: string
}

export type FeedbackResult = FeedbackSent | FeedbackFailure

const FEEDBACK_TIMEOUT_MS = 30_000

const STATUS_CODES: Record<number, FeedbackFailureCode> = {
  400: 'bad-request',
  401: 'unauthorized',
  429: 'rate-limited',
  502: 'bad-gateway',
  503: 'unavailable'
}

const toLengthProblem = (flag: string, value: string, max: number): string | undefined =>
  value.length > max ? `${flag} has ${value.length} characters; the most is ${max}` : undefined

/**
 * Why the hub would refuse the flags, or `undefined` when it accepts them.
 * The hub wants a summary of one line.
 */
export const toFeedbackInputProblem = ({
  summary,
  details,
  operation,
  resource,
  requestId
}: {
  summary: string
  details: string
  operation?: string
  resource?: string
  requestId?: string
}): string | undefined => {
  if (summary.length === 0) return '--summary is empty'
  if (/[\r\n]/.test(summary)) return '--summary must be one line'
  if (details.length === 0) return '--details is empty'
  return (
    toLengthProblem('--summary', summary, SUMMARY_MAX_LENGTH) ??
    toLengthProblem('--details', details, DETAILS_MAX_LENGTH) ??
    toLengthProblem('--operation', operation ?? '', CONTEXT_MAX_LENGTH) ??
    toLengthProblem('--resource', resource ?? '', CONTEXT_MAX_LENGTH) ??
    toLengthProblem('--request-id', requestId ?? '', CONTEXT_MAX_LENGTH)
  )
}

/** `Retry-After` in seconds; the hub never sends an HTTP date. */
const readRetryAfter = (res: Response): number | undefined => {
  const value = res.headers.get('retry-after')
  if (value === null || !/^\d+$/.test(value.trim())) return undefined
  return Number(value.trim())
}

/** `90` → `2 minutes`: rounded up, so the user never retries too soon. */
export const toWaitText = (seconds: number): string => {
  if (seconds < 120) return `${seconds} seconds`
  if (seconds < 7200) return `${Math.ceil(seconds / 60)} minutes`
  return `${Math.ceil(seconds / 3600)} hours`
}

const toFailureMessage = (
  code: FeedbackFailureCode,
  {
    env,
    origin,
    tokenSource,
    hubMessage,
    status,
    retryAfterSeconds
  }: {
    env: HubEnv
    origin: string
    tokenSource: HubTokenSource
    hubMessage?: string
    status: number
    retryAfterSeconds?: number
  }
): string => {
  switch (code) {
    case 'unauthorized':
      return toRejectedTokenMessage(env, tokenSource)
    case 'rate-limited':
      return (
        `${toSentence(hubMessage ?? 'Too many feedback requests')} ` +
        (retryAfterSeconds === undefined
          ? 'Try again later.'
          : `Try again in ${toWaitText(retryAfterSeconds)}.`)
      )
    case 'bad-gateway':
      return 'GitHub did not confirm the feedback issue, and the hub stored nothing. Try again later.'
    case 'unavailable':
      return `The hub at ${origin} cannot take feedback yet.`
    default:
      return hubMessage ?? `the hub answered ${status}`
  }
}

const toFailure = async (
  res: Response,
  { env, origin, tokenSource }: { env: HubEnv; origin: string; tokenSource: HubTokenSource }
): Promise<FeedbackFailure> => {
  const code = STATUS_CODES[res.status] ?? 'hub-error'
  const retryAfterSeconds = code === 'rate-limited' ? readRetryAfter(res) : undefined
  const apiError = await readApiError(res)
  return {
    type: 'failed',
    code,
    status: res.status,
    message: toFailureMessage(code, {
      env,
      origin,
      tokenSource,
      hubMessage: apiError.message,
      status: res.status,
      retryAfterSeconds
    }),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    requestId: apiError.requestId,
    details: apiError.details
  }
}

const sentSchema = v.object({ id: v.string(), issueUrl: v.string() })

const toSent = (body: unknown, status: number): FeedbackResult => {
  const sent = v.safeParse(sentSchema, body)
  if (!sent.success) {
    return {
      type: 'failed',
      code: 'hub-error',
      status,
      message: 'the hub took the feedback, but its answer had no id or issueUrl'
    }
  }
  return { type: 'sent', id: sent.output.id, issueUrl: sent.output.issueUrl }
}

type FeedbackArgs = {
  kind: FeedbackKind
  summary: string
  details: string
  context: FeedbackContext
  token: string
  tokenSource: HubTokenSource
  origin: string
  env: HubEnv
  timeoutMs?: number
}

export const feedbackHeadless = async ({
  kind,
  summary,
  details,
  context,
  token,
  tokenSource,
  origin,
  env,
  timeoutMs = FEEDBACK_TIMEOUT_MS
}: FeedbackArgs): Promise<FeedbackResult> => {
  try {
    const res = await fetch(`${origin}/v1/feedback`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ kind, summary, details, context }),
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!res.ok) return await toFailure(res, { env, origin, tokenSource })
    const body: unknown = await res.json().catch(rethrowTimeout)
    return toSent(body, res.status)
  } catch (err) {
    // The hub may have filed the issue before the answer was lost.
    return {
      type: 'failed',
      code: 'network',
      message:
        `cannot reach the hub at ${origin}: ${errorMessage(err)}. ` +
        'The feedback may still have been filed.'
    }
  }
}
