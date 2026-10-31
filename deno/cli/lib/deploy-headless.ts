/**
 * Headless `deploy` path. Stores a new immutable version of the stack on the
 * hub, then deploys it as a stack server. Source is the deliverable: the hub
 * deploys the uploaded source tree directly as a Deno Deploy app
 * (synthesizing the `server.ts` entry itself) — there is no compiled bundle.
 *
 * Flow:
 *   1. Resolve the version — the `--version` flag wins, otherwise the project
 *      root `deno.json#version`. No version → fail before any network call.
 *   2. Resolve the stack identity from the project `deno.json#name`
 *      (`@account/slug`).
 *   3. `GET /v1/stacks/{account}/{stack}/versions/{version}` — a 200 stops
 *      before any upload: versions are immutable.
 *   4. `collectSourceFiles(project)` — the user-authored source tree, filtered
 *      by built-in defaults + the project's optional `.skmtcignore`. The hub
 *      REQUIRES `deno.lock` in the upload. When the project `deno.json` lacks
 *      the `@skmtc/server` pin the hub's synthesized `server.ts` needs, it is
 *      added, `deno.lock` is refreshed, and the tree is collected again.
 *   5. `POST /v1/stacks/{account}/{stack}/versions` (multipart) with the
 *      `version` part + one `files` part per source file. Atomic.
 *   6. `POST /v1/stacks/{account}/{stack}/servers` `{ version }` deploys the
 *      stored version and answers with the StackServer. It never moves the
 *      `production` alias.
 *
 * With `existing`, steps 3–5 are skipped: the version already on the hub is
 * deployed as it is.
 */

import { join } from '@std/path/join'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { collectSourceFiles, type SourceFile } from '@/lib/source-upload.ts'
import { parseScopedName, toScopedPath } from '@/lib/scoped-name.ts'
import { toProjectInstallCommand } from '@/lib/dependency-age.ts'
import { pinServerForPublish, refreshProjectLock } from '@/lib/publish-server-pin.ts'
import {
  errorMessage,
  isTimeoutError,
  readApiError,
  rethrowTimeout,
  toSentence
} from '@/lib/api-publish-headless.ts'
// One definition, in the module that owns the stored-auth shape. This file
// used to declare its own copy of the same literal, which is how a default
// hub silently drifts between `login` and `deploy`.
import { DEFAULT_HUB_ENV, HUB_HOSTS, type HubEnv } from '@/lib/hub-env.ts'

/** The deploy waits until the server is ready, so it gets a long timeout. */
export const DEPLOY_TIMEOUT_MS = 120_000

/** The version check before the upload. */
export const EXISTS_TIMEOUT_MS = 20_000

/** The part of {@link SkmtcRoot} a deploy reads: the project's folder. */
export type DeployRoot = {
  findProject: (projectName: string) => { toPath: () => string }
}

type DeployHeadlessArgs = {
  skmtcRoot: DeployRoot
  projectName: string
  /** Personal access token. */
  token: string
  /** Hub base URL — defaults to https://api.skmtc.dev. */
  origin?: string
  /**
   * Version override from `--version`. When absent the version is read
   * from the project root `deno.json#version`.
   */
  version?: string
  /** The `--env` flag, for the commands the failure messages suggest. */
  envFlag?: HubEnv
  /** Deploy the version already stored on the hub, without uploading. */
  existing?: boolean
  /** Refresh `deno.lock` after the server pin changes `deno.json`; a seam for tests. */
  refreshLock?: (projectPath: string) => Promise<void>
}

export const STACK_SERVER_STATUSES = ['deploying', 'active', 'idle', 'paused', 'error'] as const

export type StackServerStatus = (typeof STACK_SERVER_STATUSES)[number]

/** The StackServer the deploy route answers with. */
export type StackDeploy = {
  status: StackServerStatus
  /** Set when `status` is `error`. */
  statusReason: string | null
  endpointUrl: string | null
  url: string | null
}

/** The stored version, when this run uploaded it. */
export type StackUpload = {
  /** Content identity of the uploaded source tree (sha256 hex). */
  sourceHash: string
  /** Canonical SPA URL for the stored version. */
  versionUrl: string
  sourceFileCount: number
  sourceTotalBytes: number
}

export type DeployFailureStage = 'version' | 'identity' | 'exists' | 'source' | 'upload' | 'deploy'

export type DeployHeadlessResult =
  | {
      type: 'deployed'
      projectName: string
      stack: { account: string; slug: string }
      /** The stored semver. */
      version: string
      /** `null` with `--existing`: the version was already stored. */
      upload: StackUpload | null
      deploy: StackDeploy
    }
  | {
      type: 'failed'
      projectName: string
      reason: string
      stage: DeployFailureStage
      /** The version is stored on the hub: a later run cannot change it. */
      stored: boolean
    }

/** 0 when the version is deployed; 2 when it already exists; 1 otherwise. */
export const toDeployExitCode = (result: DeployHeadlessResult): number => {
  if (result.type === 'deployed') return result.deploy.status === 'error' ? 1 : 0
  return result.stage === 'exists' ? 2 : 1
}

/** How this run was invoked: the flags a suggested command must keep. */
export type DeployInvocation = {
  projectName: string
  /** The version, when `--version` gave it. */
  version?: string
  /** The hub, when `--env` gave it. */
  env?: HubEnv
}

/** `skmtc deploy <project> --existing`, with this run's `--version` and `--env`. */
const toRetryCommand = ({ projectName, version, env }: DeployInvocation): string =>
  [
    `skmtc deploy ${projectName}`,
    version ? `--version ${version}` : '',
    env ? `--env ${env}` : '',
    '--existing'
  ]
    .filter(Boolean)
    .join(' ')

/**
 * `skmtc deploy <project>` with this run's `--env`. Without `--version`: the
 * next run deploys a new version.
 */
const toRerunCommand = ({ projectName, env }: DeployInvocation): string =>
  `skmtc deploy ${projectName}${env ? ` --env ${env}` : ''}`

/** The recipe when the version is already on the hub. */
export const toVersionExistsMessage = (version: string, invocation: DeployInvocation): string =>
  `Version ${version} already exists. Bump \`version\` in deno.json, or run ` +
  `\`${toRetryCommand(invocation)}\` to deploy the stored version.`

/** What a stored version that did not deploy needs: a fix and a new version. */
export const toStoredFixMessage = (version: string, invocation: DeployInvocation): string =>
  `Version ${version} is stored and cannot change. Fix the problem, bump \`version\` ` +
  `in deno.json, and run \`${toRerunCommand(invocation)}\` again.`

/**
 * The lines that report a deployed result, shared by the text output and the
 * Ink view: the version, then `deploy: <status>`.
 */
export const toDeployedLines = (
  result: Extract<DeployHeadlessResult, { type: 'deployed' }>
): string[] => {
  const ref = `${result.stack.account}/${result.stack.slug}@${result.version}`
  const lines = result.upload
    ? [
        `Stored ${ref}`,
        `  source: ${result.upload.sourceFileCount} files, ${result.upload.sourceTotalBytes} bytes`,
        `  sourceHash: ${result.upload.sourceHash}`,
        `  version: ${result.upload.versionUrl}`
      ]
    : [`Already stored ${ref}`]
  lines.push(`deploy: ${result.deploy.status}`)
  if (result.deploy.status === 'error') {
    lines.push(`  reason: ${result.deploy.statusReason ?? '(the hub gave no reason)'}`)
    lines.push(toStoredFixMessage(result.version, { projectName: result.projectName }))
    return lines
  }
  if (result.deploy.url) lines.push(`  url: ${result.deploy.url}`)
  if (result.deploy.endpointUrl) lines.push(`  endpoint: ${result.deploy.endpointUrl}`)
  return lines
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Read the project root `deno.json` field `key` as a string, or `undefined`
 * when the file is missing, unparseable, or the field is not a string.
 */
const readProjectField = async (
  projectPath: string,
  key: 'name' | 'version'
): Promise<string | undefined> => {
  try {
    const contents = await Deno.readTextFile(join(projectPath, 'deno.json'))
    const parsed: unknown = JSON.parse(contents)
    if (!isObject(parsed)) return undefined
    const value = parsed[key]
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the version to deploy: the `--version` flag wins, then the
 * project root `deno.json#version`. Both are trimmed; empty values count
 * as missing. Throws when neither source yields a version — the CLI never
 * invents or auto-bumps a semver.
 *
 * Exported for tests.
 */
export const resolveStackVersion = async ({
  projectPath,
  versionFlag
}: {
  projectPath: string
  versionFlag?: string
}): Promise<string> => {
  const fromFlag = versionFlag?.trim()
  if (fromFlag) return fromFlag

  const fromDenoJson = (await readProjectField(projectPath, 'version'))?.trim()
  if (fromDenoJson) return fromDenoJson

  throw new Error(
    "no version to deploy — set a `version` in the project's deno.json or pass --version <semver>"
  )
}

/**
 * Resolve the stack identity from the project root `deno.json#name` — a stack is
 * a JSR-style package, so its identity is its package name `@account/slug` (the
 * `@account` scope may be an org). Throws the recipe when the name is missing or
 * not a scoped name; it never falls back to the authenticated handle.
 *
 * Exported for tests.
 */
export const resolveStackName = async (
  projectPath: string
): Promise<{ account: string; slug: string }> => {
  const name = (await readProjectField(projectPath, 'name'))?.trim()
  const parsed = name ? parseScopedName(name) : null
  if (!parsed) {
    throw new Error(
      'no stack name to deploy to — set `name` to "@account/slug" in the project deno.json'
    )
  }
  return parsed
}

/** The upload's 409: the version is already stored. */
export class VersionExistsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VersionExistsError'
  }
}

/** The upload succeeded, but its answer could not be read: the version is stored. */
export class StoredVersionUnreadableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoredVersionUnreadableError'
  }
}

/**
 * Whether `version` is already stored. Only a 200 counts as stored: a 404, a
 * refusal or no answer lets the upload go ahead, and its 409 still catches a
 * stored version.
 *
 * Exported for tests.
 */
export const isVersionStored = async ({
  origin,
  token,
  account,
  slug,
  version
}: {
  origin: string
  token: string
  account: string
  slug: string
  version: string
}): Promise<boolean> => {
  try {
    const response = await fetch(
      `${origin}/v1/stacks/${toScopedPath({ account, slug })}/versions/${encodeURIComponent(version)}`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(EXISTS_TIMEOUT_MS)
      }
    )
    await response.body?.cancel()
    return response.status === 200
  } catch {
    return false
  }
}

/**
 * POST the version + source tree in one atomic multipart request and parse
 * the returned StackVersion. The hub writes R2, computes the source content
 * identity, reconciles the composition, and returns the complete version.
 * Returns the version as the hub stored it. A 409 throws
 * {@link VersionExistsError}; a 2xx with an unreadable body throws
 * {@link StoredVersionUnreadableError}.
 *
 * Exported for tests.
 */
export const uploadVersion = async ({
  origin,
  token,
  account,
  slug,
  version,
  invocation,
  files
}: {
  origin: string
  token: string
  account: string
  slug: string
  version: string
  /** For the commands the failure messages suggest. */
  invocation: DeployInvocation
  files: SourceFile[]
}): Promise<{ version: string; upload: StackUpload }> => {
  if (files.length === 0) throw new Error('no source files to upload')

  const form = new FormData()
  form.append('version', version)
  for (const file of files) {
    // The hub reads each `files` part's filename as the path relative to the
    // project root (FormData sets `Content-Disposition: filename` from the
    // third argument).
    form.append('files', new Blob([file.bytes], { type: file.contentType }), file.path)
  }

  const response = await fetch(`${origin}/v1/stacks/${toScopedPath({ account, slug })}/versions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form
  })

  if (!response.ok) {
    const text = await response.text()
    if (response.status === 409) {
      throw new VersionExistsError(
        `${toVersionExistsMessage(version, invocation)} Hub said: ${text.slice(0, 500)}`
      )
    }
    throw new Error(`version upload failed (${response.status}): ${text.slice(0, 500)}`)
  }

  // A 2xx means the hub stored the version, whatever the body says.
  const unreadable = () =>
    new StoredVersionUnreadableError(
      `the hub stored version ${version} but answered with an unexpected payload. ` +
        `Run \`${toRetryCommand(invocation)}\` to deploy it.`
    )
  const payload: unknown = await response.json().catch(() => undefined)
  if (!isObject(payload)) throw unreadable()
  const storedVersion = payload['version']
  const versionUrl = payload['htmlUrl']
  const sourceHash = payload['sourceHash']
  const sourceField = payload['source']
  if (
    typeof storedVersion !== 'string' ||
    typeof versionUrl !== 'string' ||
    typeof sourceHash !== 'string' ||
    !isObject(sourceField)
  ) {
    throw unreadable()
  }
  const sourceFileCount = sourceField['fileCount']
  const sourceTotalBytes = sourceField['totalBytes']
  if (typeof sourceFileCount !== 'number' || typeof sourceTotalBytes !== 'number') {
    throw unreadable()
  }
  return {
    version: storedVersion,
    upload: { versionUrl, sourceHash, sourceFileCount, sourceTotalBytes }
  }
}

const isStatus = (value: unknown): value is StackServerStatus =>
  STACK_SERVER_STATUSES.some(status => status === value)

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

type DeployVersionOutcome =
  | { type: 'deployed'; deploy: StackDeploy }
  | { type: 'failed'; reason: string; stored: boolean }

/**
 * Deploy a stored version: `POST /v1/stacks/{account}/{slug}/servers` with
 * `{ version }` only, never `promote`. The route is idempotent, so a run
 * after a timeout deploys the same version again; while the first deploy is
 * still running, the hub answers 409.
 *
 * With `existing`, a 404 means the version is not stored: the advice is the
 * upload, without `--existing`.
 *
 * Exported for tests.
 */
export const deployVersion = async ({
  origin,
  token,
  account,
  slug,
  version,
  invocation,
  existing = false,
  timeoutMs = DEPLOY_TIMEOUT_MS
}: {
  origin: string
  token: string
  account: string
  slug: string
  version: string
  /** For the commands the failure messages suggest. */
  invocation: DeployInvocation
  existing?: boolean
  timeoutMs?: number
}): Promise<DeployVersionOutcome> => {
  try {
    const response = await fetch(`${origin}/v1/stacks/${toScopedPath({ account, slug })}/servers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ version }),
      signal: AbortSignal.timeout(timeoutMs)
    })

    if (!response.ok) {
      const { message, requestId } = await readApiError(response)
      const hubMessage =
        toSentence(message || 'the hub gave no reason') +
        (requestId ? ` (request id: ${requestId})` : '')
      const status = response.status
      if (status === 401 || status === 403) {
        return {
          type: 'failed',
          stored: true,
          reason:
            `Version ${version} is stored, but the hub refused the deploy (${status}): ` +
            `${hubMessage} The token needs the \`write:releases\` scope.`
        }
      }
      // The hub stores no such version for this stack.
      if (existing && status === 404) {
        return {
          type: 'failed',
          stored: false,
          reason:
            `The hub cannot deploy version ${version} (${status}): ${hubMessage} ` +
            `If the version is not stored yet, run \`${toRerunCommand(invocation)}\` without \`--existing\`.`
        }
      }
      // An earlier deploy of this version is still running.
      if (status === 409) {
        return {
          type: 'failed',
          stored: true,
          reason:
            `deploy failed (${status}): ${hubMessage} Version ${version} is stored and is still ` +
            `deploying. Wait a minute, then run \`${toRetryCommand(invocation)}\`.`
        }
      }
      // The version cannot deploy as it is.
      if ([400, 404, 422].includes(status)) {
        return {
          type: 'failed',
          stored: true,
          reason: `deploy failed (${status}): ${hubMessage} ${toStoredFixMessage(version, invocation)}`
        }
      }
      // Any other status says nothing about the version: deploy it again.
      return {
        type: 'failed',
        stored: true,
        reason:
          `deploy failed (${status}): ${hubMessage} Version ${version} is stored. ` +
          `Run \`${toRetryCommand(invocation)}\` to deploy it again.`
      }
    }

    const payload: unknown = await response.json().catch(rethrowTimeout)
    if (!isObject(payload) || !isStatus(payload['status'])) {
      return {
        type: 'failed',
        stored: true,
        reason:
          `the hub answered the deploy with an unexpected payload. Version ${version} is stored; ` +
          `check it on the hub, or run \`${toRetryCommand(invocation)}\` to deploy it again.`
      }
    }
    return {
      type: 'deployed',
      deploy: {
        status: payload['status'],
        statusReason: toNullableString(payload['statusReason']),
        endpointUrl: toNullableString(payload['endpointUrl']),
        url: toNullableString(payload['url'])
      }
    }
  } catch (err) {
    const lead = isTimeoutError(err)
      ? `deploy not confirmed: the hub did not answer within ${timeoutMs / 1000} s.`
      : `deploy not confirmed: cannot reach the hub at ${origin}: ${errorMessage(err)}.`
    return {
      type: 'failed',
      stored: true,
      reason:
        `${lead} Version ${version} is stored; it may still deploy. ` +
        `Run \`${toRetryCommand(invocation)}\` to deploy it again.`
    }
  }
}

export const deployHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  origin = HUB_HOSTS[DEFAULT_HUB_ENV].api,
  version: versionFlag,
  envFlag,
  existing = false,
  refreshLock = refreshProjectLock
}: DeployHeadlessArgs): Promise<DeployHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)
  // The flags a suggested command keeps: `--version` only when this run had it.
  const toInvocation = (version: string): DeployInvocation => ({
    projectName,
    version: versionFlag ? version : undefined,
    env: envFlag
  })
  const fail = (stage: DeployFailureStage, err: unknown, stored = false): DeployHeadlessResult => ({
    type: 'failed',
    projectName,
    reason: errorMessage(err),
    stage,
    stored
  })

  // Resolve the version first — before any network call — so a missing
  // version fails fast with the recipe.
  let version: string
  try {
    version = await resolveStackVersion({ projectPath: project.toPath(), versionFlag })
  } catch (err) {
    return fail('version', err)
  }

  // The stack identity is the project deno.json#name (@account/slug) — a stack
  // is a JSR-style package; the @account scope may be an org.
  let account: string
  let slug: string
  try {
    const stack = await resolveStackName(project.toPath())
    account = stack.account
    slug = stack.slug
  } catch (err) {
    return fail('identity', err)
  }

  let upload: StackUpload | null = null
  if (!existing) {
    if (await isVersionStored({ origin, token, account, slug, version })) {
      return fail('exists', toVersionExistsMessage(version, toInvocation(version)), true)
    }

    let files: SourceFile[]
    try {
      files = await collectSourceFiles(project.toPath())
      // Pre-flight what the hub will reject anyway, with the recipe attached:
      // deterministic resolution (and the single-@skmtc/core check) hang off
      // the lockfile, so an upload without one always 422s server-side.
      if (!files.some(file => file.path === 'deno.lock')) {
        throw new Error(
          `deno.lock not found in the upload — the hub requires it. Run \`${toProjectInstallCommand()}\` ` +
            `in the project (and make sure .skmtcignore does not exclude deno.lock), then run \`${toRerunCommand(toInvocation(version))}\` again.`
        )
      }
      // Without this pin the hub cannot build the version's server.
      if (await pinServerForPublish(project.toPath())) {
        await refreshLock(project.toPath())
        console.error(
          'Pinned @skmtc/server in deno.json so the hub can deploy this version. ' +
            'Commit deno.json and deno.lock.'
        )
        files = await collectSourceFiles(project.toPath())
      }
    } catch (err) {
      return fail('source', err)
    }

    try {
      const stored = await uploadVersion({
        origin,
        token,
        account,
        slug,
        version,
        invocation: toInvocation(version),
        files
      })
      // Deploy and report the version as the hub stored it.
      version = stored.version
      upload = stored.upload
    } catch (err) {
      if (err instanceof VersionExistsError) return fail('exists', err, true)
      return fail('upload', err, err instanceof StoredVersionUnreadableError)
    }
  }

  const deployed = await deployVersion({
    origin,
    token,
    account,
    slug,
    version,
    invocation: toInvocation(version),
    existing
  })
  if (deployed.type === 'failed') {
    return {
      type: 'failed',
      projectName,
      reason: deployed.reason,
      stage: 'deploy',
      stored: deployed.stored
    }
  }

  return {
    type: 'deployed',
    projectName,
    stack: { account, slug },
    version,
    upload,
    deploy: deployed.deploy
  }
}
