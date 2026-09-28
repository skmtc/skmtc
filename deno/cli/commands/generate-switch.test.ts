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

  assertEquals(exitCode, 2)
  assertEquals(errors.length, 1)
  assertStringIncludes(errors[0], 'missing required argument: <schema>')
  assertStringIncludes(errors[0], 'client.json')
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
    bundles.push(await Deno.readTextFile(fromFileUrl(bundlePath)))
    return {
      stats: { tokens: 0, lines: 0, totalTime: 0, errors: [], files: 0 },
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
  generateLocalFn: typeof generateLocal
): Promise<CapturedExit> => {
  let captured: CapturedExit = { errors: [], exitCode: undefined }
  await captureStdout(async () => {
    captured = await withCapturedExit(() =>
      generateSwitch({
        projectName,
        schemaSourceString: undefined,
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
        assertEquals(existsSync(join(projectPath, 'bundle.js')), false)
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
