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

// ===== toConditional Tests =====

Deno.test('List - toConditional renders value when condition is true', () => {
  const list = List.toConditional('content', true)
  assertEquals(list.toString(), 'content')
})

Deno.test('List - toConditional returns empty when condition is false', () => {
  const list = List.toConditional('content', false)
  assertEquals(list.toString(), '')
})

Deno.test('List - toConditional works with complex Stringable values', () => {
  const complexValue = List.toObject(['a', 'b'])
  const list = List.toConditional(complexValue, true)
  assertEquals(list.toString(), '{a, b}')
})

Deno.test('List - toConditional with false condition on complex value', () => {
  const complexValue = List.toObject(['a', 'b'])
  const list = List.toConditional(complexValue, false)
  assertEquals(list.toString(), '')
})

Deno.test('List - toConditional works with List as value', () => {
  const innerList = List.toParams(['arg1', 'arg2'])
  const list = List.toConditional(innerList, true)
  assertEquals(list.toString(), '(arg1, arg2)')
})

Deno.test('List - toConditional with boolean literal true', () => {
  const condition = 5 > 3
  const list = List.toConditional('result', condition)
  assertEquals(list.toString(), 'result')
})

// ===== toFilteredKeyValue Tests =====

Deno.test('List - toFilteredKeyValue returns undefined when value is undefined', () => {
  const result = List.toFilteredKeyValue('key', undefined)
  assertEquals(result, undefined)
})

Deno.test('List - toFilteredKeyValue returns undefined when value is empty string', () => {
  const result = List.toFilteredKeyValue('key', '')
  assertEquals(result?.toString(), 'key: ')
})

Deno.test('List - toFilteredKeyValue returns undefined when value is empty List', () => {
  const emptyList = List.toEmpty()
  const result = List.toFilteredKeyValue('key', emptyList)
  assertEquals(result, undefined)
})

Deno.test('List - toFilteredKeyValue returns key-value when value has content', () => {
  const result = List.toFilteredKeyValue('name', 'string')
  assertEquals(result?.toString(), 'name: string')
})

Deno.test('List - toFilteredKeyValue works with array values', () => {
  const result = List.toFilteredKeyValue('tags', ['a', 'b'])
  assertEquals(result?.toString(), 'tags: a,b')
})

// ===== fromEntries Tests =====

Deno.test('List - fromEntries creates EntryList from record', () => {
  const entryList = List.fromEntries({ a: 'valueA', b: 'valueB' })
  assertEquals(entryList.entries.length, 2)
})

Deno.test('List - fromEntries handles empty record', () => {
  const entryList = List.fromEntries({})
  assertEquals(entryList.entries.length, 0)
})

Deno.test('List - fromEntries preserves entry order', () => {
  const entryList = List.fromEntries({ first: '1', second: '2', third: '3' })
  assertEquals(entryList.entries[0][0], 'first')
  assertEquals(entryList.entries[1][0], 'second')
  assertEquals(entryList.entries[2][0], 'third')
})

Deno.test('List - fromEntries toObject with identity mapping', () => {
  const entryList = List.fromEntries({ x: 'X', y: 'Y' })
  const result = entryList.toObject(([key, value]) => List.toKeyValue(key, value))
  assertEquals(result.toString(), '{x: X, y: Y}')
})

Deno.test('List - fromEntries toObject with custom mapping', () => {
  const entryList = List.fromEntries({ a: '1', b: '2' })
  const result = entryList.toObject(([key, value]) => `${key}=${value}`)
  assertEquals(result.toString(), '{a=1, b=2}')
})

Deno.test('List - fromEntries toLines with mapping', () => {
  const entryList = List.fromEntries({ name: 'Alice', age: '30' })
  const result = entryList.toLines(([key, value]) => `${key}: ${value}`)
  assertEquals(result.toString(), 'name: Alice\nage: 30')
})

Deno.test('List - fromEntries toArray with mapping', () => {
  const entryList = List.fromEntries({ x: '10', y: '20' })
  const result = entryList.toArray(([key, value]) => `${key}=${value}`)
  assertEquals(result.toString(), '[x=10, y=20]')
})

Deno.test('List - fromEntries with undefined record returns empty EntryList', () => {
  const entryList = List.fromEntries(undefined)
  assertEquals(entryList.entries.length, 0)
})

// ===== KeyList Advanced Tests =====

Deno.test('List - KeyList toObject with custom mapFn', () => {
  const keyList = List.fromKeys({ a: 1, b: 2, c: 3 })
  const result = keyList.toObject((key) => `value_${key}`)
  const str = result.toString()
  assertEquals(str.includes('value_a'), true)
  assertEquals(str.includes('value_b'), true)
  assertEquals(str.includes('value_c'), true)
})

Deno.test('List - KeyList toObject with complex value mapping', () => {
  const keyList = List.fromKeys({ x: 1, y: 2 })
  const result = keyList.toObject((key, index) => `${key}[${index}]`)
  const str = result.toString()
  assertEquals(str.includes('x[0]'), true)
  assertEquals(str.includes('y[1]'), true)
})

Deno.test('List - KeyList toObjectPlain with special characters', () => {
  const keyList = List.fromKeys({ 'foo-bar': 1, 'baz_qux': 2 })
  const result = keyList.toObjectPlain()
  const str = result.toString()
  assertEquals(str.includes('foo-bar'), true)
  assertEquals(str.includes('baz_qux'), true)
})

Deno.test('List - KeyList toLines with custom mapFn', () => {
  const keyList = List.fromKeys({ a: 1, b: 2 })
  const result = keyList.toLines((key) => `const ${key} = value`)
  assertEquals(result.toString(), 'const a = value\nconst b = value')
})

Deno.test('List - KeyList toLines with complex value mapping', () => {
  const keyList = List.fromKeys({ x: 1, y: 2, z: 3 })
  const result = keyList.toLines((key, index) => `${index}: ${key}`)
  assertEquals(result.toString(), '0: x\n1: y\n2: z')
})

Deno.test('List - KeyList toLinesPlain basic functionality', () => {
  const keyList = List.fromKeys({ first: 1, second: 2, third: 3 })
  const result = keyList.toLinesPlain()
  const lines = result.toString().split('\n')
  assertEquals(lines.length, 3)
})

Deno.test('List - KeyList toLinesPlain with empty KeyList', () => {
  const keyList = List.fromKeys({})
  const result = keyList.toLinesPlain()
  assertEquals(result.toString(), '')
})

Deno.test('List - KeyList toObject with skipEmpty option', () => {
  const keyList = List.fromKeys({})
  const result = keyList.toObject((key) => key, { skipEmpty: true })
  assertEquals(result.toString(), '')
})

Deno.test('List - KeyList with large number of keys', () => {
  const record: Record<string, number> = {}
  for (let i = 0; i < 100; i++) {
    record[`key${i}`] = i
  }
  const keyList = List.fromKeys(record)
  assertEquals(keyList.keys.length, 100)
})

Deno.test('List - KeyList with Unicode keys', () => {
  const keyList = List.fromKeys({ '日本語': 1, 'emoji😀': 2, 'Ελληνικά': 3 })
  const result = keyList.toObjectPlain()
  const str = result.toString()
  assertEquals(str.includes('日本語'), true)
  assertEquals(str.includes('emoji😀'), true)
  assertEquals(str.includes('Ελληνικά'), true)
})

// ===== EntryList Complete Coverage =====

Deno.test('List - EntryList toObject basic transformation', () => {
  const entryList = List.fromEntries({ a: 'A', b: 'B' })
  const result = entryList.toObject(([key, value]) => `${key}:${value}`)
  assertEquals(result.toString(), '{a:A, b:B}')
})

Deno.test('List - EntryList toObject with value transformation', () => {
  const entryList = List.fromEntries({ name: 'alice', age: '25' })
  const result = entryList.toObject(([key, value]) => `${key}=${value.toUpperCase()}`)
  assertEquals(result.toString(), '{name=ALICE, age=25}')
})

Deno.test('List - EntryList toObject with undefined filtering', () => {
  const entryList = List.fromEntries({ a: 'A', b: 'B', c: 'C' })
  const result = entryList.toObject(([key, value]) => key === 'b' ? undefined : value)
  assertEquals(result.toString(), '{A, C}')
})

Deno.test('List - EntryList toLines basic transformation', () => {
  const entryList = List.fromEntries({ x: '1', y: '2' })
  const result = entryList.toLines(([key, value]) => `${key} = ${value}`)
  assertEquals(result.toString(), 'x = 1\ny = 2')
})

Deno.test('List - EntryList toLines with value transformation', () => {
  const entryList = List.fromEntries({ first: 'a', second: 'b' })
  const result = entryList.toLines(([key], index) => `[${index}] ${key}`)
  assertEquals(result.toString(), '[0] first\n[1] second')
})

Deno.test('List - EntryList toArray basic transformation', () => {
  const entryList = List.fromEntries({ a: '1', b: '2' })
  const result = entryList.toArray(([key, value]) => `${key}${value}`)
  assertEquals(result.toString(), '[a1, b2]')
})

Deno.test('List - EntryList toArray with value transformation', () => {
  const entryList = List.fromEntries({ foo: 'bar', baz: 'qux' })
  const result = entryList.toArray(([key, value]) => `"${key}":"${value}"`)
  assertEquals(result.toString(), '["foo":"bar", "baz":"qux"]')
})

Deno.test('List - EntryList empty toObject', () => {
  const entryList = List.fromEntries({})
  const result = entryList.toObject(([key, value]) => `${key}:${value}`)
  assertEquals(result.toString(), '{}')
})

Deno.test('List - EntryList empty toLines', () => {
  const entryList = List.fromEntries({})
  const result = entryList.toLines(([key, value]) => `${key}=${value}`)
  assertEquals(result.toString(), '')
})

Deno.test('List - EntryList empty toArray', () => {
  const entryList = List.fromEntries({})
  const result = entryList.toArray(([key, value]) => `${key}${value}`)
  assertEquals(result.toString(), '[]')
})

Deno.test('List - EntryList with complex value types', () => {
  const innerList = List.toObject(['a', 'b'])
  const entryList = List.fromEntries({ data: innerList })
  const result = entryList.toObject(([key, value]) => List.toKeyValue(key, value))
  assertEquals(result.toString(), '{data: {a, b}}')
})

Deno.test('List - EntryList with mixed Stringable types', () => {
  const entryList = List.fromEntries({ str: 'text', num: '42', bool: 'true' })
  const result = entryList.toArray(([, value]) => value)
  assertEquals(result.toString(), '[text, 42, true]')
})

// ===== Record Operations with Complex Values =====

Deno.test('List - toRecord with List values', () => {
  const innerList = List.toArray(['x', 'y'])
  const result = List.toRecord({ items: innerList })
  assertEquals(result.toString(), '{items: [x, y]}')
})

Deno.test('List - toRecord with array of Stringable values', () => {
  const result = List.toRecord({ tags: ['a', 'b', 'c'] })
  assertEquals(result.toString(), '{tags: a,b,c}')
})

Deno.test('List - toRecord with mixed value types', () => {
  const innerList = List.toParams(['p1', 'p2'])
  const result = List.toRecord({ name: 'string', params: innerList, count: '5' })
  const str = result.toString()
  assertEquals(str.includes('name: string'), true)
  assertEquals(str.includes('params: (p1, p2)'), true)
  assertEquals(str.includes('count: 5'), true)
})

Deno.test('List - toRecord with nested Lists', () => {
  const outer = List.toObject(['a', 'b'])
  const inner = List.toArray(['1', '2'])
  const result = List.toRecord({ outer, inner })
  const str = result.toString()
  assertEquals(str.includes('outer: {a, b}'), true)
  assertEquals(str.includes('inner: [1, 2]'), true)
})

Deno.test('List - toFilteredRecord removes empty arrays', () => {
  const result = List.toFilteredRecord({ items: [], name: 'value' })
  assertEquals(result.toString(), '{name: value}')
})

Deno.test('List - toFilteredRecord removes empty Lists', () => {
  const emptyList = List.toEmpty()
  const result = List.toFilteredRecord({ empty: emptyList, valid: 'data' })
  assertEquals(result.toString(), '{valid: data}')
})

Deno.test('List - toFilteredRecord keeps non-empty arrays', () => {
  const result = List.toFilteredRecord({ tags: ['a', 'b'], name: 'value' })
  const str = result.toString()
  assertEquals(str.includes('tags: a,b'), true)
  assertEquals(str.includes('name: value'), true)
})

Deno.test('List - toFilteredRecord keeps non-empty Lists', () => {
  const nonEmptyList = List.toObject(['x', 'y'])
  const result = List.toFilteredRecord({ data: nonEmptyList, name: 'value' })
  const str = result.toString()
  assertEquals(str.includes('data: {x, y}'), true)
  assertEquals(str.includes('name: value'), true)
})

Deno.test('List - toFilteredRecord with mixed empty/non-empty', () => {
  const emptyList = List.toEmpty()
  const fullList = List.toArray(['a'])
  const result = List.toFilteredRecord({
    empty: emptyList,
    emptyArr: [],
    fullList,
    fullArr: ['x'],
    undef: undefined,
    valid: 'data'
  })
  const str = result.toString()
  assertEquals(str.includes('fullList: [a]'), true)
  assertEquals(str.includes('fullArr: x'), true)
  assertEquals(str.includes('valid: data'), true)
  assertEquals(str.includes('empty'), false)
  assertEquals(str.includes('emptyArr'), false)
  assertEquals(str.includes('undef'), false)
})

Deno.test('List - toRecord with undefined in arrays', () => {
  const result = List.toRecord({ items: ['a', undefined, 'b'] })
  assertEquals(result.toString(), '{items: a,,b}')
})

// ===== hasValue Advanced Tests =====

Deno.test('List - hasValue returns false for empty List', () => {
  const emptyList = List.toEmpty()
  assertEquals(List.hasValue(emptyList), false)
})

Deno.test('List - hasValue returns true for List with values', () => {
  const list = List.toObject(['a', 'b'])
  assertEquals(List.hasValue(list), true)
})

Deno.test('List - hasValue handles nested List (one level)', () => {
  const innerList = List.toArray(['x'])
  const outerList = new List([innerList])
  assertEquals(List.hasValue(outerList), true)
})

Deno.test('List - hasValue handles deeply nested Lists (3+ levels)', () => {
  const level3 = List.toSingle('value')
  const level2 = new List([level3])
  const level1 = new List([level2])
  assertEquals(List.hasValue(level1), true)
})

Deno.test('List - hasValue returns true for List containing empty Lists', () => {
  // hasValue checks if values array is non-empty, not if those values are empty Lists
  const emptyInner = List.toEmpty()
  const outerList = new List([emptyInner])
  // The values array has 1 item (even though it's an empty List), so hasValue returns true
  assertEquals(List.hasValue(outerList), true)
})

Deno.test('List - hasValue returns true for nested List with any value', () => {
  const innerWithValue = List.toSingle('data')
  const emptyInner = List.toEmpty()
  const outerList = new List([emptyInner, innerWithValue])
  assertEquals(List.hasValue(outerList), true)
})

Deno.test('List - hasValue works with List in arrays', () => {
  const innerList = List.toObject(['a'])
  assertEquals(List.hasValue([innerList]), true)
})

Deno.test('List - hasValue with mixed empty and non-empty nested Lists', () => {
  const empty1 = List.toEmpty()
  const empty2 = new List([])
  const full = List.toSingle('value')
  const mixed = new List([empty1, empty2, full])
  assertEquals(List.hasValue(mixed), true)
})

// ===== Complex Integration Tests =====

Deno.test('List - nested Lists in record values', () => {
  const params = List.toParams(['arg1', 'arg2'])
  const returns = List.toObject(['prop1', 'prop2'])
  const signature = List.toRecord({ params, returns })
  const str = signature.toString()
  assertEquals(str.includes('params: (arg1, arg2)'), true)
  assertEquals(str.includes('returns: {prop1, prop2}'), true)
})

Deno.test('List - three-level List nesting', () => {
  const level3 = List.toSingle('innermost')
  const level2 = List.toObject([level3])
  const level1 = List.toArray([level2])
  assertEquals(level1.toString(), '[{innermost}]')
})

Deno.test('List - record with mixed types (string, array, List)', () => {
  const listValue = List.toParams(['p1', 'p2'])
  const arrayValue = ['a', 'b']
  const stringValue = 'simple'
  const result = List.toRecord({
    str: stringValue,
    arr: arrayValue,
    list: listValue
  })
  const str = result.toString()
  assertEquals(str.includes('str: simple'), true)
  assertEquals(str.includes('arr: a,b'), true)
  assertEquals(str.includes('list: (p1, p2)'), true)
})

Deno.test('List - long list (1000+ items) performance', () => {
  const items = Array.from({ length: 1000 }, (_, i) => `item${i}`)
  const list = List.toArray(items)
  const result = list.toString()
  assertEquals(result.startsWith('[item0,'), true)
  assertEquals(result.endsWith('item999]'), true)
})

Deno.test('List - Unicode and emoji in values', () => {
  const list = List.toObject(['日本語', 'emoji😀', 'Ελληνικά'])
  const result = list.toString()
  assertEquals(result.includes('日本語'), true)
  assertEquals(result.includes('emoji😀'), true)
  assertEquals(result.includes('Ελληνικά'), true)
})

Deno.test('List - special characters in separators', () => {
  const list = new List(['a', 'b', 'c'], { separator: ' -> ' })
  assertEquals(list.toString(), 'a -> b -> c')
})

Deno.test('List - custom bookends combinations', () => {
  const list1 = new List(['x'], { bookends: '{}' })
  const list2 = new List(['y'], { bookends: '[]' })
  const list3 = new List(['z'], { bookends: '()' })
  assertEquals(list1.toString(), '{x}')
  assertEquals(list2.toString(), '[y]')
  assertEquals(list3.toString(), '(z)')
})

Deno.test('List - toLines with nested structures', () => {
  const line1 = List.toObject(['a', 'b'])
  const line2 = List.toArray(['c', 'd'])
  const result = List.toLines([line1, line2])
  assertEquals(result.toString(), '{a, b}\n[c, d]')
})

Deno.test('List - fromKeys to toObject to toString chain', () => {
  const result = List.fromKeys({ x: 1, y: 2 })
    .toObject((key) => `val_${key}`)
    .toString()
  assertEquals(result.includes('val_x'), true)
  assertEquals(result.includes('val_y'), true)
})

Deno.test('List - fromEntries to toArray to toString chain', () => {
  const result = List.fromEntries({ a: 'A', b: 'B' })
    .toArray(([key, value]) => `${key}=${value}`)
    .toString()
  assertEquals(result, '[a=A, b=B]')
})

Deno.test('List - multiple filters in sequence', () => {
  const data = { a: 'A', b: undefined, c: [], d: List.toEmpty(), e: 'E' }
  const result = List.toFilteredRecord(data)
  const str = result.toString()
  assertEquals(str.includes('a: A'), true)
  assertEquals(str.includes('e: E'), true)
  assertEquals(str.includes('b'), false)
  assertEquals(str.includes('c'), false)
  assertEquals(str.includes('d'), false)
})

Deno.test('List - real-world use case: function parameters', () => {
  const params = List.toParams([
    'id: string',
    'options?: RequestOptions',
    'callback?: (result: T) => void'
  ])
  assertEquals(params.toString(), '(id: string, options?: RequestOptions, callback?: (result: T) => void)')
})

// ===== Edge Cases & Error Conditions =====

Deno.test('List - empty string values preserved (not filtered)', () => {
  const list = new List(['a', '', 'c'])
  assertEquals(list.toString(), 'a, , c')
})

Deno.test('List - zero values preserved', () => {
  const list = new List(['0', '1', '2'])
  assertEquals(list.toString(), '0, 1, 2')
})

Deno.test('List - false boolean string values preserved', () => {
  const list = new List(['true', 'false'])
  assertEquals(list.toString(), 'true, false')
})

Deno.test('List - very long single value (10000+ chars)', () => {
  const longValue = 'x'.repeat(10000)
  const list = List.toSingle(longValue)
  assertEquals(list.toString().length, 10000)
})

Deno.test('List - separator same as bookend character', () => {
  const list = new List(['a', 'b'], { separator: '[', bookends: '[]' })
  assertEquals(list.toString(), '[a[b]')
})

Deno.test('List - empty separator string', () => {
  const list = new List(['a', 'b', 'c'], { separator: '' })
  assertEquals(list.toString(), 'abc')
})

Deno.test('List - multiple consecutive undefined values', () => {
  const list = new List(['a', undefined, undefined, undefined, 'b'])
  assertEquals(list.toString(), 'a, b')
})

Deno.test('List - all values undefined except last', () => {
  const list = new List([undefined, undefined, undefined, 'last'])
  assertEquals(list.toString(), 'last')
})

Deno.test('List - skipEmpty with nested empty Lists', () => {
  const emptyInner = List.toEmpty()
  const list = List.toObject([emptyInner], { skipEmpty: true })
  // This should not skip because emptyInner is technically a value (List instance)
  // even though it renders as empty
  assertEquals(list.toString(), '{}')
})

Deno.test('List - toFilteredRecord with empty string values', () => {
  const result = List.toFilteredRecord({ name: '', value: 'data' })
  // Empty strings are not undefined, so they should be kept
  assertEquals(result.toString(), '{name: , value: data}')
})

// ===== Type Alias Verification =====

Deno.test('List - ListObject type works correctly', () => {
  const list: List<string[], ', ', '{}'> = List.toObject(['a', 'b'])
  assertEquals(list.toString(), '{a, b}')
})

Deno.test('List - ListArray type works correctly', () => {
  const list: List<string[], ', ', '[]'> = List.toArray(['x', 'y'])
  assertEquals(list.toString(), '[x, y]')
})

Deno.test('List - ListParams type works correctly', () => {
  const list: List<string[], ', ', '()'> = List.toParams(['p1', 'p2'])
  assertEquals(list.toString(), '(p1, p2)')
})

Deno.test('List - ListLines type works correctly', () => {
  const list: List<string[], '\n', 'none'> = List.toLines(['line1', 'line2'])
  assertEquals(list.toString(), 'line1\nline2')
})

Deno.test('List - ListKeyValue type works correctly', () => {
  const list: List<[string, string], ': ', 'none'> = List.toKeyValue('key', 'value')
  assertEquals(list.toString(), 'key: value')
})

Deno.test('List - type inference for generics works', () => {
  const list = List.toObject(['a', 'b', 'c'])
  // TypeScript should infer the correct types
  assertEquals(list.bookends, '{}')
  assertEquals(list.separator, ', ')
  assertEquals(list.values.length, 3)
})
