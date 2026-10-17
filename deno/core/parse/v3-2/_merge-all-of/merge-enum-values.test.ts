import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import { mergeEnumValues } from './merge-enum-values.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('mergeEnumValues - merges overlapping enum values', () => {
  const a: OpenAPIV3.SchemaObject = {
    enum: ['a', 'b', 'c']
  }
  const b: OpenAPIV3.SchemaObject = {
    enum: ['b', 'c', 'd']
  }
  const result = mergeEnumValues(a, b)
  assertEquals(result, {
    enum: ['b', 'c']
  })
})

Deno.test('mergeEnumValues - handles missing enum', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = {
    enum: ['a', 'b', 'c']
  }
  const result = mergeEnumValues(a, b)
  assertEquals(result, {
    enum: ['a', 'b', 'c']
  })
})

Deno.test('mergeEnumValues - handles empty intersection', () => {
  const a: OpenAPIV3.SchemaObject = {
    enum: ['a', 'b']
  }
  const b: OpenAPIV3.SchemaObject = {
    enum: ['c', 'd']
  }

  assertThrows(() => mergeEnumValues(a, b), Error, 'Merged schema has empty enum array')
})
