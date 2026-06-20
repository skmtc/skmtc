import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import { mergeArrayConstraints } from './merge-array-constraints.ts'
import type { GetRefFn, ArraySchemaObject } from './types.ts'

Deno.test('mergeArrayConstraints - merges length constraints', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    minItems: 0,
    maxItems: 10,
    items: { type: 'string' }
  }
  const b: ArraySchemaObject = {
    type: 'array',
    minItems: 5,
    maxItems: 15,
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b, getRef)

  assertEquals(result, {
    type: 'array',
    minItems: 5,
    maxItems: 10,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - handles missing constraints', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: ArraySchemaObject = {
    type: 'array',
    minItems: 5,
    maxItems: 15,
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b, getRef)

  assertEquals(result, {
    type: 'array',
    minItems: 5,
    maxItems: 15,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - handles single uniqueItems', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  }
  const b: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b, getRef)
  assertEquals(result, {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - handles conflicting uniqueItems', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  }
  const b: ArraySchemaObject = {
    type: 'array',
    uniqueItems: false,
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b, getRef)
  assertEquals(result, {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - merges enum values when both schemas have enums', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const b: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['c', 'd'],
      ['e', 'f']
    ]
  }
  const result = mergeArrayConstraints(a, b, getRef)
  assertEquals(result, {
    type: 'array',
    items: { type: 'string' },
    enum: [['c', 'd']]
  })
})

Deno.test('mergeArrayConstraints - takes enum from second schema when first has no enum', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const result = mergeArrayConstraints(a, b, getRef)
  assertEquals(result, {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  })
})

Deno.test('mergeArrayConstraints - takes enum from first schema when second has no enum', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const b: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b, getRef)
  assertEquals(result, {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  })
})

Deno.test('mergeArrayConstraints - throws when enum intersection is empty', () => {
  const getRef: GetRefFn = () => ({})

  const a: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const b: ArraySchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['e', 'f'],
      ['g', 'h']
    ]
  }
  assertThrows(
    () => mergeArrayConstraints(a, b, getRef),
    Error,
    'Merged schema has empty enum array'
  )
})
