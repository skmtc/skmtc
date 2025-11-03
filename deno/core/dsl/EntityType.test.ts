import { assertEquals } from '@std/assert/equals'
import { EntityType } from '@/dsl/EntityType.ts'

Deno.test('EntityType - variable type maps to const keyword', () => {
  const entity = new EntityType('variable')

  assertEquals(entity.type, 'variable')
  assertEquals(entity.toString(), 'const')
})

Deno.test('EntityType - type maps to type keyword', () => {
  const entity = new EntityType('type')

  assertEquals(entity.type, 'type')
  assertEquals(entity.toString(), 'type')
})
