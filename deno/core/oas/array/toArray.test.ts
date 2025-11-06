import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toArray } from './toArray.ts'
import { assertEquals } from '@std/assert/equals'
import { OasArray } from './Array.ts'
import { OasUnknown } from '../unknown/Unknown.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toArray - basic array type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.ArraySchemaObject = { type: 'array', items: {} }
  const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasArray, new OasArray({ items: new OasUnknown() }))
})
