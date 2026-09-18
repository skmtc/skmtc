import { assertEquals, assertThrows } from '@std/assert'
import { normalizeExportPath } from '@/helpers/normalizeExportPath.ts'

Deno.test('normalizeExportPath: the canonical form is a fixed point', () => {
  assertEquals(normalizeExportPath('@/types/x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath(normalizeExportPath('@/types/x.ts')), '@/types/x.ts')
})

Deno.test('normalizeExportPath: every accepted spelling canonicalizes to @/ plus a POSIX path', () => {
  assertEquals(normalizeExportPath('./types/x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('types/x.ts'), '@/types/x.ts')
})

Deno.test('normalizeExportPath: Windows separators become forward slashes', () => {
  assertEquals(normalizeExportPath('@\\types\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('types\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('.\\types\\x.ts'), '@/types/x.ts')
})

Deno.test('normalizeExportPath: POSIX-normalized after the separator swap', () => {
  assertEquals(normalizeExportPath('@/./types//x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('@\\.\\types\\\\x.ts'), '@/types/x.ts')
})

Deno.test('normalizeExportPath: a file at the root is fine', () => {
  assertEquals(normalizeExportPath('@/index.ts'), '@/index.ts')
  assertEquals(normalizeExportPath('index.ts'), '@/index.ts')
})

Deno.test('normalizeExportPath: a .. segment is rejected as a whole segment, before normalization', () => {
  for (const path of ['@/types/../x.ts', '../x.ts', 'types/../../x.ts', '@\\..\\x.ts']) {
    assertThrows(() => normalizeExportPath(path), Error, path, `path: '${path}'`)
  }
  // A directory name that merely contains dots is not a parent reference.
  assertEquals(normalizeExportPath('types/..hidden/x.ts'), '@/types/..hidden/x.ts')
})

Deno.test('normalizeExportPath: an absolute path is rejected on every host', () => {
  for (const path of ['/etc/x.ts', 'C:\\x.ts', 'C:/x.ts', '\\\\server\\share\\x.ts']) {
    assertThrows(() => normalizeExportPath(path), Error, path, `path: '${path}'`)
  }
})

Deno.test('normalizeExportPath: a path naming basePath itself is rejected', () => {
  for (const path of ['@/', './', '.', '']) {
    assertThrows(() => normalizeExportPath(path), Error, undefined, `path: '${path}'`)
  }
})

Deno.test('normalizeExportPath: the error names the generator when given one', () => {
  assertThrows(
    () => normalizeExportPath('../x.ts', { generatorId: '@acme/gen-x' }),
    Error,
    '@acme/gen-x'
  )
})
