import { assertEquals, assertThrows } from '@std/assert'
import { createVariable, createType, toTsKeyword } from './createIdentifier.ts'

Deno.test('createVariable - creates untyped variable', () => {
  const identifier = createVariable('userName')

  assertEquals(identifier.name, 'userName')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.kind, 'variable')
  assertEquals(identifier.exported, true)
  assertEquals(identifier.toString(), 'userName')
})

Deno.test('createVariable - creates typed variable', () => {
  const identifier = createVariable('userId', { typeName: 'string' })

  assertEquals(identifier.typeName, 'string')
  assertEquals(identifier.kind, 'variable')
})

Deno.test('createVariable - exported can be switched off', () => {
  const identifier = createVariable('helper', { exported: false })

  assertEquals(identifier.exported, false)
})

Deno.test('createType - creates type identifier', () => {
  const identifier = createType('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.kind, 'type')
  assertEquals(identifier.toString(), 'User')
})

Deno.test('toTsKeyword - maps the TypeScript kind vocabulary', () => {
  assertEquals(toTsKeyword('variable'), 'const')
  assertEquals(toTsKeyword('type'), 'type')
})

Deno.test('toTsKeyword - throws on a kind outside the vocabulary', () => {
  assertThrows(() => toTsKeyword('struct'), Error, 'Unknown TypeScript entity kind')
})
