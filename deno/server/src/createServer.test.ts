import { assertEquals, assertExists } from 'jsr:@std/assert@^1.0.10'
import * as v from 'valibot'
import type { GeneratorsMapContainer, ModelConfig, TransformModelArgs } from '@skmtc/core'
import { createServer } from './createServer.ts'

/**
 * Integration tests for `createServer`.
 *
 * Uses an empty generator map — the goal is to verify the request
 * routing and `protocol` dispatch, not the generator output. Both the
 * `'oas'` and `'gql'` branches should accept their respective input
 * shapes and return a 200 with `artifacts` + `manifest` in the body.
 */

const minimalOas = {
  openapi: '3.0.0',
  info: { title: 'Test', version: '1.0.0' },
  paths: {}
}

const minimalSdl = /* GraphQL */ `
  type Query {
    ping: Boolean
  }
`

const mkApp = () =>
  createServer({
    toGeneratorConfigMap: () => ({})
  })

Deno.test('POST /artifacts - rejects body with no protocol', async () => {
  const app = mkApp()
  const res = await app.request('/artifacts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ schema: JSON.stringify(minimalOas) })
  })

  // No `protocol` field → can't pick a variant in the discriminated
  // union, so the body schema must reject.
  assertEquals(res.status >= 400, true)
})

Deno.test('POST /artifacts - accepts protocol=oas with OpenAPI body', async () => {
  const app = mkApp()
  const res = await app.request('/artifacts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      protocol: 'oas',
      schema: JSON.stringify(minimalOas)
    })
  })

  assertEquals(res.status, 200)
  const body = await res.json()
  assertExists(body.artifacts)
  assertExists(body.manifest)
  // Attribution is always enabled with a post-pass, so both fields are
  // present (empty here — the empty generator map emits no files).
  assertEquals(Array.isArray(body.generationMap), true)
  assertExists(body.sidecars)
})

Deno.test('POST /artifacts - accepts protocol=gql with GraphQL SDL', async () => {
  const app = mkApp()
  const res = await app.request('/artifacts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      protocol: 'gql',
      schema: minimalSdl
    })
  })

  assertEquals(res.status, 200)
  const body = await res.json()
  assertExists(body.artifacts)
  assertExists(body.manifest)
})

Deno.test('POST /artifacts - rejects body with invalid protocol', async () => {
  const app = mkApp()
  const res = await app.request('/artifacts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ schema: 'whatever', protocol: 'soap' })
  })

  // Variant schema rejection bubbles through Hono as a thrown error.
  // Either way we verify an unknown protocol doesn't quietly succeed.
  assertEquals(res.status >= 400, true)
})

Deno.test('GET /generators - lists configured generator IDs', async () => {
  const modelGen: ModelConfig = {
    id: 'modelGen',
    type: 'model',
    transform(_args: TransformModelArgs): void {}
  }
  const app = createServer({
    toGeneratorConfigMap: (() => ({ modelGen })) as <
      EnrichmentType = undefined,
    >() => GeneratorsMapContainer<EnrichmentType>,
  })

  const res = await app.request('/generators')
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.generators, ['modelGen'])
})

Deno.test('POST /descriptors - returns one descriptor per generator', async () => {
  type Enrichment = { coerce?: boolean }
  const modelGen: ModelConfig<Enrichment> = {
    id: 'modelGen',
    type: 'model',
    toEnrichmentSchema: () => v.object({ coerce: v.optional(v.boolean()) }),
    transform(_args: TransformModelArgs): void {}
  }
  const app = createServer({
    toGeneratorConfigMap: (() => ({ modelGen })) as <
      EnrichmentType = undefined,
    >() => GeneratorsMapContainer<EnrichmentType>,
  })

  const res = await app.request('/descriptors', { method: 'POST' })
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.descriptors.length, 1)
  assertEquals(body.descriptors[0].generator, 'modelGen')
  assertEquals(body.descriptors[0].appliesTo, 'model')
  // The `coerce` boolean maps to a `toggle` field.
  assertEquals(body.descriptors[0].fields[0].key, 'coerce')
  assertEquals(body.descriptors[0].fields[0].kind, 'toggle')
})

Deno.test('POST /to-v3-json - converts OpenAPI source to v3 JSON', async () => {
  const app = mkApp()
  const res = await app.request('/to-v3-json', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ schema: JSON.stringify(minimalOas) })
  })

  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.schema.openapi, '3.0.0')
})
