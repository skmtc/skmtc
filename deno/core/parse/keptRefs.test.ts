import { assert, assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { toKeptRefs } from '@/parse/keptRefs.ts'
import { toDeclaredTypes } from '@/parse/toDeclaredTypes.ts'
import { mergeIntersection as mergeIntersection30 } from '@/parse/v3-0/_merge-all-of/merge-intersection.ts'
import { mergeIntersection as mergeIntersection31 } from '@/parse/v3-1/_merge-all-of/merge-intersection.ts'
import { mergeIntersection as mergeIntersection32 } from '@/parse/v3-2/_merge-all-of/merge-intersection.ts'
import { mergeUnion as mergeUnion30 } from '@/parse/v3-0/_merge-all-of/merge-union.ts'
import { mergeUnion as mergeUnion31 } from '@/parse/v3-1/_merge-all-of/merge-union.ts'
import { mergeUnion as mergeUnion32 } from '@/parse/v3-2/_merge-all-of/merge-union.ts'
import { normalizeMergeMember as normalize31 } from '@/parse/v3-1/schema/normalize-schema-shape.ts'
import { normalizeMergeMember as normalize32 } from '@/parse/v3-2/schema/normalize-schema-shape.ts'

const ref = { $ref: '#/components/schemas/A' }
const text: OpenAPIV3.SchemaObject = { type: 'string' }
const object: OpenAPIV3.SchemaObject = { type: 'object', properties: { x: text } }

const toDocument = (schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject>): OpenAPIV3.Document => ({
  openapi: '3.0.3',
  info: { title: 't', version: '1' },
  paths: {},
  components: { schemas }
})

const toArgs = () => ({
  getRef: (): OpenAPIV3.SchemaObject => {
    throw new Error('A kept ref was followed')
  },
  system: {
    allOf: 'strict' as const,
    replaced: new Set<string>(),
    keptRefs: toKeptRefs({ documentObject: toDocument({}), setting: 'all' })
  }
})

const versions = [
  {
    version: '3.0',
    mergeIntersection: (schema: OpenAPIV3.SchemaObject) => mergeIntersection30({ schema, ...toArgs() }),
    mergeUnion: (schema: OpenAPIV3.SchemaObject, groupType: 'oneOf' | 'anyOf') => mergeUnion30({ schema, groupType, ...toArgs() })
  },
  {
    version: '3.1',
    mergeIntersection: (schema: OpenAPIV3.SchemaObject) => mergeIntersection31({ schema, normalize: normalize31, ...toArgs() }),
    mergeUnion: (schema: OpenAPIV3.SchemaObject, groupType: 'oneOf' | 'anyOf') =>
      mergeUnion31({ schema, groupType, normalize: normalize31, ...toArgs() })
  },
  {
    version: '3.2',
    mergeIntersection: (schema: OpenAPIV3.SchemaObject) => mergeIntersection32({ schema, normalize: normalize32, ...toArgs() }),
    mergeUnion: (schema: OpenAPIV3.SchemaObject, groupType: 'oneOf' | 'anyOf') =>
      mergeUnion32({ schema, groupType, normalize: normalize32, ...toArgs() })
  }
]

const other = { $ref: '#/components/schemas/B' }

for (const { version, mergeIntersection, mergeUnion } of versions) {
  const allOfCases: [string, OpenAPIV3.SchemaObject, unknown][] = [
    ['a ref and a schema', { allOf: [ref, object] }, { allOf: [ref, object] }],
    ['a schema, then a ref', { allOf: [object, ref] }, { allOf: [object, ref] }],
    ['one ref twice', { allOf: [ref, ref, object] }, { allOf: [ref, object] }],
    ['two refs', { allOf: [ref, other] }, { allOf: [ref, other] }],
    ['a nested allOf', { allOf: [{ allOf: [ref, object] }, other] }, { allOf: [ref, object, other] }],
    ['a nested allOf of one ref', { allOf: [{ allOf: [ref] }, object] }, { allOf: [ref, object] }],
    ['the wrapper\'s own keywords', { title: 't', allOf: [ref, object], 'x-a': 1 } as OpenAPIV3.SchemaObject, { title: 't', allOf: [ref, object], 'x-a': 1 }],
    ['a member with a property both give a ref', { allOf: [{ properties: { p: ref } }, { properties: { p: other } }] }, { properties: { p: { allOf: [ref, other] } } }],
    ['a null-only member', { allOf: [ref, object, { nullable: true, enum: [null] }] }, undefined]
  ]

  for (const [name, schema, expected] of allOfCases) {
    Deno.test(`${version} mergeIntersection keeps a ref without following it: ${name}`, () => {
      const merged = mergeIntersection(schema)

      if (expected !== undefined) {
        assertEquals(merged, expected)
      } else {
        assert('allOf' in merged && merged.allOf?.[0] === ref)
      }
    })
  }

  for (const groupType of ['oneOf', 'anyOf'] as const) {
    Deno.test(`${version} mergeUnion keeps a ${groupType} member ref without following it`, () => {
      assertEquals(mergeUnion({ type: 'object', [groupType]: [ref, other] }, groupType), {
        [groupType]: [{ allOf: [{ type: 'object' }, ref] }, { allOf: [{ type: 'object' }, other] }]
      })
      assertEquals(mergeUnion({ description: 'd', [groupType]: [ref, other] }, groupType), {
        description: 'd',
        [groupType]: [ref, other]
      })
      assertEquals(mergeUnion({ type: 'object', [groupType]: [{ allOf: [ref] }] }, groupType), {
        [groupType]: [{ allOf: [{ type: 'object' }, ref] }]
      })
    })
  }
}

Deno.test('toKeptRefs - a self-reference, a ref on the way round and no other ref', () => {
  const self = { $ref: '#/components/schemas/Self' }
  const toB = { $ref: '#/components/schemas/B' }
  const backToA = { $ref: '#/components/schemas/A' }
  const intoCycle = { $ref: '#/components/schemas/A' }
  const remote = { $ref: 'other.yml#/components/schemas/A' }
  const nowhere = { $ref: '#/components/schemas/Nowhere' }
  const kept = toKeptRefs({
    documentObject: toDocument({
      Self: { properties: { p: self, escaped: { $ref: '#/components/schemas/Self' } } },
      A: { properties: { p: toB, q: remote, r: nowhere } },
      B: { type: 'array', items: backToA },
      C: { properties: { p: intoCycle } }
    }),
    setting: undefined
  })

  assertEquals(
    [self, toB, backToA, intoCycle, remote, nowhere].map(each => kept?.has(each)),
    [true, true, true, false, false, false]
  )
  assertEquals(kept?.has({ ...self }), false)
  assertEquals(kept?.has(kept.copy(self, { ...self })), true)
  assertEquals(kept?.has(kept.copy(intoCycle, { ...intoCycle })), false)
})

Deno.test('toKeptRefs - merge keeps none, all keeps each', () => {
  assertEquals(toKeptRefs({ documentObject: toDocument({}), setting: 'merge' }), undefined)
  assertEquals(toKeptRefs({ documentObject: toDocument({}), setting: 'all' })?.has(ref), true)
})

Deno.test('toKeptRefs - a long chain of refs does not run out of stack', () => {
  const length = 20_000
  const last = { $ref: '#/components/schemas/S0' }
  const schemas = Object.fromEntries(
    Array.from({ length }, (_, index) => [
      `S${index}`,
      { properties: { next: index === length - 1 ? last : { $ref: `#/components/schemas/S${index + 1}` } } }
    ])
  )

  assertEquals(toKeptRefs({ documentObject: toDocument(schemas), setting: 'cycles' })?.has(last), true)
})

Deno.test('toDeclaredTypes - through refs, allOf and unions, and around a cycle', () => {
  const schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject> = {
    Text: text,
    Alias: { $ref: 'Text' },
    Sub: { allOf: [{ $ref: 'Text' }, { description: 'd' }] },
    Mixed: { oneOf: [{ $ref: 'Text' }, { type: 'integer' }] },
    Open: { oneOf: [{ $ref: 'Text' }, {}] },
    Loop: { oneOf: [{ $ref: 'Loop' }, { $ref: 'Text' }] },
    Twice: { oneOf: [{ $ref: 'Sub' }, { $ref: 'Sub' }] },
    Outer: { oneOf: [{ $ref: 'Inner' }, { type: 'object' }] },
    Inner: { oneOf: [{ $ref: 'Outer' }, text] },
    Nothing: {}
  }
  const peek = ({ $ref }: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject | undefined => {
    const found = schemas[$ref]

    return found !== undefined && '$ref' in found ? peek(found) : found
  }
  const toTypes = (name: string) => toDeclaredTypes({ schema: { $ref: name }, peek })

  assertEquals(toTypes('Alias'), ['string'])
  assertEquals(toTypes('Sub'), ['string'])
  assertEquals(toTypes('Mixed'), ['string', 'integer'])
  assertEquals(toTypes('Open'), 'any')
  assertEquals(toTypes('Loop'), 'any')
  // `Inner` is read inside `Outer`, so its types are not known there.
  assertEquals(toDeclaredTypes({ schema: { allOf: [{ $ref: 'Outer' }, { $ref: 'Inner' }] }, peek }), 'any')
  assertEquals(toTypes('Twice'), ['string'])
  assertEquals(toTypes('Nothing'), 'any')
  assertEquals(toTypes('Nowhere'), 'any')
  assertEquals(toDeclaredTypes({ schema: { type: 'number' }, peek }), ['number', 'integer'])
})
