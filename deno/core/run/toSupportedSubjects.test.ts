import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { toSupportedSubjects } from './toSupportedSubjects.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
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

const generators = <E = undefined>(): GeneratorsMapContainer<E> =>
  ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'gets-only': toOasOperationEntry({
      id: 'gets-only',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      isSupported: ({ operation }) => operation.method === 'get',
      transform: () => {},
    }),
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    'all-ops': toOasOperationEntry({
      id: 'all-ops',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: () => {},
    }),
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    models: toModelEntry({
      id: 'models',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: () => {},
    }),
  })

Deno.test('toSupportedSubjects', async (t) => {
  const result = toSupportedSubjects({
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

  await t.step('an operation generator reports only the operations its isSupported accepts', () => {
    const gen = result.subjects['gets-only']
    assertEquals(gen.type, 'oasOperation')
    if (gen.type === 'oasOperation') {
      assertEquals(
        gen.operations.sort((a, b) => a.path.localeCompare(b.path)),
        [
          { path: '/owners', method: 'get' },
          { path: '/pets', method: 'get' },
        ],
      )
    }
  })

  await t.step('an operation generator without isSupported reports every operation', () => {
    const gen = result.subjects['all-ops']
    if (gen.type === 'oasOperation') {
      assertEquals(gen.operations.length, 3)
    }
  })

  await t.step('a model generator reports every model', () => {
    const gen = result.subjects['models']
    assertEquals(gen.type, 'model')
    if (gen.type === 'model') {
      assertEquals(gen.models.toSorted(), ['Owner', 'Pet'])
    }
  })
})
