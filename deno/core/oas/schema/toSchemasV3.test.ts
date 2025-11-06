import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toSchemaV3 } from './toSchemasV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasString } from '../string/String.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toSchemaV3 - basic unknown schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'string' }
  const oasSchema = toSchemaV3({ schema, stackTrail, context: mockParseContext })

  assertEquals(oasSchema, new OasString())
})
