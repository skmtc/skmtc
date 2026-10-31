import { assertEquals, assertStrictEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import {
  normalizeMergeMember,
  normalizeSchemaShape
} from '@/parse/v3-2/schema/normalize-schema-shape.ts'

// 3.1 encodings, read through a loose record because the 3.0-typed
// SchemaObject does not model them.
const toSchema = (value: Record<string, unknown>): OpenAPIV3.SchemaObject => value

const cases: Record<string, OpenAPIV3.SchemaObject> = {
  'type array with null': toSchema({ type: ['object', 'null'], properties: {} }),
  'multi-type array': toSchema({ type: ['string', 'number'] }),
  "['array', 'null'] with no items": toSchema({ type: ['array', 'null'] }),
  'null only': toSchema({ type: 'null' }),
  'null-only array': toSchema({ type: ['null'] }),
  const: toSchema({ const: 'fixed' }),
  examples: toSchema({ type: 'string', examples: ['a', 'b'] }),
  'numeric exclusive bounds': toSchema({
    type: 'number',
    exclusiveMinimum: 1,
    exclusiveMaximum: 9
  }),
  'content encoding': toSchema({ type: 'string', contentEncoding: 'base64' }),
  unevaluatedProperties: toSchema({ type: 'object', unevaluatedProperties: false })
}

Deno.test('normalizeSchemaShape returns an already-normalized schema unchanged', () => {
  for (const schema of Object.values(cases)) {
    const normalized = normalizeSchemaShape(schema)
    assertStrictEquals(normalizeSchemaShape(normalized), normalized)
  }
})

Deno.test('normalizeMergeMember returns an already-normalized schema unchanged', () => {
  for (const schema of Object.values(cases)) {
    const normalized = normalizeMergeMember(schema)
    assertStrictEquals(normalizeMergeMember(normalized), normalized)
  }
})

Deno.test("normalizeSchemaShape: ['array', 'null'] with no items keeps items absent", () => {
  assertEquals<unknown>(normalizeSchemaShape(cases["['array', 'null'] with no items"]), {
    type: 'array',
    nullable: true
  })
})

Deno.test('normalizeMergeMember: a null-only member becomes { nullable: true }', () => {
  assertEquals(normalizeMergeMember(toSchema({ type: 'null', description: 'none' })), {
    description: 'none',
    nullable: true
  })
  assertEquals(normalizeMergeMember(toSchema({ type: ['null'] })), { nullable: true })
})

Deno.test('normalizeSchemaShape leaves a standalone null-only schema unchanged', () => {
  const schema = toSchema({ type: 'null' })
  assertStrictEquals(normalizeSchemaShape(schema), schema)
})
