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

Deno.test('ParseContext dialect split - a 3.1 document routes to the v3-1 parser', () => {
  // A webhooks-bearing 3.1 document parses through the 3.1 tree. The two
  // trees are byte-identical until the native-3.1 divergence, so this pins
  // that the 3.1 branch is wired and reachable (webhooks parsed, isolated
  // from operations). `paths: {}` sidesteps the not-yet-optional-paths
  // handling, which the divergence addresses.
  const result = parse({
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    paths: {},
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

Deno.test('ParseContext dialect split - an unknown OpenAPI version fails loud', () => {
  // No silent default: a 4.0 / 3.2 / missing version must throw, not be
  // quietly parsed as 3.0.
  assertThrows(
    () => parse({ openapi: '4.0.0', info: { title: 't', version: '0' }, paths: {} }),
    Error,
    'Unsupported OpenAPI version: 4.0.0'
  )
})
