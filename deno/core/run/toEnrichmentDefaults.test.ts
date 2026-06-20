import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'
import { toEnrichmentDefaults } from './toEnrichmentDefaults.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toWebhookEntry } from '@/dsl/webhook/toWebhookEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'

const doc: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {
    '/pets': {
      get: { responses: { '200': { description: 'ok' } } },
      post: { responses: { '200': { description: 'ok' } } },
    },
    '/owners': {
      get: { responses: { '200': { description: 'ok' } } },
    },
  },
  components: { schemas: { Pet: { type: 'object' }, Owner: { type: 'object' } } },
}

const opSchema = v.object({
  subject: v.optional(v.object({ title: v.optional(v.string()) })),
  generator: v.undefined(),
  stack: v.undefined(),
})
type OpEnrichment = v.InferOutput<typeof opSchema>

const modelSchema = v.object({
  subject: v.optional(v.object({ note: v.optional(v.string()) })),
  generator: v.undefined(),
  stack: v.undefined(),
})
type ModelEnrichment = v.InferOutput<typeof modelSchema>

const generators = <E = undefined>(): GeneratorsMapContainer<E> =>
  ({
    // A POST-only form generator that seeds a title from the operation.
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    forms: toOasOperationEntry<OpEnrichment>({
      id: 'forms',
      toEnrichmentSchema: () => opSchema,
      isSupported: ({ operation }) => operation.method === 'post',
      transform: () => {},
      toEnrichmentDefaults: ({ operation }) => ({
        subject: { title: `Form for ${operation.method} ${operation.path}` },
        generator: undefined,
        stack: undefined,
      }),
    }),
    // Advertises no defaults — must be omitted from the result entirely.
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'no-defaults': toOasOperationEntry({
      id: 'no-defaults',
      toEnrichmentSchema: () => opSchema,
      transform: () => {},
    }),
    // Has the hook but returns `undefined` for every operation — also omitted.
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'empty-defaults': toOasOperationEntry<OpEnrichment>({
      id: 'empty-defaults',
      toEnrichmentSchema: () => opSchema,
      transform: () => {},
      toEnrichmentDefaults: () => undefined,
    }),
    // A model generator seeds every model.
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    models: toModelEntry<ModelEnrichment>({
      id: 'models',
      toEnrichmentSchema: () => modelSchema,
      transform: () => {},
      toEnrichmentDefaults: ({ refName }) => ({
        subject: { note: `model ${refName}` },
        generator: undefined,
        stack: undefined,
      }),
    }),
    // A model generator that supports only `Pet` — seeds only its
    // isSupported subjects.
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'pet-only-models': toModelEntry<ModelEnrichment>({
      id: 'pet-only-models',
      toEnrichmentSchema: () => modelSchema,
      isSupported: ({ refName }) => refName === 'Pet',
      transform: () => {},
      toEnrichmentDefaults: ({ refName }) => ({
        subject: { note: `model ${refName}` },
        generator: undefined,
        stack: undefined,
      }),
    }),
  })

Deno.test('toEnrichmentDefaults', async (t) => {
  const result = toEnrichmentDefaults({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: doc },
    settings: undefined,
    toGeneratorConfigMap: generators,
    stackTrail: new StackTrail(['TEST']),
    silent: true,
  })

  await t.step('parses without issues', () => {
    assertEquals(result.parseIssues, [])
  })

  await t.step('an operation generator seeds only its isSupported subjects, keyed [path][method].main', () => {
    assertEquals(result.enrichmentDefaults['forms'], {
      '/pets': { post: { main: { title: 'Form for post /pets' } } },
    })
  })

  await t.step('a model generator seeds every model, keyed [refName].main', () => {
    assertEquals(result.enrichmentDefaults['models'], {
      Pet: { main: { note: 'model Pet' } },
      Owner: { main: { note: 'model Owner' } },
    })
  })

  await t.step('a model generator seeds only its isSupported subjects', () => {
    assertEquals(result.enrichmentDefaults['pet-only-models'], {
      Pet: { main: { note: 'model Pet' } },
    })
  })

  await t.step('a generator without toEnrichmentDefaults is omitted', () => {
    assertEquals('no-defaults' in result.enrichmentDefaults, false)
  })

  await t.step('a generator whose hook returns undefined is omitted', () => {
    assertEquals('empty-defaults' in result.enrichmentDefaults, false)
  })
})

const webhookSchema = v.object({
  subject: v.optional(v.object({ label: v.optional(v.string()) })),
  generator: v.undefined(),
  stack: v.undefined(),
})
type WebhookEnrichment = v.InferOutput<typeof webhookSchema>

// 3.1 webhooks riding the OAS input — the webhook arm seeds defaults keyed by
// `[name][method].main`, mirroring the operation arm with the webhook name in
// the `path` slot.
const webhookDoc: OpenAPIV3.Document & {
  webhooks?: Record<string, OpenAPIV3.PathItemObject>
} = {
  openapi: '3.0.3',
  info: { title: 'T', version: '1' },
  paths: {},
  webhooks: {
    newPet: { post: { responses: { '200': { description: 'ok' } } } },
    petUpdated: { put: { responses: { '200': { description: 'ok' } } } },
  },
}

const webhookGenerators = <E = undefined>(): GeneratorsMapContainer<E> =>
  ({
    // POST-only handler seeds a label from the webhook name.
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    handlers: toWebhookEntry<WebhookEnrichment>({
      id: 'handlers',
      toEnrichmentSchema: () => webhookSchema,
      isSupported: ({ webhook }) => webhook.method === 'post',
      transform: () => {},
      toEnrichmentDefaults: ({ webhook }) => ({
        subject: { label: `Handle ${webhook.name}` },
        generator: undefined,
        stack: undefined,
      }),
    }),
    // Advertises no defaults — must be omitted from the result entirely.
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'no-defaults-webhook': toWebhookEntry({
      id: 'no-defaults-webhook',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: () => {},
    }),
  })

Deno.test('toEnrichmentDefaults - webhook arm', async (t) => {
  const result = toEnrichmentDefaults({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: webhookDoc },
    settings: undefined,
    toGeneratorConfigMap: webhookGenerators,
    stackTrail: new StackTrail(['TEST']),
    silent: true,
  })

  await t.step('parses without issues', () => {
    assertEquals(result.parseIssues, [])
  })

  await t.step('a webhook generator seeds only its isSupported webhooks, keyed [name][method].main', () => {
    assertEquals(result.enrichmentDefaults['handlers'], {
      newPet: { post: { main: { label: 'Handle newPet' } } },
    })
  })

  await t.step('a webhook generator without toEnrichmentDefaults is omitted', () => {
    assertEquals('no-defaults-webhook' in result.enrichmentDefaults, false)
  })
})
