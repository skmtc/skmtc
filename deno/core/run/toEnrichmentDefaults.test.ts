import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'
import { toEnrichmentDefaults } from './toEnrichmentDefaults.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'

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
