import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'

Deno.test('Identifier - carries name, kind, typeName, exported', () => {
  const identifier = new Identifier({ name: 'userId', typeName: 'string', kind: 'variable' })

  assertEquals(identifier.name, 'userId')
  assertEquals(identifier.typeName, 'string')
  assertEquals(identifier.kind, 'variable')
  assertEquals(identifier.exported, true)
})

Deno.test('Identifier - exported defaults to true and can be switched off', () => {
  const hidden = new Identifier({ name: 'helper', kind: 'variable', exported: false })

  assertEquals(hidden.exported, false)
})

Deno.test('Identifier - kind is opaque to the engine', () => {
  // A non-TypeScript vocabulary flows through untouched — core never
  // interprets the value (a language package's renderer does).
  const rustStruct = new Identifier({ name: 'User', kind: 'struct' })

  assertEquals(rustStruct.kind, 'struct')
})

Deno.test('Identifier - toString returns the name', () => {
  const identifier = new Identifier({ name: 'count', typeName: 'number', kind: 'variable' })

  assertEquals(identifier.toString(), 'count')
})
