import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import { type CreateResult, createHeadless } from '@/lib/project-headless.ts'
import { printCreateResult } from '@/commands/project.ts'
import { Manager } from '@/lib/manager.ts'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'

const originalFetch = globalThis.fetch
const originalCwd = Deno.cwd()

type Call = { url: string; method?: string }

/**
 * A workspace root outside any `.skmtc` ancestor, so `toAbsoluteRootPath`
 * resolves to the cwd: the test runs with the root as its cwd.
 */
const makeFixture = async ({ api, source }: { api?: string; source?: string }): Promise<string> => {
  const root = await Deno.makeTempDir()
  const projectPath = join(root, '.skmtc', 'pets')
  await Deno.mkdir(join(projectPath, '.settings'), { recursive: true })
  await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ name: '@acme/stack' }))
  await Deno.writeTextFile(
    join(projectPath, '.settings', 'client.json'),
    JSON.stringify({ api, source, settings: { basePath: '.' } })
  )
  // Only a file source has a file to write.
  if (source && !/^https?:\/\//i.test(source)) {
    await Deno.mkdir(join(root, 'schemas'), { recursive: true })
    await Deno.writeTextFile(join(root, source), 'openapi: 3.1.0\n')
  }

  return root
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Answers every hub call `project create` makes after the API stage. */
const hubResponse = (url: string): Response =>
  url.endsWith('/v1/projects')
    ? json({ htmlUrl: 'https://skmtc.test/acme/projects/pets-app' }, 201)
    : json({ enrichments: [] })

const withFixture = async (
  root: string,
  fetchStub: (call: Call) => Response | Promise<Response>,
  run: (skmtcRoot: SkmtcRoot) => Promise<void>
): Promise<void> => {
  Deno.chdir(root)
  try {
    // Stubbed before the open: opening a project reads a URL source.
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(fetchStub({ url: input.toString(), method: init?.method }))
    const skmtcRoot = await SkmtcRoot.open(new Manager())
    await run(skmtcRoot)
  } finally {
    globalThis.fetch = originalFetch
    Deno.chdir(originalCwd)
    await Deno.remove(root, { recursive: true })
  }
}

Deno.test('createHeadless - adds the local file schema as a revision of client.json#api', async () => {
  const root = await makeFixture({ api: '@acme/pets', source: 'schemas/openapi.yaml' })
  const calls: Call[] = []

  await withFixture(
    root,
    call => {
      calls.push(call)
      return call.url.includes('/revisions') ? json({ deduped: true }, 201) : hubResponse(call.url)
    },
    async skmtcRoot => {
      const result = await createHeadless({
        skmtcRoot,
        projectName: 'pets',
        name: 'pets-app',
        token: 'pat-123',
        origin: 'https://hub.test'
      })

      assertEquals(result.type, 'created')
      assertEquals(calls[0], {
        url: 'https://hub.test/v1/apis/acme/pets/revisions?filename=openapi.yaml',
        method: 'POST'
      })
      assertEquals(
        calls.map(call => call.url),
        [
          'https://hub.test/v1/apis/acme/pets/revisions?filename=openapi.yaml',
          'https://hub.test/v1/projects',
          'https://hub.test/v1/projects/acme/pets-app/client-config'
        ]
      )
    }
  )
})

Deno.test('createHeadless - a network error during the revision upload is a failed api stage', async () => {
  const root = await makeFixture({ api: '@acme/pets', source: 'schemas/openapi.yaml' })
  const calls: Call[] = []

  await withFixture(
    root,
    call => {
      calls.push(call)
      throw new TypeError('error sending request: dns error')
    },
    async skmtcRoot => {
      const result = await createHeadless({
        skmtcRoot,
        projectName: 'pets',
        name: 'pets-app',
        token: 'pat-123',
        origin: 'https://hub.test'
      })

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.stage, 'api')
      assertStringIncludes(result.reason, 'schema revision upload failed: error sending request')
      // The failure stops before the project is created.
      assertEquals(calls.length, 1)
    }
  )
})

Deno.test('createHeadless - encodes the API account and slug as path segments', async () => {
  // `parseScopedName` accepts `?` and `#`; unencoded, they would cut the path
  // and send the upload to another route.
  const root = await makeFixture({ api: '@acme/pets?x=1', source: 'schemas/openapi.yaml' })
  const calls: Call[] = []

  await withFixture(
    root,
    call => {
      calls.push(call)
      return call.url.includes('/revisions') ? json({ deduped: false }, 201) : hubResponse(call.url)
    },
    async skmtcRoot => {
      await createHeadless({
        skmtcRoot,
        projectName: 'pets',
        name: 'pets-app',
        token: 'pat-123',
        origin: 'https://hub.test'
      })

      assertEquals(
        calls[0]?.url,
        'https://hub.test/v1/apis/acme/pets%3Fx%3D1/revisions?filename=openapi.yaml'
      )
    }
  )
})

Deno.test('createHeadless - takes the filename after a Windows-style separator', async () => {
  const root = await makeFixture({ api: '@acme/pets', source: 'schemas\\openapi.json' })
  const calls: Call[] = []

  await withFixture(
    root,
    call => {
      calls.push(call)
      return call.url.includes('/revisions') ? json({ deduped: false }, 201) : hubResponse(call.url)
    },
    async skmtcRoot => {
      await createHeadless({
        skmtcRoot,
        projectName: 'pets',
        name: 'pets-app',
        token: 'pat-123',
        origin: 'https://hub.test'
      })

      assertEquals(
        calls[0]?.url,
        'https://hub.test/v1/apis/acme/pets/revisions?filename=openapi.json'
      )
    }
  )
})

Deno.test('createHeadless - a network error while registering the schema is a failed api stage', async () => {
  const root = await makeFixture({ source: 'schemas/openapi.yaml' })
  const calls: Call[] = []

  await withFixture(
    root,
    call => {
      calls.push(call)
      throw new TypeError('error sending request: dns error')
    },
    async skmtcRoot => {
      const result = await createHeadless({
        skmtcRoot,
        projectName: 'pets',
        name: 'pets-app',
        token: 'pat-123',
        origin: 'https://hub.test'
      })

      if (result.type !== 'failed') throw new Error('expected a failed result')
      assertEquals(result.stage, 'api')
      assertStringIncludes(result.reason, 'schema register failed: error sending request')
      assertEquals(
        calls.map(call => call.url),
        ['https://hub.test/v1/apis/upload?owner=acme&filename=openapi.yaml']
      )
    }
  )
})

// --- schemaStep ---------------------------------------------------------------

/** Run `createHeadless` against the fixture; returns the result and the calls. */
const runCreate = async (
  fixture: { api?: string; source?: string },
  fetchStub: (call: Call) => Response
): Promise<{ result: CreateResult; calls: Call[] }> => {
  const root = await makeFixture(fixture)
  const calls: Call[] = []
  let result: CreateResult | undefined
  await withFixture(
    root,
    call => {
      calls.push(call)
      return fetchStub(call)
    },
    async skmtcRoot => {
      result = await createHeadless({
        skmtcRoot,
        projectName: 'pets',
        name: 'pets-app',
        token: 'pat-123',
        origin: 'https://hub.test'
      })
    }
  )
  if (!result) throw new Error('createHeadless did not run')
  return { result, calls }
}

const schemaStepOf = (result: CreateResult): string => {
  if (result.type !== 'created') throw new Error(`expected a created result: ${result.reason}`)
  return result.schemaStep
}

Deno.test('createHeadless - schemaStep is revision-added when the hub adds a revision', async () => {
  const { result } = await runCreate({ api: '@acme/pets', source: 'schemas/openapi.yaml' }, call =>
    call.url.includes('/revisions') ? json({ deduped: false }, 201) : hubResponse(call.url)
  )

  assertEquals(schemaStepOf(result), 'revision-added')
})

Deno.test('createHeadless - schemaStep is revision-added when the 201 body does not parse', async () => {
  const { result } = await runCreate({ api: '@acme/pets', source: 'schemas/openapi.yaml' }, call =>
    call.url.includes('/revisions')
      ? new Response('not json', { status: 201 })
      : hubResponse(call.url)
  )

  assertEquals(schemaStepOf(result), 'revision-added')
})

Deno.test('createHeadless - schemaStep is unchanged when the hub deduped the file', async () => {
  const { result } = await runCreate({ api: '@acme/pets', source: 'schemas/openapi.yaml' }, call =>
    call.url.includes('/revisions') ? json({ deduped: true }, 201) : hubResponse(call.url)
  )

  assertEquals(schemaStepOf(result), 'unchanged')
})

Deno.test('createHeadless - schemaStep is url-not-uploaded for a URL source', async () => {
  const { result, calls } = await runCreate(
    { api: '@acme/pets', source: 'https://example.test/openapi.yaml' },
    call =>
      call.url.startsWith('https://example.test/')
        ? new Response('openapi: 3.1.0\n', { status: 200 })
        : hubResponse(call.url)
  )

  assertEquals(schemaStepOf(result), 'url-not-uploaded')
  assertEquals(
    calls.map(call => call.url),
    [
      'https://example.test/openapi.yaml',
      'https://hub.test/v1/projects',
      'https://hub.test/v1/projects/acme/pets-app/client-config'
    ]
  )
})

Deno.test('createHeadless - schemaStep is no-source when client.json#source is empty', async () => {
  const { result, calls } = await runCreate({ api: '@acme/pets' }, call => hubResponse(call.url))

  assertEquals(schemaStepOf(result), 'no-source')
  assertEquals(
    calls.filter(call => call.url.includes('/revisions') || call.url.includes('/v1/apis/')),
    []
  )
})

Deno.test('createHeadless - schemaStep is registered when client.json#api is not set', async () => {
  const { result } = await runCreate({ source: 'schemas/openapi.yaml' }, call =>
    call.url.includes('/v1/apis/upload')
      ? json({ api: { owner: { handle: 'acme' }, slug: 'pets' } }, 201)
      : hubResponse(call.url)
  )

  assertEquals(schemaStepOf(result), 'registered')
})

// --- printCreateResult -------------------------------------------------------

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

const CREATED: CreateResult = {
  type: 'created',
  projectName: 'pets',
  project: { account: 'acme', slug: 'pets-app' },
  origin: 'https://hub.test',
  stack: 'acme/stack',
  api: { account: 'acme', slug: 'pets' },
  apiRegistered: false,
  schemaStep: 'revision-added',
  enrichmentCount: 0,
  remoteWritten: false
}

const schemaLineOf = (result: CreateResult): string | undefined =>
  capture(() => printCreateResult(result, { format: 'text' })).out.find(line =>
    line.startsWith('  schema: ')
  )

Deno.test('printCreateResult - text names a registered schema', () => {
  assertEquals(
    schemaLineOf({ ...CREATED, apiRegistered: true, schemaStep: 'registered' }),
    '  schema: registered from client.json#source'
  )
})

Deno.test('printCreateResult - text names an added revision', () => {
  assertEquals(
    schemaLineOf({ ...CREATED, schemaStep: 'revision-added' }),
    '  schema: added a new revision from the local file'
  )
})

Deno.test('printCreateResult - text names an unchanged file', () => {
  assertEquals(
    schemaLineOf({ ...CREATED, schemaStep: 'unchanged' }),
    '  schema: unchanged (the hub already had this file)'
  )
})

Deno.test('printCreateResult - text says a URL source was not uploaded and may be older', () => {
  assertEquals(
    schemaLineOf({ ...CREATED, schemaStep: 'url-not-uploaded' }),
    "  schema: not uploaded (URL source); bound the hub's latest revision of acme/pets, which may be older than the document at the URL now"
  )
})

Deno.test('printCreateResult - text says there was no source', () => {
  assertEquals(
    schemaLineOf({ ...CREATED, schemaStep: 'no-source' }),
    "  schema: no client.json#source; bound the hub's latest revision of acme/pets"
  )
})

Deno.test('printCreateResult - the schema line follows the api line', () => {
  const { out } = capture(() => printCreateResult(CREATED, { format: 'text' }))

  const apiLine = out.indexOf('  api: acme/pets')
  assertEquals(out.slice(apiLine, apiLine + 2), [
    '  api: acme/pets',
    '  schema: added a new revision from the local file'
  ])
})

Deno.test('printCreateResult - JSON output carries schemaStep', () => {
  const { out } = capture(() =>
    printCreateResult({ ...CREATED, schemaStep: 'url-not-uploaded' }, { format: 'json' })
  )

  assertEquals(JSON.parse(out.join('\n')).schemaStep, 'url-not-uploaded')
})
