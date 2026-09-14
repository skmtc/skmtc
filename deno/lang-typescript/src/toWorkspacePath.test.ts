import { assertEquals } from '@std/assert'
import { isUnderRoot, toWorkspacePath } from './toWorkspacePath.ts'

Deno.test('toWorkspacePath: the workspace-root anchor and a trailing slash are dropped', () => {
  assertEquals(toWorkspacePath('@/packages/sdk/src'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('./packages/sdk/src'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('packages/sdk/src/'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('@/packages/sdk/src/'), 'packages/sdk/src')
  assertEquals(toWorkspacePath('packages/sdk/src'), 'packages/sdk/src')
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

Deno.test('isUnderRoot: a root is a folder — a shared prefix, the root itself, and its parent are not under it', () => {
  assertEquals(isUnderRoot({ path: 'packages/sdk-legacy/a.ts', rootPath: 'packages/sdk' }), false)
  assertEquals(isUnderRoot({ path: 'packages/sdk', rootPath: 'packages/sdk' }), false)
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

Deno.test('isUnderRoot: the workspace root contains nothing', () => {
  // A bare specifier and a forward workspace path look the same, so a root
  // that held everything would treat `zod` as an artifact.
  for (const rootPath of ['', '.', './', '@/']) {
    assertEquals(isUnderRoot({ path: 'zod', rootPath }), false, `root '${rootPath}'`)
    assertEquals(isUnderRoot({ path: 'types/User.ts', rootPath }), false, `root '${rootPath}'`)
    assertEquals(isUnderRoot({ path: '@/types/User.ts', rootPath }), false, `root '${rootPath}'`)
  }
})
