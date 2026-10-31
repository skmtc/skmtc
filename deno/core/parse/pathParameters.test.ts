import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// A path-level parameter that fails to parse drops only the operations it
// applies to. An operation parameter with the same `name` and `in`
// overrides it. Other operations and paths are kept.

type Logged = { type: string; level: string; location: string; message: string }

const ok = { responses: { '200': { description: 'ok' } } }

// Readable `name` and `in`, but `style` is not a valid value.
const brokenTrace = { name: 'X-Trace', in: 'header', style: 'sideways' }
const ownTrace = { name: 'X-Trace', in: 'header', schema: { type: 'string' } }

// `name`, `in` and `required` nested inside `schema`.
const nestedEntry = (name: string) => ({
  schema: { type: 'integer', name, in: 'path', required: true }
})

const parse = (openapi: string, document: Record<string, unknown>) => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: toDocumentObject(
        { openapi, info: { title: 't', version: '0' }, ...document },
        `${openapi} document`
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')

  const logged: Logged[] = context.issues.map(({ type, level, location, message }) => ({
    type,
    level,
    location,
    message
  }))

  return {
    logged,
    operations: result.value.operations.map(({ method, path }) => `${method} ${path}`),
    webhooks: result.value.webhooks.map(({ method, name }) => `${method} ${name}`)
  }
}

const toTypeAndLocation = (logged: Logged[]) =>
  logged.map(({ type, level, location }) => ({ type, level, location }))

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} a broken path-level parameter drops only operations that do not override it`, () => {
    const { logged, operations } = parse(openapi, {
      paths: {
        '/items/{id}': {
          parameters: [brokenTrace],
          get: { ...ok, parameters: [ownTrace] },
          post: ok
        },
        '/other': { get: ok }
      }
    })

    assertEquals(operations, ['get /items/{id}', 'get /other'])
    assertEquals(toTypeAndLocation(logged), [
      {
        type: 'INVALID_PARAMETER',
        level: 'error',
        location: 'TEST:paths:/items/{id}:parameters:0'
      },
      { type: 'INVALID_OPERATION', level: 'error', location: 'TEST:paths:/items/{id}:post' }
    ])
    const [parameterIssue, operationIssue] = logged
    assertEquals(
      operationIssue.message,
      `Path-level parameter TEST:paths:/items/{id}:parameters:0 failed to parse: ${parameterIssue.message}`
    )
  })

  Deno.test(`${openapi} a $ref operation parameter does not override a broken path-level parameter`, () => {
    const { operations } = parse(openapi, {
      paths: {
        '/items': {
          parameters: [brokenTrace],
          get: { ...ok, parameters: [{ $ref: '#/components/parameters/Trace' }] }
        },
        '/other': { get: ok }
      },
      components: { parameters: { Trace: ownTrace } }
    })

    assertEquals(operations, ['get /other'])
  })

  Deno.test(`${openapi} an entry with name and in nested in schema applies to every operation`, () => {
    const { logged, operations } = parse(openapi, {
      paths: {
        '/games/{appid}': {
          parameters: [nestedEntry('appid'), nestedEntry('shop')],
          get: {
            ...ok,
            parameters: [{ name: 'appid', in: 'path', required: true, schema: { type: 'integer' } }]
          },
          post: ok
        },
        '/other': { get: ok }
      }
    })

    assertEquals(operations, ['get /other'])
    assertEquals(
      toTypeAndLocation(logged).filter(({ level }) => level === 'error'),
      [
        {
          type: 'INVALID_PARAMETER',
          level: 'error',
          location: 'TEST:paths:/games/{appid}:parameters:0'
        },
        {
          type: 'INVALID_PARAMETER',
          level: 'error',
          location: 'TEST:paths:/games/{appid}:parameters:1'
        },
        { type: 'INVALID_OPERATION', level: 'error', location: 'TEST:paths:/games/{appid}:get' },
        { type: 'INVALID_OPERATION', level: 'error', location: 'TEST:paths:/games/{appid}:post' }
      ]
    )
  })

  Deno.test(`${openapi} path-level parameters that is not an array drops every operation on the path`, () => {
    const { logged, operations } = parse(openapi, {
      paths: {
        '/molecules': {
          parameters: { name: 'page', in: 'query', schema: { type: 'integer' } },
          get: { ...ok, parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }] },
          post: ok
        },
        '/other': { get: ok }
      }
    })

    assertEquals(operations, ['get /other'])
    assertEquals(toTypeAndLocation(logged), [
      { type: 'INVALID_PARAMETER', level: 'error', location: 'TEST:paths:/molecules:parameters' },
      { type: 'INVALID_OPERATION', level: 'error', location: 'TEST:paths:/molecules:get' },
      { type: 'INVALID_OPERATION', level: 'error', location: 'TEST:paths:/molecules:post' }
    ])
    assert(
      logged[1].message.startsWith(
        'Path-level parameter TEST:paths:/molecules:parameters failed to parse: '
      )
    )
  })

  Deno.test(`${openapi} operation-level parameters that is not an array drops the operation`, () => {
    const { logged, operations } = parse(openapi, {
      paths: { '/items': { get: { ...ok, parameters: 'page' }, post: ok } }
    })

    assertEquals(operations, ['post /items'])
    assertEquals(toTypeAndLocation(logged), [
      { type: 'INVALID_OPERATION', level: 'error', location: 'TEST:paths:/items:get' }
    ])
  })

  for (const [label, empty] of [
    ['{}', {}],
    ['null', null]
  ] as const) {
    Deno.test(`${openapi} a ${label} parameters field is read as no parameters with a warning`, () => {
      const { logged, operations } = parse(openapi, {
        paths: { '/items': { parameters: empty, get: { ...ok, parameters: empty } } }
      })

      assertEquals(operations, ['get /items'])
      const warning = { type: 'EMPTY_PARAMETER', level: 'warning' }
      const message = 'Empty parameters field; read as no parameters'
      assertEquals(logged, [
        { ...warning, location: 'TEST:paths:/items:parameters', message },
        { ...warning, location: 'TEST:paths:/items:get:parameters', message }
      ])
    })
  }

  Deno.test(`${openapi} a broken webhook path-level parameter drops only webhooks that do not override it`, () => {
    const { logged, webhooks } = parse(openapi, {
      paths: {},
      webhooks: {
        itemCreated: {
          parameters: [brokenTrace],
          post: { ...ok, parameters: [ownTrace] },
          put: ok
        },
        other: { post: ok }
      }
    })

    assertEquals(webhooks, ['post itemCreated', 'post other'])
    assertEquals(toTypeAndLocation(logged), [
      {
        type: 'INVALID_PARAMETER',
        level: 'error',
        location: 'TEST:webhooks:itemCreated:parameters:0'
      },
      { type: 'INVALID_OPERATION', level: 'error', location: 'TEST:webhooks:itemCreated:put' }
    ])
  })
}
