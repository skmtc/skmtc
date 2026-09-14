import { assertEquals } from '@std/assert'
import { isUnderRoot, toWorkspacePath } from '@/helpers/toWorkspacePath.ts'

Deno.test('toWorkspacePath: the workspace-root anchor and a trailing slash are dropped', () => {
  assertEquals(toWorkspacePath('@/packages/sdk/src'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('./packages/sdk/src'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('packages/sdk/src/'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('@/packages/sdk/src/'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('packages/sdk/src'), 'packages/sdk/src')
})

Deno.test('toWorkspacePath: stacked anchors and Windows separators canonicalize in one pass', () => {
  assertEquals(toWorkspacePath('@/./packages/x'), 'packages/x')
  assertEquals(toWorkspacePath('././packages/x/'), 'packages/x')
  assertEquals(toWorkspacePath('packages\\sdk\\src\\User.ts'), 'packages/sdk/src/User.ts')
  assertEquals(
    toWorkspacePath(toWorkspacePath('@/./packages/x')),
    toWorkspacePath('@/./packages/x')
  )
})

Deno.test('toWorkspacePath: every spelling of the workspace root is the empty string', () => {
  for (const spelling of ['@/', './', '.', '']) {
    assertEquals(toWorkspacePath(spelling), '', `spelling: '${spelling}'`)
  }
})

Deno.test('toWorkspacePath: a bare module specifier is not a workspace path and is untouched', () => {
  // An npm scope is `@name/`, never `@/` — the anchor is only the bare `@/`.
  assertEquals(toWorkspacePath('@tanstack/react-query'), '@tanstack/react-query')
  assertEquals(toWorkspacePath('zod'), 'zod')
  // A dot-folder is not the `./` anchor either.
  assertEquals(toWorkspacePath('.config/tools.ts'), '.config/tools.ts')
})

Deno.test('isUnderRoot: a file or folder below the root is under it, at any depth', () => {
  assertEquals(isUnderRoot({ path: 'packages/sdk/a.ts', rootPath: 'packages/sdk' }), true)
  assertEquals(isUnderRoot({ path: 'packages/sdk/x/y/z.ts', rootPath: 'packages/sdk' }), true)
  assertEquals(isUnderRoot({ path: 'packages/sdk/models', rootPath: 'packages/sdk' }), true)
})

Deno.test('isUnderRoot: a root contains itself — a directory import of the root is its barrel', () => {
  assertEquals(isUnderRoot({ path: 'packages/sdk', rootPath: 'packages/sdk' }), true)
  assertEquals(isUnderRoot({ path: '@/packages/sdk/', rootPath: './packages/sdk' }), true)
})

Deno.test('isUnderRoot: a root is a folder — a shared prefix and its parent are not under it', () => {
  assertEquals(isUnderRoot({ path: 'packages/sdk-legacy/a.ts', rootPath: 'packages/sdk' }), false)
  assertEquals(isUnderRoot({ path: 'packages', rootPath: 'packages/sdk' }), false)
  assertEquals(isUnderRoot({ path: 'apps/packages/sdk/a.ts', rootPath: 'packages/sdk' }), false)
})

Deno.test('isUnderRoot: spelling of either side does not matter', () => {
  const spellings = [
    'packages/sdk',
    './packages/sdk',
    '@/packages/sdk',
    'packages/sdk/',
    '@/packages/sdk/'
  ]

  for (const rootPath of spellings) {
    for (const prefix of ['', './', '@/']) {
      const path = `${prefix}packages/sdk/a.ts`

      assertEquals(isUnderRoot({ path, rootPath }), true, `path '${path}' under root '${rootPath}'`)
    }
  }
})
