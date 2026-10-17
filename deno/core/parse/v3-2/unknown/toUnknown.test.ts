import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toUnknown } from './toUnknown.ts'
import { assertEquals } from '@std/assert/equals'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toUnknown - basic unknown type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = {}
  const oasUnknown = toUnknown({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasUnknown, new OasUnknown())
})
