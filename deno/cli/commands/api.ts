import {
  failWithInvalidArg,
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import {
  type ApiPublishFailure,
  apiPublishHeadless,
  type ApiPublishResult,
  type ApiPublishTokenSource,
  type ApiVisibility
} from '@/lib/api-publish-headless.ts'
import {
  exchangeLinkedRepositoryToken,
  readGithubOidcEnv,
  requestGithubOidcToken
} from '@/lib/github-oidc.ts'
import { resolveHubAuth } from '@/lib/hub-token.ts'
import { type HubEnv, toMissingTokenHint } from '@/lib/hub-env.ts'
import { parseScopedName } from '@/lib/scoped-name.ts'

export const description = 'Manage hub APIs: `publish` adds an OpenAPI document as a revision.'

// --- publish ----------------------------------------------------------------

type RenderApiPublishArgs = {
  file: string | undefined
  api: string | undefined
  visibility: ApiVisibility | undefined
  originUrl: string | undefined
  token: string | undefined
  env: HubEnv | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

const PUBLISH_USAGE =
  'skmtc api publish <file> --api @<account>/<slug> [--visibility public|private] [--origin-url <url>] [--env <env>] [--token <pat>]'
const PUBLISH_EXAMPLE = 'skmtc api publish openapi.yaml --api @acme/pets'

export const renderApiPublish = async ({
  file,
  api,
  visibility,
  originUrl,
  token,
  env,
  jsonFlag,
  noInputFlag
}: RenderApiPublishArgs) => {
  resolveInputMode({ noInputFlag, jsonFlag })

  if (file === undefined) {
    return failWithRecipe({
      command: 'api publish',
      arg: '<file>',
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE,
      discover: 'The OpenAPI document to publish, relative to the current directory.'
    })
  }

  if (api === undefined) {
    return failWithRecipe({
      command: 'api publish',
      arg: '--api',
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE,
      discover: 'The hub API as @account/slug, e.g. @acme/pets.'
    })
  }

  const scoped = parseScopedName(api)
  if (!scoped) {
    return failWithInvalidArg({
      message: `invalid --api "${api}" — expected @account/slug`,
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE
    })
  }

  const result = await runApiPublish({
    file,
    api: scoped,
    visibility,
    originUrl,
    tokenFlag: token,
    envFlag: env
  })

  if (result.type === 'missing') {
    return failWithRecipe({
      command: 'api publish',
      arg: '--token',
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE,
      discover: result.discover
    })
  }

  printApiPublishResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.type === 'failed' ? 1 : 0)
}

/** Resolve the token, then publish. `missing` when there is no token to send. */
export const runApiPublish = async ({
  file,
  api,
  visibility,
  originUrl,
  tokenFlag,
  envFlag
}: {
  file: string
  api: { account: string; slug: string }
  visibility: ApiVisibility | undefined
  originUrl: string | undefined
  tokenFlag: string | undefined
  envFlag: HubEnv | undefined
}): Promise<ApiPublishResult | ApiPublishMissing> => {
  const auth = await resolveApiPublishAuth({ tokenFlag, envFlag, api, originUrl })
  if (auth.type !== 'token') return auth

  return await apiPublishHeadless({
    file,
    api,
    visibility,
    originUrl,
    token: auth.token,
    tokenSource: auth.tokenSource,
    origin: auth.origin,
    env: auth.env
  })
}

type ApiPublishAuth =
  | {
      type: 'token'
      token: string
      tokenSource: ApiPublishTokenSource
      origin: string
      env: HubEnv
    }
  | ApiPublishMissing
  | ApiPublishFailure

/** No token and no way to get one: the caller prints the recipe, exit 2. */
export type ApiPublishMissing = { type: 'missing'; discover: string }

/**
 * The token `api publish` sends: `--token`, `$SKMTC_HUB_TOKEN` or the
 * `skmtc login` store, through `resolveHubAuth`. Only when none of them
 * gives a token, and the command runs in GitHub Actions, the job's OIDC
 * token is exchanged for a linked repository token.
 */
const resolveApiPublishAuth = async ({
  tokenFlag,
  envFlag,
  api,
  originUrl
}: {
  tokenFlag: string | undefined
  envFlag: HubEnv | undefined
  api: { account: string; slug: string }
  originUrl: string | undefined
}): Promise<ApiPublishAuth> => {
  const resolved = await resolveHubAuth({ tokenFlag, envFlag })
  if (resolved.token) {
    return {
      type: 'token',
      token: resolved.token,
      tokenSource: 'explicit',
      origin: resolved.origin,
      env: resolved.env
    }
  }

  const githubOidc = readGithubOidcEnv()
  if (githubOidc === undefined) {
    return { type: 'missing', discover: toMissingTokenHint(resolved.env) }
  }
  if (githubOidc === 'missing-permission') {
    const missingTokenHint = toMissingTokenHint(resolved.env)
    return {
      type: 'missing',
      discover:
        'Running in GitHub Actions without an OIDC token. Add `permissions: id-token: write` ' +
        'to the job (a pull request from a fork never gets one), or ' +
        `${missingTokenHint[0].toLowerCase()}${missingTokenHint.slice(1)}`
    }
  }

  // The hub refuses a source from a linked repository token on both routes.
  // Refuse it here, before the single-use OIDC token is spent.
  if (originUrl !== undefined) {
    return {
      type: 'failed',
      code: 'bad-request',
      message:
        '--origin-url needs `skmtc login` or a PAT: a linked repository token cannot add a source.'
    }
  }

  const githubToken = await requestGithubOidcToken({ ...githubOidc, audience: resolved.origin })
  if (githubToken.type === 'failed') return githubToken

  const linked = await exchangeLinkedRepositoryToken({
    origin: resolved.origin,
    api,
    githubToken: githubToken.token
  })
  if (linked.type === 'failed') return linked

  return {
    type: 'token',
    token: linked.token,
    tokenSource: 'oidc',
    origin: resolved.origin,
    env: resolved.env
  }
}

export const printApiPublishResult = (
  result: ApiPublishResult,
  { format }: { format: 'text' | 'json' }
): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  switch (result.type) {
    case 'published': {
      const name = `@${result.api.account}/${result.api.slug}`
      console.log(
        result.deduped
          ? `Published ${name} revision ${result.revision}, unchanged (deduped)`
          : `Published ${name} revision ${result.revision}`
      )
      if (result.created) console.log('  created API')
      console.log(`  ${result.url}`)
      return
    }
    case 'failed': {
      console.error(
        `Publish failed (${result.code}${result.status ? `, ${result.status}` : ''}): ${result.message}`
      )
      for (const detail of result.details ?? []) {
        console.error(`  ${detail.field ? `${detail.field}: ` : ''}${detail.message}`)
      }
      if (result.requestId) console.error(`  request id: ${result.requestId}`)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled api publish result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
