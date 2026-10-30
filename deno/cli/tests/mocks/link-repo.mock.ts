import { join } from '@std/path/join'

/** A workflow that publishes with the action. */
export const PUBLISH_ACTION_WORKFLOW =
  'jobs:\n  publish:\n    steps:\n      - uses: skmtc/publish-action@v1\n'

/** A workflow that publishes with the CLI. */
export const PUBLISH_CLI_WORKFLOW =
  'jobs:\n  publish:\n    steps:\n      - run: skmtc api publish openapi.yaml --api @acme/pets\n'

/** A workflow that does not publish. */
export const TEST_WORKFLOW = 'jobs:\n  test:\n    steps:\n      - run: deno test\n'

/**
 * Git variables a hook exports. Unset them around a test, or git and the
 * command under test read the repository the hook runs in.
 */
export const UNSET_GIT_VARIABLES = { GIT_DIR: undefined, GIT_WORK_TREE: undefined }

const git = async (cwd: string, args: string[]): Promise<void> => {
  const output = await new Deno.Command('git', {
    args: [`--git-dir=${join(cwd, '.git')}`, `--work-tree=${cwd}`, ...args],
    cwd,
    stdout: 'null',
    stderr: 'piped'
  }).output()
  if (!output.success) {
    throw new Error(`git ${args.join(' ')}: ${new TextDecoder().decode(output.stderr)}`)
  }
}

/**
 * A temporary git repository with `remote` as its origin (none when unset)
 * and `workflows` in `.github/workflows/`. The caller removes it.
 */
export const makeLinkRepo = async ({
  remote,
  workflows = {}
}: {
  remote?: string
  workflows?: Record<string, string>
}): Promise<string> => {
  const root = await Deno.realPath(await Deno.makeTempDir())
  await git(root, ['init', '--quiet'])
  if (remote !== undefined) await git(root, ['remote', 'add', 'origin', remote])
  const folder = join(root, '.github', 'workflows')
  await Deno.mkdir(folder, { recursive: true })
  for (const [name, text] of Object.entries(workflows)) {
    await Deno.writeTextFile(join(folder, name), text)
  }
  return root
}
