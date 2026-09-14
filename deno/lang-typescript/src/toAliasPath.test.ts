import { assertEquals, assertThrows } from '@std/assert'
import { toAliasPath } from './toAliasPath.ts'

Deno.test('toAliasPath: the path relative to the package root, behind the @/ alias', () => {
  assertEquals(
    toAliasPath({ path: 'packages/sdk/src/models/User.ts', rootPath: 'packages/sdk/src' }),
    '@/models/User.ts'
  )
  assertEquals(
    toAliasPath({ path: 'packages/sdk/src/config.ts', rootPath: 'packages/sdk/src' }),
    '@/config.ts'
  )
  assertEquals(
    toAliasPath({ path: 'packages/sdk/src/a/b/c.ts', rootPath: 'packages/sdk/src' }),
    '@/a/b/c.ts'
  )
})

Deno.test('toAliasPath: the workspace-root @/ on the way in is not the package @/ on the way out', () => {
  // A generator wrote `@/packages/sdk/src/models/User.ts` (workspace root);
  // the file imports `@/models/User.ts` (package root).
  assertEquals(
    toAliasPath({ path: '@/packages/sdk/src/models/User.ts', rootPath: './packages/sdk/src/' }),
    '@/models/User.ts'
  )
})

Deno.test('toAliasPath: a path outside the root cannot be aliased to it', () => {
  assertThrows(
    () => toAliasPath({ path: 'packages/sdk-legacy/src/a.ts', rootPath: 'packages/sdk' }),
    Error,
    "Cannot alias 'packages/sdk-legacy/src/a.ts': it is not under package root 'packages/sdk'"
  )
  assertThrows(
    () => toAliasPath({ path: 'types/User.ts', rootPath: '.' }),
    Error,
    'not under package root'
  )
})
