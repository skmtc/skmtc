import { assertThrows } from '@std/assert/throws'
import { checkArrayItemTypeConflicts } from './check-array-item-type-conflicts.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('checkArrayItemTypeConflicts - no conflict when item types match', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  checkArrayItemTypeConflicts(a, b) // Should not throw
})

Deno.test('checkArrayItemTypeConflicts - no conflict when one is not an array', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'array',
    items: { type: 'string' }
  }
  checkArrayItemTypeConflicts(a, b) // Should not throw
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
  checkArrayItemTypeConflicts(a, b) // Should not throw
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
    () => checkArrayItemTypeConflicts(a, b),
    Error,
    "Cannot merge schemas: array items have conflicting types 'string' and 'number'"
  )
})
