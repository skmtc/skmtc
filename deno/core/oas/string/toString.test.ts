import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toString } from './toString.ts'
import { assertEquals } from '@std/assert/equals'
import { OasString } from './String.ts'

Deno.test('toString - basic string type', () => {
  const schema: OpenAPIV3.SchemaObject = { type: 'string' }
  const oasString = toString({ value: schema, context: mockParseContext })

  assertEquals(oasString, new OasString())
})
