import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toBoolean } from './toBoolean.ts'
import { assertEquals } from '@std/assert/equals'
import { OasBoolean } from './Boolean.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toBoolean - basic boolean type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const schema: OpenAPIV3.SchemaObject = { type: 'boolean' }
  const oasBoolean = toBoolean({ value: schema, stackTrail, context: mockParseContext })

  assertEquals(oasBoolean, new OasBoolean())
})
