import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toBoolean } from './toBoolean.ts'
import { assertEquals } from '@std/assert/equals'
import { OasBoolean } from '@/oas/boolean/Boolean.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'

Deno.test('toBoolean - basic boolean type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'boolean' }
  const oasBoolean = toBoolean({ value: schema, stackTrail, context: mockParseContext })

  // Attribution off (default): no location, equals bare instance.
  assertEquals(oasBoolean, new OasBoolean())
})

Deno.test('toBoolean - allows default:null on a nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'boolean', nullable: true, default: null }
  const oasBoolean = toBoolean({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasBoolean, new OasBoolean({ nullable: true, default: null }))
})

Deno.test('toBoolean - rejects null default on a non-nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  const schema: OpenAPIV3.SchemaObject = { type: 'boolean', default: null }
  const oasBoolean = toBoolean({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasBoolean, new OasBoolean())
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})
