import { assertEquals } from '@std/assert/equals'
import { isEmpty } from './isEmpty.ts'

Deno.test('isEmpty - returns true for empty object', () => {
  assertEquals(isEmpty({}), true)
})

Deno.test('isEmpty - returns false for object with properties', () => {
  assertEquals(isEmpty({ name: 'John' }), false)
})

Deno.test('isEmpty - returns false for object with undefined value', () => {
  assertEquals(isEmpty({ value: undefined }), false)
})

Deno.test('isEmpty - returns false for object with null value', () => {
  assertEquals(isEmpty({ value: null }), false)
})

Deno.test('isEmpty - returns false for object with multiple properties', () => {
  assertEquals(isEmpty({ a: 1, b: 2, c: 3 }), false)
})

Deno.test('isEmpty - returns false for object with nested object', () => {
  assertEquals(isEmpty({ nested: {} }), false)
})

Deno.test('isEmpty - returns false for object with array property', () => {
  assertEquals(isEmpty({ items: [] }), false)
})

Deno.test('isEmpty - returns false for object with function property', () => {
  assertEquals(isEmpty({ fn: () => {} }), false)
})

Deno.test('isEmpty - returns true for object with only symbol properties', () => {
  const sym = Symbol('test')
  // Symbols are not enumerable by default, so they don't count as keys
  assertEquals(isEmpty({ [sym]: 'value' }), true)
})

Deno.test('isEmpty - returns true for object with only non-enumerable properties', () => {
  const obj = {}
  Object.defineProperty(obj, 'hidden', {
    value: 'secret',
    enumerable: false
  })
  assertEquals(isEmpty(obj), true)
})
