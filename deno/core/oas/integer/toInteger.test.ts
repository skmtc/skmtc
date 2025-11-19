import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toInteger } from './toInteger.ts'
import { assertEquals } from '@std/assert/equals'
import { OasInteger } from './Integer.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toInteger - basic integer type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'integer' }
  const oasInteger = toInteger({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasInteger, new OasInteger())
})

Deno.test('toInteger - validation fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = {
    type: 'integer',
    multipleOf: 10,
    maximum: 100,
    minimum: 0,
    exclusiveMaximum: true,
    exclusiveMinimum: true
  }
  const oasInteger = toInteger({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(
    oasInteger,
    new OasInteger({
      multipleOf: 10,
      maximum: 100,
      minimum: 0,
      exclusiveMaximum: true,
      exclusiveMinimum: true
    })
  )
})
