import { assertEquals, assertThrows } from '@std/assert'
import {
  hasParentSegment,
  isAbsolutePath,
  isExportPath,
  isWorkspaceSpelled,
  normalizeExportPath,
  toExportPathBody
} from '@/helpers/normalizeExportPath.ts'

Deno.test('normalizeExportPath: the canonical form is a fixed point', () => {
  assertEquals(normalizeExportPath('@/types/x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath(normalizeExportPath('@/types/x.ts')), '@/types/x.ts')
})

Deno.test('normalizeExportPath: every accepted spelling canonicalizes to @/ plus a POSIX path', () => {
  assertEquals(normalizeExportPath('./types/x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('types/x.ts'), '@/types/x.ts')
  // A leading slash is an anchor spelling, not a POSIX root: the old docs
  // taught it and the old resolver joined it onto basePath.
  assertEquals(normalizeExportPath('/types/x.ts'), '@/types/x.ts')
})

Deno.test('normalizeExportPath: Windows separators become forward slashes', () => {
  assertEquals(normalizeExportPath('@\\types\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('types\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('.\\types\\x.ts'), '@/types/x.ts')
})

Deno.test('normalizeExportPath: POSIX-normalized, so a doubled slash after the anchor is one key', () => {
  assertEquals(normalizeExportPath('@/./types//x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('@\\.\\types\\\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeExportPath('@//X.kt'), '@/X.kt')
  assertEquals(normalizeExportPath('.//x.ts'), '@/x.ts')
  assertEquals(normalizeExportPath('//x.ts'), '@/x.ts')
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

Deno.test('normalizeExportPath: a Windows drive or UNC path is rejected on every host', () => {
  for (const path of ['C:\\x.ts', 'C:/x.ts', '\\\\server\\share\\x.ts']) {
    assertThrows(() => normalizeExportPath(path), Error, path, `path: '${path}'`)
  }
})

Deno.test('normalizeExportPath: a path naming basePath itself is rejected', () => {
  for (const path of ['@/', './', '.', '/', '']) {
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

Deno.test('toExportPathBody: the canonical path after the anchor', () => {
  assertEquals(toExportPathBody('@/types/x.ts'), 'types/x.ts')
  assertEquals(toExportPathBody('.\\types\\x.ts'), 'types/x.ts')
  assertThrows(() => toExportPathBody('../x.ts'))
})

Deno.test('isExportPath: the non-throwing form of the same checks', () => {
  for (const path of ['@/types/x.ts', 'types/x.ts', '/types/x.ts', 'zod', '@tanstack/query']) {
    assertEquals(isExportPath(path), true, `path: '${path}'`)
  }
  for (const path of ['../x.ts', 'C:\\x.ts', '@/', '']) {
    assertEquals(isExportPath(path), false, `path: '${path}'`)
  }
})

Deno.test('isWorkspaceSpelled: an anchor spelling, never a bare specifier', () => {
  for (const path of ['@/x.ts', './x.ts', '/x.ts', '@\\x.ts', '.\\x.ts', '\\x.ts']) {
    assertEquals(isWorkspaceSpelled(path), true, `path: '${path}'`)
  }
  for (const path of ['zod', '@tanstack/query', 'types/x.ts', 'npm:zod']) {
    assertEquals(isWorkspaceSpelled(path), false, `path: '${path}'`)
  }
})

Deno.test('hasParentSegment and isAbsolutePath: the shared predicates', () => {
  assertEquals(hasParentSegment('a/../b'), true)
  assertEquals(hasParentSegment('a\\..\\b'), true)
  assertEquals(hasParentSegment('a/..b/c'), false)
  assertEquals(isAbsolutePath('/tmp/out'), true)
  assertEquals(isAbsolutePath('C:\\out'), true)
  assertEquals(isAbsolutePath('\\\\server\\share'), true)
  assertEquals(isAbsolutePath('./src'), false)
})
