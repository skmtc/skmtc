import { assertEquals } from '@std/assert'
import { assertNotEquals } from '@std/assert/not-equals'
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

  assertEquals(result.type, 'skipped')
  if (result.type === 'skipped') {
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

      assertEquals(result.type, 'no-tsconfig')
    })
  }
)

Deno.test(
  'runTypecheck - discovers the nested app tsconfig by walking up from a monorepo basePath',
  async () => {
    // The nested-monorepo layout: the skmtc root (tempRoot) has NO tsconfig; the
    // app under apps/x owns it, and basePath points at the app's src. Discovery
    // walks up from basePath, so it must find the app's tsconfig — the app root,
    // not the skmtc root, is where the consumer's TypeScript lives.
    await withTempCwd(async tempRoot => {
      const appDir = join(tempRoot, 'apps', 'x')
      await ensureDir(join(appDir, 'src'))
      await Deno.writeTextFile(
        join(appDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { noEmit: true, skipLibCheck: true } })
      )
      await Deno.writeTextFile(join(appDir, 'src', 'thing.ts'), 'export const thing = 1\n')

      const result = await runTypecheck({
        filePaths: ['apps/x/src/thing.ts'],
        basePathAbs: join(appDir, 'src')
      })

      // Reaching past tsconfig-discovery (anything but `no-tsconfig`) proves the
      // search walked up from basePath into the nested app and found the app's
      // tsconfig — the only one in the tree. Whether tsc then runs depends on the
      // environment; discovery succeeding is the monorepo behavior under test.
      assertNotEquals(result.type, 'no-tsconfig')
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

      assertEquals(result.type, 'passed')
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

      assertEquals(result.type, 'failed')
      if (result.type === 'failed') {
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
 * shell out via `npx tsc`, which is what `runTypecheck` itself uses
 * in production. The probe has two traps:
 *
 *  1. Running from inside the workspace (the test process's cwd) is a
 *     false positive: `npx tsc` finds the workspace's
 *     `node_modules/.bin/tsc`, but the test then cd's into a temp dir
 *     under `homedir()` with no `node_modules` ancestor.
 *  2. From the temp dir, `npx tsc` falls back to npm's published
 *     placeholder package (`"This is not the tsc command you are
 *     looking for"`), which exits non-zero and prints its message to
 *     stdout — no "Version" line.
 *
 * The probe must run from the same type of bare directory the test
 * uses. We create a throwaway temp dir under `homedir()` and probe
 * `npx tsc --version` from there.
 */
function canRunTsc(): boolean {
  try {
    const probeDir = Deno.makeTempDirSync({ dir: homedir(), prefix: 'tsc-probe-' })
    try {
      const cmd = new Deno.Command('sh', {
        args: ['-c', 'npx tsc --version'],
        cwd: probeDir,
        stdout: 'piped',
        stderr: 'piped'
      })
      const output = cmd.outputSync()
      if (output.code !== 0) return false
      const stdout = new TextDecoder().decode(output.stdout)
      return stdout.includes('Version')
    } finally {
      Deno.removeSync(probeDir, { recursive: true })
    }
  } catch {
    return false
  }
}
