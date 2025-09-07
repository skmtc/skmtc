import { assertThrows } from '@std/assert/throws'
import { checkNumberConstraintsConflicts } from './check-number-constraints-conflicts.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('checkNumberConstraintsConflicts - no conflict when ranges overlap', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'number', minimum: 0, maximum: 10 }
  const b: OpenAPIV3.SchemaObject = { type: 'number', minimum: 5, maximum: 15 }
  checkNumberConstraintsConflicts(a, b) // Should not throw
})

Deno.test('checkNumberConstraintsConflicts - no conflict when one is not a number', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = { type: 'number', minimum: 0, maximum: 10 }
  checkNumberConstraintsConflicts(a, b) // Should not throw
})

Deno.test('checkNumberConstraintsConflicts - no conflict when constraints are missing', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'number' }
  const b: OpenAPIV3.SchemaObject = { type: 'number' }
  checkNumberConstraintsConflicts(a, b) // Should not throw
})

Deno.test('checkNumberConstraintsConflicts - throws when ranges do not overlap', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'number', minimum: 0, maximum: 10 }
  const b: OpenAPIV3.SchemaObject = { type: 'number', minimum: 20, maximum: 30 }
  assertThrows(
    () => checkNumberConstraintsConflicts(a, b),
    Error,
    'Cannot merge schemas: incompatible number ranges [0,10] and [20,30]'
  )
})
