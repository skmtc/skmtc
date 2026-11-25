import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { allowsNull } from '@/parse/allowsNull.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  Obj: { type: 'object' },
  Nullable: { type: 'object', nullable: true },
  Alias: { allOf: [ref('Nullable')] },
  // The trap: each of these leads back to itself with no property between.
  Self: { oneOf: [ref('Self'), ref('Obj')] },
  First: { allOf: [ref('Second'), ref('Obj')] },
  Second: { anyOf: [ref('First')] },
  SelfOrNull: { oneOf: [ref('SelfOrNull'), ref('Nullable')] }
}

const peek = ({ $ref }: OpenAPIV3.ReferenceObject) => schemas[$ref.split('/').at(-1) ?? '']

Deno.test('allowsNull - through refs, allOf and unions', () => {
  assertEquals(allowsNull({ schema: ref('Obj'), peek }), false)
  assertEquals(allowsNull({ schema: ref('Alias'), peek }), true)
  assertEquals(allowsNull({ schema: { oneOf: [ref('Obj'), ref('Nullable')] }, peek }), true)
  assertEquals(allowsNull({ schema: ref('Nowhere'), peek }), false)
})

Deno.test('allowsNull - a loop ends, and a member beside it still counts', () => {
  assertEquals(allowsNull({ schema: ref('Self'), peek }), false)
  assertEquals(allowsNull({ schema: ref('First'), peek }), false)
  assertEquals(allowsNull({ schema: ref('SelfOrNull'), peek }), true)
})
