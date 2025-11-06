import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toNumber } from './toNumber.ts'
import { assertEquals } from '@std/assert/equals'
import { OasNumber } from './Number.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toNumber - basic number type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'number' }
  const oasNumber = toNumber({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasNumber, new OasNumber())
})
