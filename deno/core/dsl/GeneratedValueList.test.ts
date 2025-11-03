import { assertEquals } from '@std/assert/equals'
import { GeneratedValueList } from '@/dsl/GeneratedValueList.ts'
import { EMPTY } from '@/dsl/constants.ts'

Deno.test('GeneratedValueList - creates empty list', () => {
  const list = new GeneratedValueList(', ')

  assertEquals(list.separator, ', ')
  assertEquals(list.toString(), '')
})

Deno.test('GeneratedValueList - adds and joins values with separator', () => {
  const list = new GeneratedValueList(', ')

  list.add({ toString: () => 'value1' })
  list.add({ toString: () => 'value2' })
  list.add({ toString: () => 'value3' })

  assertEquals(list.toString(), 'value1, value2, value3')
})

Deno.test('GeneratedValueList - filters out EMPTY constant values', () => {
  const list = new GeneratedValueList(', ')

  list.add({ toString: () => 'value1' })
  list.add({ toString: () => EMPTY })
  list.add({ toString: () => 'value2' })
  list.add({ toString: () => EMPTY })
  list.add({ toString: () => 'value3' })

  assertEquals(list.toString(), 'value1, value2, value3')
})

Deno.test('GeneratedValueList - works with newline separator', () => {
  const list = new GeneratedValueList('\n')

  list.add({ toString: () => 'line1' })
  list.add({ toString: () => 'line2' })
  list.add({ toString: () => 'line3' })

  assertEquals(list.toString(), 'line1\nline2\nline3')
})

Deno.test('GeneratedValueList - works with custom separators', () => {
  const list = new GeneratedValueList(' | ')

  list.add({ toString: () => "'active'" })
  list.add({ toString: () => "'inactive'" })
  list.add({ toString: () => "'pending'" })

  assertEquals(list.toString(), "'active' | 'inactive' | 'pending'")
})

Deno.test('GeneratedValueList - handles single value', () => {
  const list = new GeneratedValueList(', ')

  list.add({ toString: () => 'only-value' })

  assertEquals(list.toString(), 'only-value')
})

Deno.test('GeneratedValueList - returns empty string when all values are EMPTY', () => {
  const list = new GeneratedValueList(', ')

  list.add({ toString: () => EMPTY })
  list.add({ toString: () => EMPTY })
  list.add({ toString: () => EMPTY })

  assertEquals(list.toString(), '')
})
