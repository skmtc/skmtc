import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasParameter } from '@/oas/parameter/Parameter.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

const ok = { responses: { '200': { description: 'ok' } } }

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

const toIssueSummaries = (issues: { level: string; type: string; location: string }[]) =>
  issues.map(({ level, type, location }) => ({ level, type, location }))

Deno.test('v3-2 toParameterV3 - a querystring parameter with content is on the IR', () => {
  const { issues, document } = parse({
    paths: {
      '/search': {
        get: {
          ...ok,
          parameters: [
            {
              name: 'q',
              in: 'querystring',
              content: {
                'application/x-www-form-urlencoded': {
                  schema: { type: 'object', properties: { term: { type: 'string' } } }
                }
              }
            }
          ]
        }
      }
    }
  })

  assertEquals(issues, [])
  const parameter = document.operations[0].parameters?.[0]
  assert(parameter instanceof OasParameter)
  assertEquals(parameter.location, 'querystring')
  assertEquals(parameter.style, undefined)
  assertEquals(parameter.explode, false)
  assertEquals(Object.keys(parameter.content ?? {}), ['application/x-www-form-urlencoded'])
})

Deno.test('v3-2 toParameterV3 - a querystring parameter with schema is INVALID_PARAMETER', () => {
  const { issues, document } = parse({
    paths: {
      '/search': {
        get: {
          ...ok,
          parameters: [
            { name: 'q', in: 'querystring', schema: { type: 'object' } },
            { name: 'page', in: 'header', schema: { type: 'integer' } }
          ]
        }
      }
    }
  })

  assertEquals(toIssueSummaries(issues), [
    { level: 'error', type: 'INVALID_PARAMETER', location: 'TEST:paths:/search:get:parameters:0' }
  ])
  // The parameter is dropped; the operation and its other parameters stay.
  assertEquals(
    document.operations[0].parameters?.map(parameter => parameter.resolve().name),
    ['page']
  )
})

Deno.test('v3-2 toParameterV3 - a querystring parameter with schema and content is INVALID_PARAMETER', () => {
  const { issues } = parse({
    paths: {
      '/search': {
        get: {
          ...ok,
          parameters: [
            {
              name: 'q',
              in: 'querystring',
              schema: { type: 'object' },
              content: { 'application/x-www-form-urlencoded': { schema: { type: 'object' } } }
            }
          ]
        }
      }
    }
  })

  assertEquals(toIssueSummaries(issues), [
    { level: 'error', type: 'INVALID_PARAMETER', location: 'TEST:paths:/search:get:parameters:0' }
  ])
})

Deno.test('v3-2 toParameterV3 - a querystring parameter with empty or several content entries is INVALID_PARAMETER', () => {
  const form = { 'application/x-www-form-urlencoded': { schema: { type: 'object' } } }
  const { issues, document } = parse({
    paths: {
      '/search': {
        get: {
          ...ok,
          parameters: [
            { name: 'empty', in: 'querystring', content: {} },
            {
              name: 'several',
              in: 'querystring',
              content: { ...form, 'text/plain': { schema: { type: 'string' } } }
            }
          ]
        }
      }
    }
  })

  assertEquals(toIssueSummaries(issues), [
    { level: 'error', type: 'INVALID_PARAMETER', location: 'TEST:paths:/search:get:parameters:0' },
    { level: 'error', type: 'INVALID_PARAMETER', location: 'TEST:paths:/search:get:parameters:1' }
  ])
  assertEquals(document.operations[0].parameters, [])
})

Deno.test('v3-2 toParameterV3 - a component querystring parameter with schema is INVALID_PARAMETER', () => {
  const { issues, document } = parse({
    paths: {},
    components: {
      parameters: { Search: { name: 'q', in: 'querystring', schema: { type: 'object' } } }
    }
  })

  assertEquals(toIssueSummaries(issues), [
    { level: 'error', type: 'INVALID_PARAMETER', location: 'TEST:components:parameters:Search' }
  ])
  assertEquals(document.components?.parameters, {})
})

Deno.test('v3-2 toParameterV3 - style cookie on a cookie parameter is on the IR', () => {
  const { issues, document } = parse({
    paths: {
      '/session': {
        get: {
          ...ok,
          parameters: [{ name: 'id', in: 'cookie', style: 'cookie', schema: { type: 'string' } }]
        }
      }
    }
  })

  assertEquals(issues, [])
  const parameter = document.operations[0].parameters?.[0]
  assert(parameter instanceof OasParameter)
  assertEquals(parameter.style, 'cookie')
  assertEquals(parameter.explode, true)
})

Deno.test('v3-2 toParameterV3 - style cookie on a query parameter drops the operation', () => {
  const { issues, document } = parse({
    paths: {
      '/session': {
        get: {
          ...ok,
          parameters: [{ name: 'id', in: 'query', style: 'cookie', schema: { type: 'string' } }]
        }
      }
    }
  })

  assertEquals(toIssueSummaries(issues), [
    { level: 'error', type: 'INVALID_OPERATION', location: 'TEST:paths:/session:get' }
  ])
  assertEquals(document.operations, [])
})
