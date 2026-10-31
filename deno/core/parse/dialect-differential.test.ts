import { assert, assertEquals } from '@std/assert'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { toSchemaV3 as parseV30 } from '@/parse/v3-0/schema/toSchemasV3.ts'
import { toSchemaV3 as parseV31 } from '@/parse/v3-1/schema/toSchemasV3.ts'
import { toSchemaV3 as parseV32 } from '@/parse/v3-2/schema/toSchemasV3.ts'

// Differential corpus — the executable 3.0 ↔ 3.1 ↔ 3.2 equivalence spec. For
// each construct that the dialects spell differently, a 3.0 document fragment
// and its 3.1 and 3.2 equivalents must parse to the SAME IR. 3.2's
// schema-layer changes are additive, so its column repeats the 3.1 fragment. This is the
// drift safety net for the duplicated parser trees: it catches a copy
// diverging even when every tree still compiles and passes its own tests.

const createContext = (): ParseContextType =>
  ({
    trace<T>(_token: string | string[], fn: () => T): T {
      return fn()
    },
    logSkippedFields(): void {},
    logIssue(): void {},
    logIssueNoKey(): void {},
    registerRef(): void {},
    stackTrail: {
      append: () => {},
      remove: () => {},
      clone: () => ({ append: () => {}, remove: () => {}, clone: () => ({}) })
    },
    // deno-lint-ignore no-explicit-any
    documentObject: {} as any,
    attribution: undefined,
    currentStackTrail: undefined,
    withStackTrail<T>(_stackTrail: unknown, fn: () => T): T {
      return fn()
    }
  }) as unknown as ParseContextType

const parse = (parser: typeof parseV30, schemaJson: string) =>
  parser({
    schema: JSON.parse(schemaJson),
    stackTrail: new StackTrail(['TEST']),
    context: createContext()
  })

// Snapshot a non-ref schema's IR via its canonical JSON-schema form. (The
// `toJsonSchema` signatures differ across the OasSchema|OasRef union, so reach
// past it in test code; only ever called on the non-ref results below.)
const snapshot = (schema: unknown): unknown =>
  (schema as { toJsonSchema: () => unknown }).toJsonSchema()

const pairs: Array<{ name: string; v30: string; v31: string; v32: string }> = [
  {
    name: 'nullable scalar',
    v30: '{"type":"string","nullable":true}',
    v31: '{"type":["string","null"]}',
    v32: '{"type":["string","null"]}'
  },
  {
    name: 'multi-type union',
    v30: '{"oneOf":[{"type":"string"},{"type":"integer"}]}',
    v31: '{"type":["string","integer"]}',
    v32: '{"type":["string","integer"]}'
  },
  {
    name: 'literal (enum vs const)',
    v30: '{"type":"string","enum":["active"]}',
    v31: '{"type":"string","const":"active"}',
    v32: '{"type":"string","const":"active"}'
  },
  {
    name: 'exclusive bounds (boolean+minimum vs numeric)',
    v30: '{"type":"number","minimum":5,"exclusiveMinimum":true}',
    v31: '{"type":"number","exclusiveMinimum":5}',
    v32: '{"type":"number","exclusiveMinimum":5}'
  },
  {
    name: 'schema example vs examples[]',
    v30: '{"type":"string","example":"x"}',
    v31: '{"type":"string","examples":["x"]}',
    v32: '{"type":"string","examples":["x"]}'
  },
  {
    name: 'record values (additionalProperties vs unevaluatedProperties)',
    v30: '{"type":"object","additionalProperties":{"type":"string"}}',
    v31: '{"type":"object","unevaluatedProperties":{"type":"string"}}',
    v32: '{"type":"object","unevaluatedProperties":{"type":"string"}}'
  },
  {
    name: 'closed object (additionalProperties vs unevaluatedProperties false)',
    v30: '{"type":"object","additionalProperties":false}',
    v31: '{"type":"object","unevaluatedProperties":false}',
    v32: '{"type":"object","unevaluatedProperties":false}'
  }
]

Deno.test('dialect differential - 3.0 does not read unevaluatedProperties', () => {
  // `unevaluatedProperties` is not a 3.0 keyword; the v3-0 tree is unchanged
  // and does not map it to additionalProperties.
  const fromV30 = parse(parseV30, '{"type":"object","unevaluatedProperties":false}')

  assert(fromV30 instanceof OasObject)
  assertEquals(fromV30.additionalProperties, undefined)
})

for (const pair of pairs) {
  Deno.test(`dialect differential - ${pair.name} parses to the same IR`, () => {
    const fromV30 = parse(parseV30, pair.v30)
    const fromV31 = parse(parseV31, pair.v31)
    const fromV32 = parse(parseV32, pair.v32)

    assert(!(fromV30 instanceof OasRef) && !(fromV31 instanceof OasRef))
    assert(!(fromV32 instanceof OasRef))
    assertEquals(snapshot(fromV31), snapshot(fromV30))
    assertEquals(snapshot(fromV32), snapshot(fromV31))

    // The snapshot writes `additionalProperties: false` when the IR field is
    // undefined, so compare the field itself.
    if (fromV30 instanceof OasObject) {
      assert(fromV31 instanceof OasObject && fromV32 instanceof OasObject)
      assertEquals(fromV31.additionalProperties, fromV30.additionalProperties)
      assertEquals(fromV32.additionalProperties, fromV31.additionalProperties)
    }
  })
}

Deno.test('dialect differential - nullable reference parses to the same IR', () => {
  // 3.0 wraps the ref in a single-member oneOf + `nullable`; 3.1 and 3.2 add
  // a `{type:'null'}` member. All three land on a nullable OasRef (compared
  // structurally — OasRef.toJsonSchema resolves the referent, which the mock
  // document does not hold).
  const fromV30 = parse(parseV30, '{"oneOf":[{"$ref":"#/components/schemas/Foo"}],"nullable":true}')
  const fromV31 = parse(parseV31, '{"oneOf":[{"$ref":"#/components/schemas/Foo"},{"type":"null"}]}')
  const fromV32 = parse(parseV32, '{"oneOf":[{"$ref":"#/components/schemas/Foo"},{"type":"null"}]}')

  assert(fromV30 instanceof OasRef)
  assert(fromV31 instanceof OasRef)
  assert(fromV32 instanceof OasRef)
  assertEquals(fromV30.nullable, true)
  assertEquals(fromV31.nullable, fromV30.nullable)
  assertEquals(fromV32.nullable, fromV31.nullable)
})
