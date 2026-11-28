type WaitForOptions = {
  /** How long to keep trying, in milliseconds. */
  timeout?: number
  /** How long to wait between tries, in milliseconds. */
  interval?: number
}

/**
 * Runs `check` until it stops throwing. When `timeout` passes first, throws
 * the last error `check` threw, so the failure shows the assertion's own
 * message.
 *
 * Use it instead of a fixed sleep before reading `lastFrame()` or a spy: a
 * slow machine needs more time than the sleep gives, and a fast one wastes it.
 *
 * After `check` passes, it waits one more timer turn before it returns. Ink
 * attaches a prompt's input handler in an effect, which React runs with
 * `setImmediate` after the frame is drawn, and Deno runs queued immediates
 * before the next timer. Without that turn, a key written to `stdin` as soon
 * as the prompt shows can arrive before the handler and be lost.
 */
export const waitFor = async (
  check: () => void,
  { timeout = 5000, interval = 10 }: WaitForOptions = {}
): Promise<void> => {
  const deadline = Date.now() + timeout

  while (!passes(check, deadline)) {
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  await new Promise(resolve => setTimeout(resolve, 0))
}

/** Whether `check` passes. Throws its error once `deadline` has passed. */
const passes = (check: () => void, deadline: number): boolean => {
  try {
    check()
    return true
  } catch (error) {
    if (Date.now() >= deadline) {
      throw error
    }
    return false
  }
}
