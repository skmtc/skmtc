import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toInteger } from './toInteger.ts'
import { assertEquals } from '@std/assert/equals'
import { OasInteger } from './Integer.ts'

Deno.test('toInteger - basic integer type', () => {
  const schema: OpenAPIV3.SchemaObject = { type: 'integer' }
  const oasInteger = toInteger({ value: schema, context: mockParseContext })

  assertEquals(oasInteger, new OasInteger())
})
