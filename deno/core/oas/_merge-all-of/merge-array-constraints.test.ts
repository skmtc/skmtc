import { assertEquals, assertThrows } from '@std/assert'
import { mergeArrayConstraints } from './merge-array-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('mergeArrayConstraints - merges length constraints', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    minItems: 0,
    maxItems: 10,
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    minItems: 5,
    maxItems: 15,
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b)
  assertEquals(result, {
    type: 'array',
    minItems: 5,
    maxItems: 10,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - handles missing constraints', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    minItems: 5,
    maxItems: 15,
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b)

  assertEquals(result, {
    type: 'array',
    minItems: 5,
    maxItems: 15,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - handles single uniqueItems', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b)
  assertEquals(result, {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - handles conflicting uniqueItems', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    uniqueItems: false,
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b)
  assertEquals(result, {
    type: 'array',
    uniqueItems: true,
    items: { type: 'string' }
  })
})

Deno.test('mergeArrayConstraints - merges enum values when both schemas have enums', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['c', 'd'],
      ['e', 'f']
    ]
  }
  const result = mergeArrayConstraints(a, b)
  assertEquals(result, {
    type: 'array',
    items: { type: 'string' },
    enum: [['c', 'd']]
  })
})

Deno.test('mergeArrayConstraints - takes enum from second schema when first has no enum', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const result = mergeArrayConstraints(a, b)
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
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const result = mergeArrayConstraints(a, b)
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
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['a', 'b'],
      ['c', 'd']
    ]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' },
    enum: [
      ['e', 'f'],
      ['g', 'h']
    ]
  }
  assertThrows(() => mergeArrayConstraints(a, b), Error, 'Merged schema has empty enum array')
})
