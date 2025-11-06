import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toObject } from './toObject.ts'
import { assertEquals } from '@std/assert/equals'
import { OasObject } from './Object.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toObject - basic object type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'object' }
  const oasObject = toObject({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasObject, new OasObject())
})
