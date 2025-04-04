import { assertEquals, assertThrows } from '@std/assert'
import { mergeBooleanConstraints } from './merge-boolean-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('mergeBooleanConstraints - takes type from second schema when defined', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'boolean'
  }

  const b: OpenAPIV3.SchemaObject = {
    type: 'boolean'
  }

  const result = mergeBooleanConstraints(a, b)
  assertEquals(result.type, 'boolean')
})

Deno.test(
  'mergeBooleanConstraints - preserves type from first schema when second has no type',
  () => {
    const a: OpenAPIV3.SchemaObject = {
      type: 'boolean'
    }

    const b: OpenAPIV3.SchemaObject = {}

    const result = mergeBooleanConstraints(a, b)
    assertEquals(result.type, 'boolean')
  }
)

Deno.test('mergeBooleanConstraints - takes type from second schema when first has no type', () => {
  const a: OpenAPIV3.SchemaObject = {}

  const b: OpenAPIV3.SchemaObject = {
    type: 'boolean'
  }

  const result = mergeBooleanConstraints(a, b)
  assertEquals(result.type, 'boolean')
})

Deno.test('mergeBooleanConstraints - merges enum values when both schemas have enums', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'boolean',
    enum: [true, false]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'boolean',
    enum: [false]
  }
  const result = mergeBooleanConstraints(a, b)
  assertEquals(result, {
    type: 'boolean',
    enum: [false]
  })
})

Deno.test('mergeBooleanConstraints - takes enum from second schema when first has no enum', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'boolean' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'boolean',
    enum: [true]
  }
  const result = mergeBooleanConstraints(a, b)
  assertEquals(result, {
    type: 'boolean',
    enum: [true]
  })
})

Deno.test('mergeBooleanConstraints - takes enum from first schema when second has no enum', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'boolean',
    enum: [false]
  }
  const b: OpenAPIV3.SchemaObject = { type: 'boolean' }
  const result = mergeBooleanConstraints(a, b)
  assertEquals(result, {
    type: 'boolean',
    enum: [false]
  })
})

Deno.test('mergeBooleanConstraints - throws when enum intersection is empty', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'boolean',
    enum: [true]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'boolean',
    enum: [false]
  }
  assertThrows(() => mergeBooleanConstraints(a, b), Error, 'Merged schema has empty enum array')
})
