import { assertEquals, assertRejects } from '@std/assert'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { writeStoredAuth } from '@/lib/hub-token.ts'
import { generateWithServer } from '@/lib/generate-server.ts'

const originalFetch = globalThis.fetch

const okJson = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

Deno.test('generateWithServer POSTs to {url}/artifacts with protocol + schema + settings + auth', async () => {
  Deno.env.set('SKMTC_HUB_TOKEN', 'pat-123')
  let capturedUrl = ''
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedUrl = String(input)
    capturedInit = init
    return Promise.resolve(
      okJson({ artifacts: { 'src/Foo.ts': 'export const Foo = 1' }, manifest: { files: [] } })
    )
  }

  try {
    const result = await generateWithServer({
      // trailing slash should be trimmed before appending /artifacts
      stackUrl: 'https://api.skmtc.dev/v1/stacks/ada/react-stack/servers/3.0.1/',
      schemaContents: '{"openapi":"3.0.0"}',
      fileType: 'json',
      clientSettings: { basePath: 'src' }
    })

    assertEquals(
      capturedUrl,
      'https://api.skmtc.dev/v1/stacks/ada/react-stack/servers/3.0.1/artifacts'
    )
    assertEquals(capturedInit?.method, 'POST')
    const headers = capturedInit?.headers as Record<string, string>
    assertEquals(headers.authorization, 'Bearer pat-123')
    assertEquals(headers['content-type'], 'application/json')

    const body = JSON.parse(String(capturedInit?.body))
    assertEquals(body.protocol, 'oas')
    assertEquals(body.schema, '{"openapi":"3.0.0"}')
    assertEquals(body.clientSettings.basePath, 'src')

    assertEquals(result.artifacts['src/Foo.ts'], 'export const Foo = 1')
  } finally {
    globalThis.fetch = originalFetch
    Deno.env.delete('SKMTC_HUB_TOKEN')
  }
})

Deno.test('generateWithServer maps graphql fileType to the gql protocol', async () => {
  let protocol = ''
  globalThis.fetch = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    protocol = JSON.parse(String(init?.body)).protocol
    return Promise.resolve(okJson({ artifacts: {}, manifest: { files: [] } }))
  }
  try {
    await generateWithServer({
      stackUrl: 'https://api.test/s',
      schemaContents: 'type Query { a: Int }',
      fileType: 'graphql',
      clientSettings: undefined
    })
    assertEquals(protocol, 'gql')
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('generateWithServer preserves a query string (e.g. ?preview=true) on the endpoint', async () => {
  let capturedUrl = ''
  globalThis.fetch = (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = String(input)
    return Promise.resolve(okJson({ artifacts: {}, manifest: { files: {} } }))
  }
  try {
    await generateWithServer({
      stackUrl: 'https://api.test/v1/stacks/ada/s/servers/1.0.0?preview=true',
      schemaContents: '{}',
      fileType: 'json',
      clientSettings: undefined
    })
    assertEquals(
      capturedUrl,
      'https://api.test/v1/stacks/ada/s/servers/1.0.0/artifacts?preview=true'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('generateWithServer throws on a non-2xx response', async () => {
  globalThis.fetch = (): Promise<Response> => Promise.resolve(new Response('boom', { status: 404 }))
  try {
    await assertRejects(
      () =>
        generateWithServer({
          stackUrl: 'https://api.test/s',
          schemaContents: '{}',
          fileType: 'json',
          clientSettings: undefined
        }),
      Error,
      '404'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('generateWithServer throws on an unexpected response shape', async () => {
  globalThis.fetch = (): Promise<Response> =>
    Promise.resolve(okJson({ artifacts: 'not-an-object' }))
  try {
    await assertRejects(
      () =>
        generateWithServer({
          stackUrl: 'https://api.test/s',
          schemaContents: '{}',
          fileType: 'json',
          clientSettings: undefined
        }),
      Error,
      'unexpected response shape'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

/** Capture the authorization header of the one generate request. */
const captureAuthorization = () => {
  const seen: { authorization?: string; urls: string[] } = { urls: [] }
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    seen.urls.push(String(input))
    if (String(input).includes('/oauth2/token')) {
      return Promise.reject(new TypeError('offline'))
    }
    const headers = new Headers(init?.headers)
    seen.authorization = headers.get('authorization') ?? undefined
    return Promise.resolve(okJson({ artifacts: {}, manifest: { files: {} } }))
  }
  return seen
}

// A token belongs to one environment. A client.json can name any host, so
// the token goes only to its own environment's API.
Deno.test('generateWithServer - never sends the token to a host outside its environment', async () => {
  const seen = captureAuthorization()
  try {
    await withEnv({ SKMTC_HUB_TOKEN: 'pat-123', SKMTC_ENV: 'local' }, async () => {
      await generateWithServer({
        stackUrl: 'https://api.skmtc.dev/v1/stacks/ada/s/servers/1.0',
        schemaContents: '{}',
        fileType: 'json',
        clientSettings: undefined
      })
    })
    assertEquals(seen.authorization, undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// A public stack needs no token, so a stored sign-in that cannot be
// refreshed must not stop the generate.
Deno.test('generateWithServer - generates without a token when the refresh fails', async () => {
  const home = Deno.makeTempDirSync({ prefix: 'skmtc-generate-server-test-' })
  const seen = captureAuthorization()
  try {
    await withEnv({ HOME: home, SKMTC_HUB_TOKEN: undefined, SKMTC_ENV: undefined }, async () => {
      writeStoredAuth({ env: 'local', token: 'access-1', refreshToken: 'r1', expiresAt: 0 })
      await generateWithServer({
        stackUrl: 'https://api.skmtc.co.uk/v1/stacks/ada/s/servers/1.0',
        schemaContents: '{}',
        fileType: 'json',
        clientSettings: undefined
      })
    })
    assertEquals(seen.urls, [
      'https://skmtc.co.uk/api/auth/oauth2/token',
      'https://api.skmtc.co.uk/v1/stacks/ada/s/servers/1.0/artifacts'
    ])
    assertEquals(seen.authorization, undefined)
  } finally {
    globalThis.fetch = originalFetch
    Deno.removeSync(home, { recursive: true })
  }
})

Deno.test('generateWithServer - a host that is no hub API gets no token and causes no refresh', async () => {
  const home = Deno.makeTempDirSync({ prefix: 'skmtc-generate-server-test-' })
  const seen = captureAuthorization()
  try {
    await withEnv({ HOME: home, SKMTC_HUB_TOKEN: undefined, SKMTC_ENV: undefined }, async () => {
      writeStoredAuth({ env: 'local', token: 'access-1', refreshToken: 'r1', expiresAt: 0 })
      await generateWithServer({
        stackUrl: 'https://stacks.example.com/v1/stacks/ada/s/servers/1.0',
        schemaContents: '{}',
        fileType: 'json',
        clientSettings: undefined
      })
    })
    assertEquals(seen.urls, ['https://stacks.example.com/v1/stacks/ada/s/servers/1.0/artifacts'])
    assertEquals(seen.authorization, undefined)
  } finally {
    globalThis.fetch = originalFetch
    Deno.removeSync(home, { recursive: true })
  }
})
