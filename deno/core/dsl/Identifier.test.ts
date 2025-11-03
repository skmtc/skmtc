import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'

Deno.test('Identifier.createVariable - creates untyped variable', () => {
  const identifier = Identifier.createVariable('userName')

  assertEquals(identifier.name, 'userName')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.entityType.type, 'variable')
  assertEquals(identifier.toString(), 'userName')
})

Deno.test('Identifier.createVariable - creates typed variable', () => {
  const identifier = Identifier.createVariable('userId', 'string')

  assertEquals(identifier.name, 'userId')
  assertEquals(identifier.typeName, 'string')
  assertEquals(identifier.entityType.type, 'variable')
  assertEquals(identifier.toString(), 'userId')
})

Deno.test('Identifier.createType - creates type identifier', () => {
  const identifier = Identifier.createType('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.entityType.type, 'type')
  assertEquals(identifier.toString(), 'User')
})

Deno.test('Identifier - toString returns identifier name', () => {
  const variable = Identifier.createVariable('count', 'number')
  const type = Identifier.createType('Status')

  assertEquals(variable.toString(), 'count')
  assertEquals(type.toString(), 'Status')
})
