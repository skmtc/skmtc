import { ParseContext } from './ParseContext.ts'
import { StackTrail } from './StackTrail.ts'
import denoSchema from '../_schemas/deno.json' with { type: 'json' }
import cfCycleSchema from '../_schemas/cf-cycle.json' with { type: 'json' }
import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals } from '@std/assert/equals'
import { assertObjectMatch } from '@std/assert/object-match'
import { OasRef } from '../oas/ref/Ref.ts'
import { OasDocument } from '../oas/document/Document.ts'
import { OasInfo } from '../oas/info/Info.ts'
import { OasPathItem } from '../oas/pathItem/PathItem.ts'
import { OasMediaType } from '../oas/mediaType/MediaType.ts'
import { OasResponse } from '../oas/response/Response.ts'
import { OasOperation } from '../oas/operation/Operation.ts'
import type { ParseError } from './ParseContext.ts'

Deno.test.ignore('Handles schema warnings', () => {
  const parseContext = new ParseContext({
    documentObject: {
      openapi: '3.0.3',
      info: {
        title: 'Test',
        version: '1.0.0'
      },
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Analytics'
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          Analytics: {
            type: 'string',
            format: 'wtf'
          } as unknown as OpenAPIV3.SchemaObject
        }
      }
    },
    logger: console as any,
    stackTrail: new StackTrail(),
    silent: true
  })

  const parsed = parseContext.parse()

  assertEquals(parseContext.issues, [
    {
      level: 'warning',
      message: 'Unexpected format: wtf',
      location: 'components:schemas:Analytics:format',
      parent: {
        type: 'string',
        format: 'wtf'
      },
      type: 'UNEXPECTED_FORMAT'
    }
  ])
  assertEquals(
    JSON.stringify(parsed.operations),
    JSON.stringify([
      new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: new OasPathItem(),
        responses: {
          '200': new OasResponse({
            content: {
              'application/json': new OasMediaType({
                mediaType: 'application/json',
                schema: new OasRef(
                  { $ref: '#/components/schemas/Analytics', refType: 'schema' },
                  new OasDocument({
                    openapi: '3.0.0',
                    info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
                    operations: []
                  })
                )
              })
            },
            description: 'OK'
          })
        }
      })
    ])
  )
})

Deno.test.ignore('Handles response error', () => {
  const parseContext = new ParseContext({
    documentObject: {
      openapi: '3.0.3',
      info: {
        title: 'Test',
        version: '1.0.0'
      },
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/responses/testResponse'
              }
            }
          }
        }
      } as unknown as OpenAPIV3.PathsObject,
      components: {
        responses: {
          testResponse: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Analytics'
                }
              }
            }
          }
        } as unknown as OpenAPIV3.ResponsesObject,
        schemas: {
          Analytics: {
            allOf: [
              {
                type: 'string'
              },
              {
                type: 'object'
              }
            ]
          } as unknown as OpenAPIV3.SchemaObject
        }
      }
    },
    logger: console as any,
    stackTrail: new StackTrail(),
    silent: true
  })

  const parsed = parseContext.parse()

  // Behaviour below is not correct
  // Ref errors should remove the operation
  assertObjectMatch(parseContext.issues[0], {
    level: 'error',
    location: 'components:schemas:Analytics',
    parent: {
      allOf: [
        {
          type: 'string'
        },
        {
          type: 'object'
        }
      ]
    },
    type: 'INVALID_SCHEMA'
  } as ParseError)

  assertObjectMatch(parsed.operations[0], {
    path: '/test',
    method: 'get',
    pathItem: new OasPathItem(),
    responses: {
      '200': new OasRef(
        { $ref: '#/components/responses/testResponse', refType: 'response' },
        new OasDocument({
          openapi: '3.0.0',
          info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
          operations: []
        })
      )
    }
  })
})

Deno.test('Handles cycle merges', () => {
  const parseContext = new ParseContext({
    documentObject: cfCycleSchema as unknown as OpenAPIV3.Document,
    logger: console as any,
    stackTrail: new StackTrail(),
    silent: true
  })

  const parsed = parseContext.parse()

  console.log(parseContext.issues)
  console.log('PARSED', JSON.stringify(parsed, null, 2))
})

// const parseContext = new ParseContext({
//   documentObject: denoSchema as unknown as OpenAPIV3.Document,
//   logger: console as any,
//   stackTrail: new StackTrail(),
//   silent: true
// })

// const startTime = performance.now()

// parseContext.parse()

// const endTime = performance.now()

// const filteredIssues = parseContext.issues.filter(issue => {
//   return (
//     issue.type === 'UNEXPECTED_PROPERTY' &&
//     issue.level === 'warning' &&
//     ![
//       `Unexpected property 'items' in 'schema:object'`,
//       `Unexpected property 'uniqueItems' in 'schema:object'`
//     ].includes(issue.message)
//   )
// })

// const issuesByProperty = filteredIssues.reduce<Record<string, number>>((acc, issue) => {
//   const stackTrail = issue.location.split(':')

//   const property = stackTrail[stackTrail.length - 1]

//   console.log(`STACK TRACE: ${stackTrail.toString()}`)
//   console.log(`ISSUE: ${issue.level === 'warning' ? issue.message : issue.error.message}`)
//   console.log(`PARENT: ${JSON.stringify(issue.parent, null, 2)}`)
//   console.log('')

//   return {
//     ...acc,
//     [property]: (acc[property] ?? 0) + 1
//   }
// }, {})

// const items = Object.entries(issuesByProperty).sort((a, b) => a[1] - b[1])

// if (items.length > 0) {
//   console.log(JSON.stringify(Object.fromEntries(items), null, 2))
// }

// console.log(`Time taken: ${endTime - startTime} milliseconds`)

// console.log(`Number of issues: ${filteredIssues.length}`)
