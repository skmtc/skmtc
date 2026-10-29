import { assert, assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OasDocument } from '@/oas/document/Document.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import {
  isJsonMediaType,
  isAnyMediaType,
  toMediaTypeEssence
} from '@/oas/mediaType/jsonMediaType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

Deno.test('isJsonMediaType - truth table', () => {
  const table: Array<[string, boolean]> = [
    ['application/json', true],
    ['application/json;v=1.0', true],
    ['application/json; charset=utf-8', true],
    ['APPLICATION/JSON', true],
    [' application/json ', true],
    ['application/vnd.api+json', true],
    ['application/ld+json', true],
    ['application/problem+json', true],
    ['application/vnd.github.v3+json; charset=utf-8', true],
    // A name without the +json suffix says nothing about the syntax, even when the API sends JSON.
    ['application/vnd.goa.error', false],
    // Not registered: RFC 8259 registers only application/json.
    ['text/json', false],
    // A stream of JSON values, not one value.
    ['application/x-ndjson', false],
    ['application/jsonl', false],
    ['application/json-seq', false],
    ['text/plain', false],
    ['application/octet-stream', false],
    ['application/x-www-form-urlencoded', false],
    ['multipart/form-data', false],
    ['*/*', false],
    ['application/*', false],
    ['application/*+json', false],
    ['+json', false],
    ['application/+json', false],
    ['', false]
  ]

  for (const [mediaType, expected] of table) {
    assertEquals(isJsonMediaType(mediaType), expected, mediaType)
  }
})

Deno.test('isAnyMediaType - only the full range', () => {
  assert(isAnyMediaType('*/*'))
  assert(isAnyMediaType(' */*; q=0.8 '))
  assert(!isAnyMediaType('application/*'))
  assert(!isAnyMediaType('application/json'))
})

Deno.test('toMediaTypeEssence - drops parameters, trims, lowercases', () => {
  assertEquals(toMediaTypeEssence('Application/JSON; charset=utf-8'), 'application/json')
  assertEquals(toMediaTypeEssence('text/plain'), 'text/plain')
})

// Each media type's schema is an object with one property named after the
// media type, so a test can tell which one a lookup picked.
const marked = (label: string) => ({
  type: 'object',
  properties: { [label]: { type: 'string' } }
})

const toContent = (mediaTypes: string[]) =>
  Object.fromEntries(mediaTypes.map(mediaType => [mediaType, { schema: marked(mediaType) }]))

// A `*/*` body with a scalar schema: springdoc's `String` return and file download.
const scalarSchemas: Record<string, Record<string, string>> = {
  '/wildText': { type: 'string' },
  '/wildBinary': { type: 'string', format: 'binary' }
}

const ok = (mediaTypes: string[]) => ({
  '200': { description: 'ok', content: toContent(mediaTypes) }
})

const cases = {
  '/exact': ['text/plain', 'application/json'],
  '/param': ['application/json;v=1.0'],
  '/suffix': ['application/vnd.api+json'],
  '/mixed': ['text/plain', 'application/problem+json', 'application/ld+json'],
  '/text': ['text/plain'],
  '/wild': ['*/*'],
  '/range': ['application/*'],
  '/rangeAndText': ['*/*', 'text/plain'],
  '/wildAfterText': ['text/plain', '*/*; q=0.8'],
  '/wildAndJson': ['*/*', 'application/json;v=1.0'],
  '/forms': ['multipart/form-data', 'application/octet-stream'],
  '/wildText': ['*/*'],
  '/wildBinary': ['*/*']
}

const toDocument = (openapi: string) => {
  const paths = Object.fromEntries(
    Object.entries(cases).map(([path, mediaTypes]) => {
      const scalar = scalarSchemas[path]
      const content = scalar ? { '*/*': { schema: scalar } } : toContent(mediaTypes)
      return [
        path,
        {
          get: { responses: { '200': { description: 'ok', content } } },
          post: {
            requestBody: { content },
            responses: { '204': { description: 'none' } }
          }
        }
      ]
    })
  )

  return toDocumentObject(
    {
      openapi,
      info: { title: 't', version: '0' },
      paths: {
        ...paths,
        '/params': {
          get: {
            parameters: [
              {
                name: 'one',
                in: 'query',
                content: toContent(['application/json;v=1.0'])
              },
              {
                name: 'two',
                in: 'query',
                content: toContent(['text/plain', 'application/vnd.filter+json'])
              }
            ],
            responses: {
              '200': {
                description: 'ok',
                headers: {
                  'X-Json': {
                    content: toContent(['application/vnd.meta+json'])
                  },
                  'X-Text': { content: toContent(['text/plain']) },
                  'X-Two': { content: toContent(['text/plain', 'text/csv']) },
                  'X-Wild': { content: toContent(['*/*']) }
                }
              }
            }
          }
        }
      },
      ...(openapi === '3.0.3'
        ? {}
        : {
            webhooks: {
              pinged: {
                post: {
                  requestBody: {
                    content: toContent(['application/cloudevents+json'])
                  },
                  responses: { '200': { description: 'ok' } }
                }
              }
            }
          })
    },
    `${openapi} document`
  )
}

const parse = (openapi: string) => {
  const context = new ParseContext({
    input: { type: 'oas', value: toDocument(openapi) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')
  return { document: result.value, issues: context.issues }
}

/** The single property name of a marked schema: the media type it came from. */
const markOf = (schema: OasSchema | OasRef<'schema'> | undefined): string | undefined => {
  if (!schema || schema.isRef() || schema.type !== 'object') {
    return undefined
  }
  return Object.keys(schema.properties ?? {})[0]
}

const toOperation = (document: OasDocument, method: string, path: string): OasOperation => {
  const operation = document.operations.find(op => op.method === method && op.path === path)
  assert(operation, `${method} ${path}`)
  return operation
}

/** A body read from `*\/*` is sent and expected as `application/json`. */
const toContentType = (mediaType: string | undefined): string | undefined =>
  mediaType === undefined ? undefined : isAnyMediaType(mediaType) ? 'application/json' : mediaType

const expectedPick: Record<string, string | undefined> = {
  '/exact': 'application/json',
  '/param': 'application/json;v=1.0',
  '/suffix': 'application/vnd.api+json',
  '/mixed': 'application/problem+json',
  '/text': undefined,
  // `*/*` is read after the JSON-like keys, never before them.
  '/wild': '*/*',
  '/range': undefined,
  '/rangeAndText': '*/*',
  '/wildAfterText': '*/*; q=0.8',
  '/wildAndJson': 'application/json;v=1.0',
  '/forms': undefined,
  // A scalar under `*/*` is a text body or a file, not JSON.
  '/wildText': undefined,
  '/wildBinary': undefined
}

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} - OasResponse.toSchema() picks the JSON media type`, () => {
    const { document } = parse(openapi)
    for (const [path, expected] of Object.entries(expectedPick)) {
      const response = toOperation(document, 'get', path).toSuccessResponse()?.resolve()
      assert(response, path)
      assertEquals(markOf(response.toSchema()), expected, path)
      assertEquals(response.toJsonContent()?.mediaType, expected, path)
      assertEquals(response.toJsonContent()?.contentType, toContentType(expected), path)
      assertEquals(markOf(response.toJsonContent()?.schema), expected, path)
    }
  })

  Deno.test(`${openapi} - OasRequestBody.toSchema() and toRequestBody pick the JSON media type`, () => {
    const { document } = parse(openapi)
    for (const [path, expected] of Object.entries(expectedPick)) {
      const operation = toOperation(document, 'post', path)
      const requestBody = operation.requestBody?.resolve()
      assert(requestBody, path)
      assertEquals(markOf(requestBody.toSchema()), expected, path)
      assertEquals(requestBody.toJsonContent()?.mediaType, expected, path)
      assertEquals(markOf(operation.toRequestBody(({ schema }) => schema)), expected, path)
      assertEquals(
        operation.toRequestBody(({ mediaType, contentType }) => ({ mediaType, contentType })),
        expected === undefined
          ? undefined
          : { mediaType: expected, contentType: toContentType(expected) },
        path
      )
    }
  })

  Deno.test(`${openapi} - an explicit media type is an exact lookup`, () => {
    const { document } = parse(openapi)
    const text = toOperation(document, 'get', '/text').toSuccessResponse()?.resolve()
    assertEquals(markOf(text?.toSchema('text/plain')), 'text/plain')

    // No normalization of the key when the caller names one.
    const param = toOperation(document, 'get', '/param').toSuccessResponse()?.resolve()
    assertEquals(param?.toSchema('application/json'), undefined)
    assertEquals(markOf(param?.toSchema('application/json;v=1.0')), 'application/json;v=1.0')

    const wild = toOperation(document, 'post', '/wild')
    assertEquals(markOf(wild.toRequestBody(({ schema }) => schema, '*/*')), '*/*')
    assertEquals(
      toOperation(document, 'post', '/text').toRequestBody(
        ({ mediaType, contentType }) => ({ mediaType, contentType }),
        'text/plain'
      ),
      { mediaType: 'text/plain', contentType: 'text/plain' }
    )
  })

  Deno.test(`${openapi} - OasOperation.traverse reads the JSON media type`, () => {
    const { document } = parse(openapi)
    assertEquals(
      markOf(toOperation(document, 'get', '/suffix').traverse(['SuccessResponse'])),
      'application/vnd.api+json'
    )
    assertEquals(
      markOf(toOperation(document, 'post', '/mixed').traverse(['RequestBody'])),
      'application/problem+json'
    )
    assertEquals(markOf(toOperation(document, 'get', '/wild').traverse(['SuccessResponse'])), '*/*')
    assertThrows(
      () => toOperation(document, 'get', '/range').traverse(['SuccessResponse']),
      Error,
      'has no success response schema for a JSON media type'
    )
    assertThrows(
      () => toOperation(document, 'get', '/text').traverse(['SuccessResponse']),
      Error,
      'has no success response schema for a JSON media type'
    )
    assertThrows(
      () =>
        toOperation(document, 'get', '/suffix').traverse(['SuccessResponse'], 'application/json'),
      Error,
      'for media type "application/json"'
    )
  })

  Deno.test(`${openapi} - OasParameter and OasHeader toSchema() pick the JSON media type`, () => {
    const { document } = parse(openapi)
    const operation = toOperation(document, 'get', '/params')
    const [one, two] = operation.toParams()
    assertEquals(markOf(one?.toSchema()), 'application/json;v=1.0')
    assertEquals(markOf(two?.toSchema()), 'application/vnd.filter+json')
    assertEquals(markOf(two?.toSchema('text/plain')), 'text/plain')

    const headers = operation.toSuccessResponse()?.resolve().headers
    const json = headers?.['X-Json']?.resolve()
    const text = headers?.['X-Text']?.resolve()
    assertEquals(markOf(json?.toSchema()), 'application/vnd.meta+json')
    // Header `content` has exactly one entry, so it is read whatever its type.
    assertEquals(markOf(text?.toSchema()), 'text/plain')
    assertThrows(
      () => headers?.['X-Two']?.resolve().toSchema(),
      Error,
      'Schema not found for a JSON media type'
    )
    assertThrows(
      () => headers?.['X-Two']?.resolve().toSchema('application/json'),
      Error,
      'Schema not found for media type "application/json"'
    )
    assertEquals(markOf(headers?.['X-Wild']?.resolve().toSchema()), '*/*')
    assertEquals(markOf(text?.toSchema('text/plain')), 'text/plain')
  })

  Deno.test(`${openapi} - one media type issue per body without a JSON media type`, () => {
    const { issues } = parse(openapi)
    const mediaTypeIssues = issues
      .filter(issue => issue.type === 'WILDCARD_MEDIA_TYPE' || issue.type === 'NO_JSON_MEDIA_TYPE')
      .map(({ level, type, location }) => ({ level, type, location }))
      .sort((a, b) => a.location.localeCompare(b.location))

    // A JSON-like key (`/wildAndJson`) or only specific types (`/text`,
    // `/forms`) log nothing. A body read from `*/*` is the warning. A range no
    // lookup reads (`application/*`, a scalar under `*/*`) is the debug issue.
    assertEquals(
      mediaTypeIssues,
      [
        ...['/range', '/wildBinary', '/wildText'].flatMap(path => [
          {
            level: 'debug',
            type: 'NO_JSON_MEDIA_TYPE',
            location: `TEST:paths:${path}:get:responses:200:content`
          },
          {
            level: 'debug',
            type: 'NO_JSON_MEDIA_TYPE',
            location: `TEST:paths:${path}:post:requestBody:content`
          }
        ]),
        ...['/rangeAndText', '/wild', '/wildAfterText'].flatMap(path => [
          {
            level: 'warning',
            type: 'WILDCARD_MEDIA_TYPE',
            location: `TEST:paths:${path}:get:responses:200:content`
          },
          {
            level: 'warning',
            type: 'WILDCARD_MEDIA_TYPE',
            location: `TEST:paths:${path}:post:requestBody:content`
          }
        ])
      ].sort((a, b) => a.location.localeCompare(b.location))
    )
  })
}

for (const openapi of ['3.1.0', '3.2.0']) {
  Deno.test(`${openapi} - OasWebhook.toPayloadSchema() picks the JSON media type`, () => {
    const { document } = parse(openapi)
    const webhook = document.webhooks[0]
    assert(webhook)
    assertEquals(markOf(webhook.toPayloadSchema()), 'application/cloudevents+json')
    assertEquals(webhook.toPayloadSchema('application/json'), undefined)
  })
}

Deno.test('exact application/json documents read the same schema as before, with no media type issue', () => {
  // Before this change every lookup was content['application/json']. A document
  // that already uses that key must read the same objects and log nothing new.
  for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
    const context = new ParseContext({
      input: {
        type: 'oas',
        value: toDocumentObject(
          {
            openapi,
            info: { title: 't', version: '0' },
            paths: {
              '/pets': {
                post: {
                  requestBody: {
                    content: toContent(['application/json', 'application/xml'])
                  },
                  responses: {
                    '200': {
                      description: 'ok',
                      content: toContent(['application/json'])
                    }
                  }
                }
              }
            }
          },
          openapi
        )
      },
      logger: new log.Logger('test', 'ERROR'),
      silent: true
    })
    const result = context.parse(new StackTrail(['TEST']))
    assert(result.type === 'oas')
    const operation = toOperation(result.value, 'post', '/pets')
    const response = operation.toSuccessResponse()?.resolve()
    const requestBody = operation.requestBody?.resolve()

    assert(response?.toSchema() === response?.content?.['application/json']?.schema)
    assert(requestBody?.toSchema() === requestBody?.content['application/json']?.schema)
    assertEquals(
      context.issues.filter(
        issue => issue.type === 'WILDCARD_MEDIA_TYPE' || issue.type === 'NO_JSON_MEDIA_TYPE'
      ),
      []
    )
  }
})
