import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toUnion } from './toUnion.ts'
import { assertEquals } from '@std/assert/equals'
import { OasUnion } from './Union.ts'
import { OasString } from '../string/String.ts'

Deno.test('toUnion - basic anyOf union type', () => {
  const schema: OpenAPIV3.SchemaObject = { anyOf: [{ type: 'string' }] }
  const members = [{ type: 'string' }] as OpenAPIV3.SchemaObject[]
  const oasUnion = toUnion({
    value: schema,
    members,
    parentType: 'anyOf',
    context: mockParseContext
  })

  assertEquals(oasUnion, new OasUnion({ members: [new OasString()] }))
})
