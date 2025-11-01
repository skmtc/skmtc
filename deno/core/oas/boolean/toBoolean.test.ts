import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toBoolean } from './toBoolean.ts'
import { assertEquals } from '@std/assert/equals'
import { OasBoolean } from './Boolean.ts'

Deno.test('toBoolean - basic boolean type', () => {
  const schema: OpenAPIV3.SchemaObject = { type: 'boolean' }
  const oasBoolean = toBoolean({ value: schema, context: mockParseContext })

  assertEquals(oasBoolean, new OasBoolean())
})
