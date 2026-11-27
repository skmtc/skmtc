import { assertEquals } from '@std/assert/equals'
import { assertNotEquals } from '@std/assert/not-equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import { StackTrail, toArtifacts } from '@skmtc/core'
import { toGenerateLocalArgs } from '@/lib/to-generate-local-args.ts'
import { captureConsole, withConfigRoot } from '@/tests/config-files.mock.ts'
import { stub } from '@std/testing/mock'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { Project } from '@/lib/project.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { withEnv } from '@/tests/mocks/env.mock.ts'

// A schema that fails under the default `not: strict` and parses under `not: unknown`.
const openapi = {
  openapi: '3.1.0',
  info: { title: 'pets', version: '1' },
  paths: {},
  components: {
    schemas: {
      Pet: { type: 'object', properties: { id: { type: 'string' } } },
      AnythingButAString: { not: { type: 'string' } }
    }
  }
}

/**
 * Reads the project's config as `skmtc generate` does, runs core on the
 * settings it reads, and returns the output without its timings and ids.
 */
const generate = async (projectName: string) => {
  const args = await toGenerateLocalArgs({ projectName, schemaSourceString: undefined, watch: undefined })

  if (!args) {
    throw new Error(`no generate args for ${projectName}`)
  }

  const { artifacts, manifest } = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: JSON.parse(args.schemaContents) },
    settings: args.clientSettings,
    toGeneratorConfigMap: () => ({}),
    startAt: 0,
    silent: true,
    stackTrail: new StackTrail(['trace'])
  })

  return JSON.stringify({ artifacts, parseIssues: manifest.parseIssues, results: manifest.results }, null, 2)
}

Deno.test('generate - client.json with settings.system gives the same output as skmtc.config.json with settings.parse', async () => {
  // A schema source relative to the root, where the test runs.
  const source = 'openapi.json'
  const projects = {
    legacy: { 'client.json': { source, settings: { basePath: 'src', system: { not: 'unknown' } } } },
    current: { 'skmtc.config.json': { source, settings: { basePath: 'src', parse: { not: 'unknown' } } } },
    // Without the setting: the output it changes.
    unset: { 'skmtc.config.json': { source, settings: { basePath: 'src' } } }
  }

  await withConfigRoot(projects, async ({ tempRoot }) => {
    await Deno.writeTextFile(join(tempRoot, source), JSON.stringify(openapi))

    const legacy = await captureConsole(() => generate('legacy'))
    const current = await captureConsole(() => generate('current'))
    const unset = await captureConsole(() => generate('unset'))

    assertEquals(legacy.value, current.value)
    // The setting is read under either name: without it, the output differs.
    assertNotEquals(legacy.value, unset.value)

    // The old names print their deprecation warnings; the new names print none.
    assertEquals(legacy.stderr.length, 2)
    assertStringIncludes(legacy.stderr[0], 'client.json')
    assertStringIncludes(legacy.stderr[1], 'settings.system')
    assertEquals(current.stderr, [])
    assertEquals(legacy.stdout, [])
  })
})

Deno.test('generate - a config written with settings.parse reaches the engine as system, which a core before 0.49 reads', async () => {
  const source = 'openapi.json'

  await withConfigRoot(
    { legacy: { 'client.json': { source, settings: { basePath: 'src', system: { not: 'unknown' } } } } },
    async ({ tempRoot, readFile }) => {
      await Deno.writeTextFile(join(tempRoot, source), JSON.stringify(openapi))

      // Any command's cleanup writes the config back with `parse`.
      const manager = createMockManager()
      await captureConsole(async () => {
        await Project.open('legacy', manager)
        await Promise.all(manager.cleanupActions.map(action => action()))
      })
      assertStringIncludes(readFile('legacy', 'client.json') ?? '', '"parse"')

      const { value: args } = await captureConsole(() =>
        toGenerateLocalArgs({ projectName: 'legacy', schemaSourceString: undefined, watch: undefined })
      )

      // The stack server path: what the CLI posts is what the engine reads.
      const bodies: string[] = []
      const fetchStub = stub(globalThis, 'fetch', (_input, init) => {
        bodies.push(String(init?.body))
        return Promise.resolve(Response.json({ artifacts: {}, manifest: { files: {} } }))
      })

      try {
        await withEnv({ SKMTC_HUB_TOKEN: 'pat' }, () =>
          GenerateArtifacts.generateWithWorker({
            bundlePath: undefined,
            schemaContents: args?.schemaContents ?? '',
            fileType: 'json',
            clientSettings: args?.clientSettings,
            stackUrl: 'https://stack.test'
          })
        )
      } finally {
        fetchStub.restore()
      }

      const sent = JSON.parse(bodies[0]).clientSettings
      // A core before 0.49 reads `settings.system` only.
      assertEquals(sent.system, { not: 'unknown' })
      assertEquals('parse' in sent, false)
    }
  )
})
