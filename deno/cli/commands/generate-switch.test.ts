import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { generateSwitch } from '@/commands/generate-switch.ts'
import { withCapturedExit } from '@/tests/strict-mode-helpers.test.ts'
import { join } from '@std/path/join'
import { checkModuleGraph } from '@/lib/duplicate-packages.ts'
import {
  bundleWithoutCheck,
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

Deno.test('generateSwitch - refuses a bundle.js holding two copies of @skmtc/core', async () => {
  // An older CLI built a two-core bundle.js. The pins were fixed since
  // without rebundling, so the module graph now holds one core — generate
  // must judge the bundle.js it is about to run, not the graph.
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      { generatorVersion: '0.2.0' },
      async ({ projectName, projectPath }) => {
        await bundleWithoutCheck(projectPath)
        const denoJsonPath = join(projectPath, 'deno.json')
        const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath))
        denoJson.imports['@skmtc/gen-a'] = 'jsr:@skmtc/gen-a@0.1.0'
        await Deno.writeTextFile(denoJsonPath, JSON.stringify(denoJson))
        assertEquals((await checkModuleGraph(projectPath)).type, 'single-copies')

        const { errors, exitCode } = await withCapturedExit(async () => {
          await generateSwitch({
            projectName,
            schemaSourceString: undefined,
            watch: undefined,
            noInputFlag: true
          })
        })

        assertEquals(exitCode, 1)
        assertEquals(errors.length, 1)
        assertStringIncludes(
          errors[0],
          'bundle.js of project "api" holds more than one copy of @skmtc/core'
        )
        assertStringIncludes(errors[0], '  @skmtc/core 0.1.0\n  @skmtc/core 0.2.0')
        assertStringIncludes(errors[0], 'skmtc bundle api')
      }
    )
  })
})
