import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toUnknown } from './toUnknown.ts'
import { assertEquals } from '@std/assert/equals'
import { OasUnknown } from './Unknown.ts'

Deno.test('toUnknown - basic unknown type', () => {
  const schema: OpenAPIV3.SchemaObject = {}
  const oasUnknown = toUnknown({ value: schema, context: mockParseContext })

  assertEquals(oasUnknown, new OasUnknown())
})
