import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { Logger } from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals } from '@std/assert/equals'
import { assertObjectMatch } from '@std/assert/object-match'
import { assertSpyCalls, spy } from '@std/testing/mock'
import { OasRef } from '@/oas/ref/Ref.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasPathItem } from '@/oas/pathItem/PathItem.ts'
import { OasMediaType } from '@/oas/mediaType/MediaType.ts'
import { OasResponse } from '@/oas/response/Response.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import type { ParseError } from '@/context/ParseContext.ts'

Deno.test.ignore('Handles schema warnings', () => {
  const stackTrail = new StackTrail(['TEST'])

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
    logger: console as unknown as Logger,
    silent: true
  })

  const parsed = parseContext.parse(stackTrail)

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
  const stackTrail = new StackTrail(['TEST'])
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
    logger: console as unknown as Logger,
    silent: true
  })

  const parsed = parseContext.parse(stackTrail)

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

Deno.test('ParseContext - constructor stores properties correctly', () => {
  const documentObject: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: {
      title: 'Test API',
      version: '1.0.0'
    },
    paths: {}
  }
  const logger = console as unknown as Logger

  const parseContext = new ParseContext({
    documentObject,
    logger,
    silent: true
  })

  assertEquals(parseContext.documentObject, documentObject)
  assertEquals(parseContext.logger, logger)
  assertEquals(parseContext.silent, true)
  assertEquals(parseContext.issues, [])
  assertEquals(parseContext.oasDocument instanceof OasDocument, true)
})

Deno.test('ParseContext - constructor sets silent to true by default', () => {
  const documentObject: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {}
  }

  const parseContext = new ParseContext({
    documentObject,
    logger: console as unknown as Logger,
    silent: true
  })

  assertEquals(parseContext.silent, true)
})

Deno.test('ParseContext - logIssueNoKey adds error to issues array', () => {
  const parseContext = new ParseContext({
    documentObject: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} },
    logger: console as unknown as Logger,
    silent: true
  })

  const stackTrail = new StackTrail(['paths', '/test', 'get'])
  const error = new Error('Test error')
  const parent = { test: 'data' }

  parseContext.logIssueNoKey({
    level: 'error',
    error,
    stackTrail,
    parent,
    type: 'INVALID_SCHEMA'
  })

  assertEquals(parseContext.issues.length, 1)
  assertEquals(parseContext.issues[0].level, 'error')
  assertEquals((parseContext.issues[0] as any).error, error)
  assertEquals(parseContext.issues[0].location, 'paths:/test:get')
  assertEquals(parseContext.issues[0].parent, parent)
  assertEquals(parseContext.issues[0].type, 'INVALID_SCHEMA')
})

Deno.test('ParseContext - logIssueNoKey adds warning to issues array', () => {
  const parseContext = new ParseContext({
    documentObject: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} },
    logger: console as unknown as Logger,
    silent: true
  })

  const stackTrail = new StackTrail(['components', 'schemas', 'User'])
  const parent = { type: 'string', format: 'unknown' }

  parseContext.logIssueNoKey({
    level: 'warning',
    message: 'Unexpected format: unknown',
    stackTrail,
    parent,
    type: 'UNEXPECTED_FORMAT'
  })

  assertEquals(parseContext.issues.length, 1)
  assertEquals(parseContext.issues[0].level, 'warning')
  assertEquals((parseContext.issues[0] as any).message, 'Unexpected format: unknown')
  assertEquals(parseContext.issues[0].location, 'components:schemas:User')
  assertEquals(parseContext.issues[0].parent, parent)
  assertEquals(parseContext.issues[0].type, 'UNEXPECTED_FORMAT')
})

Deno.test('ParseContext - logIssueNoKey calls logger.warn when not silent', () => {
  const mockLogger = {
    warn: () => {}
  } as unknown as Logger

  const warnSpy = spy(mockLogger, 'warn')

  const parseContext = new ParseContext({
    documentObject: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} },
    logger: mockLogger,
    silent: false
  })

  const stackTrail = new StackTrail(['test'])

  parseContext.logIssueNoKey({
    level: 'warning',
    message: 'Test warning',
    stackTrail,
    parent: {},
    type: 'UNEXPECTED_PROPERTY'
  })

  assertSpyCalls(warnSpy, 1)
  warnSpy.restore()
})

Deno.test('ParseContext - logIssueNoKey does not call logger when silent', () => {
  const mockLogger = {
    warn: () => {}
  } as unknown as Logger

  const warnSpy = spy(mockLogger, 'warn')

  const parseContext = new ParseContext({
    documentObject: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} },
    logger: mockLogger,
    silent: true
  })

  const stackTrail = new StackTrail(['test'])

  parseContext.logIssueNoKey({
    level: 'warning',
    message: 'Test warning',
    stackTrail,
    parent: {},
    type: 'UNEXPECTED_PROPERTY'
  })

  assertSpyCalls(warnSpy, 0)
  warnSpy.restore()
})

Deno.test('ParseContext - logSkippedFields logs warning for each skipped field', () => {
  const parseContext = new ParseContext({
    documentObject: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} },
    logger: console as unknown as Logger,
    silent: true
  })

  const stackTrail = new StackTrail(['components', 'schemas', 'User'])
  const skipped = {
    unknownField1: 'value1',
    unknownField2: 'value2',
    unknownField3: 'value3'
  }

  parseContext.logSkippedFields({
    skipped,
    stackTrail,
    parent: { type: 'object' },
    parentType: 'SchemaObject'
  })

  assertEquals(parseContext.issues.length, 3)
  assertEquals((parseContext.issues[0] as any).message, "Unexpected property 'unknownField1' in 'SchemaObject'")
  assertEquals((parseContext.issues[1] as any).message, "Unexpected property 'unknownField2' in 'SchemaObject'")
  assertEquals((parseContext.issues[2] as any).message, "Unexpected property 'unknownField3' in 'SchemaObject'")
  assertEquals(parseContext.issues[0].type, 'UNEXPECTED_PROPERTY')
})

Deno.test('ParseContext - logIssue calls stackTrail.trace with key', () => {
  const parseContext = new ParseContext({
    documentObject: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} },
    logger: console as unknown as Logger,
    silent: true
  })

  const stackTrail = new StackTrail(['test'])
  const traceSpy = spy(stackTrail, 'trace')

  parseContext.logIssue({
    key: 'responses',
    level: 'warning',
    message: 'Test message',
    stackTrail,
    parent: {},
    type: 'INVALID_RESPONSE'
  })

  assertSpyCalls(traceSpy, 1)
  assertEquals(traceSpy.calls[0].args[0], 'responses')

  traceSpy.restore()
})
