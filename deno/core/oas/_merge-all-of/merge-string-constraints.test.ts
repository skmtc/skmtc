import { assertEquals, assertThrows } from '@std/assert'
import { mergeStringConstraints } from './merge-string-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('mergeStringConstraints - handles minLength', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'string',
    minLength: 0
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'string',
    minLength: 5
  }
  const result = mergeStringConstraints(a, b)
  assertEquals(result, {
    type: 'string',
    minLength: 5
  })
})

Deno.test('mergeStringConstraints - handles maxLength', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'string',
    maxLength: 10
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'string',
    maxLength: 5
  }
  const result = mergeStringConstraints(a, b)
  assertEquals(result, {
    type: 'string',
    maxLength: 5
  })
})

Deno.test('mergeStringConstraints - throws error on conflicting patterns', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'string',
    pattern: '^[a-z]+$'
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'string',
    pattern: '^[a-z0-9]+$'
  }
  assertThrows(
    () => mergeStringConstraints(a, b),
    Error,
    "Cannot merge schemas: conflicting patterns '^[a-z]+$' and '^[a-z0-9]+$'"
  )
})

Deno.test('mergeStringConstraints - throws error on different types', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'string',
    minLength: 5
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'number',
    minimum: 0
  }
  assertThrows(
    () => mergeStringConstraints(a, b),
    Error,
    "Cannot merge schemas: conflicting types 'string' and 'number'"
  )
})

Deno.test('mergeStringConstraints - handles schemas without type', () => {
  const a: OpenAPIV3.SchemaObject = {}
  const b: OpenAPIV3.SchemaObject = {}
  const result = mergeStringConstraints(a, b)
  assertEquals(result, {})
})

Deno.test('mergeStringConstraints - merges enum values when both schemas have enums', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['a', 'b', 'c']
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['b', 'c', 'd']
  }
  const result = mergeStringConstraints(a, b)
  assertEquals(result, {
    type: 'string',
    enum: ['b', 'c']
  })
})

Deno.test('mergeStringConstraints - takes enum from second schema when first has no enum', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['a', 'b', 'c']
  }
  const result = mergeStringConstraints(a, b)
  assertEquals(result, {
    type: 'string',
    enum: ['a', 'b', 'c']
  })
})

Deno.test('mergeStringConstraints - takes enum from first schema when second has no enum', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['a', 'b', 'c']
  }
  const b: OpenAPIV3.SchemaObject = { type: 'string' }
  const result = mergeStringConstraints(a, b)
  assertEquals(result, {
    type: 'string',
    enum: ['a', 'b', 'c']
  })
})

Deno.test('mergeStringConstraints - throws when enum intersection is empty', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['a', 'b', 'c']
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['d', 'e', 'f']
  }
  assertThrows(() => mergeStringConstraints(a, b), Error, 'Merged schema has empty enum array')
})
