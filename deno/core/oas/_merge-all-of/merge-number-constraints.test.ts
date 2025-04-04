import { assertEquals, assertThrows } from '@std/assert'
import { mergeNumberConstraints } from './merge-number-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('mergeNumberConstraints - merges overlapping ranges', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 0,
    maximum: 10
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 5,
    maximum: 15
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    minimum: 5,
    maximum: 10
  })
})

Deno.test('mergeNumberConstraints - handles missing constraints', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'number' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 5,
    maximum: 15
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    minimum: 5,
    maximum: 15
  })
})

Deno.test('mergeNumberConstraints - handles exclusive bounds', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 5,
    maximum: 15
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    minimum: 5,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  })
})

Deno.test('mergeNumberConstraints - handles exclusive bounds with non-exclusive bounds', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 5,
    maximum: 15,
    exclusiveMinimum: false,
    exclusiveMaximum: false
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    minimum: 5,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  })
})

Deno.test('mergeNumberConstraints - handles multipleOf', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    multipleOf: 2
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    multipleOf: 3
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    multipleOf: 6
  })
})

Deno.test('mergeNumberConstraints - handles multipleOf', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    multipleOf: 2
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number'
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    multipleOf: 2
  })
})

Deno.test('mergeNumberConstraints - merges enum values when both schemas have enums', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    enum: [1.1, 2.2, 3.3]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    enum: [2.2, 3.3, 4.4]
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    enum: [2.2, 3.3]
  })
})

Deno.test('mergeNumberConstraints - takes enum from second schema when first has no enum', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'number' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    enum: [1.1, 2.2, 3.3]
  }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    enum: [1.1, 2.2, 3.3]
  })
})

Deno.test('mergeNumberConstraints - takes enum from first schema when second has no enum', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    enum: [1.1, 2.2, 3.3]
  }
  const b: OpenAPIV3.SchemaObject = { type: 'number' }
  const result = mergeNumberConstraints(a, b)
  assertEquals(result, {
    type: 'number',
    enum: [1.1, 2.2, 3.3]
  })
})

Deno.test('mergeNumberConstraints - throws when enum intersection is empty', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'number',
    enum: [1.1, 2.2, 3.3]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    enum: [4.4, 5.5, 6.6]
  }
  assertThrows(() => mergeNumberConstraints(a, b), Error, 'Merged schema has empty enum array')
})
