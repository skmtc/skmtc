import { assert, assertEquals } from '@std/assert'
import { fromFileUrl } from '@std/path/from-file-url'
import { join } from '@std/path/join'

/**
 * End-to-end through the real `deno lint` driver, which is the only way to
 * verify the parts `Deno.lint.runPlugin` does not model: that a project
 * loads the plugin from its `deno.json`, that `deno-lint-ignore
 * skmtc/<rule>` suppresses a signed-off site, and that
 * `lint.rules.exclude` drops a rule wholesale (the escape hatch for the
 * informational checks, since `deno lint` has no warn severity).
 */

const PLUGIN_PATH = fromFileUrl(import.meta.resolve('../../mod.ts'))

const SOURCE = `// deno-lint-ignore skmtc/no-as-casts -- upstream types lack the narrowing
export const approved = raw as Narrowed
export const unapproved = raw as Other
export const stub = \`// TODO: fill this in\`
`

type Diagnostic = { code: string }

const lintProject = async (
  denoJson: Record<string, unknown>
): Promise<{ codes: string[]; exitCode: number }> => {
  const root = await Deno.makeTempDir({ prefix: 'skmtc-lint-driver-' })
  try {
    await Deno.writeTextFile(join(root, 'deno.json'), JSON.stringify(denoJson))
    await Deno.mkdir(join(root, 'src'))
    await Deno.writeTextFile(join(root, 'src', 'Value.ts'), SOURCE)

    const command = new Deno.Command(Deno.execPath(), {
      args: ['lint', '--json'],
      cwd: root,
      stdout: 'piped',
      stderr: 'piped'
    })
    const output = await command.output()
    const report: unknown = JSON.parse(new TextDecoder().decode(output.stdout))
    assert(report !== null && typeof report === 'object' && 'diagnostics' in report)
    const { diagnostics } = report
    assert(Array.isArray(diagnostics))
    return {
      codes: diagnostics
        .filter((diagnostic: Diagnostic) => diagnostic.code.startsWith('skmtc/'))
        .map((diagnostic: Diagnostic) => diagnostic.code)
        .sort(),
      exitCode: output.code
    }
  } finally {
    await Deno.remove(root, { recursive: true })
  }
}

Deno.test('deno lint: loads the plugin, honours the ignore directive, fails the run', async () => {
  const { codes, exitCode } = await lintProject({ lint: { plugins: [PLUGIN_PATH] } })
  assertEquals(codes, ['skmtc/no-as-casts', 'skmtc/no-emitted-todos'])
  assertEquals(exitCode, 1)
})

Deno.test('deno lint: an informational rule can be excluded wholesale', async () => {
  const { codes } = await lintProject({
    lint: { plugins: [PLUGIN_PATH], rules: { exclude: ['skmtc/no-emitted-todos'] } }
  })
  assertEquals(codes, ['skmtc/no-as-casts'])
})
