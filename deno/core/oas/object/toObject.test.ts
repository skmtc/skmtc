import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toObject } from './toObject.ts'
import { assertEquals } from '@std/assert/equals'
import { OasObject } from './Object.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
Deno.test('toObject - basic object type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'object' }
  const oasObject = toObject({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasObject, new OasObject())
})

Deno.test('toObject - allows default:null on a nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'object', nullable: true, default: null }
  const oasObject = toObject({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasObject, new OasObject({ nullable: true, default: null }))
})

Deno.test('toObject - rejects null default on a non-nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  // Objects previously passed `default` through ungated; null is now stripped
  // and logged on a non-nullable schema.
  const schema: OpenAPIV3.SchemaObject = { type: 'object', default: null }
  const oasObject = toObject({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasObject, new OasObject())
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})

Deno.test('toObject - strips a non-object default and logs', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  const schema: OpenAPIV3.SchemaObject = { type: 'object', default: 'nope' }
  const oasObject = toObject({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasObject, new OasObject())
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})
