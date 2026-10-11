import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals } from '@std/assert/equals'
import { assert } from '@std/assert'
import { mergeIntersection } from './merge-intersection.ts'
import type { GetRefFn } from './types.ts'

/**
 * Reference cycles through `allOf` / `oneOf`.
 *
 * The shape is buddy-api's, reduced: `Hub` carries a `oneOf` of variants and
 * every variant is `allOf: [{$ref: Hub}, …]`. Expanding one variant used to
 * re-expand every variant, each of which re-expanded the first — base-N growth
 * with no bound. Parsing the real document never returned, and the operation
 * pages built from it answered 503 while the isolate was killed.
 *
 * Two things keep it finite, and both are load-bearing:
 *
 *  - the path of `$ref`s being expanded, so a reference back into the path is
 *    left as a reference instead of inlined; and
 *  - `mergeWithRef` routing resolved schemas through `mergeSchemasOrRefs`
 *    rather than `mergeSchemas`, so a referent's `allOf` is CONSUMED while that
 *    path is still in hand. Without it the `allOf` survived into the merged
 *    output and re-triggered expansion higher up the stack, where the path had
 *    been left behind — the cycle marker is scoped to the descent, but the data
 *    escapes upward.
 *
 * These tests fail by hanging or exhausting the stack rather than by asserting,
 * so they are kept small enough to fail fast.
 */

const toGetRef = (schemas: Record<string, OpenAPIV3.SchemaObject>): GetRefFn =>
  (({ $ref }: OpenAPIV3.ReferenceObject) => {
    const name = $ref.split('/').pop() ?? ''
    const schema = schemas[name]

    if (!schema) {
      throw new Error(`Unknown ref: ${$ref}`)
    }

    return schema
  }) as GetRefFn

const ref = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/schemas/${name}`
})

/** `Hub` + `count` variants, each `allOf: [{$ref: Hub}, {own property}]`. */
const hubAndVariants = (count: number): Record<string, OpenAPIV3.SchemaObject> => {
  const names = Array.from({ length: count }, (_, index) => `Variant${index}`)

  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    Hub: {
      type: 'object',
      required: ['kind'],
      properties: { kind: { type: 'string' } },
      oneOf: names.map(ref)
    }
  }

  names.forEach((name, index) => {
    schemas[name] = {
      type: 'object',
      allOf: [ref('Hub'), { type: 'object', properties: { [`field${index}`]: { type: 'string' } } }]
    }
  })

  return schemas
}

Deno.test('merge - a variant referencing its own hub terminates', () => {
  const schemas = hubAndVariants(4)
  const merged = mergeIntersection({ schema: schemas.Variant0, getRef: toGetRef(schemas) })

  assert(!('$ref' in merged), 'expected a merged schema, not a bare reference')
  assert(Array.isArray(merged.oneOf), 'expected the hub union to survive the merge')
  assertEquals(merged.oneOf?.length, 4)
})

Deno.test('merge - cost stays linear as variants are added', () => {
  // The defect was exponential in the variant count: 18 variants never
  // finished. If growth returns, this does not fail politely — it hangs.
  for (const count of [2, 4, 8, 18]) {
    const schemas = hubAndVariants(count)
    const merged = mergeIntersection({ schema: schemas.Variant0, getRef: toGetRef(schemas) })

    assert(!('$ref' in merged))
    assertEquals(merged.oneOf?.length, count)
  }
})

Deno.test('merge - a directly self-referential allOf terminates', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    Node: {
      type: 'object',
      allOf: [ref('Node'), { type: 'object', properties: { label: { type: 'string' } } }]
    }
  }

  const merged = mergeIntersection({ schema: schemas.Node, getRef: toGetRef(schemas) })

  assert(!('$ref' in merged))
  assertEquals(merged.properties?.label, { type: 'string' })
})

Deno.test('merge - a mutual cycle between two schemas terminates', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    Left: {
      type: 'object',
      allOf: [ref('Right'), { type: 'object', properties: { left: { type: 'string' } } }]
    },
    Right: {
      type: 'object',
      allOf: [ref('Left'), { type: 'object', properties: { right: { type: 'string' } } }]
    }
  }

  const merged = mergeIntersection({ schema: schemas.Left, getRef: toGetRef(schemas) })

  assert(!('$ref' in merged))
  assertEquals(merged.properties?.right, { type: 'string' })
})

/**
 * The dispatch change in `mergeWithRef` is what makes this pass: a referent
 * carrying `allOf` is merged rather than having the `allOf` copied through into
 * the output by `typedMerge`.
 */
Deno.test('merge - allOf on a referenced schema is consumed, not passed through', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    Composed: {
      allOf: [
        { type: 'object', properties: { base: { type: 'string' } } },
        { type: 'object', properties: { extra: { type: 'string' } } }
      ]
    }
  }

  const merged = mergeIntersection({
    schema: {
      allOf: [ref('Composed'), { type: 'object', properties: { own: { type: 'string' } } }]
    },
    getRef: toGetRef(schemas)
  })

  assert(!('$ref' in merged))
  assertEquals(merged.allOf, undefined, 'allOf must not survive into the merged output')
  assertEquals(merged.properties?.base, { type: 'string' })
  assertEquals(merged.properties?.extra, { type: 'string' })
  assertEquals(merged.properties?.own, { type: 'string' })
})

/**
 * The guard is path-scoped. A global visited set would also stop the cycles
 * above and would additionally leave the second sibling use of a shared schema
 * unexpanded — changing output for acyclic documents, which is the one thing
 * this must not do.
 */
Deno.test('merge - a schema used twice as a sibling expands in both places', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    Address: { type: 'object', properties: { street: { type: 'string' } } }
  }

  const merged = mergeIntersection({
    schema: {
      allOf: [
        { type: 'object', properties: { billing: ref('Address'), shipping: ref('Address') } },
        { type: 'object', properties: { note: { type: 'string' } } }
      ]
    },
    getRef: toGetRef(schemas)
  })

  assert(!('$ref' in merged))
  assertEquals(merged.properties?.billing, { $ref: '#/components/schemas/Address' })
  assertEquals(merged.properties?.shipping, { $ref: '#/components/schemas/Address' })
})
