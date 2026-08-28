import { assert, assertEquals } from '@std/assert'
import { SchemaFlattener } from '@/context/SchemaFlattener.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { toSchemaV3 as parseV30 } from './v3-0/schema/toSchemasV3.ts'
import { toSchemaV3 as parseV31 } from './v3-1/schema/toSchemasV3.ts'

// Differential corpus — the executable 3.0 ↔ 3.1 equivalence spec. For each
// construct that the two dialects spell differently, a 3.0 document fragment
// and its 3.1 equivalent must parse to the SAME IR. This is the drift safety
// net for the two duplicated parser trees: it catches a copy diverging even
// when both still compile and their own per-tree tests pass.

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
    flattener: new SchemaFlattener(),
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

const pairs: Array<{ name: string; v30: string; v31: string }> = [
  {
    name: 'nullable scalar',
    v30: '{"type":"string","nullable":true}',
    v31: '{"type":["string","null"]}'
  },
  {
    name: 'multi-type union',
    v30: '{"oneOf":[{"type":"string"},{"type":"integer"}]}',
    v31: '{"type":["string","integer"]}'
  },
  {
    name: 'literal (enum vs const)',
    v30: '{"type":"string","enum":["active"]}',
    v31: '{"type":"string","const":"active"}'
  },
  {
    name: 'exclusive bounds (boolean+minimum vs numeric)',
    v30: '{"type":"number","minimum":5,"exclusiveMinimum":true}',
    v31: '{"type":"number","exclusiveMinimum":5}'
  },
  {
    name: 'schema example vs examples[]',
    v30: '{"type":"string","example":"x"}',
    v31: '{"type":"string","examples":["x"]}'
  }
]

for (const pair of pairs) {
  Deno.test(`dialect differential - ${pair.name} parses to the same IR`, () => {
    const fromV30 = parse(parseV30, pair.v30)
    const fromV31 = parse(parseV31, pair.v31)

    assert(!(fromV30 instanceof OasRef) && !(fromV31 instanceof OasRef))
    assertEquals(snapshot(fromV30), snapshot(fromV31))
  })
}

Deno.test('dialect differential - nullable reference parses to the same IR', () => {
  // 3.0 wraps the ref in a single-member oneOf + `nullable`; 3.1 adds a
  // `{type:'null'}` member. Both land on a nullable OasRef (compared
  // structurally — OasRef.toJsonSchema resolves the referent, which the mock
  // document does not hold).
  const fromV30 = parse(parseV30, '{"oneOf":[{"$ref":"#/components/schemas/Foo"}],"nullable":true}')
  const fromV31 = parse(parseV31, '{"oneOf":[{"$ref":"#/components/schemas/Foo"},{"type":"null"}]}')

  assert(fromV30 instanceof OasRef)
  assert(fromV31 instanceof OasRef)
  assertEquals(fromV30.nullable, true)
  assertEquals(fromV31.nullable, fromV30.nullable)
})
