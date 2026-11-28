import { assertEquals, assertRejects } from '@std/assert'
import { waitFor } from '@/test/wait-for.ts'

Deno.test('waitFor - returns once the check stops throwing', async () => {
  const readyAt = Date.now() + 50

  await waitFor(() => assertEquals(Date.now() >= readyAt, true))

  assertEquals(Date.now() >= readyAt, true)
})

Deno.test('waitFor - throws the last error of the check when the timeout passes', async () => {
  await assertRejects(
    () =>
      waitFor(
        () => {
          throw new Error('still not ready')
        },
        { timeout: 30 }
      ),
    Error,
    'still not ready'
  )
})

// React runs the effects of a render, where Ink attaches input handlers,
// with `setImmediate`. A key written before they run is lost.
Deno.test('waitFor - runs the work queued with setImmediate before it returns', async () => {
  const ran: string[] = []
  setImmediate(() => setImmediate(() => ran.push('effect')))

  await waitFor(() => {})

  assertEquals(ran, ['effect'])
})
