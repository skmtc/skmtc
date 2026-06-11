import { assertEquals, assertThrows } from '@std/assert'
import {
  createAbstractRecord,
  createEnum,
  createRecord,
  toCsKeyword
} from './createIdentifier.ts'

Deno.test('createRecord writes the record kind', () => {
  const identifier = createRecord('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.kind, 'record')
  assertEquals(identifier.exported, true)
})

Deno.test('createAbstractRecord writes the abstract-record kind', () => {
  const identifier = createAbstractRecord('Animal')

  assertEquals(identifier.name, 'Animal')
  assertEquals(identifier.kind, 'abstract-record')
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

Deno.test('toCsKeyword maps the vocabulary with the D3/D14/CC3 modifiers riding the kind', () => {
  assertEquals(toCsKeyword('record'), 'sealed partial record')
  assertEquals(toCsKeyword('abstract-record'), 'abstract partial record')
  assertEquals(toCsKeyword('enum'), 'enum')
  assertEquals(toCsKeyword('class'), 'sealed partial class')
  assertEquals(toCsKeyword('interface'), 'interface')
})

Deno.test('toCsKeyword throws outside the vocabulary (foreign-language identifier; no alias/val kinds — the distinctive constraint)', () => {
  assertThrows(() => toCsKeyword('variable'), Error, 'Unknown C# entity kind: variable')
  assertThrows(() => toCsKeyword('data-class'), Error, 'Unknown C# entity kind: data-class')
  assertThrows(() => toCsKeyword('typealias'), Error, 'Unknown C# entity kind')
  assertThrows(() => toCsKeyword('val'), Error, 'Unknown C# entity kind')
})

Deno.test('toCsKeyword has no alias kind and no file-scope-value kind (the distinctive constraint)', () => {
  assertThrows(() => toCsKeyword('typealias'), Error, 'Unknown C# entity kind')
  assertThrows(() => toCsKeyword('val'), Error, 'Unknown C# entity kind')
})
