import { assertEquals, assertThrows } from '@std/assert'
import { sanitizePropertyName } from './sanitizePropertyName.ts'

Deno.test('plain identifiers pass through untouched', () => {
  assertEquals(sanitizePropertyName('userName'), 'userName')
  assertEquals(sanitizePropertyName('_internal'), '_internal')
  assertEquals(sanitizePropertyName('a1'), 'a1')
})

Deno.test('soft keywords are legal identifiers and pass through', () => {
  assertEquals(sanitizePropertyName('value'), 'value')
  assertEquals(sanitizePropertyName('data'), 'data')
  assertEquals(sanitizePropertyName('field'), 'field')
  assertEquals(sanitizePropertyName('import'), 'import')
})

Deno.test('hard keywords are backtick-escaped', () => {
  assertEquals(sanitizePropertyName('object'), '`object`')
  assertEquals(sanitizePropertyName('val'), '`val`')
  assertEquals(sanitizePropertyName('when'), '`when`')
  assertEquals(sanitizePropertyName('in'), '`in`')
})

Deno.test('syntactically invalid names are backtick-escaped', () => {
  assertEquals(sanitizePropertyName('user name'), '`user name`')
  assertEquals(sanitizePropertyName('1st'), '`1st`')
  assertEquals(sanitizePropertyName('user-name'), '`user-name`')
})

Deno.test('names backticks cannot save throw (JVM-illegal characters)', () => {
  assertThrows(() => sanitizePropertyName('a.b'), Error, 'cannot be escaped')
  assertThrows(() => sanitizePropertyName('a/b'), Error, 'cannot be escaped')
  assertThrows(() => sanitizePropertyName('a`b'), Error, 'cannot be escaped')
  assertThrows(() => sanitizePropertyName('a\nb'), Error, 'cannot be escaped')
})
