/**
 * Headless `api publish` — add an OpenAPI document to a hub API as a revision.
 *
 * Standalone: it reads `<file>` against the current directory and needs no
 * Skmtc workspace. With a visibility it calls `POST /v1/apis/publish`, which
 * creates the API when it is missing. Without one it calls
 * `POST /v1/apis/{account}/{api}/revisions`, which never creates an API.
 */

import { resolve } from '@std/path/resolve'
import { type HubEnv, toLoginCommand } from '@/lib/hub-env.ts'
import { toScopedPath } from '@/lib/scoped-name.ts'

type Scoped = { account: string; slug: string }

export const API_VISIBILITIES = ['public', 'private'] as const

export type ApiVisibility = (typeof API_VISIBILITIES)[number]

export type ApiPublishFailureCode =
  | 'file-unreadable'
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'invalid-document'
  | 'network'
  | 'hub-error'
  | 'oidc-token'
  | 'oidc-exchange'

export type ApiErrorDetail = { field?: string; message: string }

export type ApiPublishFailure = {
  type: 'failed'
  code: ApiPublishFailureCode
  status?: number
  message: string
  requestId?: string
  details?: ApiErrorDetail[]
}

/**
 * `explicit`: from `--token`, `$SKMTC_HUB_TOKEN` or `skmtc login`. `oidc`: a
 * linked repository token, from a GitHub Actions OIDC token.
 */
export type ApiPublishTokenSource = 'explicit' | 'oidc'

export type ApiPublishResult =
  | {
      type: 'published'
      api: Scoped
      /** The revision's content ref. */
      revision: string
      url: string
      /** The hub already had these bytes; no revision was added. */
      deduped: boolean
      /** The publish created the API. */
      created: boolean
      origin: string
    }
  | ApiPublishFailure

/**
 * The publish ends within this time. It uploads the whole document and the
 * hub parses it, so it gets longer than the sign-in requests.
 */
const PUBLISH_TIMEOUT_MS = 120_000

type ApiPublishArgs = {
  /** The document, from `readPublishFile`. */
  bytes: Uint8Array<ArrayBuffer>
  /** The document's file name, from `readPublishFile`. */
  filename: string
  api: Scoped
  /** Set: create the API when it is missing. Unset: the API must exist. */
  visibility?: ApiVisibility
  /** Where these bytes can be fetched. */
  originUrl?: string
  token: string
  tokenSource: ApiPublishTokenSource
  origin: string
  env: HubEnv
  timeoutMs?: number
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

const STATUS_CODES: Record<number, ApiPublishFailureCode> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  422: 'invalid-document'
}

/** The request URL: the create route with a visibility, else the revisions route. */
export const toApiPublishUrl = ({
  api,
  visibility,
  originUrl,
  filename,
  origin
}: {
  api: Scoped
  visibility?: ApiVisibility
  originUrl?: string
  filename: string
  origin: string
}): string => {
  const optionalOriginUrl = originUrl ? [['originUrl', originUrl]] : []
  if (visibility) {
    const query = new URLSearchParams([
      ['owner', api.account],
      ['slug', api.slug],
      ['visibility', visibility],
      ['filename', filename],
      ...optionalOriginUrl
    ])
    return `${origin}/v1/apis/publish?${query}`
  }
  const query = new URLSearchParams([['filename', filename], ...optionalOriginUrl])
  return `${origin}/v1/apis/${toScopedPath(api)}/revisions?${query}`
}

/**
 * The hub's `ApiError` body, when the response carries one. Any other body,
 * such as a gateway's HTML page, yields nothing.
 */
export const readApiError = async (
  res: Response
): Promise<{ message?: string; requestId?: string; details?: ApiErrorDetail[] }> => {
  const text = await res.text()
  try {
    const body: unknown = JSON.parse(text)
    if (!isObject(body)) return {}
    const details = Array.isArray(body.details)
      ? body.details
          .filter(isObject)
          .flatMap(detail =>
            typeof detail.message === 'string'
              ? [
                  typeof detail.field === 'string'
                    ? { field: detail.field, message: detail.message }
                    : { message: detail.message }
                ]
              : []
          )
      : []
    return {
      message: typeof body.message === 'string' ? body.message : undefined,
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
      details: details.length > 0 ? details : undefined
    }
  } catch {
    return {}
  }
}

export const toSentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

/**
 * What to do next, for the failures the caller can fix. A linked repository
 * token gets none: signing in or another token is not the fix in CI.
 */
const toHint = (
  code: ApiPublishFailureCode,
  { api, env, tokenSource }: { api: Scoped; env: HubEnv; tokenSource: ApiPublishTokenSource }
): string | undefined => {
  if (tokenSource === 'oidc') return undefined
  switch (code) {
    case 'unauthorized':
      return `Sign in again with \`${toLoginCommand(env)}\`, or pass a valid --token.`
    case 'forbidden':
      return (
        `The token needs the publish:schemas scope and write access to @${api.account}. ` +
        `Run \`${toLoginCommand(env)}\`, or pass a token that has them.`
      )
    default:
      return undefined
  }
}

/** The lead sentence the CLI writes itself, in place of the hub's message. */
const toOwnLead = (
  code: ApiPublishFailureCode,
  {
    api,
    visibility,
    tokenSource
  }: { api: Scoped; visibility?: ApiVisibility; tokenSource: ApiPublishTokenSource }
): string | undefined => {
  if (tokenSource === 'oidc') {
    switch (code) {
      case 'unauthorized':
        return 'The linked repository token was refused: it expired or its link was removed. Run the job again.'
      case 'not-found':
        return `API @${api.account}/${api.slug} not found. The first publish needs \`skmtc login\` or a PAT.`
      default:
        return undefined
    }
  }
  return code === 'not-found' && !visibility
    ? `API @${api.account}/${api.slug} not found, or you cannot see it. ` +
        'Check the name, or pass --visibility public|private to create it.'
    : undefined
}

const toFailure = async (
  res: Response,
  {
    api,
    visibility,
    env,
    tokenSource
  }: { api: Scoped; visibility?: ApiVisibility; env: HubEnv; tokenSource: ApiPublishTokenSource }
): Promise<ApiPublishResult> => {
  const code = STATUS_CODES[res.status] ?? 'hub-error'
  const apiError = await readApiError(res)
  const lead =
    toOwnLead(code, { api, visibility, tokenSource }) ??
    apiError.message ??
    `the hub answered ${res.status}`
  const hint = toHint(code, { api, env, tokenSource })
  return {
    type: 'failed',
    code,
    status: res.status,
    message: hint ? `${toSentence(lead)} ${hint}` : lead,
    requestId: apiError.requestId,
    details: apiError.details
  }
}

/** Read the success body (`ImportApiResult`). */
const toPublished = (body: unknown, status: number, origin: string): ApiPublishResult => {
  const api = isObject(body) && isObject(body.api) ? body.api : undefined
  const owner = api && isObject(api.owner) ? api.owner.handle : undefined
  const slug = api?.slug
  const revision = isObject(body) && isObject(body.revision) ? body.revision : undefined
  const contentRef = revision?.contentRef
  const url = revision?.htmlUrl
  if (
    !isObject(body) ||
    typeof owner !== 'string' ||
    typeof slug !== 'string' ||
    typeof contentRef !== 'string' ||
    typeof url !== 'string'
  ) {
    return {
      type: 'failed',
      code: 'hub-error',
      status,
      message: 'the hub accepted the document, but its answer had no API or revision'
    }
  }
  return {
    type: 'published',
    api: { account: owner, slug },
    revision: contentRef,
    url,
    deduped: body.deduped === true,
    created: body.isNewApi === true,
    origin
  }
}

/** Read `<file>` and take its file name. The caller reads it before any sign-in. */
export const readPublishFile = async (
  file: string
): Promise<
  { type: 'read'; bytes: Uint8Array<ArrayBuffer>; filename: string } | ApiPublishFailure
> => {
  // Against the current directory, never a `.skmtc` ancestor: the command
  // needs no workspace.
  const path = resolve(Deno.cwd(), file)
  const read = await Deno.readFile(path).then(
    bytes => ({ bytes }),
    (err: unknown) => ({ error: errorMessage(err) })
  )
  if ('error' in read) {
    return {
      type: 'failed',
      code: 'file-unreadable',
      message: `cannot read "${file}" (${path}): ${read.error}`
    }
  }
  // Both separators: a Windows-style `schemas\api.json` has no `/`. The hub
  // reads the extension to tell JSON from YAML.
  const filename = file.split(/[\\/]/).pop() || 'openapi.json'
  return { type: 'read', bytes: read.bytes, filename }
}

export const apiPublishHeadless = async ({
  bytes,
  filename,
  api,
  visibility,
  originUrl,
  token,
  tokenSource,
  origin,
  env,
  timeoutMs = PUBLISH_TIMEOUT_MS
}: ApiPublishArgs): Promise<ApiPublishResult> => {
  try {
    const res = await fetch(toApiPublishUrl({ api, visibility, originUrl, filename, origin }), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: bytes,
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!res.ok) return await toFailure(res, { api, visibility, env, tokenSource })
    const body: unknown = await res.json().catch(() => undefined)
    return toPublished(body, res.status, origin)
  } catch (err) {
    return {
      type: 'failed',
      code: 'network',
      message: `cannot reach the hub at ${origin}: ${errorMessage(err)}`
    }
  }
}
