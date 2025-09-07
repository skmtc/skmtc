import { assertThrows } from '@std/assert/throws'
import { checkReadOnlyWriteOnlyConflicts } from './check-read-only-write-only-conflicts.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('checkReadOnlyWriteOnlyConflicts - no conflict when both are readOnly', () => {
  const a: OpenAPIV3.SchemaObject = { readOnly: true }
  const b: OpenAPIV3.SchemaObject = { readOnly: true }
  checkReadOnlyWriteOnlyConflicts(a, b) // Should not throw
})

Deno.test('checkReadOnlyWriteOnlyConflicts - no conflict when both are writeOnly', () => {
  const a: OpenAPIV3.SchemaObject = { writeOnly: true }
  const b: OpenAPIV3.SchemaObject = { writeOnly: true }
  checkReadOnlyWriteOnlyConflicts(a, b) // Should not throw
})

Deno.test('checkReadOnlyWriteOnlyConflicts - no conflict when one is missing', () => {
  const a: OpenAPIV3.SchemaObject = { readOnly: true }
  const b: OpenAPIV3.SchemaObject = {}
  checkReadOnlyWriteOnlyConflicts(a, b) // Should not throw
})

Deno.test('checkReadOnlyWriteOnlyConflicts - throws when readOnly and writeOnly conflict', () => {
  const a: OpenAPIV3.SchemaObject = { readOnly: true }
  const b: OpenAPIV3.SchemaObject = { writeOnly: true }
  assertThrows(
    () => checkReadOnlyWriteOnlyConflicts(a, b),
    Error,
    'Cannot merge schemas: property cannot be both readOnly and writeOnly'
  )
})
