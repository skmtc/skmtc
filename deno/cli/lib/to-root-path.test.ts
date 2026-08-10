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

// Run `fn` with $HOME temporarily pointed at `dir`, restoring it afterwards.
// `toRootPath` reads the home directory through `homedir()` and
// `toRelativeRootPath` reads `$HOME` directly; both re-read per call, so the
// override moves the pair together.
const withHome = async (dir: string, fn: () => Promise<void> | void) => {
  const previous = Deno.env.get('HOME')
  Deno.env.set('HOME', dir)
  try {
    await fn()
  } finally {
    if (previous === undefined) {
      Deno.env.delete('HOME')
    } else {
      Deno.env.set('HOME', previous)
    }
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

Deno.test('toRelativeRootPath - tildes the home prefix', async () => {
  // A SKMTC project lives under the user's home directory, so the test supplies
  // its own home instead of reading the machine's. Reading it made the
  // assertion depend on where the runner sat: from a checkout outside $HOME the
  // relative walk starts with `..`, `join` cancels that against the `~`, and
  // the test fails for reasons unrelated to the code under test.
  //
  // `realPath` because `Deno.chdir` resolves symlinks — an unresolved home
  // (Fedora Silverblue's /home -> /var/home, macOS /tmp -> /private/tmp)
  // disagrees with the cwd the code under test sees, which reintroduces the
  // same leading `..`.
  const home = await Deno.realPath(await Deno.makeTempDir({ prefix: 'skmtc-home-' }))

  try {
    const repoRoot = join(home, 'repo')
    await ensureDir(join(repoRoot, '.skmtc'))

    await withHome(home, () =>
      withCwd(repoRoot, () => {
        assertEquals(toRelativeRootPath(), join('~', 'repo'))
      })
    )
  } finally {
    await Deno.remove(home, { recursive: true })
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

Deno.test('toRootPath - does NOT walk up past the home-directory boundary (current limitation)', async () => {
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
})
