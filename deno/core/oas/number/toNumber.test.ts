import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toNumber } from './toNumber.ts'
import { assertEquals } from '@std/assert/equals'
import { OasNumber } from './Number.ts'

Deno.test('toNumber - basic number type', () => {
  const schema: OpenAPIV3.SchemaObject = { type: 'number' }
  const oasNumber = toNumber({ value: schema, context: mockParseContext })

  assertEquals(oasNumber, new OasNumber())
})
