import { assertEquals } from '@std/assert'
import { toCyclicRefs } from '@/parse/toCyclicRefs.ts'

const toTree = () => ({ $ref: '#/components/schemas/Tree' })

// One ref object for each place a ref can be in a schema, so each can be
// asked for by itself.
const refs = {
  inItems: toTree(),
  inOneOf: { $ref: '#/components/schemas/Branch' },
  inPropertyNamedExample: toTree(),
  inPropertyNamedProperties: toTree(),
  toLeaf: { $ref: '#/components/schemas/Leaf' },
  inExampleData: toTree(),
  inExtension: toTree(),
  inOperation: toTree()
}

const document = {
  openapi: '3.0.3',
  info: { title: 'Cyclic refs', version: '1.0.0' },
  paths: {
    '/trees': {
      get: { responses: { '200': { description: 'ok', content: { 'application/json': { schema: refs.inOperation } } } } }
    }
  },
  components: {
    schemas: {
      Tree: {
        type: 'object',
        properties: {
          children: { type: 'array', items: refs.inItems },
          either: { oneOf: [refs.inOneOf, { type: 'string' }] },
          example: refs.inPropertyNamedExample,
          leaf: refs.toLeaf
        },
        example: refs.inExampleData,
        'x-note': refs.inExtension
      },
      Branch: { type: 'object', properties: { properties: refs.inPropertyNamedProperties } },
      Leaf: { type: 'string' }
    }
  }
}

Deno.test('toCyclicRefs - a ref in items, in a oneOf list and in a property is in the cycle its target leads back to', () => {
  const cyclic = toCyclicRefs(document)

  assertEquals(cyclic.has(refs.inItems), true)
  assertEquals(cyclic.has(refs.inOneOf), true)
})

// The trap: `example` and `properties` are keywords of a schema, and also
// names a property can have. Under `properties` each key is a name, so the
// schema under it is read like any other.
Deno.test('toCyclicRefs - a property named like a keyword is a schema, not that keyword', () => {
  const cyclic = toCyclicRefs(document)

  assertEquals(cyclic.has(refs.inPropertyNamedExample), true)
  assertEquals(cyclic.has(refs.inPropertyNamedProperties), true)
})

Deno.test('toCyclicRefs - a ref whose target does not lead back is not in a cycle', () => {
  assertEquals(toCyclicRefs(document).has(refs.toLeaf), false)
})

// `{ $ref }` in an example is data, and an extension is not read as a schema.
Deno.test('toCyclicRefs - a $ref in example data or under an x- key is not a reference', () => {
  const cyclic = toCyclicRefs(document)

  assertEquals(cyclic.has(refs.inExampleData), false)
  assertEquals(cyclic.has(refs.inExtension), false)
})

// An operation is not a schema that the cycle leads back to.
Deno.test('toCyclicRefs - a ref from an operation into a cycle is not in the cycle', () => {
  assertEquals(toCyclicRefs(document).has(refs.inOperation), false)
})

Deno.test('toCyclicRefs - a document with no components has no cyclic ref', () => {
  const ref = toTree()

  assertEquals(toCyclicRefs({ openapi: '3.0.3', paths: { '/a': { get: { schema: ref } } } }).has(ref), false)
  assertEquals(toCyclicRefs(undefined).has(ref), false)
})
