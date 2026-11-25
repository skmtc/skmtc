import { assert, assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { OasIntersection } from '@/oas/intersection/Intersection.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasArray } from '@/oas/array/Array.ts'
import { OasString } from '@/oas/string/String.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import { OasMediaType } from '@/oas/mediaType/MediaType.ts'
import { toJsonContent } from '@/oas/mediaType/jsonMediaType.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import type { RefFields } from '@/oas/ref/Ref.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { collateExamples } from '@/helpers/collateExamples.ts'
import { toRefParseContextStub } from '@/test/mockParseContext.ts'
import { systemSettings } from '@/types/Settings.ts'
import type { RefName } from '@/types/RefName.ts'

/** Schemas made by name, and refs that resolve to them. */
const setup = (
  make: (ref: (name: string, siblings?: Partial<RefFields<'schema'>>) => OasRef<'schema'>) => Record<string, OasSchema>
) => {
  const document = new OasDocument()
  const context = toRefParseContextStub({ type: 'oas', value: document })
  const ref = (name: string, siblings: Partial<RefFields<'schema'>> = {}) =>
    new OasRef({ ...siblings, refType: 'schema', $ref: `#/components/schemas/${name}` }, context)
  const schemas = make(ref)

  document.fields = {
    openapi: '3.0.3',
    info: new OasInfo({ title: 't', version: '1' }),
    operations: [],
    components: new OasComponents({
      schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name as RefName, schema]))
    })
  }

  return { schemas, ref }
}

const toObject = (name: string, fields = {}) => new OasObject({ properties: { [name]: new OasString() }, ...fields })

Deno.test('OasIntersection - toJsonSchema is an allOf of its members', () => {
  const { ref } = setup(() => ({}))
  const schema = new OasIntersection({
    title: 'title',
    description: 'description',
    nullable: true,
    readOnly: true,
    members: [ref('A'), new OasString()]
  })

  const json = JSON.parse(JSON.stringify(schema.toJsonSchema({ resolve: false })))

  assertEquals(json, {
    title: 'title',
    description: 'description',
    nullable: true,
    readOnly: true,
    allOf: [{ $ref: '#/components/schemas/A' }, { type: 'string' }]
  })
})

Deno.test('OasIntersection - resolve and resolveOnce give itself, and it is no ref', () => {
  const schema = new OasIntersection({ members: [] })

  assertEquals(schema.resolve(), schema)
  assertEquals(schema.resolveOnce(), schema)
  assertEquals(schema.isRef(), false)
  assertEquals([schema.oasType, schema.type], ['schema', 'intersection'])
})

Deno.test('OasIntersection - resolving a ref with keywords beside it copies the intersection', () => {
  const { schemas, ref } = setup(ref => ({
    A: new OasIntersection({ members: [ref('A'), toObject('a')], description: 'a', extensionFields: { 'x-a': 1 } })
  }))
  const target = schemas.A
  const copy = ref('A', {
    nullable: true,
    readOnly: true,
    writeOnly: true,
    deprecated: true,
    description: 'site',
    default: {},
    example: { e: 1 },
    extensionFields: { 'x-b': 2 }
  }).resolve()

  assert(copy.type === 'intersection' && target?.type === 'intersection')
  assert(copy !== target)
  assertEquals(copy.members, target.members)
  assertEquals([copy.nullable, copy.readOnly, copy.writeOnly, copy.deprecated], [true, true, true, true])
  assertEquals([copy.description, copy.default, copy.example], ['site', {}, { e: 1 }])
  assertEquals(copy.extensionFields, { 'x-a': 1, 'x-b': 2 })
  assertEquals([target.nullable, target.description], [undefined, 'a'])
})

Deno.test('OasIntersection - the object keywords next to a ref are one more member', () => {
  const { schemas, ref } = setup(ref => ({ A: new OasIntersection({ members: [ref('A'), toObject('a')] }) }))
  const site = ref('A', { properties: { z: new OasString() }, required: ['a'] })
  const resolved = site.resolve()

  assert(resolved.type === 'intersection')
  assertEquals(resolved.members.length, 3)
  const member = resolved.members[2]
  assert(member !== undefined && !member.isRef() && member.type === 'object')
  assertEquals([Object.keys(member.properties ?? {}), member.required], [['z'], ['a']])
  assertEquals(site.toSkippedSiblings(), [])
  assertEquals(site.hasValueSiblings(), true)
  assertEquals(schemas.A?.type === 'intersection' && schemas.A.members.length, 2)
})

Deno.test('OasIntersection - object keywords next to a ref that its members already say change nothing', () => {
  const { schemas, ref } = setup(ref => ({
    A: new OasIntersection({ members: [ref('A', { required: ['a'] }), ref('Base'), toObject('a', { required: ['a'] })] }),
    Base: toObject('b', { minProperties: 1 })
  }))

  const unchanged: Partial<RefFields<'schema'>>[] = [
    { required: ['a'] },
    { required: [] },
    { properties: {} },
    { properties: { b: new OasString() } },
    { minProperties: 1 }
  ]

  unchanged.forEach(siblings => {
    assertEquals(ref('A', siblings).hasValueSiblings(), false, JSON.stringify(siblings))
    assert(ref('A', siblings).resolve() === schemas.A)
  })

  const described = ref('A', { required: ['a'], description: 'd' }).resolve()

  assert(described.type === 'intersection')
  assertEquals(described.members.length, 3)
  assertEquals(ref('A', { required: ['b'] }).hasValueSiblings(), true)
  assertEquals(ref('A', { properties: { b: new OasObject({}) } }).hasValueSiblings(), true)
  assertEquals(ref('A', { minProperties: 2 }).hasValueSiblings(), true)
  assertEquals(ref('A', { additionalProperties: false }).hasValueSiblings(), true)
})

Deno.test('OasIntersection - a type next to a ref to a union of many subtypes that allOf it is checked at once', () => {
  const names = Array.from({ length: 40 }, (_, index) => `S${index}`)
  const { ref } = setup(ref => ({
    Details: new OasUnion({ members: names.map(name => ref(name)) }),
    ...Object.fromEntries(names.map(name => [name, new OasIntersection({ members: [ref('Details'), toObject(name)] })]))
  }))
  const start = performance.now()

  assertEquals(ref('Details', { _type: 'object' }).toSkippedSiblings(), [])
  assertEquals(ref('Details', { _type: 'string' }).toSkippedSiblings(), ['type'])
  assert(performance.now() - start < 1000)
})

Deno.test('OasIntersection - traverse tries each member that has the segment', () => {
  const { schemas } = setup(ref => ({
    Base: new OasObject({ properties: { meta: toObject('x') } }),
    Sub: new OasIntersection({ members: [ref('Base'), new OasObject({ properties: { meta: toObject('y') } })] })
  }))

  assertEquals(schemas.Sub?.traverse(['meta', 'x']).type, 'string')
  assertEquals(schemas.Sub?.traverse(['meta', 'y']).type, 'string')
  assertThrows(() => schemas.Sub?.traverse(['meta', 'z']), Error, '(available: y)')
})

Deno.test('OasIntersection - an example counts an intersection and its base as one level', () => {
  const length = 5
  const { schemas } = setup(ref =>
    Object.fromEntries(
      Array.from({ length }, (_, index) => [
        [`B${index}`, new OasObject({ properties: { next: ref(`S${(index + 1) % length}`) } })],
        [
          `S${index}`,
          new OasIntersection({
            members: [ref(`B${index}`), new OasObject({ properties: { v: new OasString({ example: `${index}` }) } })]
          })
        ]
      ]).flatMap(([base, sub]) => [base, sub])
    )
  )

  // Five refs of two levels each, and the leaf: 15 from 4.
  assertEquals(collateExamples({ objectSchema: schemas.S0, depth: 4 }), {
    v: '0',
    next: { v: '1', next: { v: '2', next: { v: '3', next: { v: '4', next: { v: '0' } } } } }
  })
})

Deno.test('OasIntersection - a clone keeps its not, its externalDocs and its trail', () => {
  const schema = new OasIntersection({ members: [] })
  schema.not = new OasUnknown({})
  const copy = schema.clone()

  assertEquals(copy.not, schema.not)
  assertEquals(copy.stackTrail, schema.stackTrail)
})

Deno.test('OasIntersection - isReadOnly and isWriteOnly look at every member, and end in a cycle', () => {
  const { schemas } = setup(ref => ({
    Plain: new OasIntersection({ members: [ref('Plain'), ref('Missing'), toObject('a')] }),
    Own: new OasIntersection({ members: [ref('Plain')], readOnly: true, writeOnly: true }),
    OnRef: new OasIntersection({ members: [ref('Plain', { readOnly: true, writeOnly: true })] }),
    OnTarget: new OasIntersection({ members: [ref('OnTarget'), ref('Read')] }),
    Nested: new OasIntersection({ members: [ref('Own')] }),
    Read: new OasObject({ readOnly: true, writeOnly: true })
  }))

  for (const [name, expected] of Object.entries({ Plain: false, Own: true, OnRef: true, OnTarget: true, Nested: true })) {
    assertEquals(schemas[name]?.isReadOnly(), expected, name)
    assertEquals(schemas[name]?.isWriteOnly(), expected, name)
  }
})

Deno.test('OasIntersection - traverse reads a segment as the last member that takes it', () => {
  const { schemas } = setup(ref => ({
    A: new OasIntersection({ members: [ref('A'), ref('Base'), toObject('own')] }),
    Base: new OasObject({ properties: { base: new OasString(), own: new OasObject({}) } }),
    List: new OasIntersection({ members: [new OasUnknown({}), new OasArray({ items: new OasString() })] }),
    Choice: new OasIntersection({ members: [ref('Choice'), new OasUnion({ members: [ref('Base'), ref('List')] })] })
  }))

  assertEquals(schemas.A?.traverse(['base']).type, 'string')
  assertEquals(schemas.A?.traverse(['own']).type, 'string')
  assertEquals(schemas.List?.traverse(['items']).type, 'string')
  assertEquals(schemas.Choice?.traverse(['$Base', 'own']).type, 'object')
  assertEquals(schemas.Choice?.traverse(['[0]', 'base']).type, 'string')
  assertThrows(() => schemas.A?.traverse(['missing']), Error, '"missing" does not match a member of the intersection')
})

Deno.test('OasIntersection - the keywords next to a reference that it does not take are named', () => {
  const { ref } = setup(ref => ({
    A: new OasIntersection({ members: [ref('A'), toObject('a')] }),
    Any: new OasIntersection({ members: [ref('Any'), new OasUnknown({})] })
  }))

  assertEquals(ref('A', { _type: 'object', description: 'd', deprecated: true, default: 1, minLength: 1 }).toSkippedSiblings(), ['minLength'])
  assertEquals(ref('A', { _type: 'string' }).toSkippedSiblings(), ['type'])
  assertEquals(ref('Any', { _type: 'object' }).toSkippedSiblings(), ['type'])
})

Deno.test('OasIntersection - an example of it joins the examples of its members', () => {
  const { schemas } = setup(ref => ({
    A: new OasIntersection({ members: [ref('A'), ref('Base'), new OasObject({ properties: { a: new OasString({ example: 'a' }) } })] }),
    Base: new OasObject({ properties: { b: new OasString({ example: 'b' }) } }),
    Text: new OasIntersection({ members: [new OasUnknown({}), new OasString({ example: 'text' })] }),
    Own: new OasIntersection({ members: [ref('A')], example: 'own' }),
    None: new OasIntersection({ members: [ref('None')] })
  }))
  const toExample = (name: string) => collateExamples({ objectSchema: schemas[name], depth: 0 })

  assertEquals(toExample('A'), { a: 'a', b: 'b' })
  assertEquals(toExample('Text'), 'text')
  assertEquals(toExample('Own'), 'own')
  assertEquals(toExample('None'), undefined)
})

Deno.test('OasIntersection - a body under any media type can be one', () => {
  const schema = new OasIntersection({ members: [] })

  assertEquals(toJsonContent({ '*/*': new OasMediaType({ mediaType: '*/*', schema }) })?.schema, schema)
})

Deno.test('OasIntersection - a union with one as a member is not discriminable', () => {
  const union = new OasUnion({
    discriminator: new OasDiscriminator({ propertyName: 'kind' }),
    members: [
      new OasIntersection({
        members: [new OasObject({ properties: { kind: new OasString({ enums: ['a'] }) }, required: ['kind'] })]
      })
    ]
  })

  assertEquals(union.isDiscriminable(), false)
})

Deno.test('system.intersections - takes merge, cycles and all', () => {
  ;['merge', 'cycles', 'all', undefined].forEach(intersections => assert(v.is(systemSettings, { intersections })))
  assertEquals(v.is(systemSettings, { intersections: 'none' }), false)
})
