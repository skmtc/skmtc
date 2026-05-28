/**
 * Headless `deploy` path. Builds the split bundle (project bundle +
 * two runtime halves) and uploads everything to skmtc-hub.
 *
 * Flow (post-2026-05-29 Release → Deployment collapse):
 *   1. `bundleSplit(project)` →
 *        - `<project>/server.js`         (project bundle; @skmtc/{core,server} externalised)
 *        - `<project>/runtime/core.js`   (bundled @skmtc/core)
 *        - `<project>/runtime/server.js` (bundled @skmtc/server; @skmtc/core externalised)
 *      Reads pinned `@skmtc/server` version from project deno.json.
 *   2. `GET /v1/runtimes/{serverVersion}` to check if the runtime is
 *      already materialised on the hub. 404 → PUT both halves; 200 →
 *      reuse.
 *   3. `POST /v1/stacks/{account}/{stack}/deployments` with
 *      `{ runtimeServerVersion }`. Hub allocates a UUID + an 8-char
 *      `shortId` and returns the metadata-only Deployment row.
 *   4. `POST /v1/stacks/{account}/{stack}/deployments/{shortId}/bundle`
 *      with multipart `bundle` part — persists the bundle to R2 and
 *      stamps `bundle_*` on the deployment row.
 *   5. `POST /v1/stacks/{account}/{stack}/deployments/{shortId}/source`
 *      with multipart `files` parts — writes the source tree to R2,
 *      reconciles `stack_generator_refs` from the uploaded `deno.json`.
 *
 * Each deploy creates a NEW immutable deployment. The user (or `skmtc
 * deploy --production`, when added) decides which deployment holds
 * the `production` alias on its stack — there is no semver, and no
 * implicit "publish" the deploy command does.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { bundleSplit, type BundleSplitResult } from '@/lib/bundle-split.ts'
import { collectSourceFiles, uploadSource } from '@/lib/source-upload.ts'

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
      /** Canonical deployment id — the UUID the hub allocated. */
      deploymentId: string
      /** Short 8-char form derived from the UUID; human-addressable. */
      shortId: string
      /** Canonical SPA URL for the deployment. */
      deploymentUrl: string
      runtimeServerVersion: string
      runtimeUploaded: boolean
      sourceFileCount: number
      sourceTotalBytes: number
    }
  | {
      kind: 'failed'
      projectName: string
      reason: string
      stage:
        | 'identity'
        | 'bundle'
        | 'runtime-check'
        | 'runtime-upload'
        | 'deployment-create'
        | 'bundle-upload'
        | 'source-upload'
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
 * Probe `GET /v1/runtimes/{serverVersion}`. 200 → runtime is
 * materialised on the hub and we skip the upload. 404 → upload both
 * halves. Anything else → fail loudly so misconfigured hubs don't
 * silently re-upload 1.2 MB on every deploy.
 */
const checkRuntimeExists = async ({
  hubUrl,
  token,
  serverVersion
}: {
  hubUrl: string
  token: string
  serverVersion: string
}): Promise<boolean> => {
  const response = await fetch(`${hubUrl}/v1/runtimes/${serverVersion}`, {
    method: 'GET',
    headers: { 'authorization': `Bearer ${token}` }
  })
  if (response.ok) {
    await response.text()
    return true
  }
  if (response.status === 404) {
    await response.text()
    return false
  }
  const text = await response.text()
  throw new Error(
    `runtime check failed (${response.status}): ${text.slice(0, 500)}`
  )
}

const putRuntimeHalf = async ({
  hubUrl,
  token,
  serverVersion,
  half,
  bytes
}: {
  hubUrl: string
  token: string
  serverVersion: string
  half: 'core.js' | 'server.js'
  bytes: ArrayBuffer
}): Promise<void> => {
  const response = await fetch(`${hubUrl}/v1/runtimes/${serverVersion}/${half}`, {
    method: 'PUT',
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/javascript'
    },
    body: bytes
  })
  if (!response.ok) {
    const text = await response.text()
    if (response.status === 409) {
      throw new Error(
        `runtime ${serverVersion}/${half} conflicts with already-uploaded bytes ` +
          `(409): ${text.slice(0, 300)}. ` +
          `This means a previous deploy uploaded a runtime under the same ` +
          `@skmtc/server@${serverVersion} version with different bytes. ` +
          `Either delete the existing runtime on the hub or pin a new ` +
          `@skmtc/server version in deno.json.`
      )
    }
    throw new Error(
      `runtime ${half} upload failed (${response.status}): ${text.slice(0, 500)}`
    )
  }
  await response.text()
}

const uploadRuntime = async ({
  hubUrl,
  token,
  serverVersion,
  runtimeCorePath,
  runtimeServerPath
}: {
  hubUrl: string
  token: string
  serverVersion: string
  runtimeCorePath: string
  runtimeServerPath: string
}): Promise<void> => {
  const [coreBytes, serverBytes] = await Promise.all([
    readArrayBuffer(runtimeCorePath),
    readArrayBuffer(runtimeServerPath)
  ])
  await putRuntimeHalf({ hubUrl, token, serverVersion, half: 'core.js', bytes: coreBytes })
  await putRuntimeHalf({ hubUrl, token, serverVersion, half: 'server.js', bytes: serverBytes })
}

/**
 * Read a file into a fresh `ArrayBuffer`. `Deno.readFile` returns
 * `Uint8Array<ArrayBufferLike>` whose underlying buffer might be a
 * `SharedArrayBuffer`, which fetch bodies reject. Copy into a
 * non-shared `ArrayBuffer` to narrow the type and avoid accidentally
 * shared memory across fetches.
 */
const readArrayBuffer = async (path: string): Promise<ArrayBuffer> => {
  const u8 = await Deno.readFile(path)
  const buf = new ArrayBuffer(u8.byteLength)
  new Uint8Array(buf).set(u8)
  return buf
}

/**
 * POST the deployment metadata row with `runtimeServerVersion`.
 * Returns the allocated id / shortId / htmlUrl.
 */
const createDeployment = async ({
  hubUrl,
  token,
  account,
  slug,
  runtimeServerVersion
}: {
  hubUrl: string
  token: string
  account: string
  slug: string
  runtimeServerVersion: string
}): Promise<{ deploymentId: string; shortId: string; deploymentUrl: string }> => {
  const response = await fetch(`${hubUrl}/v1/stacks/${account}/${slug}/deployments`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ runtimeServerVersion })
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`deployment POST failed (${response.status}): ${text.slice(0, 500)}`)
  }
  const payload: unknown = await response.json()
  if (!isObject(payload)) throw new Error('hub returned non-object payload')
  const deploymentId = payload['id']
  const shortId = payload['shortId']
  const deploymentUrl = payload['htmlUrl']
  if (
    typeof deploymentId !== 'string' ||
    typeof shortId !== 'string' ||
    typeof deploymentUrl !== 'string'
  ) {
    throw new Error('hub deployment payload had unexpected shape')
  }
  return { deploymentId, shortId, deploymentUrl }
}

const uploadBundle = async ({
  hubUrl,
  token,
  account,
  slug,
  shortId,
  bundle
}: {
  hubUrl: string
  token: string
  account: string
  slug: string
  shortId: string
  bundle: ArrayBuffer
}): Promise<{ bytes: number; sha256: string }> => {
  const form = new FormData()
  form.append('bundle', new Blob([bundle], { type: 'application/javascript' }), 'server.js')

  const response = await fetch(
    `${hubUrl}/v1/stacks/${account}/${slug}/deployments/${shortId}/bundle`,
    {
      method: 'POST',
      headers: { 'authorization': `Bearer ${token}` },
      body: form
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`bundle upload failed (${response.status}): ${text.slice(0, 500)}`)
  }

  const payload: unknown = await response.json()
  if (!isObject(payload)) throw new Error('hub returned non-object payload')
  const bundleField = payload['bundle']
  if (!isObject(bundleField)) throw new Error('hub response missing bundle field')
  const bytes = bundleField['bytes']
  const sha256 = bundleField['sha256']
  if (typeof bytes !== 'number' || typeof sha256 !== 'string') {
    throw new Error('hub bundle payload had unexpected shape')
  }
  return { bytes, sha256 }
}

export const deployHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  hubUrl = DEFAULT_HUB_URL
}: DeployHeadlessArgs): Promise<DeployHeadlessResult> => {
  // The stack identity is `<authenticated handle>/<project>`. There
  // is no account/slug choice here: the PAT picks one, the project
  // name is the slug.
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

  let split: BundleSplitResult
  try {
    split = await bundleSplit({ project })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'bundle'
    }
  }

  let runtimeAlreadyExists: boolean
  try {
    runtimeAlreadyExists = await checkRuntimeExists({
      hubUrl,
      token,
      serverVersion: split.serverVersion
    })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'runtime-check'
    }
  }

  if (!runtimeAlreadyExists) {
    try {
      await uploadRuntime({
        hubUrl,
        token,
        serverVersion: split.serverVersion,
        runtimeCorePath: split.runtimeCorePath,
        runtimeServerPath: split.runtimeServerPath
      })
    } catch (err) {
      return {
        kind: 'failed',
        projectName,
        reason: err instanceof Error ? err.message : String(err),
        stage: 'runtime-upload'
      }
    }
  }

  let deployment: { deploymentId: string; shortId: string; deploymentUrl: string }
  try {
    deployment = await createDeployment({
      hubUrl,
      token,
      account,
      slug,
      runtimeServerVersion: split.serverVersion
    })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'deployment-create'
    }
  }

  let bundleBuffer: ArrayBuffer
  try {
    bundleBuffer = await readArrayBuffer(split.projectBundlePath)
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'bundle-upload'
    }
  }

  let bundleResult: { bytes: number; sha256: string }
  try {
    bundleResult = await uploadBundle({
      hubUrl,
      token,
      account,
      slug,
      shortId: deployment.shortId,
      bundle: bundleBuffer
    })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'bundle-upload'
    }
  }

  let sourceResult: { fileCount: number; totalBytes: number }
  try {
    const files = await collectSourceFiles(project.toPath())
    sourceResult = await uploadSource({
      hubUrl,
      token,
      account,
      slug,
      shortId: deployment.shortId,
      files
    })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'source-upload'
    }
  }

  return {
    kind: 'deployed',
    projectName,
    bundlePath: split.projectBundlePath,
    bundleBytes: bundleResult.bytes,
    bundleSha256: bundleResult.sha256,
    stack: { account, slug },
    deploymentId: deployment.deploymentId,
    shortId: deployment.shortId,
    deploymentUrl: deployment.deploymentUrl,
    runtimeServerVersion: split.serverVersion,
    runtimeUploaded: !runtimeAlreadyExists,
    sourceFileCount: sourceResult.fileCount,
    sourceTotalBytes: sourceResult.totalBytes
  }
}
