import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { ensureDir } from '@std/fs/ensure-dir'
import { homedir } from 'node:os'
import { toRootPath, toAbsoluteRootPath, toRelativeRootPath } from '@/lib/to-root-path.ts'

// Run `fn` with cwd temporarily changed to `dir`, restoring it afterwards.
const withCwd = async (dir: string, fn: () => Promise<void> | void) => {
  const prev = Deno.cwd()
  Deno.chdir(dir)
  try {
    await fn()
  } finally {
    Deno.chdir(prev)
  }
}

Deno.test('toRootPath - returns path ending with .skmtc', () => {
  const rootPath = toRootPath()

  assertStringIncludes(rootPath, '.skmtc')
})

Deno.test('toRootPath - returns absolute path', () => {
  const rootPath = toRootPath()

  const isAbsolute = rootPath.startsWith('/') || rootPath.includes(':')
  assertEquals(isAbsolute, true)
})

Deno.test('toAbsoluteRootPath - returns parent of .skmtc directory', () => {
  const absolutePath = toAbsoluteRootPath()

  // Should not end with .skmtc since it's the parent
  assertEquals(absolutePath.endsWith('.skmtc'), false)
})

Deno.test('toRelativeRootPath - includes tilde for home directory', () => {
  const relativePath = toRelativeRootPath()

  // If we have a HOME env var, path should start with ~
  const hasHome = Deno.env.get('HOME')
  if (hasHome) {
    assertStringIncludes(relativePath, '~')
  }
})

// --- monorepo root discovery --------------------------------------------------
// The nested-monorepo case the `@skmtc/vite` plugin exposed: `.skmtc/` at the
// repo root, the app dir nested under `apps/x`. `toRootPath` walks up from cwd,
// so running from the nested app must still resolve the repo-root project.

Deno.test('toRootPath - walks up from a nested dir to an ancestor .skmtc (monorepo)', async () => {
  const repoRoot = await Deno.realPath(
    await Deno.makeTempDir({ dir: homedir(), prefix: 'skmtc-root-mono-' })
  )
  try {
    await ensureDir(join(repoRoot, '.skmtc'))
    const appDir = join(repoRoot, 'apps', 'x')
    await ensureDir(appDir)
    await withCwd(appDir, () => {
      assertEquals(resolve(toRootPath()), join(repoRoot, '.skmtc'))
    })
  } finally {
    await Deno.remove(repoRoot, { recursive: true })
  }
})

Deno.test('toRootPath - the nearest .skmtc wins when a nested project shadows the root', async () => {
  const repoRoot = await Deno.realPath(
    await Deno.makeTempDir({ dir: homedir(), prefix: 'skmtc-root-nest-' })
  )
  try {
    await ensureDir(join(repoRoot, '.skmtc'))
    const appDir = join(repoRoot, 'apps', 'x')
    await ensureDir(join(appDir, '.skmtc'))
    await withCwd(appDir, () => {
      assertEquals(resolve(toRootPath()), join(appDir, '.skmtc'))
    })
  } finally {
    await Deno.remove(repoRoot, { recursive: true })
  }
})

Deno.test(
  'toRootPath - does NOT walk up past the home-directory boundary (current limitation)',
  async () => {
    // Characterization test, not an endorsement: the walk-up loop only runs while
    // inside $HOME, so a repo checked out OUTSIDE $HOME (common in CI, containers,
    // /opt) never finds an ancestor `.skmtc` — it assumes one in cwd. This pins
    // current behavior; if monorepo-outside-$HOME is to be supported, relax the
    // boundary in `to-root-path.ts` and update this test deliberately.
    const home = resolve(homedir())
    const repoRoot = await Deno.realPath(
      await Deno.makeTempDir({ prefix: 'skmtc-root-outside-home-' })
    )
    if (resolve(repoRoot).startsWith(home)) {
      // The system temp dir happens to live under $HOME here, so the boundary
      // can't be demonstrated — skip rather than assert a falsehood.
      await Deno.remove(repoRoot, { recursive: true })
      return
    }
    try {
      await ensureDir(join(repoRoot, '.skmtc'))
      const appDir = join(repoRoot, 'apps', 'x')
      await ensureDir(appDir)
      await withCwd(appDir, () => {
        // Falls through to cwd/.skmtc rather than resolving the ancestor project.
        assertEquals(resolve(toRootPath()), join(appDir, '.skmtc'))
      })
    } finally {
      await Deno.remove(repoRoot, { recursive: true })
    }
  }
)
