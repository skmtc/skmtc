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
  type ApiPublishTarget,
  type ApiPublishTokenSource,
  type ApiVisibility,
  readPublishFile
} from '@/lib/api-publish-headless.ts'
import {
  exchangeLinkedRepositoryToken,
  readGithubOidcEnv,
  readIfAllowed,
  requestGithubOidcToken
} from '@/lib/github-oidc.ts'
import { resolveHubAuth, resolveHubTarget } from '@/lib/hub-token.ts'
import { HUB_HOSTS, type HubEnv, toMissingTokenHint } from '@/lib/hub-env.ts'
import { parseScopedName } from '@/lib/scoped-name.ts'
import { type ApiLinkFailure, apiLinkHeadless } from '@/lib/api-link-headless.ts'
import {
  type LinkTargetInvalid,
  resolveRepository,
  resolveWorkflow
} from '@/lib/linked-repo-detect.ts'
import { openUrl } from '@/lib/open-url.ts'
import { printHubFailure } from '@/lib/print-hub-failure.ts'
import { readEnv } from '@/lib/env.ts'

export const description =
  'Manage hub APIs: `publish` adds an OpenAPI document as a revision; `link` makes a link request for a GitHub repository.'

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

/**
 * Read `<file>`, resolve the token, then publish. `missing` when there is no
 * token to send. The file comes first: an unreadable file spends no
 * single-use OIDC token and refreshes no stored login.
 */
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
  // The hub the publish targets, named on every failure. No refresh, no request.
  const { origin, env } = resolveHubTarget({ tokenFlag, envFlag })

  const read = await readPublishFile(file)
  if (read.type === 'failed') return { ...read, origin, env }

  const auth = await resolveApiPublishAuth({ tokenFlag, envFlag, api, originUrl })
  if (auth.type === 'failed') return { ...auth, origin, env }
  if (auth.type !== 'token') return auth

  return await apiPublishHeadless({
    bytes: read.bytes,
    filename: read.filename,
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
      console.log(`  hub: ${toTargetText(result)}`)
      return
    }
    case 'failed': {
      printHubFailure('Publish failed', result)
      console.error(`  hub: ${toTargetText(result)}`)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled api publish result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/** The hub a publish targeted, e.g. `https://api.skmtc.dev (production)`. */
const toTargetText = ({ origin, env }: ApiPublishTarget): string => `${origin} (${env})`

// --- link -------------------------------------------------------------------

type RenderApiLinkArgs = {
  api: string | undefined
  repo: string | undefined
  workflow: string | undefined
  environment: string | undefined
  /** `false` with `--no-open`. */
  open: boolean
  token: string | undefined
  env: HubEnv | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

const LINK_USAGE =
  'skmtc api link --api @<account>/<slug> [--repo <owner>/<repo>] [--workflow <path>] [--environment <name>] [--no-open] [--env <env>] [--token <pat>]'
const LINK_EXAMPLE = 'skmtc api link --api @acme/pets'

export const renderApiLink = async ({
  api,
  repo,
  workflow,
  environment,
  open,
  token,
  env,
  jsonFlag,
  noInputFlag
}: RenderApiLinkArgs) => {
  resolveInputMode({ noInputFlag, jsonFlag })

  if (api === undefined) {
    return failWithRecipe({
      command: 'api link',
      arg: '--api',
      usage: LINK_USAGE,
      example: LINK_EXAMPLE,
      discover: 'The hub API as @account/slug, e.g. @acme/pets.'
    })
  }

  const scoped = parseScopedName(api)
  if (!scoped) {
    return failWithInvalidArg({
      message: `invalid --api "${api}" — expected @account/slug`,
      usage: LINK_USAGE,
      example: LINK_EXAMPLE
    })
  }

  const result = await runApiLink({
    api: scoped,
    repoFlag: repo,
    workflowFlag: workflow,
    environment,
    openFlag: open,
    tokenFlag: token,
    envFlag: env
  })

  if (result.type === 'invalid') {
    return failWithInvalidArg({ message: result.message, usage: LINK_USAGE, example: LINK_EXAMPLE })
  }

  if (result.type === 'missing') {
    return failWithRecipe({
      command: 'api link',
      arg: '--token',
      usage: LINK_USAGE,
      example: LINK_EXAMPLE,
      discover: result.discover
    })
  }

  printApiLinkResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.type === 'failed' ? 1 : 0)
}

export type ApiLinkResult =
  | {
      type: 'requested'
      api: { account: string; slug: string }
      repository: string
      workflow: string
      /** `null`: any environment. */
      environment: string | null
      id: string
      url: string
      expiresAt: string
      origin: string
      /** The browser was opened on `url`. */
      opened: boolean
    }
  | ApiLinkFailure

/**
 * Read the repository and the workflow, resolve the token, then make the
 * link request and open the browser. Git and the workflows come first: a
 * bad input refreshes no stored login.
 */
export const runApiLink = async ({
  api,
  repoFlag,
  workflowFlag,
  environment,
  openFlag,
  tokenFlag,
  envFlag,
  cwd = Deno.cwd(),
  open = openUrl
}: {
  api: { account: string; slug: string }
  repoFlag: string | undefined
  workflowFlag: string | undefined
  environment: string | undefined
  openFlag: boolean
  tokenFlag: string | undefined
  envFlag: HubEnv | undefined
  cwd?: string
  open?: (url: string) => Promise<boolean>
}): Promise<ApiLinkResult | LinkTargetInvalid | ApiPublishMissing> => {
  const repository = await resolveRepository({ repoFlag, cwd })
  if (repository.type === 'invalid') return repository

  const workflow = await resolveWorkflow({ workflowFlag, cwd })
  if (workflow.type === 'invalid') return workflow

  // A linked repository token gets 403 on this route: no OIDC exchange.
  const auth = await resolveHubAuth({ tokenFlag, envFlag })
  if (!auth.token) return { type: 'missing', discover: toMissingTokenHint(auth.env) }

  // Read before the request: an environment read that fails must not end
  // the command after the hub made a request.
  const mayOpen = openFlag && !isCi()

  const requested = await apiLinkHeadless({
    api,
    repository: repository.repository,
    workflow: workflow.workflow,
    environment,
    token: auth.token,
    origin: auth.origin,
    env: auth.env
  })
  if (requested.type === 'failed') return requested

  const shouldOpen = mayOpen && isSiteUrl(requested.url, auth.env)

  return {
    type: 'requested',
    api,
    repository: repository.repository,
    workflow: workflow.workflow,
    environment: environment ?? null,
    id: requested.id,
    url: requested.url,
    expiresAt: requested.expiresAt,
    origin: auth.origin,
    opened: shouldOpen ? await open(requested.url) : false
  }
}

const isCi = (): boolean =>
  readIfAllowed(() => readEnv('GITHUB_ACTIONS')) === 'true' ||
  readIfAllowed(() => readEnv('CI')) === 'true'

/** Only a page on the environment's own site is opened. */
const isSiteUrl = (url: string, env: HubEnv): boolean => {
  try {
    return new URL(url).origin === HUB_HOSTS[env].web
  } catch {
    return false
  }
}

export const printApiLinkResult = (
  result: ApiLinkResult,
  { format }: { format: 'text' | 'json' }
): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  switch (result.type) {
    case 'requested': {
      console.log(`Link request made for @${result.api.account}/${result.api.slug}`)
      console.log(`  repository:  ${result.repository}`)
      console.log(`  workflow:    ${result.workflow}`)
      console.log(`  environment: ${result.environment ?? 'any'}`)
      console.log(
        result.opened
          ? 'Check these values on the page opened in your browser, then select Link repository:'
          : 'Open this page, check these values, then select Link repository:'
      )
      console.log(`  ${result.url}`)
      console.log(`  expires ${result.expiresAt}`)
      return
    }
    case 'failed': {
      printHubFailure('Link request failed', result)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled api link result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
