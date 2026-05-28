/**
 * Headless `deploy` path. Builds the split bundle (project bundle +
 * two runtime halves) and uploads everything to skmtc-hub.
 *
 * Flow:
 *   1. `bundleSplit(project)` →
 *        - `<project>/server.js`         (project bundle; @skmtc/{core,server} externalised)
 *        - `<project>/runtime/core.js`   (bundled @skmtc/core)
 *        - `<project>/runtime/server.js` (bundled @skmtc/server; @skmtc/core externalised)
 *      Reads pinned `@skmtc/server` version from project deno.json.
 *   2. `GET /v1/runtimes/{serverVersion}` to check if the runtime is
 *      already materialised on the hub. 404 → PUT both halves; 200 →
 *      reuse.
 *   3. `POST /v1/stacks/{account}/{stack}/releases` with
 *      `runtimeServerVersion` declared in the JSON body. Hub validates
 *      the runtime exists in R2 before accepting; 409 if release row
 *      exists already (idempotent re-deploy of same version).
 *   4. `POST /v1/stacks/{account}/{stack}/releases/{version}/bundle`
 *      with multipart bundle — stores `server.js` in R2 and flips the
 *      release row to `published`.
 *
 * The runtime is hub-platform infrastructure shared across releases.
 * Subsequent deploys of new versions pinning the same `@skmtc/server`
 * skip step 2's upload — the GET returns 200 and we proceed to step 3.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { bundleSplit, type BundleSplitResult } from '@/lib/bundle-split.ts'

type DeployHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  /** Hub stack target — `account/stack`. */
  stack: string
  /** Release semver. */
  version: string
  /** Personal access token. */
  token: string
  /** Hub base URL — defaults to https://api.skmtc.dev. */
  hubUrl?: string
  /** Optional notes for the release. */
  notes?: string
}

export type DeployHeadlessResult =
  | {
      kind: 'deployed'
      projectName: string
      bundlePath: string
      bundleBytes: number
      bundleSha256: string
      stack: { account: string; slug: string }
      version: string
      releaseUrl: string
      runtimeServerVersion: string
      runtimeUploaded: boolean
    }
  | {
      kind: 'failed'
      projectName: string
      reason: string
      stage: 'bundle' | 'runtime-check' | 'runtime-upload' | 'release-create' | 'bundle-upload'
    }

const DEFAULT_HUB_URL = 'https://api.skmtc.dev'

const splitStack = (stack: string): { account: string; slug: string } => {
  const parts = stack.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`--stack must be of the form "account/slug" (got "${stack}")`)
  }
  return { account: parts[0], slug: parts[1] }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
    // Drain the body so the connection can be reused.
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
  // Drain the response so the connection can be reused.
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
 * POST the release row with `runtimeServerVersion`. Returns
 * `'created'` on 2xx, `'conflict'` if a release with this version
 * already exists (idempotent re-deploy), otherwise throws.
 */
const ensureRelease = async ({
  hubUrl,
  token,
  account,
  slug,
  version,
  runtimeServerVersion,
  notes
}: {
  hubUrl: string
  token: string
  account: string
  slug: string
  version: string
  runtimeServerVersion: string
  notes: string
}): Promise<'created' | 'conflict'> => {
  const response = await fetch(`${hubUrl}/v1/stacks/${account}/${slug}/releases`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      version,
      runtimeServerVersion,
      targets: ['private'],
      sourceRunId: 'cli-deploy',
      notes
    })
  })
  if (response.ok) return 'created'
  if (response.status === 409) return 'conflict'
  const text = await response.text()
  throw new Error(`release POST failed (${response.status}): ${text.slice(0, 500)}`)
}

const uploadBundle = async ({
  hubUrl,
  token,
  account,
  slug,
  version,
  bundle
}: {
  hubUrl: string
  token: string
  account: string
  slug: string
  version: string
  bundle: ArrayBuffer
}): Promise<{ bytes: number; sha256: string; releaseUrl: string }> => {
  const form = new FormData()
  form.append('bundle', new Blob([bundle], { type: 'application/javascript' }), 'server.js')

  const response = await fetch(
    `${hubUrl}/v1/stacks/${account}/${slug}/releases/${version}/bundle`,
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
  const url = payload['url']
  if (typeof bytes !== 'number' || typeof sha256 !== 'string' || typeof url !== 'string') {
    throw new Error('hub bundle payload had unexpected shape')
  }
  return { bytes, sha256, releaseUrl: url }
}

export const deployHeadless = async ({
  skmtcRoot,
  projectName,
  stack,
  version,
  token,
  hubUrl = DEFAULT_HUB_URL,
  notes = ''
}: DeployHeadlessArgs): Promise<DeployHeadlessResult> => {
  const { account, slug } = splitStack(stack)
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

  try {
    await ensureRelease({
      hubUrl,
      token,
      account,
      slug,
      version,
      runtimeServerVersion: split.serverVersion,
      notes
    })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'release-create'
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

  try {
    const { bytes, sha256, releaseUrl } = await uploadBundle({
      hubUrl,
      token,
      account,
      slug,
      version,
      bundle: bundleBuffer
    })
    return {
      kind: 'deployed',
      projectName,
      bundlePath: split.projectBundlePath,
      bundleBytes: bytes,
      bundleSha256: sha256,
      stack: { account, slug },
      version,
      releaseUrl,
      runtimeServerVersion: split.serverVersion,
      runtimeUploaded: !runtimeAlreadyExists
    }
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'bundle-upload'
    }
  }
}
