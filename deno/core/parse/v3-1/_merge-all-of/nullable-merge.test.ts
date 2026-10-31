import { assertEquals } from '@std/assert/equals'
import { mergeNullOnly, isNullOnly } from './nullable-merge.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { mergeIntersection } from '@/parse/v3-1/_merge-all-of/merge-intersection.ts'
import { mergeUnion } from '@/parse/v3-1/_merge-all-of/merge-union.ts'
import { normalizeMergeMember } from '@/parse/v3-1/schema/normalize-schema-shape.ts'

// `{ nullable: true }` is how a `{ type: 'null' }` member reads once
// `normalizeMergeMember` has run.
const nullOnlyUnion: OpenAPIV3.SchemaObject = { oneOf: [{ nullable: true }] }
const getRef = () => ({})

Deno.test('null-only union - an allOf member reads as nullable', () => {
  const result = mergeIntersection({
    schema: { allOf: [{ type: 'string' }, nullOnlyUnion] },
    getRef,
    normalize: normalizeMergeMember
  })

  assertEquals(result, { type: 'string', nullable: true })
})

Deno.test('null-only union - a nested oneOf member makes the union nullable', () => {
  const result = mergeUnion({
    schema: { oneOf: [{ type: 'string' }, nullOnlyUnion] },
    getRef,
    normalize: normalizeMergeMember,
    groupType: 'oneOf'
  })

  assertEquals(result, { oneOf: [{ type: 'string' }], nullable: true })
})

Deno.test('null-only union - a nested anyOf member makes the union nullable', () => {
  const result = mergeUnion({
    schema: { anyOf: [{ type: 'string' }, { anyOf: [{ nullable: true }] }] },
    getRef,
    normalize: normalizeMergeMember,
    groupType: 'anyOf'
  })

  assertEquals(result, { anyOf: [{ type: 'string' }], nullable: true })
})

Deno.test('null-only union - inside a oneOf inside an allOf, no "Empty oneOf"', () => {
  const result = mergeIntersection({
    schema: { allOf: [{ oneOf: [nullOnlyUnion] }, { description: 'x' }] },
    getRef,
    normalize: normalizeMergeMember
  })

  assertEquals(result, { nullable: true, description: 'x' })
})

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

Deno.test('mergeNullOnly - mutates the original schema', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'number',
    enum: [1, 2, 3]
  }

  const result = mergeNullOnly(schema)

  // Verify it's the same object (reference equality)
  assertEquals(result === schema, true)
  // Verify the original was mutated
  assertEquals(schema.nullable, true)
  assertEquals(schema.enum, [1, 2, 3, null])
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
