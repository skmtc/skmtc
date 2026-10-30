export type CapturedRun = { exitCode: number | undefined; stdout: string; stderr: string }

class ExitCalled extends Error {}

/**
 * Run `fn` with `Deno.exit`, `console.log` and `console.error` stubbed, and
 * return the exit code and the output. The `Deno.exit` stub throws, so `fn`
 * stops where the real one would end the process.
 */
export const withCapturedExit = async (fn: () => Promise<unknown>): Promise<CapturedRun> => {
  const out: string[] = []
  const err: string[] = []
  const original = { exit: Deno.exit, log: console.log, error: console.error }
  let exitCode: number | undefined
  console.log = (...parts: unknown[]) => out.push(parts.join(' '))
  console.error = (...parts: unknown[]) => err.push(parts.join(' '))
  Deno.exit = (code?: number): never => {
    exitCode = code
    throw new ExitCalled()
  }
  try {
    await fn()
  } catch (error) {
    if (!(error instanceof ExitCalled)) throw error
  } finally {
    Deno.exit = original.exit
    console.log = original.log
    console.error = original.error
  }
  return { exitCode, stdout: out.join('\n'), stderr: err.join('\n') }
}
