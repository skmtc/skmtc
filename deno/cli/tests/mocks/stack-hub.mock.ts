import { join } from '@std/path/join'
import type { DeployRoot } from '@/lib/deploy-headless.ts'
import { readCliServerPin } from '@/lib/doctor-headless.ts'

/** One request the fake hub received. */
export type HubCall = {
  method: string
  /** The path, e.g. `/v1/stacks/acme/my-api/servers`. */
  path: string
  body: BodyInit | null | undefined
}

/** The StackVersion the versions route answers with. */
export const stackVersionPayload = {
  version: '3.0.1',
  releasedAt: '2026-06-09T12:00:00Z',
  yanked: false,
  sourceHash: 'cafef00d',
  source: {
    rootKey: 'stack-versions/abc/source/',
    fileCount: 2,
    totalBytes: 11,
    uploadedAt: '2026-06-09T12:00:00Z'
  },
  url: 'https://api.skmtc.dev/v1/stacks/acme/my-api/versions/3.0.1',
  htmlUrl: 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1'
}

/** A StackServer the servers route answers with. */
export const toStackServer = (overrides: Record<string, unknown> = {}) => ({
  version: '3.0.1',
  status: 'active',
  statusReason: null,
  endpointUrl: 'https://acme-my-api.deno.dev/api',
  url: 'https://api.skmtc.dev/v1/stacks/acme/my-api/servers/3.0.1',
  isProduction: false,
  ...overrides
})

export const toJsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export type HubAnswers = {
  /** `GET …/versions/{v}`. Default 404. */
  exists?: () => Response
  /** `POST …/versions`. Default 201 StackVersion. */
  upload?: () => Response
  /** `POST …/servers`. Default 201 active StackServer. */
  deploy?: () => Response
}

/**
 * Run `fn` with `fetch` stubbed by a stack hub that answers each route as
 * `answers` says, and return every request it received, in order.
 */
export const withStackHub = async (
  answers: HubAnswers,
  fn: () => Promise<unknown>
): Promise<HubCall[]> => {
  const originalFetch = globalThis.fetch
  const calls: HubCall[] = []
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const path = new URL(input.toString()).pathname
    calls.push({ method, path, body: init?.body })
    if (method === 'GET' && path.includes('/versions/')) {
      return Promise.resolve(answers.exists?.() ?? toJsonResponse({ code: 'not-found' }, 404))
    }
    if (method === 'POST' && path.endsWith('/versions')) {
      return Promise.resolve(answers.upload?.() ?? toJsonResponse(stackVersionPayload, 201))
    }
    if (method === 'POST' && path.endsWith('/servers')) {
      return Promise.resolve(answers.deploy?.() ?? toJsonResponse(toStackServer(), 201))
    }
    return Promise.reject(new Error(`unexpected request ${method} ${path}`))
  }
  try {
    await fn()
    return calls
  } finally {
    globalThis.fetch = originalFetch
  }
}

/** The project `deno.json` imports with the CLI's `@skmtc/server` pin already set. */
export const toPinnedImports = (): Record<string, string> => {
  const pin = readCliServerPin()
  return pin === null ? {} : { '@skmtc/server': `jsr:@skmtc/server@${pin}` }
}

/**
 * A stack project in a temp folder: `deno.json` named `@acme/my-api` at
 * version 3.0.1 with the server pin, and a `deno.lock`. Only
 * `findProject(...).toPath()` of the returned root is real.
 */
export const makeStackProject = async (
  denoJson: Record<string, unknown> = {
    name: '@acme/my-api',
    version: '3.0.1',
    imports: toPinnedImports()
  }
): Promise<{
  projectPath: string
  skmtcRoot: DeployRoot
  [Symbol.asyncDispose]: () => Promise<void>
}> => {
  const projectPath = await Deno.makeTempDir()
  await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify(denoJson))
  await Deno.writeTextFile(join(projectPath, 'deno.lock'), '{}')
  const skmtcRoot: DeployRoot = { findProject: () => ({ toPath: () => projectPath }) }
  return {
    projectPath,
    skmtcRoot,
    [Symbol.asyncDispose]: () => Deno.remove(projectPath, { recursive: true })
  }
}
