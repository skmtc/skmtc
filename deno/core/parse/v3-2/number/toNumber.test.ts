import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toNumber } from './toNumber.ts'
import { assertEquals } from '@std/assert/equals'
import { OasNumber } from '@/oas/number/Number.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
Deno.test('toNumber - basic number type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'number' }
  const oasNumber = toNumber({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasNumber, new OasNumber())
})

Deno.test('toNumber - allows default:null on a nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  // A nullable number may default to null — the strict validator must not
  // reject it (regression: previously threw INVALID_SCHEMA "Expected number
  // but received null").
  const schema: OpenAPIV3.SchemaObject = { type: 'number', nullable: true, default: null }
  const oasNumber = toNumber({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasNumber, new OasNumber({ nullable: true, default: null }))
})

Deno.test('toNumber - rejects null default on a non-nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  // null is only a valid default when nullable: true — on a non-nullable
  // schema it is stripped and logged (fail-open), never kept.
  const schema: OpenAPIV3.SchemaObject = { type: 'number', default: null }
  const oasNumber = toNumber({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasNumber, new OasNumber())
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})

Deno.test('toNumber - strips a wrong-typed default and logs instead of throwing', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  // A non-number default previously threw via v.parse (fail-closed); it is
  // now stripped and logged (fail-open), consistent with example/enum.
  const schema: OpenAPIV3.SchemaObject = { type: 'number', default: 'abc' }
  const oasNumber = toNumber({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasNumber, new OasNumber())
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})

Deno.test('toNumber - validation fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = {
    type: 'number',
    multipleOf: 10,
    maximum: 100,
    minimum: 0,
    exclusiveMaximum: true,
    exclusiveMinimum: true
  }
  const oasNumber = toNumber({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(
    oasNumber,
    new OasNumber({
      multipleOf: 10,
      maximum: 100,
      minimum: 0,
      exclusiveMaximum: true,
      exclusiveMinimum: true
    })
  )
})
