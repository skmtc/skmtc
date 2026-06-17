import { assertEquals, assertThrows } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

// The dialect split lives in ParseContext.parse(): it reads
// `documentObject.openapi` exactly once and routes to the v3-0 or v3-1
// parser tree, throwing on anything else. These tests pin that routing.

const parse = (documentObject: Record<string, unknown>) => {
  const context = new ParseContext({
    input: { type: 'oas', value: documentObject as unknown as OpenAPIV3.Document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  return context.parse(new StackTrail(['TEST']))
}

Deno.test('ParseContext dialect split - a 3.0 document routes to the v3-0 parser', () => {
  const result = parse({
    openapi: '3.0.3',
    info: { title: 't', version: '0' },
    paths: {}
  })
  assertEquals(result.type, 'oas')
})

Deno.test('ParseContext dialect split - a webhooks-only 3.1 document routes to v3-1 and parses (no paths)', () => {
  // A webhooks-only 3.1 document (no `paths` — legal in 3.1) parses through
  // the v3-1 tree end-to-end: webhooks parsed, operations empty, no throw.
  const result = parse({
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    webhooks: {
      newPet: {
        post: { responses: { '200': { description: 'ok' } } }
      }
    }
  })
  assertEquals(result.type, 'oas')
  if (result.type === 'oas') {
    assertEquals(result.value.webhooks.length, 1)
    assertEquals(result.value.operations.length, 0)
  }
})

Deno.test('ParseContext dialect split - a rich 3.1 document parses natively end-to-end', () => {
  // The e2e gate for retiring down-convert: a 3.1 document exercising the
  // native idioms (type-array nullable, const, multi-type union, numeric
  // exclusive bounds) plus a path operation and a webhook, parsed through the
  // full ParseContext.parse path with NO down-convert and NO error-level
  // issues.
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: {
        openapi: '3.1.0',
        info: { title: 't', version: '0' },
        paths: {
          '/pets': { get: { responses: { '200': { description: 'ok' } } } }
        },
        webhooks: {
          newPet: { post: { responses: { '200': { description: 'ok' } } } }
        },
        components: {
          schemas: {
            MaybeName: { type: ['string', 'null'] },
            Status: { type: 'string', const: 'active' },
            StringOrInt: { type: ['string', 'integer'] },
            Positive: { type: 'integer', exclusiveMinimum: 0 }
          }
        }
      } as unknown as OpenAPIV3.Document
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  const result = context.parse(new StackTrail(['TEST']))

  assertEquals(result.type, 'oas')
  // Every 3.1 idiom handled natively — no error-level parse issues.
  assertEquals(context.issues.filter(issue => issue.level === 'error').length, 0)
  if (result.type === 'oas') {
    assertEquals(result.value.operations.length, 1)
    assertEquals(result.value.webhooks.length, 1)
  }
})

Deno.test('ParseContext dialect split - an unknown OpenAPI version fails loud', () => {
  // No silent default: a 4.0 / 3.2 / missing version must throw, not be
  // quietly parsed as 3.0.
  assertThrows(
    () => parse({ openapi: '4.0.0', info: { title: 't', version: '0' }, paths: {} }),
    Error,
    'Unsupported OpenAPI version: 4.0.0'
  )
})
