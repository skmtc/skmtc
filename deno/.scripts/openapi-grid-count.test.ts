import { assertEquals } from '@std/assert'
import { join } from '@std/path'
import {
  type CellCount,
  type Count,
  readDocuments,
  toCount,
  toDocumentSites,
  toNullSites,
  toObjects,
  toRawTarget
} from './openapi-grid-count.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const toDocument = (
  openapi: string,
  schemas: Record<string, unknown>,
  paths: Record<string, unknown> = {}
) => ({
  openapi,
  info: { title: 't', version: '1' },
  paths,
  components: { schemas }
})

/** The three sites of the harvest documents, in two documents of the same shapes. */
const first = toDocument('3.0.0', {
  Company: { type: 'object', properties: { external_id: { type: 'string', nullable: true } } },
  CompanyCreate: {
    type: 'object',
    properties: {
      // A ref to a place inside a component.
      external_id: {
        type: 'string',
        nullable: false,
        allOf: [{ $ref: '#/components/schemas/Company/properties/external_id' }]
      }
    }
  }
})

const second = toDocument('3.0.0', {
  threshold: { type: 'number', nullable: true },
  upper: { allOf: [ref('threshold')], description: 'An alias with a description.' },
  Priority: {
    type: 'object',
    properties: {
      upper: { allOf: [ref('upper')], type: 'number', nullable: false },
      lower: { allOf: [ref('upper')], type: 'number', nullable: false }
    }
  },
  // The enum refuses null already, so there is none for the type to exclude.
  Rotation: { type: 'string', nullable: true, enum: ['a'] },
  rotation: { allOf: [ref('Rotation')], type: 'string', nullable: false }
})

async function* toDocuments(...documents: unknown[]) {
  for (const [index, document] of documents.entries()) {
    yield await Promise.resolve({ name: `${index}.json`, document })
  }
}

const toCells = (count: Count): string[] =>
  count.cells.map(
    ({ cell, sites }) => `${cell.keyword} | ${cell.spelling} | ${cell.target} | ${sites}`
  )

const toPointers = (counts: CellCount[]): string[] => counts.flatMap(({ examples }) => examples)

Deno.test('finds the three sites where a type excludes the null of the target', async () => {
  const sites = toNullSites(await toCount(toDocuments(first, second)))

  assertEquals(toPointers(sites), [
    '0.json #/components/schemas/CompanyCreate/properties/external_id',
    '1.json #/components/schemas/Priority/properties/upper',
    '1.json #/components/schemas/Priority/properties/lower'
  ])
})

Deno.test('reads the documents from a directory and those inside it', async () => {
  const directory = await Deno.makeTempDir()

  try {
    await Deno.mkdir(join(directory, 'b', 'specs'), { recursive: true })
    await Deno.writeTextFile(join(directory, 'a.json'), JSON.stringify(first))
    await Deno.writeTextFile(join(directory, 'b', 'specs', 'b.json'), JSON.stringify(second))
    await Deno.writeTextFile(join(directory, 'list.json'), '[1]')

    const documents = await Array.fromAsync(readDocuments(directory))

    assertEquals(
      documents.map(({ name }) => name),
      ['a.json', 'b/specs/b.json']
    )
  } finally {
    await Deno.remove(directory, { recursive: true })
  }
})

Deno.test('a site counts once for each keyword that it has', async () => {
  const document = toDocument('3.1.0', {
    A: { type: 'object', properties: { a: { type: 'string' } } },
    B: { anyOf: [ref('A'), { type: 'null' }], description: 'd', default: null },
    C: {
      allOf: [ref('A'), { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] }]
    }
  })

  const count = await toCount(toDocuments(document))

  assertEquals(toCells(count), [
    'none | anyOf [ref, null] | object | 1',
    'default: null | anyOf [ref, null] | object | 1',
    'description | anyOf [ref, null] | object | 1',
    'none | allOf [ref, {keyword}] | object | 1',
    'type, the same | allOf [ref, {keyword}] | object | 1',
    'required | allOf [ref, {keyword}] | object | 1',
    'properties | allOf [ref, {keyword}] | object | 1'
  ])
  // An annotation does not make a site one of two keywords.
  assertEquals(
    count.cells.map(({ alone }) => alone),
    [1, 1, 1, 0, 0, 0, 0]
  )
})

Deno.test('a target in a cycle, an alias and a scalar are told apart', () => {
  const document = toDocument('3.1.0', {
    Loop: { type: 'object', properties: { x: { allOf: [ref('Loop')], description: 'd' } } },
    Alias: ref('Loop'),
    Plain: { type: 'object', properties: { a: { allOf: [ref('Alias')], readOnly: true } } },
    Count: { type: 'integer' },
    UseCount: { allOf: [ref('Count')], type: 'integer' },
    Amount: { type: 'number' },
    UseAmount: { allOf: [ref('Amount')], type: 'integer' }
  })
  const { sites } = toDocumentSites(document)

  assertEquals(
    sites
      .filter(({ cell }) => cell.keyword !== 'none')
      .map(({ cell }) => [cell.keyword, cell.target]),
    [
      ['description', 'object in a cycle'],
      ['readOnly', 'alias of object'],
      ['type, the same', 'number'],
      ['type, narrower', 'number']
    ]
  )
})

Deno.test('a target is nullable by the rules of its version, and in core by nullable too', () => {
  const toNullable = (version: '3.0.3' | '3.1.0', schema: unknown) => {
    const { nullable, nullableInCore } = toRawTarget({ version, document: {}, schema })

    return [nullable, nullableInCore]
  }

  assertEquals(toNullable('3.0.3', { type: 'string', nullable: true }), [true, true])
  assertEquals(toNullable('3.0.3', { type: 'string', nullable: true, enum: ['a'] }), [false, true])
  assertEquals(toNullable('3.1.0', { type: 'string', nullable: true }), [false, true])
  assertEquals(toNullable('3.1.0', { type: ['string', 'null'] }), [true, true])
  assertEquals(toNullable('3.1.0', { anyOf: [{ type: 'string' }, { type: 'null' }] }), [true, true])
  assertEquals(
    toNullable('3.1.0', { type: 'string', anyOf: [{ type: 'string' }, { type: 'null' }] }),
    [false, true]
  )
})

Deno.test('a site that the grid has no place for is counted with its reason', () => {
  const document = toDocument('3.0.3', {
    A: { type: 'object' },
    List: { type: 'array', items: {} },
    B: { allOf: [ref('A')], oneOf: [ref('A')] },
    C: { oneOf: [ref('A'), { type: 'null' }] },
    D: { allOf: [ref('List')], description: 'd' },
    E: { allOf: [ref('Missing')], description: 'd' }
  })

  assertEquals(toDocumentSites(document).outside, [
    'two of allOf, anyOf and oneOf',
    'a member of type null in 3.0 (#398)',
    'a target of another kind',
    'a target that is not in the document'
  ])
  assertEquals(toDocumentSites({ swagger: '2.0' }).outside, ['a document of another version'])
})

Deno.test('a default response is read, and data is not', () => {
  const pointers = toObjects({
    responses: { default: { a: {} } },
    example: { b: {} },
    'x-c': { c: {} },
    properties: { example: {}, 'x-d': {} }
  }).map(({ pointer }) => pointer)

  assertEquals(pointers, [
    '#',
    '#/responses/default',
    '#/responses/default/a',
    '#/properties/example',
    '#/properties/x-d'
  ])
})
