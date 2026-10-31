import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// The OpenAPI 3.2 operation keys are not part of 3.0: a 3.0 document keeps
// skipping `query` and `additionalOperations` and rejecting
// `in: querystring` and `style: cookie`.

const ok = { responses: { '200': { description: 'ok' } } }

const context = new ParseContext({
  input: {
    type: 'oas',
    value: toDocumentObject(
      {
        openapi: '3.0.3',
        info: { title: 't', version: '0' },
        paths: {
          '/pets': {
            query: ok,
            additionalOperations: { COPY: ok },
            get: ok
          },
          '/search': {
            get: {
              ...ok,
              parameters: [
                {
                  name: 'q',
                  in: 'querystring',
                  content: { 'application/x-www-form-urlencoded': { schema: { type: 'object' } } }
                }
              ]
            }
          },
          '/session': {
            get: {
              ...ok,
              parameters: [
                { name: 'id', in: 'cookie', style: 'cookie', schema: { type: 'string' } }
              ]
            }
          }
        }
      },
      '3.0 document with 3.2 keys'
    )
  },
  logger: new log.Logger('test', 'ERROR'),
  silent: true
})
const result = context.parse(new StackTrail(['TEST']))

Deno.test('v3-0 toOperationsV3 - 3.2 operation keys behave as before 3.2 support', () => {
  assert(result.type === 'oas')

  assertEquals(
    context.issues.map(({ level, type, location }) => ({ level, type, location })),
    [
      { level: 'warning', type: 'UNEXPECTED_PROPERTY', location: 'TEST:paths:/pets:query' },
      {
        level: 'warning',
        type: 'UNEXPECTED_PROPERTY',
        location: 'TEST:paths:/pets:additionalOperations'
      },
      { level: 'error', type: 'INVALID_OPERATION', location: 'TEST:paths:/search:get' },
      { level: 'error', type: 'INVALID_OPERATION', location: 'TEST:paths:/session:get' }
    ]
  )
  assertEquals(
    result.value.operations.map(({ method, path }) => `${method} ${path}`),
    ['get /pets']
  )
})
