import { assertEquals, assertRejects } from '@std/assert'
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
      stackUrl: 'https://api.test/v1/stacks/ada/react-stack/servers/3.0.1/',
      schemaContents: '{"openapi":"3.0.0"}',
      clientSettings: { basePath: 'src' }
    })

    assertEquals(capturedUrl, 'https://api.test/v1/stacks/ada/react-stack/servers/3.0.1/artifacts')
    assertEquals(capturedInit?.method, 'POST')
    const headers = capturedInit?.headers as Record<string, string>
    assertEquals(headers.authorization, 'Bearer pat-123')
    assertEquals(headers['content-type'], 'application/json')

    const body = JSON.parse(String(capturedInit?.body))
    // No `protocol`: the stack server infers it from the document, using
    // the same `@skmtc/convert` inference the local path uses. Sending a
    // second opinion derived from a filename could only disagree.
    assertEquals('protocol' in body, false)
    assertEquals(body.schema, '{"openapi":"3.0.0"}')
    assertEquals(body.clientSettings.basePath, 'src')

    assertEquals(result.artifacts['src/Foo.ts'], 'export const Foo = 1')
  } finally {
    globalThis.fetch = originalFetch
    Deno.env.delete('SKMTC_HUB_TOKEN')
  }
})

Deno.test('generateWithServer sends SDL untouched, without a protocol', async () => {
  let body: Record<string, unknown> = {}
  globalThis.fetch = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    body = JSON.parse(String(init?.body))
    return Promise.resolve(okJson({ artifacts: {}, manifest: { files: [] } }))
  }
  try {
    await generateWithServer({
      stackUrl: 'https://api.test/s',
      schemaContents: 'type Query { a: Int }',
      clientSettings: undefined
    })
    assertEquals(body.schema, 'type Query { a: Int }')
    assertEquals('protocol' in body, false)
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
          clientSettings: undefined
        }),
      Error,
      'unexpected response shape'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
