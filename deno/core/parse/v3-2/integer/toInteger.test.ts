import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toInteger } from './toInteger.ts'
import { assertEquals } from '@std/assert/equals'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
Deno.test('toInteger - basic integer type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'integer' }
  const oasInteger = toInteger({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasInteger, new OasInteger())
})

Deno.test('toInteger - allows default:null on a nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'integer', nullable: true, default: null }
  const oasInteger = toInteger({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasInteger, new OasInteger({ nullable: true, default: null }))
})

Deno.test('toInteger - rejects null default on a non-nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  const schema: OpenAPIV3.SchemaObject = { type: 'integer', default: null }
  const oasInteger = toInteger({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasInteger, new OasInteger())
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})

Deno.test('toInteger - strips a wrong-typed default and logs instead of throwing', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  const schema: OpenAPIV3.SchemaObject = { type: 'integer', default: 1.5 }
  const oasInteger = toInteger({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasInteger, new OasInteger())
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
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
