import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals } from '@std/assert/equals'
import { mergeIntersection } from './merge-intersection.ts'
import type { GetRefFn } from './types.ts'

/**
 * What a resolved referent may and may not lose on the way through the merge.
 *
 * `mergeWithRef` consumes a referent's `allOf` — that key escaping upward in
 * the data is half of what made the expansion unbounded. It consumes ONLY
 * `allOf`: dispatching the referent's `oneOf`/`anyOf` as well sends it to
 * `mergeCrossProduct`, whose `toGroup` keeps the member list and discards
 * every sibling keyword on that node. These pin the boundary.
 */

const toGetRef = (schemas: Record<string, OpenAPIV3.SchemaObject>): GetRefFn =>
  ((ref: OpenAPIV3.ReferenceObject) => {
    const name = ref.$ref.split('/').pop()

    if (name === undefined || !(name in schemas)) {
      throw new Error(`unknown ref ${ref.$ref}`)
    }

    return schemas[name]
  }) as GetRefFn

Deno.test('referent merge - a discriminated union keeps its discriminator', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    Pet: {
      oneOf: [
        { type: 'object', properties: { petType: { type: 'string' }, bark: { type: 'string' } } },
        { type: 'object', properties: { petType: { type: 'string' }, meow: { type: 'string' } } }
      ],
      discriminator: { propertyName: 'petType' },
      description: 'a pet'
    }
  }

  const merged = mergeIntersection({
    schema: {
      allOf: [
        { type: 'object', properties: { pet: { $ref: '#/components/schemas/Pet' } } },
        {
          type: 'object',
          properties: { pet: { description: 'the pet slot', type: 'object' } },
          required: ['pet']
        }
      ]
    },
    getRef: toGetRef(schemas)
  })

  const pet = 'properties' in merged ? merged.properties?.pet : undefined
  const petSchema = pet as OpenAPIV3.SchemaObject

  assertEquals(petSchema.discriminator, { propertyName: 'petType' })
  assertEquals(Array.isArray(petSchema.oneOf), true)
})

Deno.test('referent merge - the source document is not rewritten', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {
    X: { type: 'string', enum: ['a', 'b'] }
  }
  const before = JSON.stringify(schemas.X)

  try {
    mergeIntersection({
      schema: {
        allOf: [
          { type: 'object', properties: { p: { $ref: '#/components/schemas/X' } } },
          { type: 'object', properties: { p: { nullable: true, enum: [null] } } }
        ]
      },
      getRef: toGetRef(schemas)
    })
  } catch {
    // Whether this pair merges is not what is under test — an unrelated
    // component gaining `null` in its enum is.
  }

  assertEquals(JSON.stringify(schemas.X), before, 'the shared component must be untouched')
})
