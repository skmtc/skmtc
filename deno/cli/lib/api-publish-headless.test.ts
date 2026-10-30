import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import {
  apiPublishHeadless,
  type ApiPublishResult,
  readPublishFile
} from '@/lib/api-publish-headless.ts'
import { printApiPublishResult, runApiPublish } from '@/commands/api.ts'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import {
  recordTimeouts,
  withNeverAnsweringFetch
} from '@/tests/mocks/never-answering-fetch.mock.ts'

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
  bytes: new TextEncoder().encode(DOCUMENT),
  filename: 'openapi.yaml',
  api: { account: 'acme', slug: 'pets' },
  token: 'pat-123',
  tokenSource: 'explicit' as const,
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

Deno.test('apiPublishHeadless - a non-JSON error body falls back to the status, not the page', async () => {
  const root = await makeFolder()
  const responses = [
    new Response('<!doctype html><title>530</title>', { status: 530 }),
    new Response('', { status: 401 })
  ]

  await withFolder(
    root,
    root,
    () => responses.shift() ?? new Response('', { status: 500 }),
    async () => {
      const gateway = await apiPublishHeadless(BASE)
      const unauthorized = await apiPublishHeadless(BASE)

      if (gateway.type !== 'failed' || unauthorized.type !== 'failed') {
        throw new Error('expected failed results')
      }
      assertEquals(gateway.message, 'the hub answered 530')
      assertEquals(
        unauthorized.message,
        'the hub answered 401. Sign in again with `skmtc login`, or pass a valid --token.'
      )
    }
  )
})

Deno.test('apiPublishHeadless - a 201 with an unexpected body is a hub-error that keeps the status', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () => json({ unexpected: true }, 201),
    async () => {
      const result = await apiPublishHeadless(BASE)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'hub-error')
      assertEquals(result.status, 201)
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

Deno.test('apiPublishHeadless - a hub that never answers is network after the timeout', async () => {
  await withNeverAnsweringFetch(async () => {
    const result = await apiPublishHeadless({ ...BASE, timeoutMs: 10 })

    if (result.type !== 'failed') throw new Error('expected a failed result')
    assertEquals(result.code, 'network')
    assertEquals(
      result.message,
      'cannot reach the hub at https://hub.test: The operation was aborted due to timeout'
    )
  })
})

Deno.test('apiPublishHeadless - waits 120 s by default', async () => {
  globalThis.fetch = () => Promise.resolve(json(imported(), 201))
  try {
    assertEquals(await recordTimeouts(() => apiPublishHeadless(BASE)), [120_000])
  } finally {
    globalThis.fetch = originalFetch
  }
})

// --- readPublishFile ----------------------------------------------------------

Deno.test('readPublishFile - an unreadable file is file-unreadable with the file and its path', async () => {
  const root = await Deno.realPath(await makeFolder())
  Deno.chdir(root)
  try {
    const result = await readPublishFile('missing.yaml')

    if (result.type !== 'failed') throw new Error('expected a failed result')
    assertEquals(result.code, 'file-unreadable')
    assertStringIncludes(
      result.message,
      `cannot read "missing.yaml" (${join(root, 'missing.yaml')}): `
    )
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(root, { recursive: true })
  }
})

Deno.test('apiPublishHeadless - runs from a folder with no .skmtc and creates none', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () => json(imported(), 201),
    async () => {
      const read = await readPublishFile('schemas/openapi.yaml')
      if (read.type !== 'read') throw new Error('expected the file to be read')
      const result = await apiPublishHeadless({ ...BASE, bytes: read.bytes })

      assertEquals(result.type, 'published')
      const entries = [...Deno.readDirSync(root)].map(entry => entry.name)
      assertEquals(entries, ['schemas'])
    }
  )
})

Deno.test('readPublishFile - reads <file> against the cwd, not a .skmtc ancestor', async () => {
  // A workspace root above the cwd: resolving through it would miss the file.
  // The workspace lookup walks up only inside the home folder, so the temp
  // folder stands in for it.
  // The real path: on macOS the temp folder is a symlink, and the cwd is not.
  const root = await Deno.realPath(await Deno.makeTempDir())
  const workspace = join(root, 'workspace')
  await Deno.mkdir(join(workspace, '.skmtc'), { recursive: true })
  const cwd = join(workspace, 'service')
  await Deno.mkdir(join(cwd, 'schemas'), { recursive: true })
  await Deno.writeTextFile(join(cwd, 'schemas', 'openapi.yaml'), DOCUMENT)
  const homeVariable = Deno.build.os === 'windows' ? 'USERPROFILE' : 'HOME'
  const originalHome = Deno.env.get(homeVariable)
  Deno.env.set(homeVariable, root)

  try {
    await withFolder(
      root,
      cwd,
      () => json(imported(), 201),
      async () => {
        const result = await readPublishFile('schemas/openapi.yaml')

        if (result.type !== 'read') throw new Error('expected the file to be read')
        assertEquals(new TextDecoder().decode(result.bytes), DOCUMENT)
      }
    )
  } finally {
    if (originalHome === undefined) Deno.env.delete(homeVariable)
    else Deno.env.set(homeVariable, originalHome)
  }
})

Deno.test('readPublishFile - takes the filename after a Windows separator', async () => {
  const root = await makeFolder()

  await withFolder(
    root,
    root,
    () => json(imported(), 201),
    async () => {
      // On POSIX the backslash is part of the name, so write the file under it.
      const file = Deno.build.os === 'windows' ? 'schemas\\openapi.yaml' : 'a\\openapi.yaml'
      if (Deno.build.os !== 'windows') await Deno.writeTextFile(join(root, file), DOCUMENT)
      const result = await readPublishFile(file)

      if (result.type !== 'read') throw new Error('expected the file to be read')
      assertEquals(result.filename, 'openapi.yaml')
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

// --- runApiPublish: GitHub Actions OIDC ------------------------------------------

const GITHUB_REQUEST_URL = 'https://pipelines.actions.githubusercontent.com/token?api-version=2.0'
const GITHUB_REQUEST_TOKEN = 'gh-request-token-secret'
const GITHUB_JWT = 'eyJhbGciOiJSUzI1NiJ9.gh-jwt-secret'
const LINKED_TOKEN = 'skmtc_lr_linked-secret'
const EXCHANGE_URL = 'https://api.skmtc.dev/v1/apis/acme/pets/linked-repositories/exchange'

type OidcCall = { url: string; method?: string; authorization?: string; body?: string }

/** The answers of GitHub, the exchange and the publish; each may be overridden. */
type OidcRoutes = {
  github?: () => Response
  exchange?: () => Response
  publish?: () => Response
}

const isGithubCall = (url: string): boolean =>
  url.startsWith('https://pipelines.actions.githubusercontent.com/')

/**
 * Run `run` in a folder holding `schemas/openapi.yaml`, with a home folder of
 * its own (so no real `auth.json` is read), every token variable set (or
 * deleted) explicitly, and `fetch` stubbed for the three routes.
 */
const withOidcRun = async (
  {
    env = {},
    routes = {},
    storedToken,
    storedRefreshToken
  }: {
    env?: Record<string, string | undefined>
    routes?: OidcRoutes
    storedToken?: string
    /** Store the login as an expired browser sign-in, which refreshes before use. */
    storedRefreshToken?: string
  },
  run: (calls: OidcCall[]) => Promise<void>
): Promise<void> => {
  const root = await Deno.realPath(await makeFolder())
  if (storedToken) {
    const expired = storedRefreshToken ? { refreshToken: storedRefreshToken, expiresAt: 0 } : {}
    await Deno.mkdir(join(root, '.skmtc'))
    await Deno.writeTextFile(
      join(root, '.skmtc', 'auth.json'),
      JSON.stringify({ env: 'production', token: storedToken, ...expired })
    )
  }
  const calls: OidcCall[] = []
  await withEnv(
    {
      HOME: root,
      USERPROFILE: root,
      SKMTC_HUB_TOKEN: undefined,
      SKMTC_ENV: undefined,
      SKMTC_API_ORIGIN: undefined,
      GITHUB_ACTIONS: 'true',
      ACTIONS_ID_TOKEN_REQUEST_URL: GITHUB_REQUEST_URL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: GITHUB_REQUEST_TOKEN,
      ...env
    },
    async () => {
      Deno.chdir(root)
      globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
        const url = input.toString()
        calls.push({
          url,
          method: init?.method,
          authorization: new Headers(init?.headers).get('authorization') ?? undefined,
          body: typeof init?.body === 'string' ? init.body : undefined
        })
        if (isGithubCall(url))
          return Promise.resolve(routes.github?.() ?? json({ value: GITHUB_JWT }))
        if (url === EXCHANGE_URL) {
          return Promise.resolve(
            routes.exchange?.() ??
              json({ accessToken: LINKED_TOKEN, expiresAt: '2026-10-29T12:15:00Z' }, 201)
          )
        }
        return Promise.resolve(routes.publish?.() ?? json(imported(), 201))
      }
      try {
        await run(calls)
      } finally {
        globalThis.fetch = originalFetch
        Deno.chdir(originalCwd)
        await Deno.remove(root, { recursive: true })
      }
    }
  )
}

const RUN = {
  file: 'schemas/openapi.yaml',
  api: { account: 'acme', slug: 'pets' },
  visibility: undefined,
  originUrl: undefined,
  tokenFlag: undefined,
  envFlag: undefined
}

Deno.test('runApiPublish - with no token in GitHub Actions, publishes with the exchanged token', async () => {
  await withOidcRun({}, async calls => {
    const result = await runApiPublish(RUN)

    assertEquals(result.type, 'published')
    assertEquals(calls.length, 3)

    const github = new URL(calls[0].url)
    assertEquals(calls[0].method, 'GET')
    assertEquals(
      `${github.origin}${github.pathname}`,
      'https://pipelines.actions.githubusercontent.com/token'
    )
    assertEquals(github.searchParams.get('audience'), 'https://api.skmtc.dev')
    assertEquals(calls[0].authorization, `bearer ${GITHUB_REQUEST_TOKEN}`)

    assertEquals(calls[1], {
      url: EXCHANGE_URL,
      method: 'POST',
      authorization: undefined,
      body: JSON.stringify({ token: GITHUB_JWT })
    })

    assertEquals(
      calls[2].url,
      'https://api.skmtc.dev/v1/apis/acme/pets/revisions?filename=openapi.yaml'
    )
    assertEquals(calls[2].authorization, `Bearer ${LINKED_TOKEN}`)
  })
})

Deno.test('runApiPublish - the audience follows --env', async () => {
  await withOidcRun({}, async calls => {
    await runApiPublish({ ...RUN, envFlag: 'staging' })

    assertEquals(new URL(calls[0].url).searchParams.get('audience'), 'https://api.skmtc.net')
    assertEquals(
      calls[1].url,
      'https://api.skmtc.net/v1/apis/acme/pets/linked-repositories/exchange'
    )
  })
})

Deno.test('runApiPublish - --token skips OIDC', async () => {
  await withOidcRun({}, async calls => {
    const result = await runApiPublish({ ...RUN, tokenFlag: 'pat-flag' })

    assertEquals(result.type, 'published')
    assertEquals(
      calls.filter(call => isGithubCall(call.url) || call.url === EXCHANGE_URL),
      []
    )
    assertEquals(
      calls.map(call => call.authorization),
      ['Bearer pat-flag']
    )
  })
})

Deno.test('runApiPublish - $SKMTC_HUB_TOKEN skips OIDC', async () => {
  await withOidcRun({ env: { SKMTC_HUB_TOKEN: 'pat-env' } }, async calls => {
    const result = await runApiPublish(RUN)

    assertEquals(result.type, 'published')
    assertEquals(
      calls.map(call => call.authorization),
      ['Bearer pat-env']
    )
  })
})

Deno.test('runApiPublish - a stored login skips OIDC', async () => {
  await withOidcRun({ storedToken: 'stored-token' }, async calls => {
    const result = await runApiPublish(RUN)

    assertEquals(result.type, 'published')
    assertEquals(
      calls.map(call => call.authorization),
      ['Bearer stored-token']
    )
  })
})

Deno.test('runApiPublish - outside GitHub Actions the variables are ignored: the old recipe, no call', async () => {
  await withOidcRun({ env: { GITHUB_ACTIONS: undefined } }, async calls => {
    const result = await runApiPublish(RUN)

    assertEquals(result, {
      type: 'missing',
      discover:
        'Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token. ' +
        'Mint a PAT at https://skmtc.dev/settings/tokens.'
    })
    assertEquals(calls, [])
  })
})

Deno.test('runApiPublish - in GitHub Actions without the variables the recipe names id-token: write', async () => {
  await withOidcRun(
    { env: { ACTIONS_ID_TOKEN_REQUEST_URL: undefined, ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined } },
    async calls => {
      const result = await runApiPublish(RUN)

      assertEquals(result, {
        type: 'missing',
        discover:
          'Running in GitHub Actions without an OIDC token. Add `permissions: id-token: write` ' +
          'to the job (a pull request from a fork never gets one), or run `skmtc login`, ' +
          'set $SKMTC_HUB_TOKEN, or pass --token. Mint a PAT at https://skmtc.dev/settings/tokens.'
      })
      assertEquals(calls, [])
    }
  )
})

Deno.test('runApiPublish - --origin-url under OIDC is refused before any call', async () => {
  await withOidcRun({}, async calls => {
    const result = await runApiPublish({ ...RUN, originUrl: 'https://example.test/openapi.yaml' })

    assertEquals(result, {
      type: 'failed',
      code: 'bad-request',
      message:
        '--origin-url needs `skmtc login` or a PAT: a linked repository token cannot add a source.'
    })
    assertEquals(calls, [])
  })
})

Deno.test('runApiPublish - --origin-url with an explicit token is still sent', async () => {
  await withOidcRun({}, async calls => {
    const result = await runApiPublish({
      ...RUN,
      tokenFlag: 'pat-flag',
      originUrl: 'https://example.test/openapi.yaml'
    })

    assertEquals(result.type, 'published')
    assertEquals(calls.length, 1)
    assertStringIncludes(calls[0].url, '&originUrl=https%3A%2F%2Fexample.test%2Fopenapi.yaml')
  })
})

Deno.test('runApiPublish - a missing file under GitHub Actions makes no call', async () => {
  await withOidcRun({}, async calls => {
    const result = await runApiPublish({ ...RUN, file: 'missing.yaml' })

    if (result.type !== 'failed') throw new Error('expected a failed result')
    assertEquals(result.code, 'file-unreadable')
    assertStringIncludes(result.message, 'cannot read "missing.yaml" (')
    assertEquals(calls, [])
  })
})

Deno.test('runApiPublish - a missing file with an expired stored login makes no refresh call', async () => {
  await withOidcRun(
    { storedToken: 'stored-token', storedRefreshToken: 'stored-refresh' },
    async calls => {
      const result = await runApiPublish({ ...RUN, file: 'missing.yaml' })

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, 'file-unreadable')
      assertStringIncludes(result.message, 'cannot read "missing.yaml" (')
      assertEquals(calls, [])
    }
  )
})

Deno.test('runApiPublish - a GitHub or exchange failure stops before the publish', async () => {
  const cases: Array<{ routes: OidcRoutes; code: string; calls: number }> = [
    {
      routes: { github: () => new Response('boom', { status: 500 }) },
      code: 'oidc-token',
      calls: 1
    },
    { routes: { github: () => json({}) }, code: 'oidc-token', calls: 1 },
    {
      routes: { exchange: () => json({ message: 'No linked repository' }, 403) },
      code: 'oidc-exchange',
      calls: 2
    }
  ]
  for (const { routes, code, calls: expectedCalls } of cases) {
    await withOidcRun({ routes }, async calls => {
      const result = await runApiPublish(RUN)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.code, code)
      assertEquals(calls.length, expectedCalls)
    })
  }
})

Deno.test('runApiPublish - under OIDC a publish 401 or 403 gives no skmtc login, scope or --visibility remedy', async () => {
  const cases: Array<{ status: number; message: string }> = [
    {
      status: 401,
      message:
        'The linked repository token was refused: it expired or its link was removed. Run the job again.'
    },
    { status: 403, message: 'This token cannot publish here.' }
  ]
  for (const { status, message } of cases) {
    await withOidcRun(
      { routes: { publish: () => json({ message: 'This token cannot publish here.' }, status) } },
      async () => {
        const result = await runApiPublish(RUN)

        if (result.type !== 'failed') throw new Error('expected a failed result')
        assertEquals(result.message, message)
      }
    )
  }
})

Deno.test('runApiPublish - under OIDC a publish 404 gives only the first-publish hint, with or without --visibility', async () => {
  for (const visibility of [undefined, 'public' as const]) {
    await withOidcRun(
      { routes: { publish: () => json({ message: 'API not found' }, 404) } },
      async () => {
        const result = await runApiPublish({ ...RUN, visibility })

        if (result.type !== 'failed') throw new Error('expected a failed result')
        assertEquals(result.code, 'not-found')
        assertEquals(
          result.message,
          'API @acme/pets not found. The first publish needs `skmtc login` or a PAT.'
        )
      }
    )
  }
})

Deno.test('runApiPublish - no failure prints either token, as text or JSON', async () => {
  const failures: OidcRoutes[] = [
    { github: () => new Response('boom', { status: 500 }) },
    { github: () => json({}) },
    {
      github: () => {
        throw new TypeError('error sending request')
      }
    },
    ...[400, 401, 403, 503, 502].map(status => ({
      exchange: () => json({ message: 'refused', requestId: 'req-x' }, status)
    })),
    { exchange: () => json({ token: 'x' }, 201) },
    {
      exchange: () => {
        throw new TypeError('error sending request')
      }
    },
    ...[400, 401, 403, 404, 409, 422, 500].map(status => ({
      publish: () => json({ message: 'refused', requestId: 'req-y' }, status)
    })),
    { publish: () => json({ unexpected: true }, 201) },
    {
      publish: () => {
        throw new TypeError('error sending request')
      }
    }
  ]
  for (const routes of failures) {
    await withOidcRun({ routes }, async () => {
      const result = await runApiPublish(RUN)

      if (result.type !== 'failed') throw new Error('expected a failed result')
      const text = capture(() => printApiPublishResult(result, { format: 'text' }))
      const asJson = capture(() => printApiPublishResult(result, { format: 'json' }))
      const printed = [...text.out, ...text.err, ...asJson.out, ...asJson.err].join('\n')
      for (const secret of [GITHUB_REQUEST_TOKEN, GITHUB_JWT, LINKED_TOKEN, 'skmtc_lr_']) {
        assertEquals(printed.includes(secret), false, `${result.code} printed ${secret}`)
      }
    })
  }
})
