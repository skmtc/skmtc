import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import { createHeadless } from '@/lib/project-headless.ts'
import { Manager } from '@/lib/manager.ts'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'

const originalFetch = globalThis.fetch
const originalCwd = Deno.cwd()

type Call = { url: string; method?: string }

/**
 * A workspace root outside any `.skmtc` ancestor, so `toAbsoluteRootPath`
 * resolves to the cwd: the test runs with the root as its cwd.
 */
const makeFixture = async ({ api, source }: { api?: string; source: string }): Promise<string> => {
  const root = await Deno.makeTempDir()
  const projectPath = join(root, '.skmtc', 'pets')
  await Deno.mkdir(join(projectPath, '.settings'), { recursive: true })
  await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ name: '@acme/stack' }))
  await Deno.writeTextFile(
    join(projectPath, '.settings', 'client.json'),
    JSON.stringify({ api, source, settings: { basePath: '.' } })
  )
  await Deno.mkdir(join(root, 'schemas'), { recursive: true })
  await Deno.writeTextFile(join(root, source), 'openapi: 3.1.0\n')

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
    const skmtcRoot = await SkmtcRoot.open(new Manager())
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(fetchStub({ url: input.toString(), method: init?.method }))
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
