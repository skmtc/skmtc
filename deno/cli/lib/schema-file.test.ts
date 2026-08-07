import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { join } from '@std/path/join'

Deno.test('toSchemaSource - identifies HTTP URLs as remote', () => {
  const source = toSchemaSource('http://example.com/schema.json')

  assertEquals(source.type, 'remote')
  if (source.type === 'remote') {
    assertEquals(source.url, 'http://example.com/schema.json')
  }
})

Deno.test('toSchemaSource - identifies HTTPS URLs as remote', () => {
  const source = toSchemaSource('https://example.com/openapi.yaml')

  assertEquals(source.type, 'remote')
  if (source.type === 'remote') {
    assertEquals(source.url, 'https://example.com/openapi.yaml')
  }
})

Deno.test('toSchemaSource - identifies local paths', () => {
  const source = toSchemaSource('./schema.json')

  assertEquals(source.type, 'local')
  if (source.type === 'local') {
    assertEquals(source.path, './schema.json')
  }
})

Deno.test('toSchemaSource - handles absolute local paths', () => {
  const source = toSchemaSource('/absolute/path/to/schema.yaml')

  assertEquals(source.type, 'local')
  if (source.type === 'local') {
    assertEquals(source.path, '/absolute/path/to/schema.yaml')
  }
})

Deno.test('toSchemaSource - handles relative paths with parent references', () => {
  const source = toSchemaSource('../schemas/openapi.json')

  assertEquals(source.type, 'local')
  if (source.type === 'local') {
    assertEquals(source.path, '../schemas/openapi.json')
  }
})

// Tests for SchemaFile class
Deno.test('SchemaFile.create - returns instance with null values', () => {
  const schemaFile = SchemaFile.create()

  assertEquals(schemaFile.contents, null)
  assertEquals(schemaFile.schemaSource, null)
  assertEquals(schemaFile.fileType, null)
})

Deno.test('SchemaFile.openFromSource - opens local JSON file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.json')
    const contents = JSON.stringify({ openapi: '3.0.0' })
    await Deno.writeTextFile(filePath, contents)

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.contents, contents)
    assertEquals(schemaFile.fileType, 'json')
    assertEquals(schemaFile.schemaSource?.type, 'local')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.openFromSource - opens local YAML file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.yaml')
    const contents = 'openapi: 3.0.0'
    await Deno.writeTextFile(filePath, contents)

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.contents, contents)
    assertEquals(schemaFile.fileType, 'yaml')
    assertEquals(schemaFile.schemaSource?.type, 'local')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.openFromSource - handles .yml extension', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.yml')
    const contents = 'openapi: 3.0.0'
    await Deno.writeTextFile(filePath, contents)

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.fileType, 'yaml')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.getFromSource - rejects unsupported file extension', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.txt')
    await Deno.writeTextFile(filePath, 'test content')

    const source = { type: 'local' as const, path: filePath }

    await assertRejects(
      async () => {
        await SchemaFile.getFromSource(source)
      },
      Error,
      'Schema file extension not recognized'
    )
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.getFromSource - handles local JSON correctly', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'test.json')
    const jsonContent = '{"test": "data"}'
    await Deno.writeTextFile(filePath, jsonContent)

    const source = { type: 'local' as const, path: filePath }
    const result = await SchemaFile.getFromSource(source)

    assertEquals(result.contents, jsonContent)
    assertEquals(result.fileType, 'json')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('SchemaFile.getFromSource - handles local YAML correctly', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'test.yaml')
    const yamlContent = 'test: data'
    await Deno.writeTextFile(filePath, yamlContent)

    const source = { type: 'local' as const, path: filePath }
    const result = await SchemaFile.getFromSource(source)

    assertEquals(result.contents, yamlContent)
    assertEquals(result.fileType, 'yaml')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

/** Run `body` with `globalThis.fetch` replaced — remote sources fetch
 *  through it, so tests need no network access. */
const withStubbedFetch = async (
  stub: (input: URL | RequestInfo) => Response | Promise<Response>,
  body: () => Promise<void>
) => {
  const original = globalThis.fetch
  globalThis.fetch = ((input: URL | RequestInfo) => Promise.resolve(stub(input))) as typeof fetch
  try {
    await body()
  } finally {
    globalThis.fetch = original
  }
}

Deno.test('SchemaFile.getFromSource - fetches a remote JSON source', async () => {
  await withStubbedFetch(
    () =>
      new Response('{"openapi": "3.0.0"}', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/openapi.json' }
      const result = await SchemaFile.getFromSource(source)

      assertEquals(result.contents, '{"openapi": "3.0.0"}')
      assertEquals(result.fileType, 'json')
      // A constructed Response has no url, so the requested URL is kept.
      assertEquals(result.schemaSource, { type: 'remote', url: 'https://example.com/openapi.json' })
    }
  )
})

Deno.test('SchemaFile.getFromSource - non-2xx remote source fails with the status', async () => {
  await withStubbedFetch(
    () => new Response('not found', { status: 404, statusText: 'Not Found' }),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/missing.json' }

      await assertRejects(
        async () => {
          await SchemaFile.getFromSource(source)
        },
        Error,
        'returned 404'
      )
    }
  )
})

Deno.test('SchemaFile.getFromSource - unreachable remote source fails with the reason', async () => {
  await withStubbedFetch(
    () => {
      throw new TypeError('connection refused')
    },
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/openapi.json' }

      await assertRejects(
        async () => {
          await SchemaFile.getFromSource(source)
        },
        Error,
        'Could not fetch schema from https://example.com/openapi.json'
      )
    }
  )
})

Deno.test('SchemaFile.getFromSource - empty remote body fails clearly', async () => {
  await withStubbedFetch(
    () => new Response('', { status: 200 }),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/openapi.json' }

      await assertRejects(
        async () => {
          await SchemaFile.getFromSource(source)
        },
        Error,
        'is empty'
      )
    }
  )
})

Deno.test('SchemaFile.openFromSource - returns consistent schemaSource', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.json')
    await Deno.writeTextFile(filePath, '{}')

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.schemaSource?.type, 'local')
    if (schemaFile.schemaSource?.type === 'local') {
      // Should be the absolute resolved path
      assertEquals(schemaFile.schemaSource.path.includes(filePath), true)
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

/** A stubbed `Response` that reports a `url`, the way a real redirected
 *  response does. A constructed `Response` has `url === ''`, which is
 *  why the redirect paths below need this. */
const withFinalUrl = (response: Response, url: string): Response => {
  Object.defineProperty(response, 'url', { value: url })
  return response
}

Deno.test('SchemaFile.getFromSource - detects the format from the URL it landed on', async () => {
  await withStubbedFetch(
    () =>
      withFinalUrl(
        new Response('openapi: 3.0.0', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' }
        }),
        'https://cdn.example.com/pinned/spec.yaml'
      ),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/spec' }
      const result = await SchemaFile.getFromSource(source)

      // The redirect target's extension wins over an unhelpful
      // Content-Type — the server is saying what it served.
      assertEquals(result.fileType, 'yaml')
      assertEquals(result.schemaSource, {
        type: 'remote',
        url: 'https://cdn.example.com/pinned/spec.yaml'
      })
    }
  )
})

Deno.test('SchemaFile.getFromSource - falls back to the requested URL when the redirect target has no extension', async () => {
  await withStubbedFetch(
    () =>
      withFinalUrl(
        new Response('{"openapi": "3.0.0"}', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' }
        }),
        'https://cdn.example.com/blob/abc123'
      ),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/openapi.json' }
      const result = await SchemaFile.getFromSource(source)

      // The common presigned/content-addressed shape: neither the final
      // pathname nor the Content-Type identifies the format, so the
      // extension the user pinned is the last real evidence of intent.
      assertEquals(result.fileType, 'json')
      // Attribution still reports where it landed.
      assertEquals(result.schemaSource, {
        type: 'remote',
        url: 'https://cdn.example.com/blob/abc123'
      })
    }
  )
})

Deno.test('SchemaFile.getFromSource - detects the format from Content-Type alone', async () => {
  await withStubbedFetch(
    () =>
      new Response('type Query { a: Int }', {
        status: 200,
        headers: { 'content-type': 'application/graphql; charset=utf-8' }
      }),
    async () => {
      // No extension anywhere, so only the header can decide.
      const source = { type: 'remote' as const, url: 'https://example.com/schema' }
      const result = await SchemaFile.getFromSource(source)

      assertEquals(result.fileType, 'graphql')
    }
  )
})

Deno.test('SchemaFile.getFromSource - unidentifiable format names both URLs', async () => {
  await withStubbedFetch(
    () =>
      withFinalUrl(
        new Response('nonsense', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' }
        }),
        'https://cdn.example.com/blob/abc123'
      ),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/schema' }

      await assertRejects(
        async () => {
          await SchemaFile.getFromSource(source)
        },
        Error,
        "nor the requested '/schema'"
      )
    }
  )
})

Deno.test('SchemaFile.getFromSource - follows a real redirect and reports where it landed', async () => {
  // The stubs above assert the logic; this asserts the assumption the
  // logic rests on — that `redirect: 'follow'` leaves the final URL on
  // `response.url`.
  const server = Deno.serve({ port: 0, onListen: () => {} }, request => {
    const { pathname } = new URL(request.url)
    if (pathname === '/openapi.json') {
      return new Response(null, { status: 302, headers: { location: '/v1/spec.yaml' } })
    }
    return new Response('openapi: 3.0.0', {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' }
    })
  })

  try {
    const { port } = server.addr as Deno.NetAddr
    const result = await SchemaFile.getFromSource({
      type: 'remote',
      url: `http://localhost:${port}/openapi.json`
    })

    assertEquals(result.fileType, 'yaml')
    assertEquals(result.schemaSource, {
      type: 'remote',
      url: `http://localhost:${port}/v1/spec.yaml`
    })
  } finally {
    await server.shutdown()
  }
})

Deno.test('SchemaFile.getFromSource - a body that fails mid-read reports the URL', async () => {
  await withStubbedFetch(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"openapi":'))
            // What `AbortSignal.timeout` raises when a server sends
            // headers promptly and then stalls: the rejection lands on
            // the body read, not on `fetch`.
            controller.error(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/openapi.json' }

      const error = await assertRejects(
        async () => {
          await SchemaFile.getFromSource(source)
        },
        Error,
        'Could not fetch schema from https://example.com/openapi.json'
      )
      // Names the cap, which `TimeoutError`'s own message does not.
      assertStringIncludes(error.message, 'timed out after 30s')
    }
  )
})

Deno.test('SchemaFile.openFromProject - an unreadable pinned source warns instead of throwing', async () => {
  // `SkmtcRoot.open` opens every project, so a throw here would break
  // `list`, `clean`, `bundle`, `publish` … and the bare `skmtc` prompt,
  // none of which need the schema.
  const warnings: string[] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }

  try {
    await withStubbedFetch(
      () => new Response('not found', { status: 404, statusText: 'Not Found' }),
      async () => {
        const schemaFile = await SchemaFile.openFromProject(
          'some-project',
          'https://example.com/gone.json'
        )

        assertEquals(schemaFile.contents, null)
        assertEquals(schemaFile.schemaSource, null)
        assertEquals(schemaFile.fileType, null)
      }
    )
  } finally {
    console.error = originalError
  }

  assertEquals(warnings.length, 1)
  assertStringIncludes(warnings[0], 'could not read the schema for project "some-project"')
  assertStringIncludes(warnings[0], 'returned 404')
})
