import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import { apiPublishHeadless, type ApiPublishResult } from '@/lib/api-publish-headless.ts'
import { printApiPublishResult } from '@/commands/api.ts'

const originalFetch = globalThis.fetch
const originalCwd = Deno.cwd()

type Call = { url: string; method?: string; contentType?: string; body?: string }

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const DOCUMENT = 'openapi: 3.1.0\n'

/** An `ImportApiResult` for `@acme/pets`. */
const imported = ({ deduped = false, isNewApi = false } = {}): unknown => ({
  api: { owner: { handle: 'acme' }, slug: 'pets' },
  revision: {
    contentRef: '1a2b3c4d5e6f',
    htmlUrl: 'https://skmtc.test/acme/apis/pets/revisions/1a2b3c4d5e6f',
    url: 'https://hub.test/v1/apis/acme/pets/revisions/1a2b3c4d5e6f'
  },
  deduped,
  isNewApi,
  diffsPending: false
})

/** A folder with `schemas/openapi.yaml` and no `.skmtc`, used as the cwd. */
const makeFolder = async (): Promise<string> => {
  const root = await Deno.makeTempDir()
  await Deno.mkdir(join(root, 'schemas'), { recursive: true })
  await Deno.writeTextFile(join(root, 'schemas', 'openapi.yaml'), DOCUMENT)
  return root
}

const withFolder = async (
  root: string,
  cwd: string,
  fetchStub: (call: Call) => Response | Promise<Response>,
  run: () => Promise<void>
): Promise<void> => {
  Deno.chdir(cwd)
  try {
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) =>
      fetchStub({
        url: input.toString(),
        method: init?.method,
        contentType: new Headers(init?.headers).get('content-type') ?? undefined,
        body: init?.body instanceof Uint8Array ? new TextDecoder().decode(init.body) : undefined
      })
    await run()
  } finally {
    globalThis.fetch = originalFetch
    Deno.chdir(originalCwd)
    await Deno.remove(root, { recursive: true })
  }
}

const BASE = {
  file: 'schemas/openapi.yaml',
  api: { account: 'acme', slug: 'pets' },
  token: 'pat-123',
  origin: 'https://hub.test',
  env: 'production' as const
}

Deno.test('apiPublishHeadless - without --visibility posts the bytes to /revisions', async () => {
  const root = await makeFolder()
  const calls: Call[] = []

  await withFolder(
    root,
    root,
    call => {
      calls.push(call)
      return json(imported(), 201)
    },
    async () => {
      const result = await apiPublishHeadless(BASE)

      assertEquals(calls, [
        {
          url: 'https://hub.test/v1/apis/acme/pets/revisions?filename=openapi.yaml',
          method: 'POST',
          contentType: 'application/octet-stream',
          body: DOCUMENT
        }
      ])
      assertEquals(result, {
        type: 'published',
        api: { account: 'acme', slug: 'pets' },
        revision: '1a2b3c4d5e6f',
        url: 'https://skmtc.test/acme/apis/pets/revisions/1a2b3c4d5e6f',
        deduped: false,
        created: false,
        origin: 'https://hub.test'
      })
    }
  )
})

Deno.test('apiPublishHeadless - --origin-url is in the /revisions query', async () => {
  const root = await makeFolder()
  const calls: Call[] = []

  await withFolder(
    root,
    root,
    call => {
      calls.push(call)
      return json(imported(), 201)
    },
    async () => {
      await apiPublishHeadless({
        ...BASE,
        originUrl: 'https://github.com/acme/pets/blob/main/openapi.yaml'
      })

      assertEquals(
        calls[0].url,
        'https://hub.test/v1/apis/acme/pets/revisions?filename=openapi.yaml' +
          '&originUrl=https%3A%2F%2Fgithub.com%2Facme%2Fpets%2Fblob%2Fmain%2Fopenapi.yaml'
      )
    }
  )
})

Deno.test('apiPublishHeadless - --visibility posts to /v1/apis/publish with owner, slug, visibility and originUrl', async () => {
  const root = await makeFolder()
  const calls: Call[] = []

  await withFolder(
    root,
    root,
    call => {
      calls.push(call)
      return json(imported({ isNewApi: true }), 201)
    },
    async () => {
      const result = await apiPublishHeadless({
        ...BASE,
        visibility: 'public',
        originUrl: 'https://example.test/openapi.yaml'
      })

      assertEquals(calls.length, 1)
      assertEquals(
        calls[0].url,
        'https://hub.test/v1/apis/publish?owner=acme&slug=pets&visibility=public' +
          '&filename=openapi.yaml&originUrl=https%3A%2F%2Fexample.test%2Fopenapi.yaml'
      )
      assertEquals(calls[0].body, DOCUMENT)
      if (result.type !== 'published') throw new Error('expected a published result')
      assertEquals(result.created, true)
    }
  )
})

Deno.test('apiPublishHeadless - encodes account and slug on both routes', async () => {
  const root = await makeFolder()
  const calls: Call[] = []
  const api = { account: 'a#c', slug: 'p?ts' }

  await withFolder(
    root,
    root,
    call => {
      calls.push(call)
      return json(imported(), 201)
    },
    async () => {
      await apiPublishHeadless({ ...BASE, api })
      await apiPublishHeadless({ ...BASE, api, visibility: 'private' })

      assertEquals(
        calls.map(call => call.url),
        [
          'https://hub.test/v1/apis/a%23c/p%3Fts/revisions?filename=openapi.yaml',
          'https://hub.test/v1/apis/publish?owner=a%23c&slug=p%3Fts&visibility=private&filename=openapi.yaml'
        ]
      )
    }
  )
})

Deno.test('apiPublishHeadless - a 404 on /revisions names --visibility and "cannot see it"', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () => json({ code: 'not_found', message: 'API not found', requestId: 'req-1' }, 404),
    async () => {
      const result = await apiPublishHeadless(BASE)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'not-found')
      assertEquals(result.status, 404)
      assertEquals(result.requestId, 'req-1')
      assertStringIncludes(result.message, '@acme/pets not found, or you cannot see it')
      assertStringIncludes(result.message, '--visibility')
    }
  )
})

Deno.test('apiPublishHeadless - a 409 is a conflict carrying the hub message', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () =>
      json(
        {
          code: 'conflict',
          message: 'These schema bytes already belong to other/pets.',
          requestId: 'req-2'
        },
        409
      ),
    async () => {
      const result = await apiPublishHeadless({ ...BASE, visibility: 'public' })

      assertEquals(result, {
        type: 'failed',
        code: 'conflict',
        status: 409,
        message: 'These schema bytes already belong to other/pets.',
        requestId: 'req-2',
        details: undefined
      })
    }
  )
})

Deno.test('apiPublishHeadless - a 422 is an invalid document with its details', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () =>
      json(
        {
          code: 'invalid_document',
          message: 'The document is not valid OpenAPI.',
          requestId: 'req-3',
          details: [{ field: 'paths', message: 'must be an object' }, { message: 'no info' }]
        },
        422
      ),
    async () => {
      const result = await apiPublishHeadless(BASE)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'invalid-document')
      assertEquals(result.message, 'The document is not valid OpenAPI.')
      assertEquals(result.details, [
        { field: 'paths', message: 'must be an object' },
        { message: 'no info' }
      ])
    }
  )
})

Deno.test('apiPublishHeadless - 400, 401, 403 and 500 each have their own code', async () => {
  const root = await makeFolder()
  const statuses = [400, 401, 403, 500]

  await withFolder(
    root,
    root,
    () => json({ code: 'x', message: 'refused' }, statuses.shift() ?? 500),
    async () => {
      const codes: string[] = []
      const messages: string[] = []
      for (let index = 0; index < 4; index++) {
        const result = await apiPublishHeadless(BASE)
        if (result.type !== 'failed') throw new Error('expected a failed result')
        codes.push(result.code)
        messages.push(result.message)
      }

      assertEquals(codes, ['bad-request', 'unauthorized', 'forbidden', 'hub-error'])
      assertStringIncludes(messages[1], 'skmtc login')
      assertStringIncludes(messages[2], 'publish:schemas')
      assertEquals(messages[2].includes('--visibility'), false)
    }
  )
})

Deno.test('apiPublishHeadless - a network error is a network failure', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () => {
      throw new TypeError('error sending request: dns error')
    },
    async () => {
      const result = await apiPublishHeadless(BASE)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'network')
      assertStringIncludes(result.message, 'dns error')
    }
  )
})

Deno.test('apiPublishHeadless - an unreadable file fails before any request', async () => {
  const root = await makeFolder()
  const calls: Call[] = []

  await withFolder(
    root,
    root,
    call => {
      calls.push(call)
      return json(imported(), 201)
    },
    async () => {
      const result = await apiPublishHeadless({ ...BASE, file: 'missing.yaml' })

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'file-unreadable')
      assertEquals(calls.length, 0)
    }
  )
})

Deno.test('apiPublishHeadless - runs from a folder with no .skmtc and creates none', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () => json(imported(), 201),
    async () => {
      const result = await apiPublishHeadless(BASE)

      assertEquals(result.type, 'published')
      const entries = [...Deno.readDirSync(root)].map(entry => entry.name)
      assertEquals(entries, ['schemas'])
    }
  )
})

Deno.test('apiPublishHeadless - reads <file> against the cwd, not a .skmtc ancestor', async () => {
  // A workspace root above the cwd: resolving through it would miss the file.
  const root = await Deno.makeTempDir()
  await Deno.mkdir(join(root, '.skmtc'))
  const cwd = join(root, 'service')
  await Deno.mkdir(join(cwd, 'schemas'), { recursive: true })
  await Deno.writeTextFile(join(cwd, 'schemas', 'openapi.yaml'), DOCUMENT)

  await withFolder(
    root,
    cwd,
    () => json(imported(), 201),
    async () => {
      const result = await apiPublishHeadless(BASE)

      assertEquals(result.type, 'published')
    }
  )
})

Deno.test('apiPublishHeadless - takes the filename after a Windows separator', async () => {
  const root = await makeFolder()
  const calls: Call[] = []

  await withFolder(
    root,
    root,
    call => {
      calls.push(call)
      return json(imported(), 201)
    },
    async () => {
      // On POSIX the backslash is part of the name, so write the file under it.
      const file = Deno.build.os === 'windows' ? 'schemas\\openapi.yaml' : 'a\\openapi.yaml'
      if (Deno.build.os !== 'windows') await Deno.writeTextFile(join(root, file), DOCUMENT)
      await apiPublishHeadless({ ...BASE, file })

      assertStringIncludes(calls[0].url, '?filename=openapi.yaml')
    }
  )
})

// --- printApiPublishResult ----------------------------------------------------

const capture = (run: () => void): { out: string[]; err: string[] } => {
  const out: string[] = []
  const err: string[] = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (...args: unknown[]) => out.push(args.join(' '))
  console.error = (...args: unknown[]) => err.push(args.join(' '))
  try {
    run()
  } finally {
    console.log = originalLog
    console.error = originalError
  }
  return { out, err }
}

const PUBLISHED: ApiPublishResult = {
  type: 'published',
  api: { account: 'acme', slug: 'pets' },
  revision: '1a2b3c4d5e6f',
  url: 'https://skmtc.test/acme/apis/pets/revisions/1a2b3c4d5e6f',
  deduped: false,
  created: true,
  origin: 'https://hub.test'
}

Deno.test('printApiPublishResult - text names the API, the revision, a new API and the URL', () => {
  const { out } = capture(() => printApiPublishResult(PUBLISHED, { format: 'text' }))

  assertEquals(out, [
    'Published @acme/pets revision 1a2b3c4d5e6f',
    '  created API',
    '  https://skmtc.test/acme/apis/pets/revisions/1a2b3c4d5e6f'
  ])
})

Deno.test('printApiPublishResult - deduped text says unchanged', async () => {
  const root = await makeFolder()
  await withFolder(
    root,
    root,
    () => json(imported({ deduped: true }), 201),
    async () => {
      const result = await apiPublishHeadless(BASE)
      const { out } = capture(() => printApiPublishResult(result, { format: 'text' }))

      assertEquals(out[0], 'Published @acme/pets revision 1a2b3c4d5e6f, unchanged (deduped)')
      assertEquals(out.includes('  created API'), false)
    }
  )
})

Deno.test('printApiPublishResult - JSON output shape', () => {
  const { out } = capture(() => printApiPublishResult(PUBLISHED, { format: 'json' }))

  assertEquals(JSON.parse(out.join('\n')), {
    type: 'published',
    api: { account: 'acme', slug: 'pets' },
    revision: '1a2b3c4d5e6f',
    url: 'https://skmtc.test/acme/apis/pets/revisions/1a2b3c4d5e6f',
    deduped: false,
    created: true,
    origin: 'https://hub.test'
  })
})

Deno.test('printApiPublishResult - a failure prints the message, then the details', () => {
  const { err } = capture(() =>
    printApiPublishResult(
      {
        type: 'failed',
        code: 'invalid-document',
        status: 422,
        message: 'The document is not valid OpenAPI.',
        requestId: 'req-3',
        details: [{ field: 'paths', message: 'must be an object' }]
      },
      { format: 'text' }
    )
  )

  assertEquals(err, [
    'Publish failed (invalid-document, 422): The document is not valid OpenAPI.',
    '  paths: must be an object',
    '  request id: req-3'
  ])
})

Deno.test('printApiPublishResult - failure JSON keeps code, status and requestId', () => {
  const { out } = capture(() =>
    printApiPublishResult(
      {
        type: 'failed',
        code: 'conflict',
        status: 409,
        message: 'visibility differs',
        requestId: 'req-2'
      },
      { format: 'json' }
    )
  )

  assertEquals(JSON.parse(out.join('\n')), {
    type: 'failed',
    code: 'conflict',
    status: 409,
    message: 'visibility differs',
    requestId: 'req-2'
  })
})
