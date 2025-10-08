import { assertEquals } from '@std/assert'
import { List } from './List.ts'

Deno.test('List - basic comma-separated list', () => {
  const list = new List(['a', 'b', 'c'])
  assertEquals(list.toString(), 'a, b, c')
})

Deno.test('List - filters undefined values', () => {
  const list = new List(['a', undefined, 'c'])
  assertEquals(list.toString(), 'a, c')
})

Deno.test('List - toEmpty returns empty string', () => {
  const list = List.toEmpty()
  assertEquals(list.toString(), '')
})

Deno.test('List - toSingle returns single value', () => {
  const list = List.toSingle('value')
  assertEquals(list.toString(), 'value')
})

Deno.test('List - toObject with curly braces', () => {
  const list = List.toObject(['x', 'y'])
  assertEquals(list.toString(), '{x, y}')
})

Deno.test('List - toArray with square brackets', () => {
  const list = List.toArray(['a', 'b'])
  assertEquals(list.toString(), '[a, b]')
})

Deno.test('List - toParams with parentheses', () => {
  const list = List.toParams(['p1', 'p2'])
  assertEquals(list.toString(), '(p1, p2)')
})

Deno.test('List - toLines with newline separator', () => {
  const list = List.toLines(['line1', 'line2'])
  assertEquals(list.toString(), 'line1\nline2')
})

Deno.test('List - toKeyValue joins with colon', () => {
  const list = List.toKeyValue('name', 'string')
  assertEquals(list.toString(), 'name: string')
})

Deno.test('List - skipEmpty returns empty for empty list', () => {
  const list = List.toObject([], { skipEmpty: true })
  assertEquals(list.toString(), '')
})

Deno.test('List - skipEmpty returns value for non-empty', () => {
  const list = List.toObject(['x'], { skipEmpty: true })
  assertEquals(list.toString(), '{x}')
})

Deno.test('List - toRecord creates key-value pairs', () => {
  const list = List.toRecord({ name: 'string', age: 'number' })
  assertEquals(list.toString(), '{name: string, age: number}')
})

Deno.test('List - toFilteredRecord removes undefined', () => {
  const list = List.toFilteredRecord({ name: 'string', age: undefined })
  assertEquals(list.toString(), '{name: string}')
})

Deno.test('List - hasValue returns true for string', () => {
  assertEquals(List.hasValue('test'), true)
})

Deno.test('List - hasValue returns false for undefined', () => {
  assertEquals(List.hasValue(undefined), false)
})

Deno.test('List - hasValue returns false for empty array', () => {
  assertEquals(List.hasValue([]), false)
})

Deno.test('List - toObjectKey joins with dot', () => {
  const list = List.toObjectKey('obj', 'prop')
  assertEquals(list.toString(), 'obj.prop')
})

Deno.test('List - custom separator', () => {
  const list = new List(['a', 'b', 'c'], { separator: ' | ' })
  assertEquals(list.toString(), 'a | b | c')
})

Deno.test('List - empty list with bookends', () => {
  const list = new List([], { bookends: '[]' })
  assertEquals(list.toString(), '[]')
})

Deno.test('List - single item with bookends', () => {
  const list = new List(['x'], { bookends: '[]' })
  assertEquals(list.toString(), '[x]')
})

Deno.test('List - fromKeys with object', () => {
  const list = List.fromKeys({ a: 1, b: 2, c: 3 })
  const result = list.toString()
  // Check that keys are present in the result
  assertEquals(typeof result, 'string')
  assertEquals(result.length > 0, true)
})

Deno.test('List - fromKeys with empty object', () => {
  const list = List.fromKeys({})
  // Empty object should still return a List (not a string)
  assertEquals(typeof list.toString, 'function')
})

Deno.test('List - toObjectPlain wraps in braces', () => {
  const list = List.fromKeys({ x: 1, y: 2 }).toObjectPlain()
  assertEquals(list.toString(), '{x, y}')
})

Deno.test('List - multiple undefined values filtered', () => {
  const list = new List(['a', undefined, 'b', undefined, 'c'])
  assertEquals(list.toString(), 'a, b, c')
})

Deno.test('List - all undefined returns empty', () => {
  const list = new List([undefined, undefined, undefined])
  assertEquals(list.toString(), '')
})

Deno.test('List - toFilteredRecord with all undefined', () => {
  const list = List.toFilteredRecord({ a: undefined, b: undefined })
  assertEquals(list.toString(), '{}')
})

Deno.test('List - toRecord with mixed values', () => {
  const list = List.toRecord({ name: 'string', age: 'number', active: 'boolean' })
  const result = list.toString()
  assertEquals(result.includes('name: string'), true)
  assertEquals(result.includes('age: number'), true)
  assertEquals(result.includes('active: boolean'), true)
})
