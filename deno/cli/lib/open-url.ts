/**
 * Open a URL in the browser, through `sh`: the recommended install grants
 * `--allow-run=deno,sh` only. The URL is a positional argument after the
 * script, never part of the script text.
 */

/** The `sh` arguments that open `url` on `os`, or nothing where there is no opener. */
export const toOpenArgs = (url: string, os: typeof Deno.build.os): string[] | undefined => {
  switch (os) {
    case 'darwin':
      return ['-c', 'open "$1"', 'sh', url]
    case 'linux':
      return ['-c', 'xdg-open "$1"', 'sh', url]
    default:
      return undefined
  }
}

/**
 * How long to wait for the opener to exit. `xdg-open` can run the browser in
 * the foreground; after this the opener is left running and counts as opened.
 */
const OPENER_WAIT_MS = 2_000

const spawnOpener = (args: string[]): Deno.ChildProcess | undefined => {
  try {
    return new Deno.Command('sh', { args, stdin: 'null', stdout: 'null', stderr: 'null' }).spawn()
  } catch {
    return undefined
  }
}

/**
 * `true` when the opener succeeded, or still runs after `waitMs`. A failure
 * is not an error: the caller prints the URL.
 */
export const openUrl = async (
  url: string,
  {
    os = Deno.build.os,
    waitMs = OPENER_WAIT_MS
  }: { os?: typeof Deno.build.os; waitMs?: number } = {}
): Promise<boolean> => {
  const args = toOpenArgs(url, os)
  if (args === undefined) return false
  const child = spawnOpener(args)
  if (child === undefined) return false

  const waited = Promise.withResolvers<'running'>()
  const timer = setTimeout(() => waited.resolve('running'), waitMs)
  const exited = await Promise.race([child.status.then(status => status.success), waited.promise])
  clearTimeout(timer)
  if (exited !== 'running') return exited

  // Do not hold the command open until the browser closes.
  child.unref()
  return true
}
