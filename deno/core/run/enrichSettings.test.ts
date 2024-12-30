import { enrichSettings } from './enrichSettings.ts'
import type { ClientGeneratorSettings } from '../types/Settings.ts'
import { assertEquals } from '@std/assert'

const mockSettingsPokemon = {
  generators: [
    {
      id: '@skmtc/tanstack-query-zod',
      operations: {
        '/api/v2/ability/': { get: { selected: false } },
        '/api/v2/ability/{id}/': { get: { selected: false } }
      }
    }
  ]
}

const mockEnrichmentsPokemon = {
  '@skmtc/tanstack-query-zod': {
    operations: {
      '/api/v2/ability/': {
        get: {
          enrichments: {
            isPaginated: true,
            pathToList: 'results'
          }
        }
      },
      '/api/v2/ability/{id}/': {
        get: {
          enrichments: {
            isPaginated: false,
            pathToList: null
          }
        }
      }
    }
  }
}

const expectedEnrichedSettings = [
  {
    id: '@skmtc/tanstack-query-zod',
    operations: {
      '/api/v2/ability/': {
        get: {
          selected: false,
          enrichments: { isPaginated: true, pathToList: 'results' }
        }
      },
      '/api/v2/ability/{id}/': {
        get: {
          selected: false,
          enrichments: { isPaginated: false, pathToList: null }
        }
      }
    }
  }
]

Deno.test('enrichSettings', () => {
  const result = enrichSettings({
    generatorSettings: mockSettingsPokemon.generators as ClientGeneratorSettings[],
    enrichments: mockEnrichmentsPokemon
  })

  console.log('RESULT', result)

  assertEquals(result, expectedEnrichedSettings)
})
