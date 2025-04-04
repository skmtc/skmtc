import { assertEquals, assertThrows } from '@std/assert'
import { mergeIntegerConstraints } from './merge-integer-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('mergeIntegerConstraints - merges overlapping ranges', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 0,
    maximum: 10
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 5,
    maximum: 15
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    minimum: 5,
    maximum: 10
  })
})

Deno.test('mergeIntegerConstraints - handles missing constraints', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'integer' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 5,
    maximum: 15
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    minimum: 5,
    maximum: 15
  })
})

Deno.test('mergeIntegerConstraints - handles exclusive bounds', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 5,
    maximum: 15
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    minimum: 5,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  })
})

Deno.test('mergeIntegerConstraints - handles exclusive bounds with non-exclusive bounds', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 5,
    maximum: 15,
    exclusiveMinimum: false,
    exclusiveMaximum: false
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    minimum: 5,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true
  })
})

Deno.test('mergeIntegerConstraints - handles multipleOf', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    multipleOf: 2
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    multipleOf: 3
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    multipleOf: 6
  })
})

Deno.test('mergeIntegerConstraints - preserves multipleOf when only one schema has it', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    multipleOf: 2
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer'
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    multipleOf: 2
  })
})

Deno.test('mergeIntegerConstraints - merges enum values when both schemas have enums', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    enum: [1, 2, 3]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    enum: [2, 3, 4]
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    enum: [2, 3]
  })
})

Deno.test('mergeIntegerConstraints - takes enum from second schema when first has no enum', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'integer' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    enum: [1, 2, 3]
  }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    enum: [1, 2, 3]
  })
})

Deno.test('mergeIntegerConstraints - takes enum from first schema when second has no enum', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    enum: [1, 2, 3]
  }
  const b: OpenAPIV3.SchemaObject = { type: 'integer' }
  const result = mergeIntegerConstraints(a, b)
  assertEquals(result, {
    type: 'integer',
    enum: [1, 2, 3]
  })
})

Deno.test('mergeIntegerConstraints - throws when enum intersection is empty', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'integer',
    enum: [1, 2, 3]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'integer',
    enum: [4, 5, 6]
  }
  assertThrows(() => mergeIntegerConstraints(a, b), Error, 'Merged schema has empty enum array')
})
