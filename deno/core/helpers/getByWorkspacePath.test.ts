import { assertEquals, assertThrows } from '@std/assert'
import { getByWorkspacePath } from '@/helpers/getByWorkspacePath.ts'

Deno.test('getByWorkspacePath: a key is returned as it is, without being normalized', () => {
  // `normalizeWorkspacePath` refuses this path, so a normalization would throw.
  const map = new Map([['../x.ts', 'x']])

  assertEquals(getByWorkspacePath(map, '../x.ts'), 'x')
})

Deno.test('getByWorkspacePath: a path that is no key is normalized and found', () => {
  const map = new Map([['@/types/a.ts', 'a']])

  assertEquals(getByWorkspacePath(map, './types/a.ts'), 'a')
  assertEquals(getByWorkspacePath(map, './types/b.ts'), undefined)
})

Deno.test('getByWorkspacePath: a path that is no key and names no file below basePath throws', () => {
  const map = new Map([['@/types/a.ts', 'a']])

  assertThrows(() => getByWorkspacePath(map, '../a.ts'), Error, '".." segment')
})
