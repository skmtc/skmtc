import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toSchemaV3 } from './toSchemasV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasString } from '../string/String.ts'

Deno.test('toSchemaV3 - basic unknown schema', () => {
  const schema: OpenAPIV3.SchemaObject = { type: 'string' }
  const oasSchema = toSchemaV3({ schema, context: mockParseContext })

  assertEquals(oasSchema, new OasString())
})
