import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { existsSync } from '@std/fs/exists'
import { pruneEmptyDirs, toAnchorDirs } from '@/lib/prune-empty-dirs.ts'

// Build a temp app root with a basePath and the given files, then
// delete the files and prune. Returns the temp dir for assertions.
const setup = async (files: string[]) => {
  const appRoot = await Deno.makeTempDir()
  for (const rel of files) {
    const abs = join(appRoot, rel)
    await Deno.mkdir(join(abs, '..'), { recursive: true })
    await Deno.writeTextFile(abs, 'x')
  }
  return appRoot
}

Deno.test('pruneEmptyDirs - removes a directory emptied by its only file', async () => {
  const appRoot = await setup(['src/generated/types/User.ts'])
  try {
    const anchors = toAnchorDirs(appRoot, { basePath: 'src' })!
    const filePath = join(appRoot, 'src/generated/types/User.ts')
    Deno.removeSync(filePath)

    const removed = pruneEmptyDirs({ deletedAbsPaths: [filePath], anchors, dryRun: false })

    // types/ and generated/ are now empty and should be gone.
    assertEquals(existsSync(join(appRoot, 'src/generated/types')), false)
    assertEquals(existsSync(join(appRoot, 'src/generated')), false)
    // basePath (src/) is the floor — never removed.
    assertEquals(existsSync(join(appRoot, 'src')), true)
    assertEquals(removed.length, 2)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('pruneEmptyDirs - keeps a directory holding a non-generated file', async () => {
  const appRoot = await setup(['src/generated/User.ts', 'src/generated/keep.ts'])
  try {
    const anchors = toAnchorDirs(appRoot, { basePath: 'src' })!
    const filePath = join(appRoot, 'src/generated/User.ts')
    Deno.removeSync(filePath)

    const removed = pruneEmptyDirs({ deletedAbsPaths: [filePath], anchors, dryRun: false })

    // generated/ still holds keep.ts — must survive.
    assertEquals(existsSync(join(appRoot, 'src/generated')), true)
    assertEquals(existsSync(join(appRoot, 'src/generated/keep.ts')), true)
    assertEquals(removed.length, 0)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('pruneEmptyDirs - never removes basePath itself even when fully emptied', async () => {
  const appRoot = await setup(['gen/a.ts', 'gen/b.ts'])
  try {
    const anchors = toAnchorDirs(appRoot, { basePath: 'gen' })!
    const files = [join(appRoot, 'gen/a.ts'), join(appRoot, 'gen/b.ts')]
    files.forEach(f => Deno.removeSync(f))

    pruneEmptyDirs({ deletedAbsPaths: files, anchors, dryRun: false })

    // gen/ is basePath — the floor — and survives despite being empty.
    assertEquals(existsSync(join(appRoot, 'gen')), true)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('pruneEmptyDirs - never removes a protected package root', async () => {
  const appRoot = await setup(['packages/models/src/User.ts'])
  try {
    const anchors = toAnchorDirs(appRoot, {
      basePath: '.',
      packages: [{ rootPath: 'packages/models/src', moduleName: '@app/models' }]
    })!
    const filePath = join(appRoot, 'packages/models/src/User.ts')
    Deno.removeSync(filePath)

    pruneEmptyDirs({ deletedAbsPaths: [filePath], anchors, dryRun: false })

    // The package root is protected — survives even though now empty.
    assertEquals(existsSync(join(appRoot, 'packages/models/src')), true)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('pruneEmptyDirs - dry run reports nested dirs without touching disk', async () => {
  const appRoot = await setup(['src/generated/types/User.ts'])
  try {
    const anchors = toAnchorDirs(appRoot, { basePath: 'src' })!
    const filePath = join(appRoot, 'src/generated/types/User.ts')
    // NOTE: file is NOT deleted — dry run simulates against the delete set.

    const removed = pruneEmptyDirs({ deletedAbsPaths: [filePath], anchors, dryRun: true })

    // Nothing actually removed.
    assertEquals(existsSync(join(appRoot, 'src/generated/types')), true)
    // But both nested dirs are reported as would-be-removed.
    const removedResolved = removed.map(r => resolve(r))
    assertEquals(removedResolved.includes(resolve(join(appRoot, 'src/generated/types'))), true)
    assertEquals(removedResolved.includes(resolve(join(appRoot, 'src/generated'))), true)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('toAnchorDirs - returns null when basePath is absent', () => {
  assertEquals(toAnchorDirs('/tmp/app', undefined), null)
  assertEquals(toAnchorDirs('/tmp/app', {}), null)
})

Deno.test('pruneEmptyDirs - ignores a deleted file outside the floor', async () => {
  const appRoot = await setup(['other/stray.ts'])
  try {
    // floor is src/, but the deleted file lives under other/ — its
    // ancestor walk fails the floor-containment guard and is left alone.
    const anchors = toAnchorDirs(appRoot, { basePath: 'src' })!
    const filePath = join(appRoot, 'other/stray.ts')
    Deno.removeSync(filePath)

    const removed = pruneEmptyDirs({ deletedAbsPaths: [filePath], anchors, dryRun: false })

    assertEquals(removed.length, 0)
    assertEquals(existsSync(join(appRoot, 'other')), true)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('pruneEmptyDirs - tolerates a vanished candidate dir (real run)', async () => {
  const appRoot = await Deno.makeTempDir()
  try {
    // basePath exists but the deleted file's parent dir never did —
    // readDirSync throws and the prune swallows it.
    await Deno.mkdir(join(appRoot, 'src'), { recursive: true })
    const anchors = toAnchorDirs(appRoot, { basePath: 'src' })!
    const ghost = join(appRoot, 'src/ghost/File.ts')

    const removed = pruneEmptyDirs({ deletedAbsPaths: [ghost], anchors, dryRun: false })

    assertEquals(removed.length, 0)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})

Deno.test('pruneEmptyDirs - dry run tolerates a vanished candidate dir', async () => {
  const appRoot = await Deno.makeTempDir()
  try {
    await Deno.mkdir(join(appRoot, 'src'), { recursive: true })
    const anchors = toAnchorDirs(appRoot, { basePath: 'src' })!
    const ghost = join(appRoot, 'src/ghost/File.ts')

    const removed = pruneEmptyDirs({ deletedAbsPaths: [ghost], anchors, dryRun: true })

    assertEquals(removed.length, 0)
  } finally {
    await Deno.remove(appRoot, { recursive: true })
  }
})
