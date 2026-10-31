import { assert, assertEquals, assertMatch } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

// Each `components.requestBodies` and `components.headers` entry parses
// inside its own boundary. A broken entry is dropped with one
// INVALID_REQUEST_BODY / INVALID_HEADER error at its location; the other
// entries and the operations are kept.

const emptyOneOf = { oneOf: [] }
const emptyAnyOf = { anyOf: [] }
const danglingAllOf = { allOf: [{ $ref: '#/components/schemas/Missing' }, { type: 'object' }] }

const requestBodyCases: Array<{ label: string; entry: unknown; message: RegExp }> = [
  { label: 'null', entry: null, message: /^Request body must be an object, got null$/ },
  { label: 'a string', entry: 'x', message: /^Request body must be an object, got string$/ },
  { label: 'content: null', entry: { content: null }, message: /null to object/ },
  { label: 'no content', entry: {}, message: /null to object/ },
  {
    label: 'an empty oneOf',
    entry: { content: { 'application/json': { schema: emptyOneOf } } },
    message: /"oneOf" array is empty/
  },
  {
    label: 'an empty anyOf',
    entry: { content: { 'application/json': { schema: emptyAnyOf } } },
    message: /"anyOf" array is empty/
  },
  {
    label: 'an allOf with a dangling ref',
    entry: { content: { 'application/json': { schema: danglingAllOf } } },
    message: /Missing/
  }
]

const headerCases: Array<{ label: string; entry: unknown; message: RegExp }> = [
  { label: 'null', entry: null, message: /^Header must be an object, got null$/ },
  { label: 'an array', entry: [], message: /^Header must be an object, got an array$/ },
  { label: 'an empty oneOf', entry: { schema: emptyOneOf }, message: /"oneOf" array is empty/ },
  { label: 'an empty anyOf', entry: { schema: emptyAnyOf }, message: /"anyOf" array is empty/ },
  { label: 'an allOf with a dangling ref', entry: { schema: danglingAllOf }, message: /Missing/ }
]

// Documents in the wild hold entries the parser's input type does not allow.
const toDocument = (openapi: string, components: Record<string, unknown>): OpenAPIV3.Document =>
  JSON.parse(
    JSON.stringify({
      openapi,
      info: { title: 't', version: '0' },
      paths: {
        '/pets': {
          get: { operationId: 'listPets', responses: { '200': { description: 'ok' } } }
        }
      },
      components
    })
  )

const parse = (document: OpenAPIV3.Document) => {
  const context = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')

  return { document: result.value, issues: context.issues }
}

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  for (const { label, entry, message } of requestBodyCases) {
    Deno.test(`${openapi} a component request body that is ${label} is dropped with one error`, () => {
      const { document, issues } = parse(
        toDocument(openapi, {
          requestBodies: {
            Bad: entry,
            Good: { content: { 'application/json': { schema: { type: 'object' } } } }
          }
        })
      )

      assertEquals(
        issues.map(({ level, type, location }) => ({ level, type, location })),
        [
          {
            level: 'error',
            type: 'INVALID_REQUEST_BODY',
            location: 'TEST:components:requestBodies:Bad'
          }
        ]
      )
      assertMatch(issues[0].message, message)
      assertEquals(Object.keys(document.components?.requestBodies ?? {}), ['Good'])
      assertEquals(document.operations.length, 1)
    })
  }

  for (const { label, entry, message } of headerCases) {
    Deno.test(`${openapi} a component header that is ${label} is dropped with one error`, () => {
      const { document, issues } = parse(
        toDocument(openapi, {
          headers: {
            Bad: entry,
            Good: { schema: { type: 'string' } }
          }
        })
      )

      assertEquals(
        issues.map(({ level, type, location }) => ({ level, type, location })),
        [{ level: 'error', type: 'INVALID_HEADER', location: 'TEST:components:headers:Bad' }]
      )
      assertMatch(issues[0].message, message)
      assertEquals(Object.keys(document.components?.headers ?? {}), ['Good'])
      assertEquals(document.operations.length, 1)
    })
  }

  Deno.test(`${openapi} a null header inside a response still drops the response`, () => {
    const { issues } = parse(
      toDocument(openapi, {
        responses: { WithHeader: { description: 'ok', headers: { 'X-Rate': null } } }
      })
    )

    assertEquals(
      issues.map(({ level, type, location }) => ({ level, type, location })),
      [
        {
          level: 'error',
          type: 'INVALID_RESPONSE',
          location: 'TEST:components:responses:WithHeader'
        }
      ]
    )
  })
}
