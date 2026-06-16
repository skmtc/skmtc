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

Deno.test('toNumber - allows default:null on a nullable schema', () => {
  const stackTrail = new StackTrail(['TEST'])
  // A nullable number may default to null — the strict validator must not
  // reject it (regression: previously threw INVALID_SCHEMA "Expected number
  // but received null").
  const schema: OpenAPIV3.SchemaObject = { type: 'number', nullable: true, default: null }
  const oasNumber = toNumber({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasNumber, new OasNumber({ nullable: true, default: null }))
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
