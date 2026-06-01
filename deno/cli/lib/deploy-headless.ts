/**
 * Headless `deploy` path. Builds the single self-contained bundle and uploads
 * it together with the project source in ONE atomic multipart request.
 *
 * Flow:
 *   1. `resolveAccountHandle` — the PAT resolves to the stack account; the
 *      project name is the stack slug. Stack identity is `<handle>/<project>`.
 *   2. `bundleDeploy(project)` → `<project>/server.js` — one self-contained
 *      bundle (generators + `createServer` + `@skmtc/core` + `@skmtc/server`,
 *      nothing external).
 *   3. `collectSourceFiles(project)` — the user-authored source tree, filtered
 *      by built-in defaults + the project's optional `.skmtcignore`.
 *   4. `POST /v1/stacks/{account}/{stack}/deployments` (multipart) with the
 *      `bundle` part + one `files` part per source file. The hub allocates the
 *      id + shortId, writes bundle + source to R2, reconciles the stack's
 *      generator composition from the uploaded `deno.json`, and returns the
 *      complete Deployment. There is no metadata-only intermediate state — the
 *      deploy is atomic.
 *
 * Each deploy creates a NEW immutable deployment. The user (or `skmtc deploy
 * --production`, when added) decides which deployment holds the `production`
 * alias — there is no semver, and no implicit "publish".
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { bundleDeploy } from '@/lib/bundle-deploy.ts'
import { collectSourceFiles, type SourceFile } from '@/lib/source-upload.ts'

type DeployHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  /** Personal access token. */
  token: string
  /** Hub base URL — defaults to https://api.skmtc.dev. */
  hubUrl?: string
}

export type DeployHeadlessResult =
  | {
      kind: 'deployed'
      projectName: string
      bundlePath: string
      bundleBytes: number
      bundleSha256: string
      stack: { account: string; slug: string }
      /** Canonical deployment id the hub allocated. */
      deploymentId: string
      /** Short 8-char form; human-addressable. */
      shortId: string
      /** Canonical SPA URL for the deployment. */
      deploymentUrl: string
      sourceFileCount: number
      sourceTotalBytes: number
    }
  | {
      kind: 'failed'
      projectName: string
      reason: string
      stage: 'identity' | 'bundle' | 'deploy'
    }

const DEFAULT_HUB_URL = 'https://api.skmtc.dev'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Resolve the authenticated user's handle from the PAT. The hub's
 * `GET /v1/user` returns `AuthenticatedUser` whose `handle` is the
 * `account` segment of every stack URL the user can deploy to.
 *
 * `deploy` uses this to construct the stack identity from the project
 * name alone — a stack's identity is `<authenticated handle>/<project>`.
 * Org-owned stacks aren't reachable from `skmtc deploy` today.
 */
const resolveAccountHandle = async ({
  hubUrl,
  token
}: {
  hubUrl: string
  token: string
}): Promise<string> => {
  const response = await fetch(`${hubUrl}/v1/user`, {
    method: 'GET',
    headers: { 'authorization': `Bearer ${token}` }
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`identity lookup failed (${response.status}): ${text.slice(0, 500)}`)
  }
  const payload: unknown = await response.json()
  if (!isObject(payload)) throw new Error('hub returned non-object identity payload')
  const handle = payload['handle']
  if (typeof handle !== 'string' || handle.length === 0) {
    throw new Error('hub identity payload missing `handle`')
  }
  return handle
}

/**
 * Read a file into a fresh `ArrayBuffer`. `Deno.readFile` returns
 * `Uint8Array<ArrayBufferLike>` whose underlying buffer might be a
 * `SharedArrayBuffer`, which fetch bodies reject. Copy into a
 * non-shared `ArrayBuffer`.
 */
const readArrayBuffer = async (path: string): Promise<ArrayBuffer> => {
  const u8 = await Deno.readFile(path)
  const buf = new ArrayBuffer(u8.byteLength)
  new Uint8Array(buf).set(u8)
  return buf
}

type DeploymentResponse = {
  deploymentId: string
  shortId: string
  deploymentUrl: string
  bundleBytes: number
  bundleSha256: string
  sourceFileCount: number
  sourceTotalBytes: number
}

/**
 * POST the bundle + source tree in one atomic multipart request and parse the
 * returned Deployment. The hub allocates id/shortId, writes R2, reconciles the
 * composition, and returns the complete row (bundle + source populated).
 */
const createDeployment = async ({
  hubUrl,
  token,
  account,
  slug,
  bundle,
  files
}: {
  hubUrl: string
  token: string
  account: string
  slug: string
  bundle: ArrayBuffer
  files: SourceFile[]
}): Promise<DeploymentResponse> => {
  if (files.length === 0) throw new Error('no source files to upload')

  const form = new FormData()
  form.append('bundle', new Blob([bundle], { type: 'application/javascript' }), 'server.js')
  for (const file of files) {
    // The hub reads each `files` part's filename as the path relative to the
    // project root (FormData sets `Content-Disposition: filename` from the
    // third argument).
    form.append('files', new Blob([file.bytes], { type: file.contentType }), file.path)
  }

  const response = await fetch(`${hubUrl}/v1/stacks/${account}/${slug}/deployments`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${token}` },
    body: form
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`deployment create failed (${response.status}): ${text.slice(0, 500)}`)
  }

  const payload: unknown = await response.json()
  if (!isObject(payload)) throw new Error('hub returned non-object payload')
  const deploymentId = payload['id']
  const shortId = payload['shortId']
  const deploymentUrl = payload['htmlUrl']
  const bundleField = payload['bundle']
  const sourceField = payload['source']
  if (
    typeof deploymentId !== 'string' ||
    typeof shortId !== 'string' ||
    typeof deploymentUrl !== 'string' ||
    !isObject(bundleField) ||
    !isObject(sourceField)
  ) {
    throw new Error('hub deployment payload had unexpected shape')
  }
  const bundleBytes = bundleField['bytes']
  const bundleSha256 = bundleField['sha256']
  const sourceFileCount = sourceField['fileCount']
  const sourceTotalBytes = sourceField['totalBytes']
  if (
    typeof bundleBytes !== 'number' ||
    typeof bundleSha256 !== 'string' ||
    typeof sourceFileCount !== 'number' ||
    typeof sourceTotalBytes !== 'number'
  ) {
    throw new Error('hub deployment payload had unexpected bundle/source shape')
  }
  return {
    deploymentId,
    shortId,
    deploymentUrl,
    bundleBytes,
    bundleSha256,
    sourceFileCount,
    sourceTotalBytes
  }
}

export const deployHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  hubUrl = DEFAULT_HUB_URL
}: DeployHeadlessArgs): Promise<DeployHeadlessResult> => {
  // The stack identity is `<authenticated handle>/<project>`. There is no
  // account/slug choice: the PAT picks the account, the project name is the slug.
  let account: string
  try {
    account = await resolveAccountHandle({ hubUrl, token })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'identity'
    }
  }
  const slug = projectName
  const project = skmtcRoot.findProject(projectName)

  let bundlePath: string
  let bundleBuffer: ArrayBuffer
  let files: SourceFile[]
  try {
    const built = await bundleDeploy({ project })
    bundlePath = built.projectBundlePath
    bundleBuffer = await readArrayBuffer(bundlePath)
    files = await collectSourceFiles(project.toPath())
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'bundle'
    }
  }

  let deployment: DeploymentResponse
  try {
    deployment = await createDeployment({
      hubUrl,
      token,
      account,
      slug,
      bundle: bundleBuffer,
      files
    })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'deploy'
    }
  }

  return {
    kind: 'deployed',
    projectName,
    bundlePath,
    bundleBytes: deployment.bundleBytes,
    bundleSha256: deployment.bundleSha256,
    stack: { account, slug },
    deploymentId: deployment.deploymentId,
    shortId: deployment.shortId,
    deploymentUrl: deployment.deploymentUrl,
    sourceFileCount: deployment.sourceFileCount,
    sourceTotalBytes: deployment.sourceTotalBytes
  }
}
