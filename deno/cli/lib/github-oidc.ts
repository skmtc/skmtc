/**
 * Sign in to the hub from GitHub Actions, for `api publish` only.
 *
 * The job's OIDC token is exchanged at the hub for a short-lived linked
 * repository token, scoped to one API. Neither token is ever printed: a
 * GitHub failure echoes at most the first 200 characters of its body, and a
 * hub failure echoes only the hub's `message`, `requestId` and `details`.
 */

import * as v from 'valibot'
import { readEnv } from '@/lib/env.ts'
import { toScopedPath } from '@/lib/scoped-name.ts'
import {
  type ApiPublishFailure,
  errorMessage,
  readApiError,
  rethrowTimeout,
  toSentence
} from '@/lib/api-publish-headless.ts'

type Scoped = { account: string; slug: string }

export type GithubOidcEnv = { requestUrl: string; requestToken: string }

/** A variable the process may not read (a narrow `--allow-env`) counts as unset. */
export const readIfAllowed = <T>(read: () => T): T | undefined => {
  try {
    return read()
  } catch (error) {
    if (error instanceof Deno.errors.NotCapable) return undefined
    throw error
  }
}

/**
 * The OIDC request variables. `undefined` outside GitHub Actions, even when
 * the variables are set. `'missing-permission'` in GitHub Actions without
 * them: the job has no `id-token: write`, or runs for a fork's pull request.
 */
export const readGithubOidcEnv = (): GithubOidcEnv | 'missing-permission' | undefined => {
  if (readIfAllowed(() => readEnv('GITHUB_ACTIONS')) !== 'true') return undefined

  const requestUrl = readIfAllowed(() => readEnv('ACTIONS_ID_TOKEN_REQUEST_URL'))
  const requestToken = readIfAllowed(() => readEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN'))

  return requestUrl && requestToken ? { requestUrl, requestToken } : 'missing-permission'
}

const githubTokenSchema = v.object({ value: v.pipe(v.string(), v.minLength(1)) })

const oidcTokenFailure = (message: string): ApiPublishFailure => ({
  type: 'failed',
  code: 'oidc-token',
  message
})

/**
 * Each sign-in request ends within this time, as the identity requests do.
 * Without it, a provider that never answers holds the CI job until its
 * `timeout-minutes`.
 */
const OIDC_REQUEST_TIMEOUT_MS = 20_000
const OIDC_EXCHANGE_TIMEOUT_MS = 20_000

/** Request the job's OIDC token for `audience`. One try, no retries. */
export const requestGithubOidcToken = async ({
  requestUrl,
  requestToken,
  audience,
  timeoutMs = OIDC_REQUEST_TIMEOUT_MS
}: GithubOidcEnv & { audience: string; timeoutMs?: number }): Promise<
  { type: 'token'; token: string } | ApiPublishFailure
> => {
  try {
    const url = new URL(requestUrl)
    url.searchParams.set('audience', audience)
    const res = await fetch(url, {
      method: 'GET',
      headers: { authorization: `bearer ${requestToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200)
      return oidcTokenFailure(
        body
          ? `GitHub's OIDC provider answered ${res.status}: ${body}`
          : `GitHub's OIDC provider answered ${res.status}`
      )
    }
    const parsed = v.safeParse(githubTokenSchema, await res.json().catch(rethrowTimeout))
    return parsed.success
      ? { type: 'token', token: parsed.output.value }
      : oidcTokenFailure("GitHub's OIDC provider returned no token")
  } catch (error) {
    return oidcTokenFailure(`cannot reach GitHub's OIDC provider: ${errorMessage(error)}`)
  }
}

const linkedRepositoryTokenSchema = v.object({ accessToken: v.pipe(v.string(), v.minLength(1)) })

const toExchangeLead = (
  status: number,
  { api, hubMessage }: { api: Scoped; hubMessage?: string }
): string => {
  switch (status) {
    case 401:
      return hubMessage
        ? `The hub refused the GitHub OIDC token (401): ${toSentence(hubMessage)}`
        : 'The hub refused the GitHub OIDC token (401).'
    case 403:
      return (
        `No linked repository of @${api.account}/${api.slug} matches this workflow run, ` +
        'or the API does not exist yet. The link must name this repository and this workflow ' +
        'file (and environment, if set). The first publish needs `skmtc login` or a PAT.'
      )
    case 503:
      return "The hub cannot check GitHub's signing keys right now (503). Run the job again in a few minutes."
    default:
      return hubMessage ?? `the hub answered ${status}`
  }
}

/** Exchange the job's OIDC token for a linked repository token scoped to `api`. */
export const exchangeLinkedRepositoryToken = async ({
  origin,
  api,
  githubToken,
  timeoutMs = OIDC_EXCHANGE_TIMEOUT_MS
}: {
  origin: string
  api: Scoped
  githubToken: string
  timeoutMs?: number
}): Promise<{ type: 'token'; token: string } | ApiPublishFailure> => {
  try {
    const res = await fetch(`${origin}/v1/apis/${toScopedPath(api)}/linked-repositories/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: githubToken }),
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (res.status !== 201) {
      const apiError = await readApiError(res)
      return {
        type: 'failed',
        code: 'oidc-exchange',
        status: res.status,
        message: toExchangeLead(res.status, { api, hubMessage: apiError.message }),
        requestId: apiError.requestId,
        details: apiError.details
      }
    }
    const parsed = v.safeParse(linkedRepositoryTokenSchema, await res.json().catch(rethrowTimeout))
    return parsed.success
      ? { type: 'token', token: parsed.output.accessToken }
      : {
          type: 'failed',
          code: 'oidc-exchange',
          status: res.status,
          message: 'the hub accepted the GitHub OIDC token, but its answer had no token'
        }
  } catch (error) {
    return {
      type: 'failed',
      code: 'network',
      message: `cannot reach the hub at ${origin}: ${errorMessage(error)}`
    }
  }
}
