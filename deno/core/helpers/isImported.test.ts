import { assertEquals, assertThrows } from '@std/assert'
import { isImported } from '@/helpers/isImported.ts'

Deno.test('isImported - one file in every spelling is not imported', () => {
  assertEquals(isImported('./src/user.ts', './src/user.ts'), false)
  assertEquals(isImported('./src/user.ts', 'src/user.ts'), false)
  assertEquals(isImported('@/src/user.ts', './src/user.ts'), false)
  assertEquals(isImported('src/./user.ts', 'src/user.ts'), false)
  assertEquals(isImported('src\\user.ts', 'src/user.ts'), false)
  assertEquals(isImported('/src/user.ts', 'src/user.ts'), false)
  assertEquals(isImported('user.ts', 'user.ts'), false)
})

Deno.test('isImported - different files are imported', () => {
  assertEquals(isImported('./src/user.ts', './src/product.ts'), true)
  assertEquals(isImported('src/models/user.ts', 'src/api/user.ts'), true)
  assertEquals(isImported('models/user.ts', 'api/user.ts'), true)
})

Deno.test('isImported - a path that cannot be an export path throws, as the engine does', () => {
  assertThrows(() => isImported('src/models/../user.ts', 'src/user.ts'))
})
