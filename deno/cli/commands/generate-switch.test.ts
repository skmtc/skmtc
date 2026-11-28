import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { generateSwitch } from '@/commands/generate-switch.ts'
import {
  captureStdout,
  type CapturedExit,
  withCapturedExit
} from '@/tests/strict-mode-helpers.test.ts'
import { join } from '@std/path/join'
import { fromFileUrl } from '@std/path/from-file-url'
import { existsSync } from '@std/fs/exists'
import { ensureDir } from '@std/fs/ensure-dir'
import type { generateLocal } from '@/lib/generate-local.ts'
import { stub } from '@std/testing/mock'
import type { ManifestContent } from '@skmtc/core/Manifest'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { enableConfigMigrationOffer } from '@/lib/config-migration-offer.ts'
import { withConfigRoot } from '@/tests/config-files.mock.ts'
import {
  bundleWithoutCheck,
  type RegistryPackages,
  twoCoreRegistry,
  withJsrRegistryServer,
  withRegistryProject
} from '@/tests/mocks/jsr-registry-server.mock.ts'

Deno.test('generateSwitch - strict mode without a resolvable schema fails with a recipe error', async () => {
  // Reproduces the routing path that previously fell through to
  // Ink: a remote-only project with no schema in client.json and
  // none passed positionally. In strict mode this used to mount
  // Ink (and crash with "Raw mode is not supported"); now it
  // emits an actionable recipe.
  const { errors, exitCode } = await withCapturedExit(async () => {
    // generate-zod is the canonical remote-only project in the
    // local skmtc-root sandbox; its client.json has no `source`
    // pinned. If this dir is ever moved or the project deleted
    // the test will need a different fixture.
    await generateSwitch({
      projectName: 'generate-zod',
      schemaSourceString: undefined,
      watch: undefined,
      noInputFlag: true
    })
  })

  // The fixture is a real project, which may still use client.json: its
  // deprecation warning goes to stderr too, so count only the errors.
  const recipeErrors = errors.filter(error => !error.startsWith('Warning:'))

  assertEquals(exitCode, 2)
  assertEquals(recipeErrors.length, 1)
  assertStringIncludes(recipeErrors[0], 'missing required argument: <schema>')
  assertStringIncludes(recipeErrors[0], 'skmtc.config.json')
  // The schema source is the config's top-level `source` key, and the
  // recipe names the flag that writes it.
  assertStringIncludes(recipeErrors[0], 'skmtc generate <project> <schema> --save')
  assertStringIncludes(recipeErrors[0], 'written as `source` in')
  assertEquals(recipeErrors[0].includes('settings.source'), false)
})

// The trap: this is a wrong use of a flag, in a terminal too. The error for
// a missing argument says that skmtc is in non-interactive mode, which is
// false for a person at a terminal.
Deno.test('generateSwitch - --save with no schema argument fails, and does not name a mode', async () => {
  const { errors, exitCode } = await withCapturedExit(async () => {
    await generateSwitch({
      projectName: 'my-api',
      schemaSourceString: undefined,
      watch: undefined,
      saveFlag: true
    })
  })

  assertEquals(exitCode, 2)
  assertEquals(errors.length, 1)
  assertStringIncludes(errors[0], '--save needs the <schema> argument')
  assertStringIncludes(errors[0], 'skmtc generate <project> <schema> --save')
  assertEquals(errors[0].includes('non-interactive'), false)
})

// The trap: the save looked for a config first, so a mistyped name got
// "run `skmtc init`" and exit 1, where the same name without --save gets
// the list of projects and exit 2.
Deno.test('generateSwitch - --save with a name that is not a project fails like a run without --save', async () => {
  await withConfigRoot({ 'my-api': { 'skmtc.config.json': {} } }, async ({ tempRoot }) => {
    const schemaPath = join(tempRoot, 'openapi.json')

    await Deno.writeTextFile(schemaPath, '{"openapi":"3.0.3"}')

    const { errors, exitCode } = await withCapturedExit(async () => {
      await generateSwitch({
        projectName: 'not-a-project',
        schemaSourceString: schemaPath,
        watch: undefined,
        noInputFlag: true,
        saveFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertStringIncludes(errors[0], 'missing required argument: <project>')
    assertStringIncludes(errors[0], 'ls .skmtc/')
  })
})

Deno.test('generateSwitch - --json and --watch together fail loudly with exit 2', async () => {
  // The two flags are mutually exclusive by design: --json emits a
  // single structured object and exits, --watch is a stream. We
  // surface this *before* attempting any generation work so the
  // caller learns immediately rather than after the first cycle.
  const { errors, exitCode } = await withCapturedExit(async () => {
    await generateSwitch({
      projectName: 'my-api',
      schemaSourceString: undefined,
      watch: true,
      jsonFlag: true
    })
  })

  assertEquals(exitCode, 2)
  assertEquals(errors.length, 1)
  assertStringIncludes(errors[0], '--json and --watch are mutually exclusive')
  assertStringIncludes(errors[0], 'Pick one')
})

/** Stands in for the worker run: records the bundle.js each call was handed. */
const toRecordingGenerateLocal = () => {
  const bundles: string[] = []
  const generateLocalFn: typeof generateLocal = async ({ bundlePath }) => {
    if (bundlePath === undefined) throw new Error('generate ran without building a bundle')
    bundles.push(await Deno.readTextFile(fromFileUrl(bundlePath)))
    return {
      stats: { lines: 0, totalTime: 0, errors: [], files: 0 },
      parseIssues: [],
      enrichmentWarnings: [],
      filePaths: [],
      protectedPaths: [],
      escaped: []
    }
  }
  return { bundles, generateLocalFn }
}

const runGenerate = async (
  projectName: string,
  generateLocalFn: typeof generateLocal,
  schemaSourceString?: string
): Promise<CapturedExit> => {
  let captured: CapturedExit = { errors: [], exitCode: undefined }
  await captureStdout(async () => {
    captured = await withCapturedExit(() =>
      generateSwitch({
        projectName,
        schemaSourceString,
        watch: undefined,
        noInputFlag: true,
        generateLocalFn
      })
    )
  })
  return captured
}

const setImport = async (projectPath: string, name: string, specifier: string) => {
  const denoJsonPath = join(projectPath, 'deno.json')
  const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath))
  denoJson.imports[name] = specifier
  await Deno.writeTextFile(denoJsonPath, JSON.stringify(denoJson))
}

Deno.test('generateSwitch - refuses a module graph with two copies of @skmtc/core', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0' },
      async ({ projectName, projectPath }) => {
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()

        const { errors, exitCode } = await runGenerate(projectName, generateLocalFn)

        assertEquals(exitCode, 1)
        assertEquals(errors.length, 1)
        assertStringIncludes(errors[0], 'Project "api" resolves more than one copy of @skmtc/core')
        assertStringIncludes(errors[0], '@skmtc/core 0.1.0 ← @skmtc/worker@0.1.0')
        assertStringIncludes(errors[0], '@skmtc/core 0.2.0 ← @skmtc/gen-a@0.2.0')
        assertEquals(bundles, [])
        // The refused build left the earlier bundle.js alone and nothing ran it.
        assertEquals(
          await Deno.readTextFile(join(projectPath, 'bundle.js')),
          'export default undefined\n'
        )
      }
    )
  })
})

Deno.test('generateSwitch - never runs a bundle.js built by an older CLI', async () => {
  // An older CLI built a two-core bundle.js. The pins were fixed since,
  // without a separate `skmtc bundle`.
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0' },
      async ({ projectName, projectPath }) => {
        await bundleWithoutCheck(projectPath)
        const olderBundle = await Deno.readTextFile(join(projectPath, 'bundle.js'))
        assertStringIncludes(olderBundle, '@skmtc/core/0.2.0/')
        await setImport(projectPath, '@skmtc/gen-a', 'jsr:@skmtc/gen-a@0.1.0')
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()

        const { exitCode } = await runGenerate(projectName, generateLocalFn)

        assertEquals(exitCode, 0)
        assertEquals(bundles.length, 1)
        assertStringIncludes(bundles[0], '@skmtc/gen-a/0.1.0/')
        assertEquals(bundles[0].includes('@skmtc/core/0.2.0/'), false)
      }
    )
  })
})

/** {@link twoCoreRegistry} plus a gen-a patch release that stays on core 0.1.0. */
const patchRegistry: RegistryPackages = {
  ...twoCoreRegistry,
  '@skmtc/gen-a': {
    ...twoCoreRegistry['@skmtc/gen-a'],
    '0.1.1': [
      "import { Definition } from 'jsr:@skmtc/core@0.1.0'",
      "export default { id: '@skmtc/gen-a', Definition }",
      ''
    ].join('\n')
  }
}

Deno.test('generateSwitch - runs against a changed pin without a separate bundle', async () => {
  // The generator ids stay the same; only the pin's version moves.
  await withJsrRegistryServer(patchRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ projectName, projectPath }) => {
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()
        assertEquals((await runGenerate(projectName, generateLocalFn)).exitCode, 0)

        await setImport(projectPath, '@skmtc/gen-a', 'jsr:@skmtc/gen-a@0.1.1')
        assertEquals((await runGenerate(projectName, generateLocalFn)).exitCode, 0)

        assertEquals(bundles.length, 2)
        assertStringIncludes(bundles[0], '@skmtc/gen-a/0.1.0/')
        assertStringIncludes(bundles[1], '@skmtc/gen-a/0.1.1/')
        assertEquals(bundles[1].includes('@skmtc/gen-a/0.1.0/'), false)
      }
    )
  })
})

Deno.test('generateSwitch - runs the edited source of a cloned generator', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0', imports: { '@skmtc/gen-c': './gen-c/mod.ts' } },
      async ({ projectName, projectPath }) => {
        const sourcePath = join(projectPath, 'gen-c', 'mod.ts')
        const writeSource = (label: string) =>
          Deno.writeTextFile(
            sourcePath,
            `export default { id: '@skmtc/gen-c', label: '${label}' }\n`
          )
        await ensureDir(join(projectPath, 'gen-c'))
        await writeSource('before-edit')
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()
        assertEquals((await runGenerate(projectName, generateLocalFn)).exitCode, 0)

        await writeSource('after-edit')
        assertEquals((await runGenerate(projectName, generateLocalFn)).exitCode, 0)

        assertEquals(bundles.length, 2)
        assertStringIncludes(bundles[0], 'before-edit')
        assertStringIncludes(bundles[1], 'after-edit')
        assertEquals(bundles[1].includes('before-edit'), false)
      }
    )
  })
})

Deno.test('generateSwitch - an explicit schema needs no reachable client.json#source', async () => {
  // Building reads the project's pins only, never the configured schema.
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ tempRoot, projectName, projectPath }) => {
        const clientJsonPath = join(projectPath, '.settings', 'skmtc.config.json')
        await Deno.writeTextFile(
          clientJsonPath,
          JSON.stringify({ source: './missing-openapi.json', settings: { basePath: 'src/api' } })
        )
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()

        const { exitCode } = await runGenerate(
          projectName,
          generateLocalFn,
          join(tempRoot, 'openapi.json')
        )

        assertEquals(exitCode, 0)
        assertEquals(bundles.length, 1)
      }
    )
  })
})

Deno.test('generateSwitch - in interactive mode, asks to migrate an old-name project, and on yes generates on the new names', async () => {
  // `serverUrl` makes generate run on the stack server, so no bundle is built.
  const config = {
    source: 'openapi.json',
    serverUrl: 'https://stack.test',
    settings: { basePath: 'src', system: { not: 'unknown' } }
  }

  // shop is on the old names too, but generate pets asks only about pets.
  await withConfigRoot({ pets: { 'client.json': config }, shop: { 'client.json': config } }, async ({ tempRoot, readFile }) => {
    await Deno.writeTextFile(join(tempRoot, 'openapi.json'), JSON.stringify({ openapi: '3.0.0', info: { title: 'p', version: '1' }, paths: {} }))
    const questions: string[] = []
    const settingsSeen: unknown[] = []
    const generateLocalFn: typeof generateLocal = args => {
      settingsSeen.push(args.clientSettings)
      return Promise.resolve({
        stats: { lines: 0, totalTime: 0, errors: [], files: 0 },
        parseIssues: [],
        enrichmentWarnings: [],
        filePaths: [],
        protectedPaths: [],
        escaped: []
      })
    }

    const promptStub = globalThis.prompt
    globalThis.prompt = (message?: string) => (questions.push(message ?? ''), 'y')
    enableConfigMigrationOffer(true)

    try {
      await captureStdout(async () => {
        await withCapturedExit(() =>
          generateSwitch({ projectName: 'pets', schemaSourceString: undefined, watch: undefined, generateLocalFn })
        )
      })
    } finally {
      enableConfigMigrationOffer(false)
      globalThis.prompt = promptStub
    }

    assertEquals(questions.length, 1)
    assertStringIncludes(questions[0], 'pets uses client.json / settings.system')
    assertEquals(questions[0].includes('shop'), false)
    assertEquals(readFile('pets', 'client.json'), undefined)
    assertEquals(readFile('shop', 'client.json') === undefined, false)
    assertEquals(readFile('shop', 'skmtc.config.json'), undefined)
    assertEquals(settingsSeen, [{ basePath: 'src', parse: { not: 'unknown' } }])
  })
})

Deno.test('generateSwitch - a name that is not a project writes nothing', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.1.0' }, async ({ tempRoot }) => {
      const { bundles, generateLocalFn } = toRecordingGenerateLocal()

      const { errors, exitCode } = await runGenerate(
        '.',
        generateLocalFn,
        join(tempRoot, 'openapi.json')
      )

      assertEquals(exitCode, 2)
      assertStringIncludes(errors[0], 'missing required argument: <project>')
      assertEquals(bundles, [])
      for (const fileName of ['worker.ts', 'deno.json', 'bundle.js']) {
        assertEquals(existsSync(join(tempRoot, '.skmtc', fileName)), false)
      }
    })
  })
})

// The first run of a project passes the schema as an argument, and
// `generate` does not keep it. `--save` is what makes the second run work.
Deno.test('generateSwitch - --save stores the schema, and the next run needs no argument', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ tempRoot, projectName, projectPath }) => {
        const configPath = join(projectPath, '.settings', 'skmtc.config.json')
        const schemaPath = join(tempRoot, 'openapi.json')
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()
        const run = (schemaSourceString: string | undefined, saveFlag: boolean) =>
          captureStdout(async () => {
            await withCapturedExit(() =>
              generateSwitch({
                projectName,
                schemaSourceString,
                watch: undefined,
                jsonFlag: true,
                saveFlag,
                generateLocalFn
              })
            )
          })

        // A project as `init` leaves it: no source.
        await Deno.writeTextFile(configPath, JSON.stringify({ settings: { basePath: 'src/api' } }))

        const [first] = await run(schemaPath, true)

        assertEquals(JSON.parse(first).savedSource, {
          source: schemaPath,
          configPath,
          changed: true,
          stored: true
        })
        assertEquals(JSON.parse(await Deno.readTextFile(configPath)), {
          source: schemaPath,
          settings: { basePath: 'src/api' }
        })

        const [second] = await run(undefined, false)

        assertEquals(JSON.parse(second).type, 'generated')
        assertEquals('savedSource' in JSON.parse(second), false)
        assertEquals(bundles.length, 2)
      }
    )
  })
})

// The trap: a relative schema path is read from the Skmtc root (the folder
// that holds `.skmtc/`), not from the current folder. Stored as typed, it
// is read the same way, so a saved source works from any folder below the root.
Deno.test('generateSwitch - --save stores a relative path that later runs read from the root, in any folder', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ tempRoot, projectName, projectPath }) => {
        const configPath = join(projectPath, '.settings', 'skmtc.config.json')
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()
        const run = (schemaSourceString: string | undefined, saveFlag: boolean) =>
          captureStdout(async () => {
            await withCapturedExit(() =>
              generateSwitch({
                projectName,
                schemaSourceString,
                watch: undefined,
                jsonFlag: true,
                saveFlag,
                generateLocalFn
              })
            )
          })

        await Deno.writeTextFile(configPath, JSON.stringify({ settings: { basePath: 'src/api' } }))
        await ensureDir(join(tempRoot, 'web', 'app'))
        Deno.chdir(join(tempRoot, 'web', 'app'))

        const [saved] = await run('./openapi.json', true)

        assertEquals(JSON.parse(saved).savedSource.source, './openapi.json')
        assertEquals(JSON.parse(await Deno.readTextFile(configPath)).source, './openapi.json')

        const [fromSubfolder] = await run(undefined, false)
        Deno.chdir(tempRoot)
        const [fromRoot] = await run(undefined, false)

        assertEquals(JSON.parse(fromSubfolder).type, 'generated')
        assertEquals(JSON.parse(fromRoot).type, 'generated')
        assertEquals(bundles.length, 3)
      }
    )
  })
})

// The trap: `generate` takes any text a URL returns as the schema, the page
// of a 404 too. Stored before the run, a mistyped source replaced one that
// worked, and each later run failed.
Deno.test('generateSwitch - --save does not store the source of a run that had an error', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ tempRoot, projectName, projectPath }) => {
        const configPath = join(projectPath, '.settings', 'skmtc.config.json')
        const schemaPath = join(tempRoot, 'not-a-schema.json')
        const config = { source: './openapi.json', settings: { basePath: 'src/api' } }
        const failingGenerateLocal: typeof generateLocal = () =>
          Promise.resolve({
            stats: { tokens: 0, lines: 0, totalTime: 0, errors: [], files: 0 },
            parseIssues: [
              {
                protocol: 'oas',
                level: 'error',
                type: 'RUN_FAILED',
                location: 'parse',
                message: 'parse phase failed: not an OpenAPI document',
                cause: { name: 'Error', message: 'not an OpenAPI document' }
              }
            ],
            enrichmentWarnings: [],
            filePaths: [],
            protectedPaths: [],
            escaped: []
          })

        await Deno.writeTextFile(configPath, JSON.stringify(config))
        await Deno.writeTextFile(schemaPath, '<html>Not found</html>')

        let exitCode: number | undefined
        const [output] = await captureStdout(async () => {
          const captured = await withCapturedExit(() =>
            generateSwitch({
              projectName,
              schemaSourceString: schemaPath,
              watch: undefined,
              jsonFlag: true,
              saveFlag: true,
              generateLocalFn: failingGenerateLocal
            })
          )

          exitCode = captured.exitCode
        })

        assertEquals(exitCode, 1)
        assertEquals(JSON.parse(output).savedSource, {
          source: schemaPath,
          configPath,
          changed: false,
          stored: false
        })
        assertEquals(JSON.parse(await Deno.readTextFile(configPath)), config)
      }
    )
  })
})

// The trap: `generate` reads a config that does not fit its schema as no
// config. A source written into that file reported a save, and the next
// run did not find it.
Deno.test('generateSwitch - --save refuses a config that generate cannot read, before the run', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.1.0' },
      async ({ tempRoot, projectName, projectPath }) => {
        const configPath = join(projectPath, '.settings', 'skmtc.config.json')
        const schemaPath = join(tempRoot, 'openapi.json')
        const configText = JSON.stringify({ settings: { basePath: 42 } })
        const { bundles, generateLocalFn } = toRecordingGenerateLocal()

        await Deno.writeTextFile(configPath, configText)

        let captured: CapturedExit = { errors: [], exitCode: undefined }
        await captureStdout(async () => {
          captured = await withCapturedExit(() =>
            generateSwitch({
              projectName,
              schemaSourceString: schemaPath,
              watch: undefined,
              jsonFlag: true,
              saveFlag: true,
              generateLocalFn
            })
          )
        })

        assertEquals(captured.exitCode, 1)
        assertStringIncludes(captured.errors[0], '--save cannot store the schema source')
        assertStringIncludes(captured.errors[0], 'settings.basePath')
        assertEquals(await Deno.readTextFile(configPath), configText)
        assertEquals(bundles, [])
      }
    )
  })
})

type TokenRun = { logs: string[]; exitCode: number | undefined }

/**
 * Runs `generate` through the real `generateLocal`, with the worker stubbed
 * to return one generated file. `serverUrl` makes it a remote run, so no
 * bundle is built.
 */
const runGenerateWithOneFile = async ({
  jsonFlag,
  countTokens
}: {
  jsonFlag: boolean
  countTokens: boolean | undefined
}): Promise<TokenRun> => {
  const config = { source: 'openapi.json', serverUrl: 'https://stack.test', settings: { basePath: 'src' } }
  const artifactPath = 'src/pets.generated.ts'
  const manifest: ManifestContent = {
    deploymentId: 'd',
    traceId: 't',
    spanId: 's',
    files: { [artifactPath]: { lines: 1, characters: 42, destinationPath: '@/pets.generated.ts' } },
    previews: {},
    results: {},
    parseIssues: [],
    startAt: 0,
    endAt: 1
  }

  let run: TokenRun = { logs: [], exitCode: undefined }

  await withConfigRoot({ pets: { 'skmtc.config.json': config } }, async ({ tempRoot }) => {
    await Deno.writeTextFile(
      join(tempRoot, 'openapi.json'),
      JSON.stringify({ openapi: '3.0.0', info: { title: 'p', version: '1' }, paths: {} })
    )
    const workerStub = stub(GenerateArtifacts, 'generateWithWorker', () =>
      Promise.resolve({
        artifacts: { [artifactPath]: 'export const pets = ["cat", "dog"] as const\n' },
        manifest
      })
    )

    try {
      let exitCode: number | undefined
      const logs = await captureStdout(async () => {
        const captured = await withCapturedExit(() =>
          generateSwitch({
            projectName: 'pets',
            schemaSourceString: undefined,
            watch: undefined,
            jsonFlag,
            noInputFlag: true,
            countTokens
          })
        )
        exitCode = captured.exitCode
      })
      run = { logs, exitCode }
    } finally {
      workerStub.restore()
    }
  })

  return run
}

Deno.test('generateSwitch - without --count-tokens, --json stats has no tokens key', async () => {
  const { logs, exitCode } = await runGenerateWithOneFile({ jsonFlag: true, countTokens: undefined })

  assertEquals(exitCode, 0)
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.stats.files, 1)
  assertEquals('tokens' in parsed.stats, false)
})

Deno.test('generateSwitch - without --count-tokens, the success line has no token count', async () => {
  const { logs, exitCode } = await runGenerateWithOneFile({ jsonFlag: false, countTokens: undefined })

  assertEquals(exitCode, 0)
  assertEquals(logs[0], 'Generated 1 files under src in 1ms.')
})

Deno.test('generateSwitch - with --count-tokens, --json stats has the token count', async () => {
  const { logs, exitCode } = await runGenerateWithOneFile({ jsonFlag: true, countTokens: true })

  assertEquals(exitCode, 0)
  const parsed = JSON.parse(logs[0])
  assertEquals(typeof parsed.stats.tokens, 'number')
  assertEquals(parsed.stats.tokens > 0, true)
})

Deno.test('generateSwitch - with --count-tokens, the success line has the token count', async () => {
  const { logs, exitCode } = await runGenerateWithOneFile({ jsonFlag: false, countTokens: true })

  assertEquals(exitCode, 0)
  assertEquals(/^Generated \d+ tokens, 1 files under src in 1ms\.$/.test(logs[0]), true)
})
