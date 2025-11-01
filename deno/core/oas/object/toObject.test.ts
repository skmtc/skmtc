import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toObject } from './toObject.ts'
import { assertEquals } from '@std/assert/equals'
import { OasObject } from './Object.ts'

Deno.test('toObject - basic object type', () => {
  const schema: OpenAPIV3.SchemaObject = { type: 'object' }
  const oasObject = toObject({ value: schema, context: mockParseContext })

  assertEquals(oasObject, new OasObject())
})
