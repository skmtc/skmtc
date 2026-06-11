import { assertEquals, assertThrows } from '@std/assert'
import { sanitizePropertyName } from './sanitizePropertyName.ts'

Deno.test('plain identifiers pass through unchanged', () => {
  assertEquals(sanitizePropertyName('UserId'), 'UserId')
  assertEquals(sanitizePropertyName('name'), 'name')
  assertEquals(sanitizePropertyName('_private'), '_private')
  assertEquals(sanitizePropertyName('Value2'), 'Value2')
})

Deno.test('contextual keywords are legal identifiers and pass through', () => {
  assertEquals(sanitizePropertyName('record'), 'record')
  assertEquals(sanitizePropertyName('init'), 'init')
  assertEquals(sanitizePropertyName('required'), 'required')
  assertEquals(sanitizePropertyName('value'), 'value')
  assertEquals(sanitizePropertyName('var'), 'var')
})

Deno.test('reserved keywords get the @ verbatim-identifier prefix', () => {
  assertEquals(sanitizePropertyName('class'), '@class')
  assertEquals(sanitizePropertyName('object'), '@object')
  assertEquals(sanitizePropertyName('string'), '@string')
  assertEquals(sanitizePropertyName('event'), '@event')
})

Deno.test('digit-leading names get the _ prefix (a rename, unlike @)', () => {
  assertEquals(sanitizePropertyName('1st'), '_1st')
  assertEquals(sanitizePropertyName('2fa'), '_2fa')
})

Deno.test('names nothing can save throw (gen-side rename required)', () => {
  assertThrows(() => sanitizePropertyName('user name'), Error, 'cannot be escaped')
  assertThrows(() => sanitizePropertyName('user.name'), Error, 'cannot be escaped')
  assertThrows(() => sanitizePropertyName('user-name'), Error, 'cannot be escaped')
  assertThrows(() => sanitizePropertyName(''), Error, 'cannot be escaped')
  assertThrows(() => sanitizePropertyName('1st place'), Error, 'cannot be escaped')
})
