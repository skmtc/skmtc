/**
 * Test helpers for commands that branch on `resolveInputMode()` /
 * `failWithRecipe()`. The helpers stand up the two scenarios every
 * ported command's test suite needs:
 *
 *   1. **Force-interactive** via `withFakeTty`: Deno's test runner is
 *      non-TTY, so without a stub `resolveInputMode()` always returns
 *      `'strict'`. Tests that exercise the Ink branch need the stub.
 *
 *   2. **Capture exit** via `withCapturedExit`: `failWithRecipe` calls
 *      `Deno.exit(2)`, which would terminate the test runner. The
 *      helper stubs both `console.error` and `Deno.exit`, runs `fn`,
 *      restores everything, and returns what was emitted.
 *
 * Both stubs mutate global state (`Deno.stdin.isTerminal`, `Deno.exit`,
 * `console.error`). The `try/finally` blocks restore originals
 * regardless of failure path so tests stay isolated.
 *
 * Despite the `.test.ts` filename, this module contains no tests of
 * its own. The naming keeps Deno's `deno test` walker happy without
 * forcing a separate `test-helpers/` layout.
 */

export const withFakeTty = async (fn: () => Promise<void>): Promise<void> => {
  const stdinOriginal = Deno.stdin.isTerminal.bind(Deno.stdin)
  const stdoutOriginal = Deno.stdout.isTerminal.bind(Deno.stdout)
  Deno.stdin.isTerminal = () => true
  Deno.stdout.isTerminal = () => true
  try {
    await fn()
  } finally {
    Deno.stdin.isTerminal = stdinOriginal
    Deno.stdout.isTerminal = stdoutOriginal
  }
}

export type CapturedExit = {
  errors: string[]
  exitCode: number | undefined
}

export const withCapturedExit = async (fn: () => Promise<void>): Promise<CapturedExit> => {
  const errors: string[] = []
  const originalError = console.error
  let exitCode: number | undefined
  console.error = (msg: string) => errors.push(msg)
  const originalExit = Deno.exit
  // The stub throws so control returns to the caller; `Deno.exit` is
  // typed `(code?: number) => never`, so a `throw` matches that
  // contract structurally even though it doesn't terminate the
  // process the way the real implementation does.
  Deno.exit = ((code?: number) => {
    exitCode = code
    throw new Error('__exit__')
  }) as typeof Deno.exit

  try {
    try {
      await fn()
    } catch (e) {
      if (!(e instanceof Error) || e.message !== '__exit__') throw e
    }
  } finally {
    console.error = originalError
    Deno.exit = originalExit
  }

  return { errors, exitCode }
}

export const captureStdout = async (fn: () => Promise<void>): Promise<string[]> => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    await fn()
  } finally {
    console.log = original
  }
  return logs
}
