import { assertEquals, assertStringIncludes } from '@std/assert'
import { renderProjectRm } from '@/commands/project.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { withCapturedExit } from '@/tests/strict-mode-helpers.test.ts'

Deno.test('renderProjectRm - two projects and no --from fails with the recipe', async () => {
  // It used to fall back to the first folder and take the account from it.
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderProjectRm({
      skmtcRoot: createMockSkmtcRoot(createMockManager()),
      name: 'my-api-sandbox',
      from: undefined,
      token: 'pat-123',
      env: undefined,
      noInputFlag: true
    })
  })

  assertEquals(exitCode, 2)
  assertStringIncludes(errors.join('\n'), '--from')
})
