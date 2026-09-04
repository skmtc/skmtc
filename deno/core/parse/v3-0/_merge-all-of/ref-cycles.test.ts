import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals } from '@std/assert/equals'
import { mergeIntersection } from './merge-intersection.ts'

/**
 * Cyclic `$ref`s reachable through `allOf` used to make the merge run forever.
 *
 * The shape below is the standard OpenAPI discriminated-union idiom, and it is
 * what `buddy/buddy-api` publishes: a base schema `oneOf`-lists its variants,
 * and every variant `allOf`-extends the base. Merging one variant inlines the
 * base, whose `oneOf` cross-products back over every variant, each of which
 * inlines the base again — so the work branches by the number of variants at
 * every level and never bottoms out.
 *
 * Live effect before the guard: every docs operation page whose closure
 * contained one of these died with `exceededMemory` (skmtc-hub#179).
 *
 * The rule is that a `$ref` already being expanded contributes nothing further
 * — its constraints are, by construction, already in the accumulator from the
 * level that started expanding it. Dropping it is the correct algebraic
 * simplification, not a lossy bail-out.
 */

const variantNames = ['Ssh', 'Ftp', 'Git']

const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  Target: {
    type: 'object',
    properties: { id: { type: 'string' }, kind: { type: 'string' } },
    required: ['id'],
    discriminator: { propertyName: 'kind' },
    oneOf: variantNames.map(name => ({ $ref: `#/components/schemas/Target${name}` }))
  },
  ...Object.fromEntries(
    variantNames.map(name => [
      `Target${name}`,
      {
        type: 'object',
        allOf: [
          { $ref: '#/components/schemas/Target' },
          { type: 'object', properties: { [name.toLowerCase()]: { type: 'string' } } }
        ]
      } satisfies OpenAPIV3.SchemaObject
    ])
  )
}

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  const name = ref.$ref.split('/').at(-1) ?? ''
  const schema = schemas[name]

  if (!schema) {
    throw new Error(`No schema for ${ref.$ref}`)
  }

  return schema
}

Deno.test('mergeIntersection terminates on a variant that allOf-extends its own union base', () => {
  // Termination is the point: unguarded this never returned.
  const merged = mergeIntersection({ schema: schemas.TargetGit, getRef }) as OpenAPIV3.SchemaObject

  // It resolves to the union of the variants, and each member carries the
  // extending variant's own contribution.
  assertEquals(Array.isArray(merged.oneOf), true)

  const members = (merged.oneOf ?? []) as OpenAPIV3.SchemaObject[]

  assertEquals(members.length > 0, true)
  assertEquals(
    members.every(member => Object.keys(member.properties ?? {}).includes('git')),
    true
  )
})

Deno.test('KNOWN GAP: the union base loses its own properties (issue #111, change 1)', () => {
  // Not the cycle guard's doing — the same loss happens on an equivalent
  // ACYCLIC schema. `mergeCrossProduct` replaces the union schema with its
  // members and returns only `{ [groupType]: … }`, so `Target`'s own `id` /
  // `kind` / `required` / `discriminator` never reach the result.
  //
  // This test pins the CURRENT (wrong) behaviour deliberately, so that fixing
  // sibling-key preservation FAILS here and forces this file to be updated
  // rather than silently drifting.
  const merged = mergeIntersection({ schema: schemas.TargetGit, getRef }) as OpenAPIV3.SchemaObject
  const members = (merged.oneOf ?? []) as OpenAPIV3.SchemaObject[]

  const anyMemberHasBaseProperty = members.some(member =>
    ['id', 'kind'].some(name => Object.keys(member.properties ?? {}).includes(name))
  )

  assertEquals(anyMemberHasBaseProperty, false)
  assertEquals('discriminator' in merged, false)
})

Deno.test('mergeIntersection terminates on a two-schema ref cycle', () => {
  // The smaller shape: A allOf-extends B, B allOf-extends A. No union, so no
  // branching — this one would recurse forever rather than explode.
  const pair: Record<string, OpenAPIV3.SchemaObject> = {
    A: {
      type: 'object',
      allOf: [
        { $ref: '#/components/schemas/B' },
        { type: 'object', properties: { a: { type: 'string' } } }
      ]
    },
    B: {
      type: 'object',
      allOf: [
        { $ref: '#/components/schemas/A' },
        { type: 'object', properties: { b: { type: 'string' } } }
      ]
    }
  }

  const getPairRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
    const schema = pair[ref.$ref.split('/').at(-1) ?? '']

    if (!schema) {
      throw new Error(`No schema for ${ref.$ref}`)
    }

    return schema
  }

  const merged = mergeIntersection({ schema: pair.A, getRef: getPairRef })
  const properties = Object.keys((merged as OpenAPIV3.SchemaObject).properties ?? {})

  assertEquals(properties.includes('a'), true)
  assertEquals(properties.includes('b'), true)
})

Deno.test('a ref reused in sibling branches is still expanded twice', () => {
  // A diamond is not a cycle. Guarding with one global seen-set instead of the
  // expansion PATH would silently drop the second occurrence.
  const diamond: Record<string, OpenAPIV3.SchemaObject> = {
    Leaf: { type: 'object', properties: { marker: { type: 'string' } } },
    Left: {
      type: 'object',
      allOf: [
        { $ref: '#/components/schemas/Leaf' },
        { type: 'object', properties: { left: { type: 'string' } } }
      ]
    },
    Right: {
      type: 'object',
      allOf: [
        { $ref: '#/components/schemas/Leaf' },
        { type: 'object', properties: { right: { type: 'string' } } }
      ]
    },
    Root: {
      type: 'object',
      allOf: [
        { $ref: '#/components/schemas/Left' },
        { $ref: '#/components/schemas/Right' }
      ]
    }
  }

  const getDiamondRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
    const schema = diamond[ref.$ref.split('/').at(-1) ?? '']

    if (!schema) {
      throw new Error(`No schema for ${ref.$ref}`)
    }

    return schema
  }

  const merged = mergeIntersection({ schema: diamond.Root, getRef: getDiamondRef })
  const properties = Object.keys((merged as OpenAPIV3.SchemaObject).properties ?? {})

  assertEquals(properties.includes('marker'), true)
  assertEquals(properties.includes('left'), true)
  assertEquals(properties.includes('right'), true)
})
