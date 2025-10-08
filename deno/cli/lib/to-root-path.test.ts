import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { toRootPath, toAbsoluteRootPath, toRelativeRootPath } from '@/lib/to-root-path.ts'

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
