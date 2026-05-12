import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'
import { homedir } from 'node:os'
import { runTypecheck } from '@/lib/typecheck.ts'

const withTempCwd = async (
  fn: (tempRoot: string) => Promise<void> | void
) => {
  const tempRoot = await Deno.makeTempDir({
    prefix: 'skmtc-typecheck-',
    dir: homedir()
  })
  const prevCwd = Deno.cwd()
  Deno.chdir(tempRoot)
  try {
    await fn(tempRoot)
  } finally {
    Deno.chdir(prevCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
}

Deno.test('runTypecheck - skips with reason no-files when filePaths empty', async () => {
  const result = await runTypecheck({
    filePaths: [],
    basePathAbs: undefined
  })

  assertEquals(result.kind, 'skipped')
  if (result.kind === 'skipped') {
    assertEquals(result.reason, 'no-files')
  }
})

Deno.test(
  'runTypecheck - reports no-tsconfig when none found walking up from basePath',
  async () => {
    // Use a temp dir that has no ancestor tsconfig.json. The search
    // starts at the dir we point basePathAbs at and walks up; in a
    // fresh subdir under HOME there should be none.
    await withTempCwd(async tempRoot => {
      const subdir = join(tempRoot, 'fresh')
      await ensureDir(subdir)

      const result = await runTypecheck({
        filePaths: ['src/foo.ts'],
        basePathAbs: subdir
      })

      assertEquals(result.kind, 'no-tsconfig')
    })
  }
)

Deno.test(
  'runTypecheck - reports passed when tsc reports no diagnostics in this run\'s files',
  { ignore: !canRunTsc() },
  async () => {
    await withTempCwd(async tempRoot => {
      // Build a minimal valid TS project: tsconfig + one well-typed file.
      Deno.writeTextFileSync(
        join(tempRoot, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler'
          }
        })
      )
      await ensureDir(join(tempRoot, 'src'))
      Deno.writeTextFileSync(
        join(tempRoot, 'src', 'ok.ts'),
        'export const x: number = 1\n'
      )

      const result = await runTypecheck({
        filePaths: ['src/ok.ts'],
        basePathAbs: join(tempRoot, 'src')
      })

      assertEquals(result.kind, 'passed')
    })
  }
)

Deno.test(
  'runTypecheck - reports failed and filters diagnostics to this run\'s files',
  { ignore: !canRunTsc() },
  async () => {
    await withTempCwd(async tempRoot => {
      Deno.writeTextFileSync(
        join(tempRoot, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler'
          }
        })
      )
      await ensureDir(join(tempRoot, 'src'))

      // File this run "produced" — should appear in diagnostics.
      Deno.writeTextFileSync(
        join(tempRoot, 'src', 'mine.ts'),
        'export const x: number = "not a number"\n'
      )

      // File that pre-existed and has its own error — should NOT
      // appear in our scoped diagnostics. This is the key behavior:
      // unrelated consumer-app errors don't pollute the result.
      Deno.writeTextFileSync(
        join(tempRoot, 'src', 'theirs.ts'),
        'export const y: number = "also wrong"\n'
      )

      const result = await runTypecheck({
        filePaths: ['src/mine.ts'],
        basePathAbs: join(tempRoot, 'src')
      })

      assertEquals(result.kind, 'failed')
      if (result.kind === 'failed') {
        // Every diagnostic should be in mine.ts; theirs.ts is filtered out.
        for (const d of result.diagnostics) {
          assertEquals(d.file.endsWith('mine.ts'), true)
        }
        // There should be at least one — the type assignment error.
        assertEquals(result.diagnostics.length > 0, true)
      }
    })
  }
)

/**
 * `tsc` is not part of the test runtime — these integration tests
 * shell out to it via `npx tsc`. If npx can't actually find a tsc to
 * invoke (no global install, no nearby node_modules), `npx tsc` will
 * either prompt or silently no-op, neither of which gives us a real
 * test signal. We probe by running `npx tsc --version` with a 10s
 * cap and check for a parseable version string in stdout.
 */
function canRunTsc(): boolean {
  try {
    const cmd = new Deno.Command('sh', {
      args: ['-c', 'npx --no-install tsc --version'],
      stdout: 'piped',
      stderr: 'piped'
    })
    const output = cmd.outputSync()
    if (output.code !== 0) return false
    const stdout = new TextDecoder().decode(output.stdout)
    // tsc --version prints "Version 5.x.x" — just check we got
    // a "Version" line back.
    return stdout.includes('Version')
  } catch {
    return false
  }
}
