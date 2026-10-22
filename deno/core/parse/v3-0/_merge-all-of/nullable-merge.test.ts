import { assertEquals } from '@std/assert/equals'
import { mergeNullOnly, isNullOnly } from './nullable-merge.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('mergeNullOnly - sets nullable to true', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string'
  }

  const result = mergeNullOnly(schema)

  assertEquals(result.nullable, true)
})

Deno.test('mergeNullOnly - adds null to enum when enum exists without null', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['a', 'b', 'c']
  }

  const result = mergeNullOnly(schema)

  assertEquals(result.enum, ['a', 'b', 'c', null])
  assertEquals(result.nullable, true)
})

Deno.test('mergeNullOnly - does not duplicate null when enum already contains null', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: ['a', 'b', null]
  }

  const result = mergeNullOnly(schema)

  assertEquals(result.enum, ['a', 'b', null])
  assertEquals(result.nullable, true)
})

Deno.test('mergeNullOnly - handles schema without enum property', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'integer',
    minimum: 0
  }

  const result = mergeNullOnly(schema)

  assertEquals(result.enum, undefined)
  assertEquals(result.nullable, true)
})

Deno.test('mergeNullOnly - handles empty enum array', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    enum: []
  }

  const result = mergeNullOnly(schema)

  assertEquals(result.enum, [null])
  assertEquals(result.nullable, true)
})

Deno.test('mergeNullOnly - handles enum with multiple values', () => {
  const schema: OpenAPIV3.SchemaObject = {
    enum: ['option1', 'option2', 'option3']
  }

  const result = mergeNullOnly(schema)

  assertEquals(result.enum, ['option1', 'option2', 'option3', null])
  assertEquals(result.nullable, true)
})

Deno.test('mergeNullOnly - returns the modified schema object', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'boolean'
  }

  const result = mergeNullOnly(schema)

  assertEquals(typeof result, 'object')
  assertEquals(result.nullable, true)
})

Deno.test('isNullOnly - returns true for valid null-only schema', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true,
    enum: [null]
  }

  const result = isNullOnly(schema)

  assertEquals(result, true)
})

Deno.test('isNullOnly - returns true when type property exists but is ignored', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    nullable: true,
    enum: [null]
  }

  const result = isNullOnly(schema)

  assertEquals(result, true)
})

Deno.test('isNullOnly - returns false when nullable is false', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: false,
    enum: [null]
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

Deno.test('isNullOnly - returns false when nullable is undefined', () => {
  const schema: OpenAPIV3.SchemaObject = {
    enum: [null]
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

Deno.test('isNullOnly - returns false when enum has multiple values', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true,
    enum: [null, 'value']
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

Deno.test('isNullOnly - returns false when enum is [null] but nullable is false', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: false,
    enum: [null]
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

Deno.test('isNullOnly - returns false when schema has additional properties', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true,
    enum: [null],
    description: 'A null value'
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

Deno.test('isNullOnly - returns false when enum is missing', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

Deno.test('isNullOnly - returns false when enum is empty array', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true,
    enum: []
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

Deno.test('isNullOnly - returns false when enum contains non-null value', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: true,
    enum: ['not-null']
  }

  const result = isNullOnly(schema)

  assertEquals(result, false)
})

/**
 * `getRef` hands back the LIVE `components.schemas[X]` object, and property
 * schemas are read straight off the document too, so anything mutated here is
 * rewritten for every other use site and the result depends on parse order.
 * Both fields matter: `enum` is an array, so appending to it reaches the
 * original through a shallow copy.
 */
Deno.test('mergeNullOnly - does not mutate its argument', () => {
  const schema: OpenAPIV3.SchemaObject = { type: 'string', enum: ['a', 'b'] }
  const before = JSON.stringify(schema)

  const result = mergeNullOnly(schema)

  assertEquals(JSON.stringify(schema), before, 'the input schema must be untouched')
  assertEquals(result.enum, ['a', 'b', null])
  assertEquals(result.nullable, true)
  assertEquals(schema.enum, ['a', 'b'], 'the enum ARRAY must not be appended to')
})
