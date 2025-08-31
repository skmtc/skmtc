import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import { checkEnumConflicts } from './check-enum-conflicts.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('checkEnumConflicts - no conflict when enums have intersection', () => {
  const a: OpenAPIV3.SchemaObject = { enum: ['A', 'B', 'C'] }
  const b: OpenAPIV3.SchemaObject = { enum: ['B', 'C', 'D'] }
  checkEnumConflicts(a, b) // Should not throw
})

Deno.test('checkEnumConflicts - no conflict when one enum is missing', () => {
  const a: OpenAPIV3.SchemaObject = { enum: ['A', 'B', 'C'] }
  const b: OpenAPIV3.SchemaObject = {}
  checkEnumConflicts(a, b) // Should not throw
})

Deno.test('checkEnumConflicts - throws when enums have no intersection', () => {
  const a: OpenAPIV3.SchemaObject = { enum: ['A', 'B'] }
  const b: OpenAPIV3.SchemaObject = { enum: ['C', 'D'] }
  assertThrows(
    () => checkEnumConflicts(a, b),
    Error,
    'Cannot merge schemas: enum values have no intersection'
  )
})
