import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { toSupportedSubjects } from './toSupportedSubjects.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { typescript } from '@skmtc/lang-typescript'

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
    'gets-only': toOasOperationEntry({
      lang: typescript,
      id: 'gets-only',
      isSupported: ({ operation }) => operation.method === 'get',
      transform: ({ acc }) => acc,
    }),
    'all-ops': toOasOperationEntry({
      lang: typescript,
      id: 'all-ops',
      transform: ({ acc }) => acc,
    }),
    models: toModelEntry({
      lang: typescript,
      id: 'models',
      transform: ({ acc }) => acc,
    }),
  }) as GeneratorsMapContainer<E>

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
