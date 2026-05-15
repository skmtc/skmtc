/**
 * Pipe TypeScript source through `deno fmt` and return the formatted
 * result. Used by bit-identical regression tests so that trivial
 * formatting trivia (whitespace, quote style, trailing semicolons)
 * doesn't break the assertion when SKMTC's render layer is, by
 * design, unformatted.
 *
 * The render layer in `@skmtc/core` does NOT run a formatter
 * (consumers format separately — see the skill's §1). For tests this
 * is inconvenient: a change in template-literal trivia inside a
 * generator would produce textually-different but semantically-
 * identical output. Routing both expected and actual through
 * `deno fmt` normalises that away.
 *
 * Requires `--allow-run=deno` (or broader `--allow-run`).
 */
export const formatTs = async (code: string): Promise<string> => {
  const cmd = new Deno.Command('deno', {
    args: ['fmt', '--ext', 'ts', '-'],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped'
  })
  const child = cmd.spawn()

  const writer = child.stdin.getWriter()
  await writer.write(new TextEncoder().encode(code))
  await writer.close()

  const { code: exitCode, stdout, stderr } = await child.output()

  if (exitCode !== 0) {
    const errText = new TextDecoder().decode(stderr)
    throw new Error(`deno fmt failed (exit ${exitCode}):\n${errText}\n--- input ---\n${code}`)
  }

  return new TextDecoder().decode(stdout)
}
