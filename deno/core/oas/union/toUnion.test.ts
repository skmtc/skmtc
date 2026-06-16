import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toUnion } from './toUnion.ts'
import { assertEquals } from '@std/assert/equals'
import { OasUnion } from './Union.ts'
import { OasString } from '../string/String.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'

const stringMembers = () => [{ type: 'string' }] as OpenAPIV3.SchemaObject[]

Deno.test('toUnion - basic anyOf union type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { anyOf: [{ type: 'string' }] }
  const members = [{ type: 'string' }] as OpenAPIV3.SchemaObject[]
  const oasUnion = toUnion({
    value: schema,
    members,
    parentType: 'anyOf',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasUnion, new OasUnion({ members: [new OasString()] }))
})

Deno.test('toUnion - allows default:null on a nullable union', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = {
    anyOf: [{ type: 'string' }],
    nullable: true,
    default: null
  }
  const oasUnion = toUnion({
    value: schema,
    members: stringMembers(),
    parentType: 'anyOf',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(
    oasUnion,
    new OasUnion({ members: [new OasString()], nullable: true, default: null })
  )
})

Deno.test('toUnion - keeps a non-null default value', () => {
  const stackTrail = new StackTrail(['TEST'])
  // A union default may match any member; a present (non-null) value passes
  // through unchanged.
  const schema: OpenAPIV3.SchemaObject = { anyOf: [{ type: 'string' }], default: 'hello' }
  const oasUnion = toUnion({
    value: schema,
    members: stringMembers(),
    parentType: 'anyOf',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasUnion, new OasUnion({ members: [new OasString()], default: 'hello' }))
})

Deno.test('toUnion - rejects null default on a non-nullable union', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  // Unions previously passed `default` through ungated; null is now stripped
  // and logged on a non-nullable union.
  const schema: OpenAPIV3.SchemaObject = { anyOf: [{ type: 'string' }], default: null }
  const oasUnion = toUnion({
    value: schema,
    members: stringMembers(),
    parentType: 'anyOf',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasUnion, new OasUnion({ members: [new OasString()] }))
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})

Deno.test('toUnion - validates the nullable flag', () => {
  const stackTrail = new StackTrail(['TEST'])
  const contextSpy = spy(mockParseContext, 'logIssue')
  // A non-boolean nullable used to flow straight through; it is now rejected.
  const schema = {
    anyOf: [{ type: 'string' }],
    nullable: 'yes'
  } as unknown as OpenAPIV3.SchemaObject
  const oasUnion = toUnion({
    value: schema,
    members: stringMembers(),
    parentType: 'anyOf',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasUnion, new OasUnion({ members: [new OasString()] }))
  assertSpyCalls(contextSpy, 1)
  contextSpy.restore()
})
