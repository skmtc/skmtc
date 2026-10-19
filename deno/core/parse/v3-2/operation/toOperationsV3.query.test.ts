import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasParameter } from '@/oas/parameter/Parameter.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

const ok = { responses: { '200': { description: 'ok' } } }

const querystring = (name: string) => ({
  name,
  in: 'querystring',
  content: { 'application/x-www-form-urlencoded': { schema: { type: 'object' } } }
})

const parse = (document: Record<string, unknown>) => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: toDocumentObject(
        { openapi: '3.2.0', info: { title: 't', version: '0' }, ...document },
        '3.2 document'
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')

  return { issues: context.issues, document: result.value }
}

Deno.test('v3-2 toOperationsV3 - a query key is a query operation', () => {
  const { issues, document } = parse({ paths: { '/pets': { query: ok, get: ok } } })

  assertEquals(issues, [])
  assertEquals(
    document.operations.map(({ method, path }) => `${method} ${path}`),
    ['query /pets', 'get /pets']
  )
})

Deno.test('v3-2 toWebhooksV3 - a query key is a query webhook', () => {
  const { issues, document } = parse({ webhooks: { searched: { query: ok } } })

  assertEquals(issues, [])
  assertEquals(
    document.webhooks.map(({ method, name }) => `${method} ${name}`),
    ['query searched']
  )
})

Deno.test('v3-2 toOperationsV3 - each additionalOperations entry is one warning', () => {
  const { issues, document } = parse({
    paths: { '/files': { additionalOperations: { COPY: ok, LOCK: ok }, get: ok } },
    webhooks: { moved: { additionalOperations: { MOVE: ok }, post: ok } }
  })

  assertEquals(
    issues.map(({ level, type, location }) => ({ level, type, location })),
    [
      {
        level: 'warning',
        type: 'UNSUPPORTED_OPERATION_METHOD',
        location: 'TEST:paths:/files:additionalOperations:COPY'
      },
      {
        level: 'warning',
        type: 'UNSUPPORTED_OPERATION_METHOD',
        location: 'TEST:paths:/files:additionalOperations:LOCK'
      },
      {
        level: 'warning',
        type: 'UNSUPPORTED_OPERATION_METHOD',
        location: 'TEST:webhooks:moved:additionalOperations:MOVE'
      }
    ]
  )
  assert(issues[0].message.includes("'COPY'"))
  assertEquals(
    document.operations.map(({ method, path }) => `${method} ${path}`),
    ['get /files']
  )
  assertEquals(
    document.webhooks.map(({ method, name }) => `${method} ${name}`),
    ['post moved']
  )
})

Deno.test('v3-2 toOperationsV3 - an additionalOperations value that is not an object is a skipped field', () => {
  const { issues } = parse({ paths: { '/files': { additionalOperations: true, get: ok } } })

  assertEquals(
    issues.map(({ level, type, location }) => ({ level, type, location })),
    [
      {
        level: 'warning',
        type: 'UNEXPECTED_PROPERTY',
        location: 'TEST:paths:/files:additionalOperations'
      }
    ]
  )
})

Deno.test('v3-2 toOperationsV3 - an additionalOperations array is a skipped field', () => {
  const { issues } = parse({ paths: { '/files': { additionalOperations: [ok], get: ok } } })

  assertEquals(
    issues.map(({ level, type, location }) => ({ level, type, location })),
    [
      {
        level: 'warning',
        type: 'UNEXPECTED_PROPERTY',
        location: 'TEST:paths:/files:additionalOperations'
      }
    ]
  )
})

Deno.test('v3-2 toOperationsV3 - a primitive path item does not stop the other paths', () => {
  const { issues, document } = parse({
    paths: { '/a': 'oops', '/b': { get: ok } },
    webhooks: { a: 'oops', b: { post: ok } }
  })

  assertEquals(
    issues.filter(({ level }) => level === 'error'),
    []
  )
  assertEquals(
    document.operations.map(({ method, path }) => `${method} ${path}`),
    ['get /b']
  )
  assertEquals(
    document.webhooks.map(({ method, name }) => `${method} ${name}`),
    ['post b']
  )
})

Deno.test('v3-2 toOperationsV3 - two querystring parameters are a warning', () => {
  const { issues, document } = parse({
    paths: {
      '/search': { get: { ...ok, parameters: [querystring('a'), querystring('b')] } }
    }
  })

  assertEquals(
    issues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'warning', type: 'INVALID_PARAMETER', location: 'TEST:paths:/search:get:parameters' }]
  )
  assertEquals(document.operations[0].parameters?.length, 2)
})

Deno.test('v3-2 toOperationsV3 - querystring with a path item query parameter is a warning', () => {
  const { issues, document } = parse({
    paths: {
      '/search': {
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }],
        get: { ...ok, parameters: [querystring('q')] }
      }
    }
  })

  assertEquals(
    issues.map(({ level, type, location }) => ({ level, type, location })),
    [{ level: 'warning', type: 'INVALID_PARAMETER', location: 'TEST:paths:/search:get:parameters' }]
  )
  assert(issues[0].message.includes('(page)'))
  assert(document.operations[0].parameters?.[0] instanceof OasParameter)
})

Deno.test('v3-2 toOperationsV3 - an operation querystring replaces the path item one of the same name', () => {
  const { issues } = parse({
    paths: {
      '/search': {
        parameters: [querystring('q')],
        get: { ...ok, parameters: [querystring('q')] }
      }
    }
  })

  assertEquals(issues, [])
})

Deno.test('v3-2 toWebhooksV3 - querystring with a query parameter is a warning', () => {
  const { issues } = parse({
    webhooks: {
      searched: {
        post: {
          ...ok,
          parameters: [querystring('q'), { name: 'page', in: 'query', schema: { type: 'integer' } }]
        }
      }
    }
  })

  assertEquals(
    issues.map(({ level, type, location }) => ({ level, type, location })),
    [
      {
        level: 'warning',
        type: 'INVALID_PARAMETER',
        location: 'TEST:webhooks:searched:post:parameters'
      }
    ]
  )
})
