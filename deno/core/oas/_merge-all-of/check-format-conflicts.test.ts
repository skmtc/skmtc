import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import { checkFormatConflicts } from './check-format-conflicts.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('checkFormatConflicts - no conflict when formats match', () => {
  const a: OpenAPIV3.SchemaObject = { format: 'email' }
  const b: OpenAPIV3.SchemaObject = { format: 'email' }
  checkFormatConflicts(a, b) // Should not throw
})

Deno.test('checkFormatConflicts - no conflict when one format is missing', () => {
  const a: OpenAPIV3.SchemaObject = { format: 'email' }
  const b: OpenAPIV3.SchemaObject = {}
  checkFormatConflicts(a, b) // Should not throw
})

Deno.test('checkFormatConflicts - throws when formats conflict', () => {
  const a: OpenAPIV3.SchemaObject = { format: 'email' }
  const b: OpenAPIV3.SchemaObject = { format: 'uri' }
  assertThrows(
    () => checkFormatConflicts(a, b),
    Error,
    "Cannot merge schemas: conflicting formats 'email' and 'uri'"
  )
})
