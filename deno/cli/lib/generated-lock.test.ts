import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import {
  readGeneratedLock,
  toContentHash,
  toGeneratedLockPath,
  writeGeneratedLock
} from '@/lib/generated-lock.ts'

Deno.test('toGeneratedLockPath - lock lives beside the manifest', () => {
  assertEquals(
    toGeneratedLockPath('/root/.skmtc/project/.settings/manifest.json'),
    '/root/.skmtc/project/.settings/generated.lock.json'
  )
})

Deno.test('toContentHash - deterministic sha256 hex', () => {
  assertEquals(toContentHash('abc'), toContentHash('abc'))
  assertEquals(
    toContentHash('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  )
  assertEquals(toContentHash('abc') === toContentHash('abd'), false)
})

Deno.test('generated lock - write/read round-trip', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    const lockPath = join(tempDir, '.settings', 'generated.lock.json')
    const content = {
      version: 1 as const,
      files: { 'src/out.ts': { canonicalHash: 'aa', formattedHash: 'bb' } }
    }

    writeGeneratedLock(lockPath, content)

    assertEquals(readGeneratedLock(lockPath), content)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('readGeneratedLock - missing file degrades to null silently', async () => {
  const tempDir = await Deno.makeTempDir()
  try {
    assertEquals(readGeneratedLock(join(tempDir, 'generated.lock.json')), null)
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('readGeneratedLock - malformed JSON degrades to null with a warning', async () => {
  const tempDir = await Deno.makeTempDir()
  const errors: string[] = []
  const originalError = console.error
  console.error = (msg: string) => errors.push(msg)
  try {
    const lockPath = join(tempDir, 'generated.lock.json')
    await Deno.writeTextFile(lockPath, '{not json')

    assertEquals(readGeneratedLock(lockPath), null)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], 'invalid JSON')
  } finally {
    console.error = originalError
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('readGeneratedLock - stale schema degrades to null with a warning', async () => {
  const tempDir = await Deno.makeTempDir()
  const errors: string[] = []
  const originalError = console.error
  console.error = (msg: string) => errors.push(msg)
  try {
    const lockPath = join(tempDir, 'generated.lock.json')
    await Deno.writeTextFile(lockPath, JSON.stringify({ version: 99, files: {} }))

    assertEquals(readGeneratedLock(lockPath), null)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], `doesn't match the current schema`)
  } finally {
    console.error = originalError
    await Deno.remove(tempDir, { recursive: true })
  }
})
