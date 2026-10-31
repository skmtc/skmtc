import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toWebhookEntry } from '@/dsl/webhook/toWebhookEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toGqlOperationEntry } from '@/dsl/operation/gql/toGqlOperationEntry.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// `manifest.results` nests one level per StackTrail frame:
// generate[gen][path][method]['variant'][variant] and its webhook,
// GraphQL and model analogues.

const variantEnrichmentSchema = v.object({
  subject: v.optional(v.unknown()),
  generator: v.optional(v.unknown()),
  stack: v.optional(v.unknown())
})

const ok = { responses: { '200': { description: 'ok' } } }

const document = toDocumentObject(
  {
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    paths: {
      '/pets': { get: ok },
      '/pets/{id}:archive': {
        post: {
          ...ok,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }]
        }
      }
    },
    webhooks: { newPet: { post: ok } },
    components: { schemas: { User: { type: 'string' } } }
  },
  'results shape document'
)

const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
  // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
  ops: toOasOperationEntry({
    id: 'ops',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: () => {}
  }),
  // @ts-expect-error see above
  hooks: toWebhookEntry({
    id: 'hooks',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: () => {}
  }),
  // @ts-expect-error see above
  models: toModelEntry({
    id: 'models',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: () => {}
  })
})

Deno.test('toArtifacts - results nest one level per frame for operations, webhooks and models', () => {
  const result = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: document },
    settings: {
      enrichments: {
        ops: { '/pets': { get: { main: {}, admin: {} } } },
        hooks: { newPet: { post: { main: {}, admin: {} } } },
        models: { User: { main: {}, admin: {} } }
      }
    },
    toGeneratorConfigMap: generators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['TEST'])
  })

  assertEquals(result.manifest.results, {
    TEST: {
      generate: {
        ops: {
          '/pets': { get: { variant: { main: 'success', admin: 'success' } } },
          '/pets/{id}:archive': { post: { variant: { main: 'success' } } }
        },
        hooks: {
          webhook: { newPet: { post: { variant: { main: 'success', admin: 'success' } } } }
        },
        models: {
          User: { variant: { main: 'success', admin: 'success' } }
        }
      }
    }
  })

  assertEquals(JSON.stringify(result.manifest.results).includes('%3A'), false)
})

Deno.test('toArtifacts - results nest rootKind, fieldName and variant for GraphQL operations', () => {
  const sdl = /* GraphQL */ `
    type Query {
      getUser: String
      constructor: String
      toString: String
    }
  `

  const gqlGenerators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error see above
    gql: toGqlOperationEntry({
      id: 'gql',
      toEnrichmentSchema: () => variantEnrichmentSchema,
      transform: ({ operation }) => {
        if (operation.fieldName === 'constructor') {
          throw new Error('constructor fails')
        }
      }
    })
  })

  const result = toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'gql', value: sdl },
    settings: { enrichments: { gql: { query: { getUser: { main: {}, admin: {} } } } } },
    toGeneratorConfigMap: gqlGenerators,
    startAt: Date.now(),
    silent: true,
    stackTrail: new StackTrail(['TEST'])
  })

  // Parsed from JSON: TypeScript widens object-literal values under the
  // keys `constructor` and `toString`. ResultsHandler also records each
  // logged error at `SKIPPED`.
  assertEquals(
    JSON.parse(JSON.stringify(result.manifest.results)),
    JSON.parse(`{
      "TEST": { "generate": { "gql": { "query": {
        "getUser": { "variant": { "main": "success", "admin": "success" } },
        "constructor": { "variant": { "main": "error" } },
        "toString": { "variant": { "main": "success" } }
      } } } },
      "SKIPPED": "error"
    }`)
  )

  assertEquals(JSON.stringify(result.manifest.results).includes('%3A'), false)
})
