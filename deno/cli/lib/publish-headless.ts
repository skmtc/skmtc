/**
 * Headless `publish` path. Uploads the project SOURCE TREE in one atomic
 * multipart request, publishing a new immutable version of the stack package.
 * Source is the deliverable: the hub deploys it directly as a Deno Deploy app
 * (synthesizing the `server.ts` entry itself) — there is no compiled bundle
 * (hub plan-2026-07-30-stacks-on-deno-deploy, phase-4 switch).
 *
 * Flow:
 *   1. Resolve the version to publish — the `--version` flag wins, otherwise
 *      the project root `deno.json#version`. No version → fail before any
 *      network call. Versions are immutable; the hub returns `409` when the
 *      semver is already published.
 *   2. `resolveAccountHandle` — the PAT resolves to the stack account; the
 *      project name is the stack slug. Stack identity is `<handle>/<project>`.
 *   3. `collectSourceFiles(project)` — the user-authored source tree, filtered
 *      by built-in defaults + the project's optional `.skmtcignore`. The hub
 *      REQUIRES `deno.lock` in the upload (deterministic resolution + the
 *      single-`@skmtc/core` check happen at publish, where the author is
 *      watching).
 *   4. `POST /v1/stacks/{account}/{stack}/versions` (multipart) with the
 *      `version` part + one `files` part per source file. The hub writes the
 *      source to R2, computes the content identity (`sourceHash`), reconciles
 *      the stack's generator composition from the uploaded `deno.json`, and
 *      returns the complete StackVersion. Atomic — no intermediate state.
 *
 * Versions are addressed by semver — there is no deployment id, shortId, or
 * `production` alias here. Deployments (and the alias) belong to *projects*
 * and are driven from the web app, not the CLI.
 */

import { join } from '@std/path/join'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { collectSourceFiles, type SourceFile } from '@/lib/source-upload.ts'
import { parseScopedName } from '@/lib/scoped-name.ts'
import { toProjectInstallCommand } from '@/lib/dependency-age.ts'

type PublishHeadlessArgs = {
  skmtcRoot: SkmtcRoot
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
}

export type PublishHeadlessResult =
  | {
      type: 'published'
      projectName: string
      /** Content identity of the uploaded source tree (sha256 hex). */
      sourceHash: string
      stack: { account: string; slug: string }
      /** The published semver. */
      version: string
      /** Canonical SPA URL for the published version. */
      versionUrl: string
      sourceFileCount: number
      sourceTotalBytes: number
    }
  | {
      type: 'failed'
      projectName: string
      reason: string
      stage: 'version' | 'identity' | 'source' | 'publish'
    }

const DEFAULT_ORIGIN = 'https://api.skmtc.dev'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Read the project root `deno.json#version`, or `undefined` when the file
 * is missing, unparseable, or carries no usable `version` string. The
 * caller turns `undefined` into the recipe-style "set a version" failure.
 */
const readProjectVersion = async (projectPath: string): Promise<string | undefined> => {
  try {
    const contents = await Deno.readTextFile(join(projectPath, 'deno.json'))
    const parsed: unknown = JSON.parse(contents)
    if (!isObject(parsed)) return undefined
    const version = parsed['version']
    return typeof version === 'string' ? version : undefined
  } catch {
    return undefined
  }
}

/**
 * Read the project root `deno.json#name` (the stack's JSR-style package name),
 * or `undefined` when the file is missing, unparseable, or has no `name`. The
 * caller turns `undefined`/unscoped into the recipe-style "set a name" failure.
 */
const readProjectName = async (projectPath: string): Promise<string | undefined> => {
  try {
    const contents = await Deno.readTextFile(join(projectPath, 'deno.json'))
    const parsed: unknown = JSON.parse(contents)
    if (!isObject(parsed)) return undefined
    const name = parsed['name']
    return typeof name === 'string' ? name : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the version to publish: the `--version` flag wins, then the
 * project root `deno.json#version`. Both are trimmed; empty values count
 * as missing. Throws when neither source yields a version — publishing
 * never invents or auto-bumps a semver (the hub rejects duplicates with
 * `409`, which we surface verbatim).
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

  const fromDenoJson = (await readProjectVersion(projectPath))?.trim()
  if (fromDenoJson) return fromDenoJson

  throw new Error(
    "no version to publish — set a `version` in the project's deno.json or pass --version <semver>"
  )
}

/**
 * Resolve the stack identity from the project root `deno.json#name` — a stack is
 * a JSR-style package, so its identity is its package name `@account/slug` (the
 * `@account` scope may be an org). Throws the recipe when the name is missing or
 * not a scoped name; publishing never falls back to the authenticated handle.
 *
 * Exported for tests.
 */
export const resolveStackName = async (
  projectPath: string
): Promise<{ account: string; slug: string }> => {
  const name = (await readProjectName(projectPath))?.trim()
  const parsed = name ? parseScopedName(name) : null
  if (!parsed) {
    throw new Error(
      'no stack name to publish to — set `name` to "@account/slug" in the project deno.json'
    )
  }
  return parsed
}

type StackVersionResponse = {
  version: string
  versionUrl: string
  sourceHash: string
  sourceFileCount: number
  sourceTotalBytes: number
}

/**
 * POST the version + source tree in one atomic multipart request and parse
 * the returned StackVersion. The hub writes R2, computes the source content
 * identity, reconciles the composition, and returns the complete version.
 *
 * Exported for tests.
 */
export const publishVersion = async ({
  origin,
  token,
  account,
  slug,
  version,
  files
}: {
  origin: string
  token: string
  account: string
  slug: string
  version: string
  files: SourceFile[]
}): Promise<StackVersionResponse> => {
  if (files.length === 0) throw new Error('no source files to upload')

  const form = new FormData()
  form.append('version', version)
  for (const file of files) {
    // The hub reads each `files` part's filename as the path relative to the
    // project root (FormData sets `Content-Disposition: filename` from the
    // third argument).
    form.append('files', new Blob([file.bytes], { type: file.contentType }), file.path)
  }

  const response = await fetch(`${origin}/v1/stacks/${account}/${slug}/versions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form
  })

  if (!response.ok) {
    const text = await response.text()
    if (response.status === 409) {
      throw new Error(
        `version ${version} is already published for ${account}/${slug} — versions are ` +
          `immutable. Bump the version in the project's deno.json (or pass a new ` +
          `--version) and re-publish. Hub said: ${text.slice(0, 500)}`
      )
    }
    throw new Error(`version publish failed (${response.status}): ${text.slice(0, 500)}`)
  }

  const payload: unknown = await response.json()
  if (!isObject(payload)) throw new Error('hub returned non-object payload')
  const publishedVersion = payload['version']
  const versionUrl = payload['htmlUrl']
  const sourceHash = payload['sourceHash']
  const sourceField = payload['source']
  if (
    typeof publishedVersion !== 'string' ||
    typeof versionUrl !== 'string' ||
    typeof sourceHash !== 'string' ||
    !isObject(sourceField)
  ) {
    throw new Error('hub stack version payload had unexpected shape')
  }
  const sourceFileCount = sourceField['fileCount']
  const sourceTotalBytes = sourceField['totalBytes']
  if (typeof sourceFileCount !== 'number' || typeof sourceTotalBytes !== 'number') {
    throw new Error('hub stack version payload had unexpected source shape')
  }
  return {
    version: publishedVersion,
    versionUrl,
    sourceHash,
    sourceFileCount,
    sourceTotalBytes
  }
}

export const publishHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  origin = DEFAULT_ORIGIN,
  version: versionFlag
}: PublishHeadlessArgs): Promise<PublishHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)

  // Resolve the version first — before any network call — so a missing
  // version fails fast with the recipe instead of after a bundle build.
  let version: string
  try {
    version = await resolveStackVersion({
      projectPath: project.toPath(),
      versionFlag
    })
  } catch (err) {
    return {
      type: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'version'
    }
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
    return {
      type: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'identity'
    }
  }

  let files: SourceFile[]
  try {
    files = await collectSourceFiles(project.toPath())
    // Pre-flight what the hub will reject anyway, with the recipe attached:
    // deterministic resolution (and the single-@skmtc/core check) hang off
    // the lockfile, so publishing without one always 422s server-side.
    if (!files.some(file => file.path === 'deno.lock')) {
      throw new Error(
        `deno.lock not found in the upload — the hub requires it. Run \`${toProjectInstallCommand()}\` ` +
          'in the project (and make sure .skmtcignore does not exclude deno.lock), then re-publish.'
      )
    }
  } catch (err) {
    return {
      type: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'source'
    }
  }

  let published: StackVersionResponse
  try {
    published = await publishVersion({
      origin,
      token,
      account,
      slug,
      version,
      files
    })
  } catch (err) {
    return {
      type: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'publish'
    }
  }

  return {
    type: 'published',
    projectName,
    sourceHash: published.sourceHash,
    stack: { account, slug },
    version: published.version,
    versionUrl: published.versionUrl,
    sourceFileCount: published.sourceFileCount,
    sourceTotalBytes: published.sourceTotalBytes
  }
}
