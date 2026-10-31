import { assertThrows } from '@std/assert/throws'
import { checkArrayItemTypeConflicts } from './check-array-item-type-conflicts.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { normalizeMergeMember } from '@/parse/v3-2/schema/normalize-schema-shape.ts'

Deno.test('checkArrayItemTypeConflicts - no conflict when item types match', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  checkArrayItemTypeConflicts(a, b, normalizeMergeMember) // Should not throw
})

Deno.test('checkArrayItemTypeConflicts - no conflict when one is not an array', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  checkArrayItemTypeConflicts(a, b, normalizeMergeMember) // Should not throw
})

Deno.test('checkArrayItemTypeConflicts - no conflict when items are missing', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  checkArrayItemTypeConflicts(a, b, normalizeMergeMember) // Should not throw
})

Deno.test('checkArrayItemTypeConflicts - throws when item types conflict', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'number' }
  }
  assertThrows(
    () => checkArrayItemTypeConflicts(a, b, normalizeMergeMember),
    Error,
    "Cannot merge schemas: array items have conflicting types 'string' and 'number'"
  )
})
