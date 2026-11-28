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

// On a slow runner the event loop stalls. A timer that is due by then fires
// before the immediates queued ahead of it.
Deno.test('waitFor - runs the queued work even when the event loop stalls', async () => {
  const ran: string[] = []
  setImmediate(() => ran.push('effect'))

  // The check passes at once, so waitFor has queued its wait when it returns
  // the promise. The stall then runs before the event loop turns.
  const waiting = waitFor(() => {})
  stall(5)
  await waiting

  assertEquals(ran, ['effect'])
})

/** Blocks the event loop for `milliseconds`. */
const stall = (milliseconds: number): void => {
  const until = Date.now() + milliseconds
  while (Date.now() < until) {
    // Busy-wait so no timer or immediate can run.
  }
}
