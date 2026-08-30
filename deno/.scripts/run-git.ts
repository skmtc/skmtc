/**
 * `git` run with the environment cleared apart from what spawning needs.
 *
 * A git hook exports `GIT_DIR` and `GIT_INDEX_FILE`, and a child `git` obeys
 * them over its own working directory — so the same command answers one thing
 * from a shell and another from a pre-push hook. Anything that reads git state
 * on behalf of a check has to ignore an ambient repo pointer, so every such
 * caller goes through here rather than spawning `git` itself.
 *
 * Only the index and the working tree are safe to read this way: they are the
 * same in a shallow clone, which history is not.
 */

const decoder = new TextDecoder()

export const runGit = async (cwd: string, args: string[]): Promise<string> => {
  const output = await new Deno.Command('git', {
    args,
    cwd,
    clearEnv: true,
    env: {
      NO_COLOR: '1',
      PATH: Deno.env.get('PATH') ?? '',
      HOME: Deno.env.get('HOME') ?? ''
    },
    stdout: 'piped',
    stderr: 'piped'
  }).output()

  if (!output.success) {
    throw new Error(`git ${args.join(' ')} failed: ${decoder.decode(output.stderr)}`)
  }

  return decoder.decode(output.stdout)
}
