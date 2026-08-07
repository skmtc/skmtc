import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert'
import {
  SchemaFile,
  toAttributedSource,
  toFetchDeadline,
  toSchemaSource
} from '@/lib/schema-file.ts'
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
})

Deno.test('SchemaFile.openFromSource - opens local JSON file', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const filePath = join(tempDir, 'schema.json')
    const contents = JSON.stringify({ openapi: '3.0.0' })
    await Deno.writeTextFile(filePath, contents)

    const schemaFile = await SchemaFile.openFromSource(filePath)

    assertEquals(schemaFile.contents, contents)
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
            // What the deadline raises when a server sends headers
            // promptly and then stalls: the rejection lands on the body
            // read, not on `fetch`, carrying the phrasing the deadline
            // chose for that phase.
            controller.error(
              new DOMException('timed out after 30s with no data received', 'TimeoutError')
            )
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
      // Names the cap AND that it is an idle one — a reader who sees
      // "timed out" on a big download needs to know size was not the
      // problem.
      assertStringIncludes(error.message, 'timed out after 30s with no data received')
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
      }
    )
  } finally {
    console.error = originalError
  }

  assertEquals(warnings.length, 1)
  assertStringIncludes(warnings[0], 'could not read the schema for project "some-project"')
  assertStringIncludes(warnings[0], 'returned 404')
})

Deno.test('SchemaFile.getFromSource - a whitespace-only body is empty', async () => {
  await withStubbedFetch(
    // What a misconfigured proxy or a template that rendered nothing
    // returns. Passing it on turns into an opaque parse error later.
    () => new Response('\n  \n', { status: 200 }),
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

Deno.test('SchemaFile.getFromSource - a status error survives a body that errors on cancel', async () => {
  await withStubbedFetch(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            // A server that sends 5xx headers and then resets: cancelling
            // this stream rejects, and awaiting that rejection would
            // replace the status error with a bare stream error.
            controller.error(new TypeError('connection reset'))
          }
        }),
        { status: 500, statusText: 'Internal Server Error' }
      ),
    async () => {
      const source = { type: 'remote' as const, url: 'https://example.com/openapi.json' }

      const error = await assertRejects(
        async () => {
          await SchemaFile.getFromSource(source)
        },
        Error,
        'returned 500'
      )
      assertStringIncludes(error.message, 'https://example.com/openapi.json')
    }
  )
})

Deno.test('SchemaFile.openFromProject - a remote source gets the short budget', async () => {
  // `SkmtcRoot.open` opens every project. A schema nobody asked for must
  // not hold `list` / `clean` / `install` for the minutes `generate` is
  // allowed, so this path stops at 30s where `generate` stops at 5m.
  const server = Deno.serve({ port: 0, onListen: () => {} }, () => {
    // Headers immediately, then nothing — the idle window decides.
    return new Response(new ReadableStream({ start() {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })

  const warnings: string[] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }

  try {
    const { port } = server.addr as Deno.NetAddr
    const started = performance.now()

    const schemaFile = await SchemaFile.openFromProject(
      'slow-project',
      `http://localhost:${port}/openapi.json`
    )
    const elapsed = performance.now() - started

    assertEquals(schemaFile.contents, null)
    // The generate budget's idle window is 30s; this one is 10s.
    assertEquals(elapsed < 20_000, true, `took ${Math.round(elapsed)}ms`)
  } finally {
    console.error = originalError
    await server.shutdown()
  }

  assertStringIncludes(warnings[0], 'timed out after 10s')
})

Deno.test('SchemaFile.getFromSource - reassembles a body split across chunks', async () => {
  // The idle deadline means the body is read chunk by chunk rather than
  // through `response.text()`. A multi-byte character straddling a chunk
  // boundary is what a naive decode-per-chunk would corrupt.
  const body = '{"openapi": "3.0.0", "title": "café ✅"}'
  const bytes = new TextEncoder().encode(body)
  const splitAt = bytes.indexOf(0xc3) + 1

  const server = Deno.serve(
    { port: 0, onListen: () => {} },
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, splitAt))
            controller.enqueue(bytes.slice(splitAt))
            controller.close()
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
  )

  try {
    const { port } = server.addr as Deno.NetAddr
    const result = await SchemaFile.getFromSource({
      type: 'remote',
      url: `http://localhost:${port}/openapi.json`
    })

    assertEquals(result.contents, body)
  } finally {
    await server.shutdown()
  }
})

Deno.test('SchemaFile.openFromProject - a misconfigured schema warns, it does not throw', async () => {
  // `SkmtcRoot.open` opens every project, and nothing up the stack
  // catches. Throwing here crashes `list`, `clean`, `install` and the
  // bare prompt with an uncaught exception and an empty stdout — the
  // recovery commands included.
  const tempDir = await Deno.makeTempDir()
  const warnings: string[] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }

  try {
    const filePath = join(tempDir, 'openapi.json')
    await Deno.writeTextFile(filePath, '   \n')

    const schemaFile = await SchemaFile.openFromProject('some-project', filePath)

    assertEquals(schemaFile.contents, null)
  } finally {
    console.error = originalError
    await Deno.remove(tempDir, { recursive: true })
  }

  assertEquals(warnings.length, 1)
  assertStringIncludes(warnings[0], 'is empty')
})

Deno.test('toFetchDeadline - the total ceiling fires even while progress continues', async () => {
  // The idle window alone can be held open forever by a response that
  // trickles a byte every few seconds.
  const deadline = toFetchDeadline({ idleMs: 10_000, totalMs: 120 })

  try {
    const aborted = new Promise<Event>(resolve => {
      deadline.signal.addEventListener('abort', resolve, { once: true })
    })

    // Steady "progress" that would keep resetting an idle-only budget.
    const heartbeat = setInterval(() => deadline.touch(), 20)
    await aborted
    clearInterval(heartbeat)

    const reason = deadline.signal.reason

    assertEquals(reason instanceof DOMException, true)
    assertEquals((reason as DOMException).name, 'TimeoutError')
    assertStringIncludes((reason as DOMException).message, 'limit for a single fetch')
  } finally {
    deadline.clear()
  }
})

Deno.test('toFetchDeadline - names the phase the idle window ran out in', async () => {
  const beforeResponse = toFetchDeadline({ idleMs: 40, totalMs: 10_000 })

  try {
    await new Promise<Event>(resolve => {
      beforeResponse.signal.addEventListener('abort', resolve, { once: true })
    })

    // No response yet: nothing "stopped" producing bytes, it never began.
    assertStringIncludes(
      (beforeResponse.signal.reason as DOMException).message,
      'waiting for a response'
    )
  } finally {
    beforeResponse.clear()
  }

  const duringBody = toFetchDeadline({ idleMs: 40, totalMs: 10_000 })

  try {
    duringBody.startBody()

    await new Promise<Event>(resolve => {
      duringBody.signal.addEventListener('abort', resolve, { once: true })
    })

    assertStringIncludes(
      (duringBody.signal.reason as DOMException).message,
      'with no data received'
    )
  } finally {
    duringBody.clear()
  }
})

Deno.test('toAttributedSource - records the redirect target complete', () => {
  // skmtc-hub's `?raw` surface: the floating form redirects to the
  // version-pinned one, which is the document only WITH `?raw` — the
  // same URL without it is the HTML page. Dropping the query would
  // record a URL that no longer names what was read.
  assertEquals(
    toAttributedSource('https://hub.example.com/acme/apis/pets?raw', {
      type: 'remote',
      url: 'https://hub.example.com/acme/apis/pets/versions/3.0.1?raw'
    }),
    'https://hub.example.com/acme/apis/pets/versions/3.0.1?raw'
  )
})

Deno.test('toAttributedSource - records a directly pinned URL complete', () => {
  assertEquals(
    toAttributedSource(
      'https://hub.example.com/acme/apis/pets/versions/3.0.1?raw&variant=openapi3',
      {
        type: 'remote',
        url: 'https://hub.example.com/acme/apis/pets/versions/3.0.1?raw&variant=openapi3'
      }
    ),
    'https://hub.example.com/acme/apis/pets/versions/3.0.1?raw&variant=openapi3'
  )
})

Deno.test('toAttributedSource - keeps a local source as written', () => {
  // `toSchemaContents` absolutizes relative paths; recording the resolved
  // one would write the developer's home directory into a committed
  // gen-map and churn it per machine.
  assertEquals(
    toAttributedSource('./openapi.json', {
      type: 'local',
      path: '/Users/someone/work/.skmtc/openapi.json'
    }),
    './openapi.json'
  )
})
