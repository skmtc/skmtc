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

/** `true` when the opener ran and succeeded. A failure is not an error: the caller prints the URL. */
export const openUrl = async (
  url: string,
  { os = Deno.build.os }: { os?: typeof Deno.build.os } = {}
): Promise<boolean> => {
  const args = toOpenArgs(url, os)
  if (args === undefined) return false
  const output = await new Deno.Command('sh', {
    args,
    stdin: 'null',
    stdout: 'null',
    stderr: 'null'
  })
    .output()
    .catch(() => undefined)
  return output?.success === true
}
