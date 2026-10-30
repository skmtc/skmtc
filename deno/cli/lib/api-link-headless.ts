/**
 * Headless `api link` — make a link request for a hub API.
 *
 * Calls `POST /v1/apis/{account}/{api}/linked-repository-requests`. The hub
 * answers with the settings page that shows the request; an admin of the API
 * checks the values there and links the repository.
 */

import * as v from 'valibot'
import { type HubEnv, toLoginCommand } from '@/lib/hub-env.ts'
import { toScopedPath } from '@/lib/scoped-name.ts'
import {
  type ApiErrorDetail,
  errorMessage,
  readApiError,
  rethrowTimeout,
  toSentence
} from '@/lib/api-publish-headless.ts'

type Scoped = { account: string; slug: string }

export type ApiLinkFailureCode =
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'network'
  | 'hub-error'

export type ApiLinkFailure = {
  type: 'failed'
  code: ApiLinkFailureCode
  status?: number
  message: string
  requestId?: string
  details?: ApiErrorDetail[]
}

/** The hub's `CreatedLinkedRepositoryRequest`. */
export type ApiLinkRequested = {
  type: 'requested'
  id: string
  /** The settings page that shows the request. */
  url: string
  expiresAt: string
}

export type ApiLinkHeadlessResult = ApiLinkRequested | ApiLinkFailure

const LINK_TIMEOUT_MS = 20_000

const STATUS_CODES: Record<number, ApiLinkFailureCode> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  429: 'rate-limited'
}

type ApiLinkArgs = {
  api: Scoped
  repository: string
  workflow: string
  environment?: string
  token: string
  origin: string
  env: HubEnv
  timeoutMs?: number
}

export const toApiLinkUrl = ({ api, origin }: { api: Scoped; origin: string }): string =>
  `${origin}/v1/apis/${toScopedPath(api)}/linked-repository-requests`

/** The message for a refused request: the CLI's own text where it has one, else the hub's. */
const toFailureMessage = (
  code: ApiLinkFailureCode,
  {
    api,
    env,
    hubMessage,
    status
  }: { api: Scoped; env: HubEnv; hubMessage?: string; status: number }
): string => {
  const name = `@${api.account}/${api.slug}`
  switch (code) {
    case 'forbidden':
      return (
        `You are not an admin of ${name}. ` +
        `Run \`${toLoginCommand(env)}\` as an admin, or pass a --token for an admin.`
      )
    case 'not-found':
      return `API ${name} not found, or you cannot see it.`
    case 'rate-limited':
      return '10 link requests are open on this API; wait 15 minutes or decline one on the settings page.'
    case 'unauthorized':
      return (
        `${toSentence(hubMessage ?? `the hub answered ${status}`)} ` +
        `Sign in again with \`${toLoginCommand(env)}\`, or pass a valid --token.`
      )
    default:
      return hubMessage ?? `the hub answered ${status}`
  }
}

const toFailure = async (
  res: Response,
  { api, env }: { api: Scoped; env: HubEnv }
): Promise<ApiLinkFailure> => {
  const code = STATUS_CODES[res.status] ?? 'hub-error'
  const apiError = await readApiError(res)
  return {
    type: 'failed',
    code,
    status: res.status,
    message: toFailureMessage(code, { api, env, hubMessage: apiError.message, status: res.status }),
    requestId: apiError.requestId,
    details: apiError.details
  }
}

const createdSchema = v.object({ id: v.string(), url: v.string(), expiresAt: v.string() })

const toRequested = (body: unknown, status: number): ApiLinkHeadlessResult => {
  const created = v.safeParse(createdSchema, body)
  if (!created.success) {
    return {
      type: 'failed',
      code: 'hub-error',
      status,
      message: 'the hub accepted the link request, but its answer had no id, url or expiresAt'
    }
  }
  return { type: 'requested', ...created.output }
}

export const apiLinkHeadless = async ({
  api,
  repository,
  workflow,
  environment,
  token,
  origin,
  env,
  timeoutMs = LINK_TIMEOUT_MS
}: ApiLinkArgs): Promise<ApiLinkHeadlessResult> => {
  try {
    const res = await fetch(toApiLinkUrl({ api, origin }), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'github',
        repository,
        workflowPath: workflow,
        ...(environment === undefined ? {} : { environment })
      }),
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!res.ok) return await toFailure(res, { api, env })
    const body: unknown = await res.json().catch(rethrowTimeout)
    return toRequested(body, res.status)
  } catch (err) {
    return {
      type: 'failed',
      code: 'network',
      message: `cannot reach the hub at ${origin}: ${errorMessage(err)}`
    }
  }
}
