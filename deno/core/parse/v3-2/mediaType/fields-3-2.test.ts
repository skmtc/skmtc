import { assert, assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'
import {
  toMediaTypeItemsV3,
  type MediaTypeObjectV32
} from '@/parse/v3-2/mediaType/toMediaTypeItemV3.ts'

const parseContent = (content: Record<string, MediaTypeObjectV32 | OpenAPIV3.ReferenceObject>) => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: toDocumentObject(
        {
          openapi: '3.2.0',
          info: { title: 't', version: '0' },
          paths: {},
          components: {
            schemas: { Event: { type: 'object' } },
            mediaTypes: {
              Events: { itemSchema: { $ref: '#/components/schemas/Event' } },
              'Lines/v1': { itemSchema: { type: 'string' } },
              Alias: { $ref: '#/components/mediaTypes/Events' },
              AliasOfAlias: { $ref: '#/components/mediaTypes/Alias' },
              LoopA: { $ref: '#/components/mediaTypes/LoopB' },
              LoopB: { $ref: '#/components/mediaTypes/LoopA' }
            }
          }
        },
        'media types document'
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = toMediaTypeItemsV3({ content, stackTrail: new StackTrail(['TEST']), context })

  return {
    result,
    issues: context.issues.map(({ level, type, location }) => ({ level, type, location }))
  }
}

Deno.test('v3-2 media type - itemSchema is parsed as a schema or a ref', () => {
  const { result, issues } = parseContent({
    'text/event-stream': { itemSchema: { type: 'string' } },
    'application/jsonl': { itemSchema: { $ref: '#/components/schemas/Event' } }
  })

  assertEquals(issues, [])
  assertEquals(result['text/event-stream'].itemSchema?.type, 'string')
  assertEquals(result['text/event-stream'].schema, undefined)
  const itemSchema = result['application/jsonl'].itemSchema
  assert(itemSchema?.isRef())
  assertEquals(itemSchema.$ref, '#/components/schemas/Event')
})

Deno.test('v3-2 media type - a content $ref is replaced by its components.mediaTypes entry', () => {
  const { result, issues } = parseContent({
    'text/event-stream': { $ref: '#/components/mediaTypes/Events' },
    'application/jsonl': { $ref: '#/components/mediaTypes/Lines~1v1' }
  })

  assertEquals(issues, [])
  assertEquals(result['text/event-stream'].mediaType, 'text/event-stream')
  const itemSchema = result['text/event-stream'].itemSchema
  assert(itemSchema?.isRef())
  assertEquals(itemSchema.$ref, '#/components/schemas/Event')
  assertEquals(result['application/jsonl'].itemSchema?.type, 'string')
})

Deno.test('v3-2 media type - a components.mediaTypes entry that is a $ref is followed', () => {
  const { result, issues } = parseContent({
    'text/event-stream': { $ref: '#/components/mediaTypes/Alias' },
    'application/jsonl': { $ref: '#/components/mediaTypes/AliasOfAlias' }
  })

  assertEquals(issues, [])
  for (const mediaType of ['text/event-stream', 'application/jsonl']) {
    const itemSchema = result[mediaType]?.itemSchema
    assert(itemSchema?.isRef())
    assertEquals(itemSchema.$ref, '#/components/schemas/Event')
  }
})

Deno.test('v3-2 media type - an unresolvable content $ref drops only that entry', () => {
  const { result, issues } = parseContent({
    'application/json': { schema: { type: 'string' } },
    'text/event-stream': { $ref: '#/components/mediaTypes/Missing' }
  })

  assertEquals(Object.keys(result), ['application/json'])
  assertEquals(issues, [
    { level: 'error', type: 'INVALID_DEPENDENCY_REF', location: 'TEST:text/event-stream' }
  ])
})

Deno.test('v3-2 media type - a $ref outside components.mediaTypes or into a cycle is unresolvable', () => {
  // Each pointer ends in `Events`, which `components.mediaTypes` holds.
  const { result, issues } = parseContent({
    'application/json': { $ref: '#/components/schemas/Events' },
    'application/xml': { $ref: '/components/mediaTypes/Events' },
    'application/yaml': { $ref: '#/components/mediaTypes/Events/itemSchema' },
    'text/event-stream': { $ref: '#/components/mediaTypes/LoopA' }
  })

  assertEquals(result, {})
  assertEquals(issues, [
    { level: 'error', type: 'INVALID_DEPENDENCY_REF', location: 'TEST:application/json' },
    { level: 'error', type: 'INVALID_DEPENDENCY_REF', location: 'TEST:application/xml' },
    { level: 'error', type: 'INVALID_DEPENDENCY_REF', location: 'TEST:application/yaml' },
    { level: 'error', type: 'INVALID_DEPENDENCY_REF', location: 'TEST:text/event-stream' }
  ])
})

Deno.test('v3-2 media type - prefixEncoding and itemEncoding are stored as given', () => {
  const { result, issues } = parseContent({
    'multipart/mixed': {
      schema: { type: 'array', items: { type: 'string' } },
      prefixEncoding: [{ contentType: 'text/plain' }],
      itemEncoding: { contentType: 'application/octet-stream' }
    }
  })

  assertEquals(issues, [])
  assertEquals(result['multipart/mixed'].prefixEncoding, [{ contentType: 'text/plain' }])
  assertEquals(result['multipart/mixed'].itemEncoding, { contentType: 'application/octet-stream' })
})

Deno.test('v3-2 media type - encoding with prefixEncoding or itemEncoding warns', () => {
  const encoding = { file: { contentType: 'image/png' } }
  const { result, issues } = parseContent({
    'multipart/mixed': { encoding, prefixEncoding: [{ contentType: 'text/plain' }] },
    'multipart/related': { encoding, itemEncoding: { contentType: 'text/plain' } },
    'multipart/form-data': { encoding }
  })

  assertEquals(issues, [
    { level: 'warning', type: 'UNEXPECTED_PROPERTY', location: 'TEST:multipart/mixed:encoding' },
    { level: 'warning', type: 'UNEXPECTED_PROPERTY', location: 'TEST:multipart/related:encoding' }
  ])
  // The warning drops nothing.
  assertEquals(result['multipart/mixed'].encoding, encoding)
  assertEquals(result['multipart/related'].encoding, encoding)
})
