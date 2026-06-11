import { assertEquals, assertThrows } from '@std/assert'
import { createEnum, createRecord, toCsKeyword } from './createIdentifier.ts'

Deno.test('createRecord writes the record kind', () => {
  const identifier = createRecord('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.kind, 'record')
  assertEquals(identifier.exported, true)
})

Deno.test('createEnum writes the enum kind', () => {
  const identifier = createEnum('Status')

  assertEquals(identifier.name, 'Status')
  assertEquals(identifier.kind, 'enum')
})

Deno.test('factories honor exported: false (renders internal downstream)', () => {
  const identifier = createRecord('Internal', { exported: false })

  assertEquals(identifier.exported, false)
})

Deno.test('toCsKeyword maps the CS-A vocabulary with the D3 modifiers riding the kind', () => {
  assertEquals(toCsKeyword('record'), 'sealed partial record')
  assertEquals(toCsKeyword('enum'), 'enum')
})

Deno.test('toCsKeyword throws outside the vocabulary (foreign-language identifier)', () => {
  assertThrows(() => toCsKeyword('variable'), Error, 'Unknown C# entity kind: variable')
  assertThrows(() => toCsKeyword('data-class'), Error, 'Unknown C# entity kind: data-class')
})

Deno.test('toCsKeyword throws on deferred kinds until their milestone lands', () => {
  assertThrows(() => toCsKeyword('abstract-record'), Error, 'Unknown C# entity kind')
  assertThrows(() => toCsKeyword('class'), Error, 'Unknown C# entity kind')
  assertThrows(() => toCsKeyword('interface'), Error, 'Unknown C# entity kind')
})

Deno.test('toCsKeyword has no alias kind and no file-scope-value kind (the distinctive constraint)', () => {
  assertThrows(() => toCsKeyword('typealias'), Error, 'Unknown C# entity kind')
  assertThrows(() => toCsKeyword('val'), Error, 'Unknown C# entity kind')
})
