import { assertEquals, assertObjectMatch } from '@std/assert'
import { toDocumentInput } from '@/lib/document-input.ts'

Deno.test('toDocumentInput - graphql posts the raw SDL unparsed', async () => {
  // The whole reason GQL is routed differently: a pre-parsed document
  // would carry class instances / OasRef back-refs that don't survive
  // structured clone, so the SDL must cross the worker boundary as the
  // verbatim string and be parsed worker-side.
  const sdl = 'type Query { hello: String }'
  const result = await toDocumentInput(sdl, 'graphql')

  assertEquals(result.type, 'gql')
  if (result.type !== 'gql') throw new Error('expected gql document')
  // Strictly the same string — no parse, no normalization.
  assertEquals(result.value, sdl)
})

Deno.test('toDocumentInput - OAS 3.0 JSON passes through as an oas document', async () => {
  const result = await toDocumentInput(
    JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Modern API', version: '1.0.0' },
      paths: {}
    }),
    'json'
  )

  assertEquals(result.type, 'oas')
  if (result.type !== 'oas') throw new Error('expected oas document')
  assertEquals(result.value.openapi, '3.0.0')
  assertEquals(result.value.info.title, 'Modern API')
})

Deno.test('toDocumentInput - Swagger 2.0 JSON is converted to OpenAPI 3.0 host-side', async () => {
  // describe/generate run @skmtc/convert on the host so the worker only
  // ever sees OAS 3.x. This locks in that a Swagger 2.0 source is
  // upgraded before it crosses the boundary, not left for the worker.
  const result = await toDocumentInput(
    JSON.stringify({
      swagger: '2.0',
      info: { title: 'Legacy API', version: '1.0.0' },
      paths: {}
    }),
    'json'
  )

  assertEquals(result.type, 'oas')
  if (result.type !== 'oas') throw new Error('expected oas document')
  assertEquals(result.value.openapi, '3.0.0')
  assertEquals(result.value.info.title, 'Legacy API')
  // The swagger discriminant is gone after the upgrade.
  assertEquals('swagger' in result.value, false)
})

Deno.test('toDocumentInput - YAML OAS is parsed into an oas document', async () => {
  const result = await toDocumentInput(
    ['openapi: 3.0.0', 'info:', '  title: Yaml API', '  version: 1.0.0', 'paths: {}'].join('\n'),
    'yaml'
  )

  assertEquals(result.type, 'oas')
  if (result.type !== 'oas') throw new Error('expected oas document')
  assertEquals(result.value.openapi, '3.0.0')
  assertObjectMatch(result.value.info, { title: 'Yaml API', version: '1.0.0' })
})
