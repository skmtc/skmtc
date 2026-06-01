import { assertStringIncludes } from '@std/assert'
import { toBundleFailureMessage } from '@/lib/create-bundle.ts'

Deno.test('toBundleFailureMessage', async t => {
  await t.step('includes the captured `deno bundle` stderr', () => {
    // Diagnosis: before this helper, `createBundle` threw a bare
    // `Error('Failed to create bundle')` — every distinct failure
    // (wrong Deno version, missing import-map entry, bad specifier)
    // collapsed to the same opaque message and the real cause was
    // only in `.settings/error-logs.txt`.
    const stderr = new TextEncoder().encode(
      'error: Import "@skmtc/worker" not a dependency and not in import map'
    )

    const message = toBundleFailureMessage({
      projectPath: '/root/.skmtc/lab',
      errorLogsPath: '/root/.skmtc/lab/.settings/error-logs.txt',
      stderr
    })

    assertStringIncludes(message, '@skmtc/worker')
    assertStringIncludes(message, 'not a dependency and not in import map')
    assertStringIncludes(message, '/root/.skmtc/lab')
    assertStringIncludes(message, 'error-logs.txt')
  })

  await t.step('still names the log file when stderr is empty', () => {
    const message = toBundleFailureMessage({
      projectPath: '/p',
      errorLogsPath: '/p/.settings/error-logs.txt',
      stderr: new Uint8Array()
    })

    assertStringIncludes(message, 'error-logs.txt')
    assertStringIncludes(message, 'no stderr captured')
  })
})
