/**
 * Headless `project create` / `project rm` — manage a hub project built from the
 * local setup.
 *
 * `create <name>` is **create-only** (never updates an existing project — that's
 * `push`, which confirms before overwriting). It composes existing hub endpoints:
 *   1. Stack  — `deno.json#name` (must already be published via `skmtc publish`).
 *   2. API    — `client.json#api` if set, adding a file `client.json#source` to it
 *               as a revision (`/v1/apis/{account}/{api}/revisions`, a no-op when
 *               unchanged); else register `client.json#source` (`/v1/apis/upload`
 *               for a file, `/v1/apis/import` for a URL) and write the resulting
 *               `@account/slug` back into `client.json#api`.
 *   3. Project — `POST /v1/projects` binding the two. A 409 means it already
 *               exists → we STOP (no silent overwrite).
 *   4. Seed    — `PUT …/client-config` (+ `…/preview/base-files` with --base-files).
 *
 * `rm <name>` deletes the project (`admin:resource` scope).
 */

import { join } from '@std/path/join'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { parseScopedName } from '@/lib/scoped-name.ts'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const arrayLen = (value: unknown): number => (Array.isArray(value) ? value.length : 0)

type Scoped = { account: string; slug: string }

/** Read the project root `deno.json#name` (the stack's package name). */
async function readStackName(projectPath: string): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await Deno.readTextFile(join(projectPath, 'deno.json')))
    return isObject(parsed) && typeof parsed.name === 'string' ? parsed.name : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the new project's `@account/slug` from the `<name>` arg: a bare slug
 * inherits the stack's account, a scoped `@account/slug` is used verbatim.
 */
function resolveNewProject(name: string, stackAccount: string): Scoped | undefined {
  if (name.includes('/')) return parseScopedName(name) ?? undefined
  const slug = name.trim()
  return slug ? { account: stackAccount, slug } : undefined
}

type CreateArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  name: string
  token: string
  origin: string
  /** Exact stack version to pin; defaults to `latest`. */
  stackVersion?: string
  visibility?: 'public' | 'private'
  baseFiles?: Record<string, string>
}

export type CreateResult =
  | {
      type: 'created'
      projectName: string
      project: Scoped
      origin: string
      stack: string
      api: Scoped
      /** Whether the API was registered now (vs taken from client.json#api). */
      apiRegistered: boolean
      enrichmentCount: number
      baseFilesPushed?: number
      /** Whether `api`/`project` were written back into client.json. */
      remoteWritten: boolean
      url?: string
    }
  | {
      type: 'failed'
      projectName: string
      reason: string
      stage: 'read' | 'stack' | 'api' | 'create' | 'seed'
    }

const fail = (
  projectName: string,
  reason: string,
  stage: 'read' | 'stack' | 'api' | 'create' | 'seed'
): CreateResult => ({ type: 'failed', projectName, reason, stage })

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** `account/slug` as path segments; `parseScopedName` lets `?` and `#` through. */
const toScopedPath = ({ account, slug }: Scoped): string =>
  `${encodeURIComponent(account)}/${encodeURIComponent(slug)}`

const isUrlSource = (source: string): boolean => /^https?:\/\//i.test(source)

/**
 * Read a file `client.json#source` from the workspace root, with the filename
 * the hub reads to tell JSON from YAML.
 */
async function readSchemaFile(
  source: string
): Promise<{ bytes: Uint8Array<ArrayBuffer>; filename: string } | { error: string }> {
  const path = join(toAbsoluteRootPath(), source)
  const bytes = await Deno.readFile(path).catch(() => null)
  if (bytes === null) {
    return { error: `cannot read schema source "${source}" (${path})` }
  }
  // Both separators: a Windows-style `schemas\api.json` has no `/`.
  const filename = source.split(/[\\/]/).pop() || 'schema.json'
  return { bytes, filename }
}

/** Register `client.json#source` as a hub API; returns its `@account/slug`. */
async function registerSchema(
  source: string,
  owner: string,
  origin: string,
  token: string
): Promise<{ api: Scoped } | { error: string }> {
  const headers = { authorization: `Bearer ${token}` }
  try {
    let res: Response
    if (isUrlSource(source)) {
      res = await fetch(`${origin}/v1/apis/import`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ url: source, owner })
      })
    } else {
      const file = await readSchemaFile(source)
      if ('error' in file) return file
      const query = `?owner=${encodeURIComponent(owner)}&filename=${encodeURIComponent(file.filename)}`
      res = await fetch(`${origin}/v1/apis/upload${query}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/octet-stream' },
        body: file.bytes
      })
    }
    if (!res.ok) {
      const text = await res.text()
      return {
        error: `schema register failed (${res.status}): ${text.slice(0, 300)}`
      }
    }
    const body: unknown = await res.json()
    const api = isObject(body) ? body.api : undefined
    const ownerHandle = isObject(api) && isObject(api.owner) ? api.owner.handle : undefined
    const slug = isObject(api) ? api.slug : undefined
    if (typeof ownerHandle !== 'string' || typeof slug !== 'string') {
      return {
        error: 'schema registered but the response had no api owner/slug'
      }
    }
    return { api: { account: ownerHandle, slug } }
  } catch (err) {
    return { error: `schema register failed: ${errorMessage(err)}` }
  }
}

/**
 * Add the local schema to an existing hub API as a revision, so the new project
 * binds the current local schema. Content-addressed on the hub, so an unchanged
 * schema is a no-op (`deduped`). File sources only — a URL-sourced API gets new
 * revisions through a refetch of its source, not an upload.
 */
async function uploadSchemaRevision(
  source: string,
  api: Scoped,
  origin: string,
  token: string
): Promise<{ ok: true } | { error: string }> {
  if (isUrlSource(source)) return { ok: true }
  const file = await readSchemaFile(source)
  if ('error' in file) return file
  try {
    const res = await fetch(
      `${origin}/v1/apis/${toScopedPath(api)}/revisions?filename=${encodeURIComponent(file.filename)}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
        body: file.bytes
      }
    )
    if (!res.ok) {
      const text = await res.text()
      return { error: `schema revision upload failed (${res.status}): ${text.slice(0, 300)}` }
    }
    await res.text()
    return { ok: true }
  } catch (err) {
    return { error: `schema revision upload failed: ${errorMessage(err)}` }
  }
}

export const createHeadless = async ({
  skmtcRoot,
  projectName,
  name,
  token,
  origin,
  stackVersion,
  visibility = 'private',
  baseFiles
}: CreateArgs): Promise<CreateResult> => {
  const project = skmtcRoot.findProject(projectName)
  const contents = project.clientJson.contents
  if (!contents) {
    return fail(projectName, `no client.json for "${projectName}"`, 'read')
  }

  // 1. Stack — from deno.json#name.
  const stackName = await readStackName(project.toPath())
  const stack = stackName ? parseScopedName(stackName) : undefined
  if (!stack) {
    return fail(
      projectName,
      `no stack — set a scoped \`name\` (@account/slug) in ${projectName}/deno.json and publish it (skmtc publish)`,
      'stack'
    )
  }

  const dest = resolveNewProject(name, stack.account)
  if (!dest) {
    return fail(
      projectName,
      `invalid project name "${name}" — expected a slug or @account/slug`,
      'read'
    )
  }

  const headers = { authorization: `Bearer ${token}` }

  // 2. API — use client.json#api, else register the schema and remember it.
  let apiRegistered = false
  let api: Scoped | undefined
  if (contents.api?.trim()) {
    api = parseScopedName(contents.api.trim()) ?? undefined
    if (!api) {
      return fail(projectName, `invalid client.json#api "${contents.api}"`, 'api')
    }
    // Add the current local schema as a revision so the project binds it (no-op if unchanged).
    if (contents.source?.trim()) {
      const uploaded = await uploadSchemaRevision(contents.source.trim(), api, origin, token)
      if ('error' in uploaded) return fail(projectName, uploaded.error, 'api')
    }
  } else {
    if (!contents.source?.trim()) {
      return fail(
        projectName,
        'no schema to bind — set `source` in client.json (a file or URL)',
        'api'
      )
    }
    const registered = await registerSchema(contents.source.trim(), dest.account, origin, token)
    if ('error' in registered) {
      return fail(projectName, registered.error, 'api')
    }
    api = registered.api
    apiRegistered = true
  }

  // 3. Project — create-only. A 409 means it exists; STOP (no overwrite).
  const stackPin = stackVersion?.trim()
    ? { mode: 'exact', version: stackVersion.trim() }
    : { mode: 'latest' }
  const createBody = {
    owner: dest.account,
    slug: dest.slug,
    visibility,
    description: `Generated from ${projectName} (stack ${stack.account}/${stack.slug})`,
    stack: `${stack.account}/${stack.slug}`,
    stackPin,
    api: `${api.account}/${api.slug}`,
    apiPin: { mode: 'latest' }
  }
  let projectUrl: string | undefined
  try {
    const res = await fetch(`${origin}/v1/projects`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(createBody)
    })
    if (res.status === 409) {
      return fail(
        projectName,
        `project ${dest.account}/${dest.slug} already exists — use \`skmtc push\` to update it, or pick another name`,
        'create'
      )
    }
    if (!res.ok) {
      const text = await res.text()
      const hint =
        res.status === 403
          ? ` — not authorized to create under ${dest.account}`
          : res.status === 422
            ? ` — check the stack ${stack.account}/${stack.slug} is published`
            : ''
      return fail(
        projectName,
        `create failed (${res.status})${hint}: ${text.slice(0, 300)}`,
        'create'
      )
    }
    const body: unknown = await res.json()
    if (isObject(body) && typeof body.htmlUrl === 'string') {
      projectUrl = body.htmlUrl
    }
  } catch (err) {
    return fail(projectName, errorMessage(err), 'create')
  }

  // 4. Seed config (+ base files).
  let enrichmentCount = 0
  try {
    const settings = contents.settings
    const body = {
      source: contents.source,
      settings: {
        basePath: settings.basePath ?? '.',
        packages: settings.packages,
        include: settings.include,
        skip: settings.skip,
        enrichments: settings.enrichments,
        inputDirs: settings.inputDirs
      }
    }
    const res = await fetch(`${origin}/v1/projects/${toScopedPath(dest)}/client-config`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const text = await res.text()
      return fail(
        projectName,
        `config seed failed (${res.status}) — project created: ${text.slice(0, 300)}`,
        'seed'
      )
    }
    const seeded: unknown = await res.json()
    enrichmentCount = isObject(seeded) ? arrayLen(seeded.enrichments) : 0
  } catch (err) {
    return fail(projectName, errorMessage(err), 'seed')
  }

  let baseFilesPushed: number | undefined
  if (baseFiles && Object.keys(baseFiles).length > 0) {
    try {
      const res = await fetch(`${origin}/v1/projects/${toScopedPath(dest)}/preview/base-files`, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ files: baseFiles })
      })
      if (!res.ok) {
        const text = await res.text()
        return fail(
          projectName,
          `base-files seed failed (${res.status}): ${text.slice(0, 300)}`,
          'seed'
        )
      }
      await res.text()
      baseFilesPushed = Object.keys(baseFiles).length
    } catch (err) {
      return fail(projectName, errorMessage(err), 'seed')
    }
  }

  // 5. Record the remotes — but only FILL absent fields; never overwrite an
  //    existing `project`/`api` ref (that's the user's, and clobbering it would
  //    silently re-point push/pull). A fresh setup gets both recorded.
  let remoteWritten = false
  const nextProject = contents.project?.trim() ? contents.project : `@${dest.account}/${dest.slug}`
  const nextApi = contents.api?.trim() ? contents.api : `@${api.account}/${api.slug}`
  if (nextProject !== contents.project || nextApi !== contents.api) {
    try {
      project.clientJson.contents = {
        ...contents,
        project: nextProject,
        api: nextApi
      }
      await project.clientJson.write()
      remoteWritten = true
    } catch {
      // The project was created; the write-back is a convenience.
    }
  }

  return {
    type: 'created',
    projectName,
    project: dest,
    origin,
    stack: `${stack.account}/${stack.slug}`,
    api,
    apiRegistered,
    enrichmentCount,
    baseFilesPushed,
    remoteWritten,
    url: projectUrl
  }
}

type RmArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  name: string
  token: string
  origin: string
}

export type RmResult =
  | {
      type: 'removed'
      projectName: string
      project: Scoped
      origin: string
      existed: boolean
    }
  | {
      type: 'failed'
      projectName: string
      reason: string
      stage: 'read' | 'delete'
    }

export const rmHeadless = async ({
  skmtcRoot,
  projectName,
  name,
  token,
  origin
}: RmArgs): Promise<RmResult> => {
  const project = skmtcRoot.findProject(projectName)
  const contents = project.clientJson.contents
  const stackName = await readStackName(project.toPath())
  const stack = stackName ? parseScopedName(stackName) : undefined
  const dest = resolveNewProject(
    name,
    stack?.account ?? (contents?.project ? (parseScopedName(contents.project)?.account ?? '') : '')
  )
  if (!dest || !dest.account) {
    return {
      type: 'failed',
      projectName,
      reason: `invalid project name "${name}" — expected @account/slug`,
      stage: 'read'
    }
  }
  try {
    const res = await fetch(`${origin}/v1/projects/${toScopedPath(dest)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` }
    })
    if (res.status === 404) {
      return {
        type: 'removed',
        projectName,
        project: dest,
        origin,
        existed: false
      }
    }
    if (!res.ok) {
      const text = await res.text()
      const hint =
        res.status === 403
          ? ` — deleting needs the 'admin:resource' scope (your token lacks it)`
          : ''
      return {
        type: 'failed',
        projectName,
        reason: `delete failed (${res.status})${hint}: ${text.slice(0, 300)}`,
        stage: 'delete'
      }
    }
    await res.text()
    return {
      type: 'removed',
      projectName,
      project: dest,
      origin,
      existed: true
    }
  } catch (err) {
    return {
      type: 'failed',
      projectName,
      reason: errorMessage(err),
      stage: 'delete'
    }
  }
}
