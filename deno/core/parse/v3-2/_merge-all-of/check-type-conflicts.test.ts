import { assertThrows } from '@std/assert/throws'
import { checkTypeConflicts } from './check-type-conflicts.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('checkTypeConflicts - no conflict when types match', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = { type: 'string' }
  checkTypeConflicts(a, b) // Should not throw
})

Deno.test('checkTypeConflicts - no conflict when one type is missing', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = {}
  checkTypeConflicts(a, b) // Should not throw
})

Deno.test('checkTypeConflicts - throws when types conflict', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'string' }
  const b: OpenAPIV3.SchemaObject = { type: 'number' }
  assertThrows(
    () => checkTypeConflicts(a, b),
    Error,
    "Cannot merge schemas: conflicting types 'string' and 'number'"
  )
})
