import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toString } from './toString.ts'
import { assertEquals } from '@std/assert/equals'
import { OasString } from './String.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toString - basic string type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'string' }
  const oasString = toString({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasString, new OasString())
})
