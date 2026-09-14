import { assertEquals } from '@std/assert'
import { toAliasPath } from '@/src/toAliasPath.ts'

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

Deno.test('toAliasPath: the root itself is the package alias', () => {
  assertEquals(toAliasPath({ path: 'packages/sdk/src', rootPath: 'packages/sdk/src' }), '@/')
})
