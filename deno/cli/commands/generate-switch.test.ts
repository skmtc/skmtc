import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { generateSwitch } from '@/commands/generate-switch.ts'
import { withCapturedExit } from '@/tests/strict-mode-helpers.test.ts'

Deno.test(
  'generateSwitch - strict mode without a resolvable schema fails with a recipe error',
  async () => {
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
  }
)

Deno.test(
  'generateSwitch - --json and --watch together fail loudly with exit 2',
  async () => {
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
  }
)
