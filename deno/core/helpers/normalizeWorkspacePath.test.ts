import { assertEquals, assertThrows } from '@std/assert'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import {
  applyGeneratedSuffixToWorkspacePath,
  type WorkspacePath,
  hasParentSegment,
  isAbsolutePath,
  isValidWorkspacePath,
  hasWorkspaceAnchor,
  normalizeWorkspacePath,
  toNormalizedWorkspacePath
} from '@/helpers/normalizeWorkspacePath.ts'

Deno.test('normalizeWorkspacePath: the canonical form is a fixed point', () => {
  assertEquals(normalizeWorkspacePath('@/types/x.ts'), '@/types/x.ts')
})

Deno.test('normalizeWorkspacePath: a WorkspacePath is not normalized again, and a string is not one', () => {
  const normalized: WorkspacePath = normalizeWorkspacePath('./types/x.ts')

  // @ts-expect-error a WorkspacePath is in its one spelling already
  assertEquals(normalizeWorkspacePath(normalized), '@/types/x.ts')

  // @ts-expect-error a plain string has not been normalized
  const unchecked: WorkspacePath = '@/types/x.ts'

  // @ts-expect-error ContentSettings holds a normalized export path
  ContentSettings.empty({ exportPath: './types/x.ts', identifier: new IdentifierBase({ name: 'X' }) })

  assertEquals(unchecked, normalized)
})

Deno.test('applyGeneratedSuffixToWorkspacePath: inserts the suffix and keeps the one spelling', () => {
  const path = normalizeWorkspacePath('./types/x.ts')

  assertEquals(applyGeneratedSuffixToWorkspacePath(path, '.generated'), '@/types/x.generated.ts')
  assertEquals(applyGeneratedSuffixToWorkspacePath(path, ''), '@/types/x.ts')
  // A suffix with a separator is normalized with the path.
  assertEquals(applyGeneratedSuffixToWorkspacePath(path, './/gen'), '@/types/x./gen.ts')
})

Deno.test('normalizeWorkspacePath: every accepted spelling canonicalizes to @/ plus a POSIX path', () => {
  assertEquals(normalizeWorkspacePath('./types/x.ts'), '@/types/x.ts')
  assertEquals(normalizeWorkspacePath('types/x.ts'), '@/types/x.ts')
  // A leading slash is an anchor spelling, not a POSIX root: the old docs
  // taught it and the old resolver joined it onto basePath.
  assertEquals(normalizeWorkspacePath('/types/x.ts'), '@/types/x.ts')
})

Deno.test('normalizeWorkspacePath: Windows separators become forward slashes', () => {
  assertEquals(normalizeWorkspacePath('@\\types\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeWorkspacePath('types\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeWorkspacePath('.\\types\\x.ts'), '@/types/x.ts')
})

Deno.test('normalizeWorkspacePath: POSIX-normalized, so a doubled slash after the anchor is one key', () => {
  assertEquals(normalizeWorkspacePath('@/./types//x.ts'), '@/types/x.ts')
  assertEquals(normalizeWorkspacePath('@\\.\\types\\\\x.ts'), '@/types/x.ts')
  assertEquals(normalizeWorkspacePath('@//X.kt'), '@/X.kt')
  assertEquals(normalizeWorkspacePath('.//x.ts'), '@/x.ts')
  assertEquals(normalizeWorkspacePath('//x.ts'), '@/x.ts')
})

Deno.test('normalizeWorkspacePath: a file at the root is fine', () => {
  assertEquals(normalizeWorkspacePath('@/index.ts'), '@/index.ts')
  assertEquals(normalizeWorkspacePath('index.ts'), '@/index.ts')
})

Deno.test('normalizeWorkspacePath: a .. segment is rejected as a whole segment, before normalization', () => {
  for (const path of ['@/types/../x.ts', '../x.ts', 'types/../../x.ts', '@\\..\\x.ts']) {
    assertThrows(() => normalizeWorkspacePath(path), Error, path, `path: '${path}'`)
  }
  // A directory name that merely contains dots is not a parent reference.
  assertEquals(normalizeWorkspacePath('types/..hidden/x.ts'), '@/types/..hidden/x.ts')
})

Deno.test('normalizeWorkspacePath: a Windows drive or UNC path is rejected on every host', () => {
  for (const path of ['C:\\x.ts', 'C:/x.ts', '\\\\server\\share\\x.ts']) {
    assertThrows(() => normalizeWorkspacePath(path), Error, path, `path: '${path}'`)
  }
})

Deno.test('normalizeWorkspacePath: a path naming basePath itself is rejected', () => {
  for (const path of ['@/', '@', '@/.', '@\\.', '@/./', './', './.', '.', '/', '']) {
    assertThrows(() => normalizeWorkspacePath(path), Error, undefined, `path: '${path}'`)
  }
})

Deno.test('normalizeWorkspacePath: the error names the generator when given one', () => {
  assertThrows(
    () => normalizeWorkspacePath('../x.ts', { generatorId: '@acme/gen-x' }),
    Error,
    '@acme/gen-x'
  )
})

Deno.test('toNormalizedWorkspacePath: the canonical path after the anchor', () => {
  assertEquals(toNormalizedWorkspacePath('@/types/x.ts'), 'types/x.ts')
  assertEquals(toNormalizedWorkspacePath('.\\types\\x.ts'), 'types/x.ts')
  assertThrows(() => toNormalizedWorkspacePath('../x.ts'))
})

Deno.test('isValidWorkspacePath: the non-throwing form of the same checks', () => {
  for (const path of ['@/types/x.ts', 'types/x.ts', '/types/x.ts', 'zod', '@tanstack/query']) {
    assertEquals(isValidWorkspacePath(path), true, `path: '${path}'`)
  }
  for (const path of ['../x.ts', 'C:\\x.ts', '@/', '']) {
    assertEquals(isValidWorkspacePath(path), false, `path: '${path}'`)
  }
})

Deno.test('hasWorkspaceAnchor: an anchor spelling, never a bare specifier', () => {
  for (const path of ['@/x.ts', './x.ts', '/x.ts', '@\\x.ts', '.\\x.ts', '\\x.ts']) {
    assertEquals(hasWorkspaceAnchor(path), true, `path: '${path}'`)
  }
  for (const path of ['zod', '@tanstack/query', 'types/x.ts', 'npm:zod']) {
    assertEquals(hasWorkspaceAnchor(path), false, `path: '${path}'`)
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
