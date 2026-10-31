import { assert, assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

// Tags and external docs do not change how an operation renders. A malformed
// tag entry is left out with an INVALID_TAG warning; an invalid
// `externalDocs` is left out with an INVALID_EXTERNAL_DOCS warning and its
// parent (document, tag, operation, webhook, schema) is kept.

type Logged = { type: string; level: string; message: string; location: string }

const missingUrl = 'Invalid key: Expected "url" but received undefined'

const invalidExternalDocs = (location: string, reason = missingUrl): Logged => ({
  type: 'INVALID_EXTERNAL_DOCS',
  level: 'warning',
  message: `External docs object is invalid (${reason}); left out`,
  location
})

const invalidTag = (location: string): Logged => ({
  type: 'INVALID_TAG',
  level: 'warning',
  message: 'Tag is not an object with a string name; left out',
  location
})

const operationWith = (externalDocs: unknown) => ({
  operationId: 'listPets',
  externalDocs,
  responses: { '200': { description: 'ok' } }
})

// Documents in the wild hold values the parser's input type does not allow.
const toDocument = (openapi: string, fields: Record<string, unknown>): OpenAPIV3.Document =>
  JSON.parse(JSON.stringify({ openapi, info: { title: 't', version: '0' }, paths: {}, ...fields }))

const parse = (document: OpenAPIV3.Document) => {
  const context = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')

  const logged: Logged[] = context.issues.map(({ type, level, message, location }) => ({
    type,
    level,
    message,
    location
  }))

  return { document: result.value, logged }
}

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} invalid externalDocs are left out and every parent is kept`, () => {
    const { document, logged } = parse(
      toDocument(openapi, {
        externalDocs: { description: 'no url' },
        tags: [{ name: 'pets', externalDocs: { description: 'no url' } }],
        paths: { '/pets': { get: operationWith({}) } },
        webhooks: { newPet: { post: operationWith({ url: 1 }) } },
        components: {
          schemas: {
            Pet: { type: 'object', externalDocs: {} },
            // The union reads its own `externalDocs` (the x-expansionResources
            // path skips member merging).
            Expandable: {
              anyOf: [{ type: 'string' }, { type: 'object' }],
              'x-expansionResources': true,
              externalDocs: {}
            },
            // A oneOf hands its fields, `externalDocs` included, to its members.
            PetOrCat: {
              oneOf: [
                { type: 'object', properties: { bark: { type: 'string' } } },
                { type: 'object', properties: { meow: { type: 'string' } } }
              ],
              externalDocs: {}
            }
          }
        }
      })
    )

    assertEquals(logged, [
      invalidExternalDocs('TEST:paths:/pets:get:externalDocs'),
      invalidExternalDocs(
        'TEST:webhooks:newPet:post:externalDocs',
        'Invalid type: Expected string but received 1'
      ),
      invalidExternalDocs('TEST:components:schemas:Pet:externalDocs'),
      invalidExternalDocs('TEST:components:schemas:Expandable:anyOf:externalDocs'),
      invalidExternalDocs('TEST:components:schemas:PetOrCat:oneOf:0:externalDocs'),
      invalidExternalDocs('TEST:components:schemas:PetOrCat:oneOf:1:externalDocs'),
      invalidExternalDocs('TEST:tags:0:externalDocs'),
      invalidExternalDocs('TEST:externalDocs')
    ])

    assertEquals(document.externalDocs, undefined)
    assertEquals(
      document.tags?.map(({ name, externalDocs }) => ({ name, externalDocs })),
      [{ name: 'pets', externalDocs: undefined }]
    )
    assertEquals(
      document.operations.map(({ path, method, externalDocs }) => ({ path, method, externalDocs })),
      [{ path: '/pets', method: 'get', externalDocs: undefined }]
    )
    assertEquals(
      document.webhooks.map(({ name, method, externalDocs }) => ({ name, method, externalDocs })),
      [{ name: 'newPet', method: 'post', externalDocs: undefined }]
    )

    const schemas = new Map(Object.entries(document.components?.schemas ?? {}))
    const pet = schemas.get('Pet')
    const expandable = schemas.get('Expandable')
    const petOrCat = schemas.get('PetOrCat')
    assert(pet !== undefined && !pet.isRef() && pet.type === 'object')
    assert(expandable !== undefined && !expandable.isRef() && expandable.type === 'union')
    assert(petOrCat !== undefined && !petOrCat.isRef() && petOrCat.type === 'union')
    assertEquals(pet.externalDocs, undefined)
    assertEquals(expandable.externalDocs, undefined)
    assertEquals(expandable.members.length, 2)
    assertEquals(petOrCat.members.length, 2)
  })

  Deno.test(`${openapi} valid externalDocs are kept and log nothing`, () => {
    const { document, logged } = parse(
      toDocument(openapi, {
        externalDocs: { url: 'https://example.com', description: 'd' },
        tags: [{ name: 'pets', externalDocs: { url: 'https://example.com/pets' } }]
      })
    )

    assertEquals(logged, [])
    assertEquals(document.externalDocs?.url, 'https://example.com')
    assertEquals(document.externalDocs?.description, 'd')
    assertEquals(document.tags?.[0].externalDocs?.url, 'https://example.com/pets')
  })

  Deno.test(`${openapi} a malformed tag entry is left out with a warning`, () => {
    const { document, logged } = parse(
      toDocument(openapi, {
        tags: [null, 'pets', { name: 1 }, [], { description: 'no name' }, { name: 'cats' }],
        paths: { '/cats': { get: { ...operationWith(undefined), tags: ['pets', 'cats'] } } }
      })
    )

    assertEquals(
      logged,
      [0, 1, 2, 3, 4].map(index => invalidTag(`TEST:tags:${index}`))
    )
    assertEquals(
      document.tags?.map(({ name }) => name),
      ['cats']
    )
    // The operation keeps a tag name whose tag was left out.
    assertEquals(
      document.operations.map(({ tags }) => tags),
      [['pets', 'cats']]
    )
  })

  Deno.test(`${openapi} tags that is not an array is read as no tags with one warning`, () => {
    const { document, logged } = parse(
      toDocument(openapi, {
        tags: { name: 'pets' },
        paths: { '/pets': { get: operationWith(undefined) } }
      })
    )

    assertEquals(logged, [
      {
        type: 'INVALID_TAG',
        level: 'warning',
        message: '"tags" must be an array; left out',
        location: 'TEST:tags'
      }
    ])
    assertEquals(document.tags, undefined)
    assertEquals(document.operations.length, 1)
  })
}

Deno.test('3.2.0 a malformed tag entry is left out before parents are checked', () => {
  const { document, logged } = parse(
    toDocument('3.2.0', {
      tags: [
        null,
        { name: 'pets' },
        { name: 'cats', parent: 'pets' },
        { name: 'dogs', parent: 'gone' }
      ]
    })
  )

  assertEquals(
    logged.map(({ type, location }) => ({ type, location })),
    [
      { type: 'INVALID_TAG', location: 'TEST:tags:0' },
      { type: 'INVALID_TAG_PARENT', location: 'TEST:tags:3:parent' }
    ]
  )
  assertEquals(
    document.tags?.map(({ name, parent }) => ({ name, parent })),
    [
      { name: 'pets', parent: undefined },
      { name: 'cats', parent: 'pets' },
      { name: 'dogs', parent: undefined }
    ]
  )
})
