/**
 * Headless `deploy` path — generates the CF-Workers `server.js`
 * bundle for a project and uploads it to skmtc-hub as the release's
 * bundle artifact. Strict mode invokes this directly.
 *
 * The flow:
 *   1. `bundleServer(project)` → `<project>/server.js`.
 *   2. `POST /v1/stacks/{account}/{stack}/releases` (if not already
 *      created) — records the release row in `publishing` status.
 *   3. `POST /v1/stacks/{account}/{stack}/releases/{version}/bundle`
 *      with multipart form — stores `server.js` in R2 and flips the
 *      release row to `published`.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { bundleServer } from '@/lib/bundle-server.ts'

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
    }
  | {
      kind: 'failed'
      projectName: string
      reason: string
      stage: 'bundle' | 'release-create' | 'bundle-upload'
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
 * POST the release row. Returns `'created'` on 2xx, `'conflict'` if a
 * release with this version already exists, otherwise throws.
 */
const ensureRelease = async ({
  hubUrl,
  token,
  account,
  slug,
  version,
  notes
}: {
  hubUrl: string
  token: string
  account: string
  slug: string
  version: string
  notes: string
}): Promise<'created' | 'conflict'> => {
  const response = await fetch(
    `${hubUrl}/v1/stacks/${account}/${slug}/releases`,
    {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        version,
        targets: ['private'],
        sourceRunId: 'cli-deploy',
        notes
      })
    }
  )
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
  form.append(
    'bundle',
    new Blob([bundle], { type: 'application/javascript' }),
    'server.js'
  )

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

  let bundlePath: string
  try {
    bundlePath = await bundleServer({ project })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'bundle'
    }
  }

  try {
    await ensureRelease({ hubUrl, token, account, slug, version, notes })
  } catch (err) {
    return {
      kind: 'failed',
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: 'release-create'
    }
  }

  // Deno.readFile returns `Uint8Array<ArrayBufferLike>` which TS won't
  // accept as a `Blob` part (because `ArrayBufferLike` might be
  // `SharedArrayBuffer`). Copy into a fresh `ArrayBuffer` so the type
  // narrows cleanly and we never accidentally share memory.
  const bundleU8 = await Deno.readFile(bundlePath)
  const bundleBuffer = new ArrayBuffer(bundleU8.byteLength)
  new Uint8Array(bundleBuffer).set(bundleU8)
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
      bundlePath,
      bundleBytes: bytes,
      bundleSha256: sha256,
      stack: { account, slug },
      version,
      releaseUrl
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
